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
import { importJWK, jwtVerify } from 'jose';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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

@Injectable()
export class IssuerService implements OnModuleInit {
  private readonly logger = new Logger(IssuerService.name);

  // In-memory stores (15-min TTL)
  private readonly pendingOffers = new Map<string, OfferState>();
  private readonly pendingTokens = new Map<string, TokenState>();

  private signingKeyPem: string;
  private baseUrl: string;

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

    setInterval(() => {
      const cutoff = Date.now() - 15 * 60_000;
      for (const [k, v] of this.pendingOffers) {
        if (v.createdAt.getTime() < cutoff) this.pendingOffers.delete(k);
      }
      for (const [k, v] of this.pendingTokens) {
        if (v.createdAt.getTime() < cutoff) this.pendingTokens.delete(k);
      }
    }, 60_000).unref();

    this.logger.log(`Issuer ready — ${this.baseUrl}/issuer`);
  }

  // ── 1. Create credential offer ─────────────────────────────────────────────
  // Called by VerifierService after successful PID VP verification.
  // Returns an openid-credential-offer:// deep link with the offer object inline.
  async createCredentialOffer(grantId: string, pidSubject: string): Promise<string> {
    const preAuthCode = crypto.randomUUID();
    this.pendingOffers.set(preAuthCode, { grantId, pidSubject, createdAt: new Date() });

    const offer = {
      credential_issuer: `${this.baseUrl}/issuer`,
      // Draft 13+ name; some wallets also check the old Draft ≤12 "credentials" field
      credential_configuration_ids: [EAA_VCT],
      credentials: [EAA_VCT],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthCode,
          // Draft 13: tx_code absent = no PIN
          // Draft ≤12: user_pin_required must be explicitly false
          'user_pin_required': false,
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
      credential_issuer: `${this.baseUrl}/issuer`,
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
    const preAuthCode = body['pre-authorized_code'];

    if (grantType !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
      throw new BadRequestException(`Unsupported grant_type: ${grantType}`);
    }
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

    // Validate proof of possession
    const proof = body['proof'] as Record<string, string> | undefined;
    if (!proof?.jwt) throw new BadRequestException('Missing proof.jwt (key proof required)');

    // Decode proof header + payload (no sig verify yet — need key first)
    const proofParts = proof.jwt.split('.');
    if (proofParts.length !== 3) throw new BadRequestException('Malformed proof JWT');
    const proofHeader  = JSON.parse(Buffer.from(proofParts[0], 'base64url').toString());
    const proofPayload = JSON.parse(Buffer.from(proofParts[1], 'base64url').toString());

    // c_nonce check
    if (proofPayload.nonce !== tokenState.cNonce) {
      throw new UnauthorizedException(
        `Proof nonce mismatch: expected ${tokenState.cNonce}, got ${proofPayload.nonce}`,
      );
    }

    // Wallet public key from proof header
    if (!proofHeader.jwk) throw new BadRequestException('Proof JWT must carry jwk header');
    const walletPubKey = await importJWK(proofHeader.jwk, proofHeader.alg ?? 'ES256') as CryptoKey;

    // Verify proof signature
    try {
      await jwtVerify(proof.jwt, walletPubKey, { algorithms: [proofHeader.alg ?? 'ES256'] });
      this.logger.debug('Proof JWT signature verified ✓');
    } catch (e) {
      throw new UnauthorizedException(`Proof JWT signature invalid: ${String(e)}`);
    }

    const grant = await this.grantService.findOne(tokenState.grantId);

    // Build and sign the EAA SD-JWT VC
    const credential = this.issueEaaCredential(grant, tokenState.pidSubject, proofHeader.jwk);

    // Activate grant
    const credentialId = crypto.randomUUID();
    await this.grantService.activate(grant.id, tokenState.pidSubject, credentialId);

    // One-time use — delete token
    this.pendingTokens.delete(accessToken);

    this.logger.log(
      `EAA issued — grant: ${grant.id}, resource: ${grant.resourceId}, subject: ${tokenState.pidSubject}`,
    );

    return {
      format: 'dc+sd-jwt',
      credential,
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
    const privKey = crypto.createPrivateKey(this.signingKeyPem);
    const pubJwk  = crypto.createPublicKey(privKey).export({ format: 'jwk' });

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
      iss:     `${this.baseUrl}/issuer`,
      iat:     now,
      exp:     now + 365 * 24 * 3600,
      vct:     EAA_VCT,
      sub:     pidSubject,
      cnf:     { jwk: walletJwk },
      grant_id: grant.id,
      _sd:     disclosures.map(d => d.hash),
      _sd_alg: 'sha-256',
    };

    const header = { alg: 'ES256', typ: 'dc+sd-jwt', jwk: pubJwk };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sigInput = `${h}.${p}`;
    const derSig   = crypto.sign('SHA256', Buffer.from(sigInput), privKey);
    const issuerJwt = `${sigInput}.${this.derToJws(derSig)}`;

    // SD-JWT: issuer-jwt~disc1~disc2~  (trailing ~ = no KB-JWT at issuance time)
    return [issuerJwt, ...disclosures.map(d => d.encoded), ''].join('~');
  }

  // ── Issuer metadata (/.well-known/openid-credential-issuer) ───────────────
  getIssuerMetadata() {
    const base = `${this.baseUrl}/issuer`;
    return {
      // OID4VCI §11 — Credential Issuer Metadata
      credential_issuer: base,
      credential_endpoint: `${base}/credential`,
      token_endpoint: `${base}/token`,

      // RFC 8414 / OIDC Discovery — required for wallet to discover pre-auth grant type.
      // Without grant_types_supported including pre-authorized_code, the wallet falls
      // back to authorization code flow and shows a "login at service" dialog.
      grant_types_supported: [
        'urn:ietf:params:oauth:grant-type:pre-authorized_code',
      ],
      // No client authentication required for pre-auth flow
      token_endpoint_auth_methods_supported: ['none'],
      // OIDC / RFC 8414 required fields
      issuer: base,
      response_types_supported: ['token'],

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
      },
    };
  }

  // DER → JWS signature (R||S, 64 bytes) — copied from VerifierService
  private derToJws(der: Buffer): string {
    let i = 0;
    if (der[i++] !== 0x30) throw new Error('Not a DER SEQUENCE');
    if (der[i] & 0x80) i += (der[i] & 0x7f) + 1; else i++;
    if (der[i++] !== 0x02) throw new Error('Expected R INTEGER');
    const rLen = der[i++];
    let r = der.subarray(i, i + rLen); i += rLen;
    if (der[i++] !== 0x02) throw new Error('Expected S INTEGER');
    const sLen = der[i++];
    let s = der.subarray(i, i + sLen);
    while (r.length > 32 && r[0] === 0x00) r = r.subarray(1);
    while (s.length > 32 && s[0] === 0x00) s = s.subarray(1);
    const out = Buffer.alloc(64);
    r.copy(out, 32 - r.length);
    s.copy(out, 64 - s.length);
    return out.toString('base64url');
  }
}
