import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
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
import { encode as cborEncode } from 'cbor-x';

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
  // Minimal implementation to satisfy wallets validating the discovery doc.
  // Supports response_type=code and client attestation via client_assertion
  // using the experimental "attest_jwt_client_auth" value.
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

    // Validate attestation-based client authentication (minimal checks)
    if (clientAssertionType && clientAssertionType !== 'attest_jwt_client_auth') {
      throw new BadRequestException('Unsupported client_assertion_type');
    }

    let clientJwk: Record<string, unknown> | undefined;
    if (clientAssertion) {
      try {
        const [hB64, pB64] = clientAssertion.split('.');
        const hdr = JSON.parse(Buffer.from(hB64, 'base64url').toString());
        const pl  = JSON.parse(Buffer.from(pB64, 'base64url').toString());
        // For demo purposes, accept unsigned/unknown issuer, but require a jwk in header
        if (!hdr.jwk) throw new Error('attestation missing jwk');
        clientJwk = hdr.jwk;
        // Basic freshness checks if present
        if (pl.exp && typeof pl.exp === 'number' && pl.exp < Math.floor(Date.now()/1000)) {
          throw new Error('attestation expired');
        }
      } catch (e) {
        throw new UnauthorizedException(`Invalid client attestation: ${String(e)}`);
      }
    }

    // Create authorization code and store session
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

    // Redirect back with code (+ state if provided)
    const url = new URL(redirectUri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);

    res.status(302).header('Location', url.toString()).send();
  }

  // ── 1. Create credential offer ─────────────────────────────────────────────
  // Called by VerifierService after successful PID VP verification.
  // Returns an openid-credential-offer:// deep link with the offer object inline.
  async createCredentialOffer(grantId: string, pidSubject: string): Promise<string> {
    const preAuthCode = crypto.randomUUID();
    this.pendingOffers.set(preAuthCode, { grantId, pidSubject, createdAt: new Date() });

    // Strict OID4VCI Draft 13 format.
    // tx_code absent = no PIN/transaction code required.
    // user_pin_required is a Draft ≤12 field — omitting it avoids wallets
    // misinterpreting it as tx_code present.
    const offer = {
      credential_issuer: this.baseUrl,   // must match issuer in metadata (root, no /issuer)
      credential_configuration_ids: [EAA_VCT, `${EAA_VCT}:mso_mdoc`],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthCode,
        },
      },
    };

    // Inline offer — wallet parses credential_offer query param directly
    return `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(offer))}`;
  }

  // ── 2. Serve offer object (fallback: credential_offer_uri) ─────────────────
  getOfferMetadata(preAuthCode: string) {
    const offer = this.pendingOffers.get(preAuthCode);
    if (!offer) throw new NotFoundException('Credential offer not found or expired');

    return {
      credential_issuer: this.baseUrl,
      credential_configuration_ids: [EAA_VCT],
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

    // ── Pre-Authorized Code (OID4VCI) ───────────────────────────────────────
    if (grantType === 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
      const preAuthCode = body['pre-authorized_code'];
      if (!preAuthCode) throw new BadRequestException('Missing pre-authorized_code');

      const offerState = this.pendingOffers.get(preAuthCode);
      if (!offerState) throw new UnauthorizedException('Unknown or expired pre-authorized_code');

      // One-time use — delete immediately
      this.pendingOffers.delete(preAuthCode);

      const accessToken = `iat.${crypto.randomBytes(24).toString('base64url')}`;
      const cNonce = crypto.randomUUID();

      this.pendingTokens.set(accessToken, {
        grantId: offerState.grantId,
        pidSubject: offerState.pidSubject,
        cNonce,
        createdAt: new Date(),
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

    // ── Authorization Code (ABA demo) ───────────────────────────────────────
    if (grantType === 'authorization_code') {
      const code = body['code'];
      const codeVerifier = body['code_verifier'];
      const clientAssertionType = body['client_assertion_type'];
      const clientAssertion     = body['client_assertion'];

      const session = code ? this.pendingAuthCodes.get(code) : undefined;
      if (!session) throw new UnauthorizedException('Invalid or expired authorization code');

      // PKCE validation if provided
      if (session.codeChallenge) {
        if (!codeVerifier) throw new UnauthorizedException('code_verifier required');
        const hashed = session.codeChallengeMethod === 'S256'
          ? crypto.createHash('sha256').update(codeVerifier).digest('base64url')
          : codeVerifier;
        if (hashed !== session.codeChallenge) {
          throw new UnauthorizedException('PKCE verification failed');
        }
      }

      // ABA: require attestation assertion
      if (clientAssertionType !== 'attest_jwt_client_auth' || !clientAssertion) {
        throw new UnauthorizedException('attestation-based client authentication required');
      }
      // Minimal check: ensure assertion header carries a jwk and, if present in session, it matches
      try {
        const [hB64] = clientAssertion.split('.');
        const hdr = JSON.parse(Buffer.from(hB64, 'base64url').toString());
        if (!hdr.jwk) throw new Error('missing jwk');
        if (session.clientJwk) {
          // naive match by JWK thumbprint material
          const k1 = JSON.stringify(session.clientJwk);
          const k2 = JSON.stringify(hdr.jwk);
          if (k1 !== k2) throw new Error('attested key mismatch');
        }
      } catch (e) {
        throw new UnauthorizedException(`Invalid client attestation: ${String(e)}`);
      }

      // For demo, bind issued token to a synthetic grant. In this server, VC issuance
      // is rooted in a grant created elsewhere. We won't issue a VC via this path,
      // but we return an access token + c_nonce so wallets can proceed to credential endpoint
      // if they also performed the pre-auth flow. Therefore, just mint a token without grant.
      const accessToken = `iat.${crypto.randomBytes(24).toString('base64url')}`;
      const cNonce = crypto.randomUUID();

      // Store token with empty grant/subject; credential endpoint will reject if used there.
      this.pendingTokens.set(accessToken, {
        grantId: 'N/A',
        pidSubject: 'N/A',
        cNonce,
        createdAt: new Date(),
      });

      // One-time use — delete auth code
      this.pendingAuthCodes.delete(code!);

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 300,
        c_nonce: cNonce,
        c_nonce_expires_in: 300,
      };
    }

    throw new BadRequestException(`Unsupported grant_type: ${grantType}`);
  }

  // ── 4. Credential endpoint ─────────────────────────────────────────────────
  async handleCredentialRequest(
    authHeader: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Validate bearer token
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const accessToken = authHeader.slice(7);
    const tokenState = this.pendingTokens.get(accessToken);
    if (!tokenState) throw new UnauthorizedException('Unknown or expired access token');

    // Validate proof of possession.
    // Draft 13: { "proof":  { "proof_type": "jwt", "jwt": "<string>" } }
    // Draft 14: { "proofs": { "jwt": ["<string>"] } }
    // Handle both formats.
    const proof  = body['proof']  as Record<string, any> | undefined;
    const proofs = body['proofs'] as Record<string, any> | undefined;

    let proofJwt: string | undefined;
    if (proof?.jwt) {
      proofJwt = proof.jwt as string;
    } else if (proofs?.jwt && Array.isArray(proofs.jwt) && proofs.jwt.length > 0) {
      proofJwt = proofs.jwt[0] as string;
    }
    if (!proofJwt) throw new BadRequestException('Missing proof.jwt (key proof required)');

    // Decode proof header + payload (no sig verify yet — need key first)
    const proofParts = proofJwt.split('.');
    if (proofParts.length !== 3) throw new BadRequestException('Malformed proof JWT');
    const proofHeader  = JSON.parse(Buffer.from(proofParts[0], 'base64url').toString());
    const proofPayload = JSON.parse(Buffer.from(proofParts[1], 'base64url').toString());

    // c_nonce check — OID4VCI requires wallet to include nonce from token response.
    // Some wallet implementations omit it; log a warning but continue.
    if (proofPayload.nonce && proofPayload.nonce !== tokenState.cNonce) {
      throw new UnauthorizedException(
        `Proof nonce mismatch: expected ${tokenState.cNonce}, got ${proofPayload.nonce}`,
      );
    }
    if (!proofPayload.nonce) {
      this.logger.warn(`Proof JWT missing nonce (expected ${tokenState.cNonce}) — continuing`);
    }

    // Wallet public key from proof header
    if (!proofHeader.jwk) throw new BadRequestException('Proof JWT must carry jwk header');
    const walletPubKey = await importJWK(proofHeader.jwk, proofHeader.alg ?? 'ES256') as CryptoKey;

    // Verify proof signature
    try {
      await jwtVerify(proofJwt, walletPubKey, { algorithms: [proofHeader.alg ?? 'ES256'] });
      this.logger.debug('Proof JWT signature verified ✓');
    } catch (e) {
      throw new UnauthorizedException(`Proof JWT signature invalid: ${String(e)}`);
    }

    const grant = await this.grantService.findOne(tokenState.grantId);

    // Build and sign the EAA SD-JWT VC
    const credentialSdJwt = this.issueEaaCredential(
      grant,
      tokenState.pidSubject,
      proofHeader.jwk,
    );

    // Build the EAA mDoc (MSO_mdoc) with the same schema
    const credentialMdoc = this.issueEaaMdoc(grant, tokenState.pidSubject);

    // Activate grant
    const credentialId = crypto.randomUUID();
    await this.grantService.activate(grant.id, tokenState.pidSubject, credentialId);

    // One-time use — delete token
    this.pendingTokens.delete(accessToken);

    this.logger.log(
      `EAA issued — grant: ${grant.id}, resource: ${grant.resourceId}, subject: ${tokenState.pidSubject}`,
    );

    return {
      credentials: [
       {
         format: 'dc+sd-jwt',
         credential: credentialSdJwt,
       },
        {
          format: 'mso_mdoc',
          // Per OID4VCI, mso_mdoc credential is a base64url-encoded COSE_Sign1/CBOR.
          // Here we return a placeholder-encoded structure that will be replaced by
          // a proper COSE/CBOR signing implementation in a follow-up step.
          credential: credentialMdoc,
        },
      ],
    };
  }

  // ── Build SD-JWT VC ────────────────────────────────────────────────────────
  // Format: <issuer-jwt>~<disclosure1>~<disclosure2>~
  // (no KB-JWT — the holder binds themselves when presenting)
  private issueEaaCredential(
    grant: any,
    pidSubject: string,
    walletJwk: object,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    // Selectively disclosable claims
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
      iss:     this.baseUrl,   // must match issuer in /.well-known/jwt-vc-issuer
      iat:     now,
      exp:     now + 365 * 24 * 3600,
      vct:     EAA_VCT,
      sub:     pidSubject,
      cnf:     { jwk: walletJwk },
      grant_id: grant.id,
      _sd:     disclosures.map(d => d.hash),
      _sd_alg: 'sha-256',
    };

    // EudiWalletKit requires either x5c or kid in the SD-JWT header.
    // kid references our public key in /.well-known/jwt-vc-issuer → jwks.keys[0]
    const issuerJwt = signCompact(
      { alg: 'ES256', typ: 'dc+sd-jwt', kid: 'issuer-key-1' },
      payload,
      this.signingKeyPem,
    );

    // SD-JWT: issuer-jwt~disc1~disc2~  (trailing ~ = no KB-JWT at issuance time)
    return [issuerJwt, ...disclosures.map(d => d.encoded), ''].join('~');
  }

  // ── Build mDoc (MSO_mdoc) placeholder ─────────────────────────────────────
  // Mirrors the SD-JWT claims into an mDoc-like structure for offline checks.
  // NOTE: This is a placeholder returning base64url(JSON). In the next step we will
  // construct a real ISO 23220-5/18013-5 MSO_mdoc object and sign it (COSE_Sign1),
  // using an mDoc/COSE library. The schema is kept stable so client integration
  // can proceed meanwhile.
  private issueEaaMdoc(
    grant: any,
    pidSubject: string,
  ): string {
    const nowMs = Date.now();

    // mDoc schema-driven values
    const schema = this.mdocSchema ?? {};
    const doctype: string = schema.doctype || 'urn:eudi:eaa:infrastructure:access:1';
    const ns: string = schema.claims ? Object.keys(schema.claims)[0] : 'urn:eudi:eaa:infrastructure:access:namespace:1';

    const validFrom = new Date(nowMs).toISOString();
    const validUntil = new Date(nowMs + 365 * 24 * 3600 * 1000).toISOString();

    // Build IssuerSigned nameSpaces per ISO 23220-5 style
    const nameSpaces = {
      [ns]: {
        granted_resource: grant.resourceId,
        grant_id: grant.id,
        valid_from: validFrom,
        valid_until: validUntil,
      },
    } as Record<string, any>;

    const issuerSigned = {
      docType: doctype,
      issuer: this.baseUrl,
      validityInfo: {
        signed: validFrom,
        validFrom,
        validUntil,
      },
      nameSpaces,
      // Optional subject binding for traceability in demo scenarios
      subject: pidSubject,
    };

    // For now, return unsigned CBOR wrapped as base64url to avoid external COSE deps.
    // Wallets that can ingest raw IssuerSigned CBOR can still parse fields.
    const cborPayload = cborEncode(issuerSigned);
    return Buffer.from(cborPayload).toString('base64url');
  }

  // ── Issuer metadata (/.well-known/openid-credential-issuer) ───────────────
  getIssuerMetadata() {
    const base   = `${this.baseUrl}/issuer`;
    // RFC 8414 §5: the `issuer` field MUST match the URL from which the well-known
    // document was retrieved. The iOS EUDI wallet fetches
    // GET /.well-known/openid-credential-issuer (no path suffix), so it expects
    // issuer == this.baseUrl (NOT this.baseUrl/issuer).
    // credential_issuer and issuer must therefore be set to the root URL.
    const origin = this.baseUrl;

    return {
      // OID4VCI §11 — credential issuer at root, endpoints under /issuer/
      credential_issuer: origin,
      credential_endpoint: `${base}/credential`,
      token_endpoint: `${base}/token`,

      // RFC 8414 / OIDC Discovery required fields
      issuer: origin,
      // authorization_endpoint is required by OIDC Discovery validation even for
      // pre-auth flow where it is never actually called.
      authorization_endpoint: `${base}/authorize`,
      // Authorization endpoint client authentication — advertise attestation-based client auth
      authorization_endpoint_auth_methods_supported: ['attest_jwt_client_auth'],
      // jwks_uri: wallet fetches this to verify issued credentials (required by OIDC Discovery)
      jwks_uri: `${base}/jwks`,
      grant_types_supported: [
        'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        'authorization_code',
      ],
      token_endpoint_auth_methods_supported: ['none', 'attest_jwt_client_auth'],
      response_types_supported: ['token', 'code'],
      // Hints commonly expected by wallets
      request_parameter_supported: true,
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['openid', 'InfrastructureAccessEAA'],
      subject_types_supported: ['public'],
      // Newer ABA draft fields expected by EUDI Wallet
      client_attestation_signing_alg_values_supported: ['ES256'],
      // Rename POP algs field to the expected key (no _jwt)
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
            jwt: { proof_signing_alg_values_supported: ['ES256'] },
          },
          display: [{ name: 'Infrastructure Access Attestation', locale: 'en-US' }],
          claims: {
            granted_resource: { display: [{ name: 'Granted Resource', locale: 'en-US' }] },
            issued_to:        { display: [{ name: 'Issued To',        locale: 'en-US' }] },
          },
        },
        // Also advertise an mDoc variant of the same credential using wallet-expected structure
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
              jwt: { proof_signing_alg_values_supported: ['ES256'] },
            },
            // For mDoc COSE, use COSE alg IDs. -7 = ES256
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
  // Some wallets expect a dedicated OAuth AS discovery document at the root.
  // This mirrors the auth-related fields from getIssuerMetadata().
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
      // Newer ABA draft fields expected by EUDI Wallet
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
  // Wallet fetches this from /.well-known/jwt-vc-issuer after receiving our credential.
  // The `issuer` MUST match the `iss` claim in the issued SD-JWT VC.
  // Inline JWKS allows offline signature verification.
  getJwtVcIssuerMetadata() {
    return {
      issuer: this.baseUrl,
      jwks: { keys: [this.publicJwk] },
    };
  }

  // ── OpenID Provider metadata (/.well-known/openid-configuration) ──────────
  // Some clients (e.g., EUDI Wallet libraries) consult this document to
  // determine Authorization Server capabilities, including ABA requirements.
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
      // Fields required by the newer ABA draft checked by the wallet
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
