import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GrantService } from '../grant/grant.service';
import { signCompact } from '../common/jwt.util';
import { importJWK, jwtVerify } from 'jose';
import type { Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

type OwfMdocModule = typeof import('@owf/mdoc');
type MdocContext = import('@owf/mdoc').MdocContext;

const importOwfMdoc = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<OwfMdocModule>;

// ---------------------------------------------------------------------------
// OID4VCI Issuer — Pre-Authorized Code Flow
//
//  1. VerifierService.createCredentialOffer()  → stores preAuthCode, returns deep link
//  2. Wallet GETs   /issuer/offers/:preAuthCode → credential offer JSON
//  3. Wallet GETs   /issuer/.well-known/openid-credential-issuer → metadata
//  4. Wallet POSTs  /issuer/token  { grant_type, pre-authorized_code }
//                   → { access_token, c_nonce }
//  5. Wallet POSTs  /issuer/credential  Bearer <token> { proof: { jwt } }
//                   → { format: 'dc+sd-jwt', credential: <sd-jwt> }
// ---------------------------------------------------------------------------

const EAA_VCT = 'urn:eudi:eaa:infrastructure:access:1';

interface OfferState {
  grantId: string;
  pidSubject: string;
  createdAt: Date;
}

interface TokenState {
  grantId: string;
  pidSubject: string;
  cNonce: string;
  createdAt: Date;
  issuedConfigurations?: Set<string>; // track which credential_configuration_ids already issued for this token
}

interface AuthCodeState {
  // OAuth 2.0 authorization code flow (for ABA demo)
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope?: string;
  state?: string;
  clientJwk?: Record<string, unknown>; // from attestation
  createdAt: Date;
}

@Injectable()
export class IssuerService implements OnModuleInit {
  private readonly logger = new Logger(IssuerService.name);

  // In-memory stores (15-min TTL)
  private readonly pendingOffers = new Map<string, OfferState>();
  private readonly pendingTokens = new Map<string, TokenState>();
  private readonly pendingAuthCodes = new Map<string, AuthCodeState>();

  private signingKeyPem: string;
  private issuerCertDer: Buffer | null = null;  // DER bytes for x5chain in mDoc issuerAuth
  private baseUrl: string;
  private publicJwk: object;   // issuer public key for JWKS endpoint
  private mdocSchema?: any;    // loaded from catalog/credential-schema-mdoc.json

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly grantService: GrantService,
  ) {}

  onModuleInit() {
    this.baseUrl = this.config.get('PUBLIC_BASE_URL', 'http://localhost:3000');

    // Reuse RP signing key for issuer (same cert/key pair).
    // Set ISSUER_SIGNING_KEY_PATH for a dedicated issuer key.
    const keyPath = path.resolve(
      this.config.get(
        'ISSUER_SIGNING_KEY_PATH',
        this.config.get('RP_SIGNING_KEY_PATH', 'certs/rp-signing.key'),
      ),
    );
    this.signingKeyPem = fs.readFileSync(keyPath, 'utf8');

    // Load issuer certificate for x5chain in mDoc issuerAuth (ISO 18013-5 §9.1.2.2).
    const certCandidates = [
      this.config.get<string>('ISSUER_CERT_PATH'),
      this.config.get<string>('RP_ACCESS_CERT_PATH'),
      keyPath.replace(/\.key$/, '.crt'),
      'certs/access-certificate.crt',
    ].filter(Boolean) as string[];

    for (const candidate of certCandidates) {
      const certPath = path.resolve(candidate);
      try {
        const certPem = fs.readFileSync(certPath, 'utf8');
        const b64 = certPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
        this.issuerCertDer = Buffer.from(b64, 'base64');
        this.logger.log(`Issuer certificate loaded from ${certPath} (${this.issuerCertDer.length} bytes DER)`);
        break;
      } catch {
        // Try the next configured/default certificate path.
      }
    }
    if (!this.issuerCertDer) {
      this.logger.warn(`Issuer certificate not found in candidates [${certCandidates.join(', ')}] — mDoc issuance will fail`);
    }

    // Load mDoc schema from catalog if available
    try {
      const schemaPath = path.resolve('catalog/credential-schema-mdoc.json');
      const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
      this.mdocSchema = JSON.parse(schemaRaw);
      this.logger.log('Loaded mDoc schema from catalog/credential-schema-mdoc.json');
    } catch (e) {
      this.logger.warn('mDoc schema not found or unreadable at catalog/credential-schema-mdoc.json');
    }

    // Derive and cache the public JWK for JWKS endpoint
    const privKey = crypto.createPrivateKey(this.signingKeyPem);
    const pubKey  = crypto.createPublicKey(privKey);
    this.publicJwk = { ...pubKey.export({ format: 'jwk' }), use: 'sig', alg: 'ES256', kid: 'issuer-key-1' };

    setInterval(() => {
      const cutoff = Date.now() - 15 * 60_000;
      for (const [k, v] of this.pendingOffers) {
        if (v.createdAt.getTime() < cutoff) this.pendingOffers.delete(k);
      }
      for (const [k, v] of this.pendingTokens) {
        if (v.createdAt.getTime() < cutoff) this.pendingTokens.delete(k);
      }
      for (const [k, v] of this.pendingAuthCodes) {
        if (v.createdAt.getTime() < cutoff) this.pendingAuthCodes.delete(k);
      }
    }, 60_000).unref();

    this.logger.log(`Issuer ready — ${this.baseUrl}/issuer`);
  }

  // ── OAuth2 Authorize endpoint (ABA client authentication demo) ────────────
  handleAuthorizeRequest(
    query: Record<string, string>,
    headers: Record<string, string>,
    res: Response,
  ) {
    const responseType = query['response_type'];
    const redirectUri  = query['redirect_uri'];
    const state        = query['state'];
    const scope        = query['scope'];
    const codeChallenge       = query['code_challenge'];
    const codeChallengeMethod = query['code_challenge_method'];
    const clientAssertionType = query['client_assertion_type'];
    const clientAssertion     = query['client_assertion'];

    if (!responseType || responseType !== 'code') {
      throw new BadRequestException('response_type=code is required');
    }
    if (!redirectUri) throw new BadRequestException('redirect_uri is required');

    if (clientAssertionType && clientAssertionType !== 'attest_jwt_client_auth') {
      throw new BadRequestException('Unsupported client_assertion_type');
    }

    let clientJwk: Record<string, unknown> | undefined;
    if (clientAssertion) {
      try {
        const [hB64, pB64] = clientAssertion.split('.');
        const hdr = JSON.parse(Buffer.from(hB64, 'base64url').toString());
        const pl  = JSON.parse(Buffer.from(pB64, 'base64url').toString());
        if (!hdr.jwk) throw new Error('attestation missing jwk');
        clientJwk = hdr.jwk;
        if (pl.exp && typeof pl.exp === 'number' && pl.exp < Math.floor(Date.now()/1000)) {
          throw new Error('attestation expired');
        }
      } catch (e) {
        throw new UnauthorizedException(`Invalid client attestation: ${String(e)}`);
      }
    }

    const code = crypto.randomBytes(24).toString('base64url');
    this.pendingAuthCodes.set(code, {
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scope,
      state,
      clientJwk,
      createdAt: new Date(),
    });

    const url = new URL(redirectUri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);

    res.status(302).header('Location', url.toString()).send();
  }

  // ── 1. Create credential offer ─────────────────────────────────────────────
  async createCredentialOffer(grantId: string, pidSubject: string): Promise<string> {
    const preAuthCode = crypto.randomUUID();
    this.pendingOffers.set(preAuthCode, { grantId, pidSubject, createdAt: new Date() });

    const offer = {
      credential_issuer: this.baseUrl,
      credential_configuration_ids: [`${EAA_VCT}:mso_mdoc`],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthCode,
        },
      },
    };

    return `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(offer))}`;
  }

  // ── 2. Serve offer object (fallback: credential_offer_uri) ─────────────────
  getOfferMetadata(preAuthCode: string) {
    const offer = this.pendingOffers.get(preAuthCode);
    if (!offer) throw new NotFoundException('Credential offer not found or expired');

    return {
      credential_issuer: this.baseUrl,
      credential_configuration_ids: [`${EAA_VCT}:mso_mdoc`],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthCode,
        },
      },
    };
  }

  // ── 3. Token endpoint ──────────────────────────────────────────────────────
  async handleTokenRequest(body: Record<string, string>): Promise<Record<string, unknown>> {
    const grantType = body['grant_type'];

    if (grantType === 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
      const preAuthCode = body['pre-authorized_code'];
      if (!preAuthCode) throw new BadRequestException('Missing pre-authorized_code');

      const offerState = this.pendingOffers.get(preAuthCode);
      if (!offerState) {
        throw new HttpException(
          { error: 'invalid_grant', error_description: 'Unknown or expired pre-authorized_code' },
          400,
        );
      }

      this.pendingOffers.delete(preAuthCode);

      const accessToken = `iat.${crypto.randomBytes(24).toString('base64url')}`;
      const cNonce = crypto.randomUUID();

      this.pendingTokens.set(accessToken, {
        grantId: offerState.grantId,
        pidSubject: offerState.pidSubject,
        cNonce,
        createdAt: new Date(),
        issuedConfigurations: new Set<string>(),
      });

      this.logger.log(`Token issued for grant ${offerState.grantId}`);

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 300,
        c_nonce: cNonce,
        c_nonce_expires_in: 300,
      };
    }

    if (grantType === 'authorization_code') {
      const code = body['code'];
      const codeVerifier = body['code_verifier'];
      const clientAssertionType = body['client_assertion_type'];
      const clientAssertion     = body['client_assertion'];

      const session = code ? this.pendingAuthCodes.get(code) : undefined;
      if (!session) throw new UnauthorizedException('Invalid or expired authorization code');

      if (session.codeChallenge) {
        if (!codeVerifier) throw new UnauthorizedException('code_verifier required');
        const hashed = session.codeChallengeMethod === 'S256'
          ? crypto.createHash('sha256').update(codeVerifier).digest('base64url')
          : codeVerifier;
        if (hashed !== session.codeChallenge) {
          throw new UnauthorizedException('PKCE verification failed');
        }
      }

      if (clientAssertionType !== 'attest_jwt_client_auth' || !clientAssertion) {
        throw new UnauthorizedException('attestation-based client authentication required');
      }
      try {
        const [hB64] = clientAssertion.split('.');
        const hdr = JSON.parse(Buffer.from(hB64, 'base64url').toString());
        if (!hdr.jwk) throw new Error('missing jwk');
        if (session.clientJwk) {
          const k1 = JSON.stringify(session.clientJwk);
          const k2 = JSON.stringify(hdr.jwk);
          if (k1 !== k2) throw new Error('attested key mismatch');
        }
      } catch (e) {
        throw new UnauthorizedException(`Invalid client attestation: ${String(e)}`);
      }

      const accessToken = `iat.${crypto.randomBytes(24).toString('base64url')}`;
      const cNonce = crypto.randomUUID();

      this.pendingTokens.set(accessToken, {
        grantId: 'N/A',
        pidSubject: 'N/A',
        cNonce,
        createdAt: new Date(),
        issuedConfigurations: new Set<string>(),
      });

      this.pendingAuthCodes.delete(code!);

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 300,
        c_nonce: cNonce,
        c_nonce_expires_in: 300,
      };
    }

    throw new HttpException(
      { error: 'unsupported_grant_type', error_description: `Unsupported grant_type: ${grantType}` },
      400,
    );
  }

  // ── 4. Credential endpoint ─────────────────────────────────────────────────
  async handleCredentialRequest(
    authHeader: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HttpException(
        { error: 'invalid_token', error_description: 'Missing Bearer token' },
        401,
      );
    }
    const accessToken = authHeader.slice(7);
    const tokenState = this.pendingTokens.get(accessToken);
    if (!tokenState) {
      throw new HttpException(
        { error: 'invalid_token', error_description: 'Unknown or expired access token' },
        401,
      );
    }

    const proof  = body['proof']  as Record<string, any> | undefined;
    const proofs = body['proofs'] as Record<string, any> | undefined;

    let proofJwt: string | undefined;
    if (proof?.jwt) {
      proofJwt = proof.jwt as string;
    } else if (proofs?.jwt && Array.isArray(proofs.jwt) && proofs.jwt.length > 0) {
      proofJwt = proofs.jwt[0] as string;
    }
    if (!proofJwt) {
      throw new HttpException(
        { error: 'invalid_request', error_description: 'Missing proof.jwt (key proof required)' },
        400,
      );
    }

    const proofParts = proofJwt.split('.');
    if (proofParts.length !== 3) {
      throw new HttpException(
        { error: 'invalid_request', error_description: 'Malformed proof JWT' },
        400,
      );
    }
    const proofHeader  = JSON.parse(Buffer.from(proofParts[0], 'base64url').toString());
    const proofPayload = JSON.parse(Buffer.from(proofParts[1], 'base64url').toString());

    if (proofPayload.nonce && proofPayload.nonce !== tokenState.cNonce) {
      throw new HttpException(
        { error: 'invalid_request', error_description: `Proof nonce mismatch: expected ${tokenState.cNonce}, got ${proofPayload.nonce}` },
        400,
      );
    }
    if (!proofPayload.nonce) {
      this.logger.warn(`Proof JWT missing nonce (expected ${tokenState.cNonce}) — continuing`);
    }

    // Extract wallet public JWK from either jwk header or key_attestation JWT
    let walletJwk: Record<string, unknown> | undefined = proofHeader.jwk;

    if (!walletJwk && proofHeader.key_attestation) {
      try {
        const [attHeaderB64, attPayloadB64] = (proofHeader.key_attestation as string).split('.');
        const attPayload = JSON.parse(Buffer.from(attPayloadB64, 'base64url').toString());
        const attHeader  = JSON.parse(Buffer.from(attHeaderB64, 'base64url').toString());

        if (Array.isArray(attPayload.attested_keys) && attPayload.attested_keys.length > 0) {
          const kidIndex = parseInt(proofHeader.kid ?? '0', 10);
          walletJwk = attPayload.attested_keys[isNaN(kidIndex) ? 0 : kidIndex] || attPayload.attested_keys[0];
        } else if (Array.isArray(attHeader.x5c) && attHeader.x5c.length > 0) {
          const certDer = Buffer.from(attHeader.x5c[0], 'base64');
          const certObj = new crypto.X509Certificate(certDer);
          walletJwk = certObj.publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
        }
      } catch (e) {
        this.logger.warn(`Failed to parse key_attestation from proof header: ${String(e)}`);
      }
    }

    if (!walletJwk) {
      throw new HttpException(
        { error: 'invalid_request', error_description: 'Proof JWT must carry jwk or key_attestation header' },
        400,
      );
    }

    const walletPubKey = await importJWK(walletJwk, proofHeader.alg ?? 'ES256') as CryptoKey;

    // Verify proof signature
    try {
      await jwtVerify(proofJwt, walletPubKey, { algorithms: [proofHeader.alg ?? 'ES256'] });
      this.logger.debug('Proof JWT signature verified ✓');
    } catch (e) {
      throw new HttpException(
        { error: 'invalid_request', error_description: `Proof JWT signature invalid: ${String(e)}` },
        401,
      );
    }

    const grant = await this.grantService.findOne(tokenState.grantId);

    const requestedConfigId = (body['credential_configuration_id'] as string | undefined)?.trim();

    const issueSdJwt = !requestedConfigId || requestedConfigId === EAA_VCT;
    const issueMdoc  = !requestedConfigId || requestedConfigId === `${EAA_VCT}:mso_mdoc`;

    const credentials: Array<{ format: string; credential: string }> = [];

    if (issueSdJwt) {
      const sd = this.issueEaaCredential(
        grant,
        tokenState.pidSubject,
        walletJwk,
      );
      credentials.push({ format: 'dc+sd-jwt', credential: sd });
      tokenState.issuedConfigurations?.add(EAA_VCT);
    }

    if (issueMdoc) {
      const mdoc = await this.issueEaaMdoc(grant, tokenState.pidSubject, walletJwk);
      credentials.push({ format: 'mso_mdoc', credential: mdoc });
      tokenState.issuedConfigurations?.add(`${EAA_VCT}:mso_mdoc`);
    }

    if (credentials.length === 0) {
      throw new HttpException(
        { error: 'invalid_request', error_description: `Unknown credential_configuration_id: ${requestedConfigId}` },
        400,
      );
    }

    const credentialId = crypto.randomUUID();
    await this.grantService.activate(grant.id, tokenState.pidSubject, credentialId);

    this.logger.log(
      `EAA issued (${credentials.map(c => c.format).join(', ')}) — grant: ${grant.id}, resource: ${grant.resourceId}, subject: ${tokenState.pidSubject}`,
    );

    return { credentials };
  }

  // ── Build SD-JWT VC ────────────────────────────────────────────────────────
  private issueEaaCredential(
    grant: any,
    pidSubject: string,
    walletJwk: object,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const sdEntries: Array<[string, unknown]> = [
      ['granted_resource', grant.resourceId],
      ['issued_to',        pidSubject],
    ];

    const disclosures: Array<{ encoded: string; hash: string }> = sdEntries.map(([name, value]) => {
      const salt     = crypto.randomBytes(16).toString('base64url');
      const encoded  = Buffer.from(JSON.stringify([salt, name, value])).toString('base64url');
      const hash     = crypto.createHash('sha256').update(Buffer.from(encoded)).digest('base64url');
      return { encoded, hash };
    });

    const payload = {
      iss:     this.baseUrl,
      iat:     now,
      exp:     now + 365 * 24 * 3600,
      vct:     EAA_VCT,
      sub:     pidSubject,
      cnf:     { jwk: walletJwk },
      grant_id: grant.id,
      _sd:     disclosures.map(d => d.hash),
      _sd_alg: 'sha-256',
    };

    const issuerJwt = signCompact(
      { alg: 'ES256', typ: 'dc+sd-jwt', kid: 'issuer-key-1' },
      payload,
      this.signingKeyPem,
    );

    return [issuerJwt, ...disclosures.map(d => d.encoded), ''].join('~');
  }

  // ── Build mDoc (mso_mdoc) with OWF mdoc-ts ────────────────────────────────
  private async issueEaaMdoc(
    grant: any,
    pidSubject: string,
    walletJwk: any,
  ): Promise<string> {
    const nowMs = Date.now();

    const schema = this.mdocSchema ?? {};
    const doctype: string = schema.doctype || 'urn:eudi:eaa:infrastructure:access:1';
    const ns: string = schema.claims ? Object.keys(schema.claims)[0] : 'urn:eudi:eaa:infrastructure:access:namespace:1';

    const validFrom = new Date(nowMs);
    const validUntil = new Date(nowMs + 365 * 24 * 3600 * 1000);
    const privateJwk = this.getIssuerPrivateJwk();
    const normalizedWalletJwk = this.normalizeEcJwk(walletJwk);
    const { CoseKey, DeviceKey, Issuer, SignatureAlgorithm } = await importOwfMdoc('@owf/mdoc');
    const ctx = this.createOwfMdocContext();

    const issuerSigned = await new Issuer(doctype, ctx)
      .addIssuerNamespace(ns, {
        granted_resource: grant.resourceId,
        grant_id: grant.id,
        valid_from: validFrom.toISOString(),
        valid_until: validUntil.toISOString(),
      })
      .sign({
        signingKey: CoseKey.fromJwk(privateJwk),
        algorithm: SignatureAlgorithm.ES256,
        digestAlgorithm: 'SHA-256',
        validityInfo: {
          signed: validFrom,
          validFrom,
          validUntil,
        },
        deviceKeyInfo: {
          deviceKey: DeviceKey.fromJwk(normalizedWalletJwk),
        },
        certificates: this.issuerCertDer ? [this.issuerCertDer] : [],
      });

    this.logger.debug(`mDoc IssuerSigned ready via OWF mdoc-ts — doctype=${doctype} namespace=${ns}`);
    return issuerSigned.encodedForOid4Vci;
  }

  private createOwfMdocContext(): Pick<MdocContext, 'cose' | 'crypto'> {
    return {
      crypto: {
        random: (length: number) => crypto.randomBytes(length),
        digest: ({ digestAlgorithm, bytes }) => {
          const algorithm = digestAlgorithm.toLowerCase().replace('-', '');
          return crypto.createHash(algorithm).update(Buffer.from(bytes)).digest();
        },
        calculateEphemeralMacKey: () => {
          throw new Error('Ephemeral MAC key calculation is not used during issuance');
        },
      },
      cose: {
        sign1: {
          sign: ({ toBeSigned }) =>
            crypto
              .createSign('sha256')
              .update(Buffer.from(toBeSigned))
              .sign({ key: this.signingKeyPem, dsaEncoding: 'ieee-p1363' }),
          verify: () => {
            throw new Error('COSE verification is not used during issuance');
          },
        },
        mac0: {
          sign: () => {
            throw new Error('COSE MAC0 signing is not used during issuance');
          },
          verify: () => {
            throw new Error('COSE MAC0 verification is not used during issuance');
          },
        },
      },
    };
  }

  private getIssuerPrivateJwk(): Record<string, unknown> {
    const privateKey = crypto.createPrivateKey(this.signingKeyPem);
    return {
      ...privateKey.export({ format: 'jwk' }),
      kid: 'issuer-key-1',
      alg: 'ES256',
      keyOps: ['sign'],
    } as Record<string, unknown>;
  }

  private normalizeEcJwk(jwk: any): Record<string, unknown> {
    if (!jwk || jwk.kty !== 'EC' || !jwk.x || !jwk.y) {
      throw new BadRequestException('Proof JWT jwk must be an EC public key with x/y coordinates for mDoc deviceKey');
    }

    return {
      ...jwk,
      crv: jwk.crv === 'secp256r1' ? 'P-256' : (jwk.crv ?? 'P-256'),
      alg: jwk.alg ?? 'ES256',
    };
  }

  // ── Issuer metadata (/.well-known/openid-credential-issuer) ───────────────
  getIssuerMetadata() {
    const base   = `${this.baseUrl}/issuer`;
    const origin = this.baseUrl;

    return {
      credential_issuer: origin,
      credential_endpoint: `${base}/credential`,
      token_endpoint: `${base}/token`,
      issuer: origin,
      authorization_endpoint: `${base}/authorize`,
      authorization_endpoint_auth_methods_supported: ['attest_jwt_client_auth'],
      jwks_uri: `${base}/jwks`,
      grant_types_supported: [
        'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        'authorization_code',
      ],
      token_endpoint_auth_methods_supported: ['none', 'attest_jwt_client_auth'],
      response_types_supported: ['token', 'code'],
      request_parameter_supported: true,
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['openid', 'InfrastructureAccessEAA'],
      subject_types_supported: ['public'],
      client_attestation_signing_alg_values_supported: ['ES256'],
      client_attestation_pop_signing_alg_values_supported: ['ES256'],
      id_token_signing_alg_values_supported: ['ES256'],

      credential_configurations_supported: {
        [EAA_VCT]: {
          format: 'dc+sd-jwt',
          vct: EAA_VCT,
          scope: 'InfrastructureAccessEAA',
          cryptographic_binding_methods_supported: ['jwk'],
          credential_signing_alg_values_supported: ['ES256'],
          proof_types_supported: {
            jwt: { proof_signing_alg_values_supported: ['ES256'], key_attestations_required: {} },
          },
          display: [{ name: 'Infrastructure Access Attestation', locale: 'en-US' }],
          claims: {
            granted_resource: { display: [{ name: 'Granted Resource', locale: 'en-US' }] },
            issued_to:        { display: [{ name: 'Issued To',        locale: 'en-US' }] },
          },
        },
        [`${EAA_VCT}:mso_mdoc`]: (() => {
          const defaultDoctype = 'urn:eudi:eaa:infrastructure:access:1';
          const defaultNamespace = 'urn:eudi:eaa:infrastructure:access:namespace:1';
          const schema = this.mdocSchema ?? {};
          const doctype = schema.doctype || defaultDoctype;
          const ns = (schema.claims && Object.keys(schema.claims)[0]) || defaultNamespace;

          const defaultNsClaims = {
            granted_resource: { mandatory: true, value_type: 'string', display: [{ name: 'Granted Resource', description: 'Identifier of the physical resource the holder may access', locale: 'en-US' }] },
            grant_id:        { mandatory: true, value_type: 'string', display: [{ name: 'Grant ID',        description: 'Internal grant reference for audit purposes', locale: 'en-US' }] },
            valid_from:      { mandatory: true, value_type: 'string', display: [{ name: 'Valid From',      locale: 'en-US' }] },
            valid_until:     { mandatory: true, value_type: 'string', display: [{ name: 'Valid Until',     locale: 'en-US' }] },
          } as Record<string, any>;

          const nsClaims: Record<string, any> = (schema.claims && schema.claims[ns]) || defaultNsClaims;

          const claimsArray = Object.entries(nsClaims).map(([claimName, cfg]: [string, any]) => ({
            path: [ns, claimName],
            mandatory: !!cfg.mandatory,
            display: Array.isArray(cfg.display) ? cfg.display : [{ name: claimName, locale: 'en-US' }],
          }));

          const display = Array.isArray(schema.display) && schema.display.length > 0
            ? schema.display
            : [{ name: 'Infrastructure Access Attestation (mDoc)', locale: 'en-US' }];

          return {
            format: 'mso_mdoc',
            scope: `${EAA_VCT}:mso_mdoc`,
            cryptographic_binding_methods_supported: ['jwk'],
            proof_types_supported: {
              jwt: { proof_signing_alg_values_supported: ['ES256'], key_attestations_required: {} },
            },
            credential_signing_alg_values_supported: [-7],
            doctype: doctype,
            credential_metadata: {
              display,
              claims: claimsArray,
            },
          };
        })(),
      },
    };
  }

  // ── OAuth Authorization Server metadata (/.well-known/oauth-authorization-server)
  getAuthorizationServerMetadata() {
    const base = `${this.baseUrl}/issuer`;
    const origin = this.baseUrl;

    return {
      issuer: origin,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      jwks_uri: `${base}/jwks`,
      response_types_supported: ['token', 'code'],
      grant_types_supported: [
        'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        'authorization_code',
      ],
      token_endpoint_auth_methods_supported: ['none', 'attest_jwt_client_auth'],
      authorization_endpoint_auth_methods_supported: ['attest_jwt_client_auth'],
      client_attestation_signing_alg_values_supported: ['ES256'],
      client_attestation_pop_signing_alg_values_supported: ['ES256'],
      request_parameter_supported: true,
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['openid', 'InfrastructureAccessEAA'],
    };
  }

  // JWKS endpoint — wallet uses this to verify issued SD-JWT VCs
  getJwks() {
    return { keys: [this.publicJwk] };
  }

  // SD-JWT VC §4.3 — JWT VC Issuer Metadata
  getJwtVcIssuerMetadata() {
    return {
      issuer: this.baseUrl,
      jwks: { keys: [this.publicJwk] },
    };
  }

  // ── OpenID Provider metadata (/.well-known/openid-configuration) ──────────
  getOpenIdProviderMetadata() {
    const base = `${this.baseUrl}/issuer`;
    const origin = this.baseUrl;
    return {
      issuer: origin,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      jwks_uri: `${base}/jwks`,
      response_types_supported: ['token', 'code'],
      grant_types_supported: [
        'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        'authorization_code',
      ],
      token_endpoint_auth_methods_supported: ['none', 'attest_jwt_client_auth'],
      authorization_endpoint_auth_methods_supported: ['attest_jwt_client_auth'],
      client_attestation_signing_alg_values_supported: ['ES256'],
      client_attestation_pop_signing_alg_values_supported: ['ES256'],
      request_parameter_supported: true,
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['openid', 'InfrastructureAccessEAA'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['ES256'],
    };
  }
}