import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrantService } from '../grant/grant.service';
import { IssuerService } from '../issuer/issuer.service';
import { signCompact } from '../common/jwt.util';
import {
  generateKeyPair,
  exportJWK,
  compactDecrypt,
  jwtVerify,
  importX509,
} from 'jose';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface Session {
  nonce: string;
  inviteToken: string;
  kid: string;
  ephemeralPrivateKey: CryptoKey;
  createdAt: Date;
}

@Injectable()
export class VerifierService implements OnModuleInit {
  private readonly logger = new Logger(VerifierService.name);

  // Per-request sessions: inviteToken → session
  // Also indexed by kid for JWE header lookup (wallet may omit state form field)
  private readonly sessions = new Map<string, Session>();          // key = inviteToken
  private readonly sessionsByKid = new Map<string, Session>();     // key = kid

  // Completed verifications: state → credential offer URI
  // The /verifier/complete browser page reads this to show the offer to the user
  private readonly completions = new Map<string, string>();        // key = inviteToken

  // Loaded once at startup
  private signingKeyPem: string;
  private certPem: string;
  private x5c: string;        // base64 DER for x5c header
  private clientId: string;
  private baseUrl: string;
  private registrationCertJwt: string;

  constructor(
    private readonly config: ConfigService,
    private readonly grantService: GrantService,
    private readonly issuerService: IssuerService,
  ) {}

  onModuleInit() {
    this.signingKeyPem = fs.readFileSync(
      path.resolve(this.config.get('RP_SIGNING_KEY_PATH', 'certs/rp-signing.key')),
      'utf8',
    );
    this.certPem = fs.readFileSync(
      path.resolve(this.config.get('RP_ACCESS_CERT_PATH', 'certs/access-certificate.crt')),
      'utf8',
    );
    const cert = new crypto.X509Certificate(this.certPem);
    this.x5c = cert.raw.toString('base64');
    this.clientId = this.config.getOrThrow('RP_CLIENT_ID');
    this.baseUrl = this.config.get('PUBLIC_BASE_URL', 'http://localhost:3000');
    this.registrationCertJwt = this.config.get('RP_REGISTRATION_CERT_JWT', '');

    // Expire sessions older than 10 minutes
    setInterval(() => {
      const cutoff = Date.now() - 10 * 60_000;
      for (const [k, s] of this.sessions) {
        if (s.createdAt.getTime() < cutoff) this.sessions.delete(k);
      }
    }, 60_000).unref();

    this.logger.log(`Verifier ready — client_id: ${this.clientId}`);
  }

  // ── STEP 1 — Build OID4VP Authorization Request Object ────────────────────
  //
  // Returns a signed JWT (JAR) that the wallet fetches via request_uri.
  // HAIP requirements:
  //   - client_id_scheme: x509_hash
  //   - response_mode: direct_post.jwt  (response is JWE-encrypted)
  //   - Ephemeral encryption key in client_metadata.jwks (never reused!)
  //   - aud: https://self-issued.me/v2
  //   - DCQL query for PID (urn:eudi:pid:de:1)
  //   - verifier_info with Registration Certificate JWT
  async buildAuthorizationRequest(inviteToken: string): Promise<string> {
    const grant = await this.grantService.findByInviteToken(inviteToken);
    if (!grant) throw new UnauthorizedException('Invalid invite token');
    if (grant.status === 'REVOKED') throw new UnauthorizedException('Grant revoked');

    // Generate ephemeral ECDH key pair — wallet uses the public key to encrypt
    // the VP response. We decrypt it with the private key.
    // HAIP / German wallet requires ECDH-ES (direct) + A128GCM (not key-wrap variant).
    const { privateKey: ephPriv, publicKey: ephPub } = await generateKeyPair(
      'ECDH-ES',
      { crv: 'P-256', extractable: true },
    );
    const ephPubJwk = await exportJWK(ephPub);
    const nonce = crypto.randomUUID();
    const kid = `eph-${nonce.slice(0, 8)}`;

    const session: Session = {
      nonce,
      inviteToken,
      kid,
      ephemeralPrivateKey: ephPriv,
      createdAt: new Date(),
    };
    this.sessions.set(inviteToken, session);
    this.sessionsByKid.set(kid, session);

    const payload = {
      iss: this.clientId,
      aud: 'https://self-issued.me/v2',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      response_type: 'vp_token',
      client_id: this.clientId,
      client_id_scheme: 'x509_hash',
      response_mode: 'direct_post.jwt',
      response_uri: `${this.baseUrl}/verifier/response`,
      nonce,
      state: inviteToken,
      client_metadata: {
        authorization_encrypted_response_alg: 'ECDH-ES',
        authorization_encrypted_response_enc: 'A128GCM',
        jwks: {
          keys: [{
            ...ephPubJwk,
            use: 'enc',
            alg: 'ECDH-ES',
            kid: `eph-${nonce.slice(0, 8)}`,
          }],
        },
        vp_formats_supported: {
          'dc+sd-jwt': {
            'sd-jwt_alg_values': ['ES256'],
            'kb-jwt_alg_values': ['ES256'],
          },
        },
      },
      dcql_query: {
        credentials: [{
          id: 'pid',
          format: 'dc+sd-jwt',
          meta: { vct_values: ['urn:eudi:pid:de:1', 'urn:eudi:pid:1'] },
          claims: [
            { path: ['family_name'] },
            { path: ['given_name'] },
            { path: ['birthdate'] },
            { path: ['issuing_country'] },
          ],
        }],
      },
      ...(this.registrationCertJwt && {
        verifier_info: [{ format: 'registration_cert', data: this.registrationCertJwt }],
      }),
    };

    return this.signWithX5c(payload, 'oauth-authz-req+jwt');
  }

  // ── STEP 2 — Receive and process the VP response ───────────────────────────
  //
  // direct_post.jwt: body.response = JWE compact serialization
  // direct_post (Erica fallback): body.vp_token = SD-JWT string directly
  async handleVpResponse(
    body: Record<string, string>,
  ): Promise<{ redirect_uri: string; credentialOfferUri?: string }> {
    const { response, state: stateFromForm, vp_token: rawVpToken, error, error_description } = body;

    // Wallet may POST an error response (e.g. UnsupportedClientMetaData) instead of a VP token
    if (error) {
      this.logger.error(`Wallet returned error: ${error} — ${error_description ?? ''}`);
      throw new BadRequestException(`Wallet error: ${error} — ${error_description ?? ''}`);
    }

    let session: Session | undefined;
    let inviteToken: string;
    let vpToken: string;

    if (response) {
      // ── direct_post.jwt: decrypt JWE ─────────────────────────────────────
      // The wallet may omit state as a form field — look it up via kid in the
      // JWE protected header instead.
      const jweHeader = JSON.parse(
        Buffer.from(response.split('.')[0], 'base64url').toString(),
      );
      this.logger.debug(`JWE header: ${JSON.stringify(jweHeader)}`);

      if (stateFromForm) {
        session = this.sessions.get(stateFromForm);
        inviteToken = stateFromForm;
      } else if (jweHeader.kid) {
        session = this.sessionsByKid.get(jweHeader.kid);
        inviteToken = session?.inviteToken;
      }

      if (!session) {
        throw new UnauthorizedException(
          `No session found — state: ${stateFromForm ?? 'none'}, kid: ${jweHeader.kid ?? 'none'}`,
        );
      }

      try {
        const { plaintext } = await compactDecrypt(response, session.ephemeralPrivateKey);
        const inner: Record<string, any> = JSON.parse(new TextDecoder().decode(plaintext));
        this.logger.debug(`Decrypted inner payload: ${JSON.stringify(inner)}`);

        // State may also come from inside the JWE payload
        inviteToken = inviteToken ?? inner.state;

        // The nonce may or may not be in the outer JWE payload.
        // German reference wallet puts it only in the KB-JWT (verified later in verifyPidSdJwt).
        // If present here, do an early sanity check.
        if (inner.nonce !== undefined && inner.nonce !== session.nonce) {
          throw new UnauthorizedException(
            `Nonce mismatch — expected: ${session.nonce}, got: ${inner.nonce}`,
          );
        }

        // With DCQL, vp_token is an object { [credentialId]: sdJwtString | sdJwtString[] }
        // With presentation_definition, vp_token is a plain string
        const rawVp = inner.vp_token ?? inner.vpToken;
        if (typeof rawVp === 'string') {
          vpToken = rawVp;
        } else if (rawVp && typeof rawVp === 'object' && !Array.isArray(rawVp)) {
          // DCQL: pick the first credential value (our query has id = "pid")
          // The wallet may send { pid: "sd-jwt" } or { pid: ["sd-jwt"] }
          const firstVal = Object.values(rawVp)[0] as string | string[];
          vpToken = Array.isArray(firstVal) ? firstVal[0] : firstVal;
          this.logger.debug(
            `DCQL vp_token keys: ${Object.keys(rawVp).join(', ')} ` +
            `(value type: ${Array.isArray(firstVal) ? 'array' : typeof firstVal})`,
          );
        } else if (Array.isArray(rawVp)) {
          // Top-level array of SD-JWTs
          vpToken = rawVp[0] as string;
          this.logger.debug(`vp_token is top-level array, taking first element`);
        } else {
          throw new BadRequestException(`Unexpected vp_token type: ${typeof rawVp}`);
        }
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        this.logger.error('JWE decryption failed', String(e));
        throw new BadRequestException(`Failed to decrypt VP response: ${String(e)}`);
      }
    } else if (rawVpToken) {
      // ── direct_post fallback (unencrypted, e.g. Erica) ───────────────────
      this.logger.warn('Received vp_token directly (unencrypted direct_post)');
      inviteToken = stateFromForm;
      if (!inviteToken) throw new BadRequestException('Missing state in direct_post fallback');
      session = this.sessions.get(inviteToken);
      if (!session) throw new UnauthorizedException('Unknown or expired session');
      vpToken = rawVpToken;
    } else {
      throw new BadRequestException('Missing response or vp_token in body');
    }

    if (!vpToken) throw new BadRequestException('vp_token is empty after decryption');
    if (!inviteToken) throw new BadRequestException('Could not determine invite token / state');

    const pidClaims = await this.verifyPidSdJwt(vpToken, session.nonce);

    // Clean up both session indexes
    this.sessions.delete(inviteToken);
    this.sessionsByKid.delete(session.kid);

    this.logger.log(
      `PID verified — ${pidClaims.given_name} ${pidClaims.family_name} (${pidClaims.birthdate})`,
    );

    const grant = await this.grantService.findByInviteToken(inviteToken);
    if (!grant) throw new UnauthorizedException(`Grant not found for token: ${inviteToken}`);

    // Helper — redirect to the panel complete page carrying an error code.
    // The wallet gets a valid redirect_uri so it opens the browser; the page
    // shows an appropriate message to the user instead of the credential offer.
    const errorRedirect = (code: string, description: string) => {
      this.logger.warn(`VP accepted but redirecting with error — ${code}: ${description}`);
      const redirectUri =
        `${this.baseUrl}/panel/verifier/complete` +
        `?state=${encodeURIComponent(inviteToken)}` +
        `&error=${encodeURIComponent(code)}` +
        `&error_description=${encodeURIComponent(description)}`;
      return { redirect_uri: redirectUri };
    };

    // ── One-time issuance: ACTIVE grants cannot be re-issued ─────────────────
    if (grant.status === 'ACTIVE') {
      return errorRedirect(
        'grant_already_active',
        'Dieser Zugang wurde bereits ausgestellt und kann nicht erneut beansprucht werden.',
      );
    }

    // ── Optional PID binding check ────────────────────────────────────────────
    const mismatches: string[] = [];
    if (grant.pidFamilyName) {
      const expected = grant.pidFamilyName.trim().toLowerCase();
      const got      = String(pidClaims.family_name ?? '').trim().toLowerCase();
      if (got !== expected) mismatches.push('Nachname');
    }
    if (grant.pidFirstName) {
      const expected = grant.pidFirstName.trim().toLowerCase();
      const got      = String(pidClaims.given_name ?? '').trim().toLowerCase();
      if (got !== expected) mismatches.push('Vorname');
    }
    if (grant.pidBirthdate) {
      if (pidClaims.birthdate !== grant.pidBirthdate) mismatches.push('Geburtsdatum');
    }
    if (mismatches.length > 0) {
      this.logger.warn(
        `PID binding mismatch for grant ${grant.id}: ${mismatches.join(', ')} — ` +
        `presented: ${pidClaims.given_name} ${pidClaims.family_name} ${pidClaims.birthdate}`,
      );
      return errorRedirect(
        'pid_mismatch',
        `Die vorgelegte Identität stimmt nicht mit den hinterlegten Daten überein (${mismatches.join(', ')}).`,
      );
    }

    const pidSubject =
      (pidClaims.sub as string) ??
      `${pidClaims.given_name}:${pidClaims.family_name}:${pidClaims.birthdate}`;

    const credentialOfferUri = await this.issuerService.createCredentialOffer(grant.id, pidSubject);

    // Store credential offer for the browser completion page
    this.completions.set(inviteToken, credentialOfferUri);

    // Per OID4VP spec §8.2: return only redirect_uri in the HTTP 200 response.
    const redirectUri = `${this.baseUrl}/panel/verifier/complete?state=${encodeURIComponent(inviteToken)}`;
    return { redirect_uri: redirectUri };
  }

  // Called by the browser at /verifier/complete to retrieve the credential offer
  getCompletion(state: string): string | undefined {
    return this.completions.get(state);
  }

  // ── SD-JWT Verification ────────────────────────────────────────────────────
  private async verifyPidSdJwt(
    sdJwtString: string,
    expectedNonce: string,
  ): Promise<Record<string, any>> {
    // Format: <issuer-jwt>~<disclosure1>~...~<kb-jwt>
    const parts = sdJwtString.split('~');
    if (parts.length < 2) {
      throw new BadRequestException(`Invalid SD-JWT: expected at least 2 parts, got ${parts.length}`);
    }

    const issuerJwt   = parts[0];
    const kbJwt       = parts[parts.length - 1];
    const disclosures = parts.slice(1, kbJwt.length > 0 ? -1 : undefined);

    // ── 1. Parse issuer JWT header to find the signing key
    const [issuerHeaderB64, issuerPayloadB64] = issuerJwt.split('.');
    const issuerHeader  = JSON.parse(Buffer.from(issuerHeaderB64,  'base64url').toString());
    const issuerPayload = JSON.parse(Buffer.from(issuerPayloadB64, 'base64url').toString());

    // ── 2. Get issuer public key from x5c header
    // TODO (production): verify x5c chain leads to a trust-listed PID Provider CA
    //   - Download sandbox trust list from the LoTE URL
    //   - Verify issuerHeader.x5c[last] is signed by a trusted root
    //   - Currently: we trust the key in x5c[0] directly (sandbox only)
    let issuerPublicKey: CryptoKey;
    if (issuerHeader.x5c?.length > 0) {
      const derB64 = issuerHeader.x5c[0] as string;
      const pem = `-----BEGIN CERTIFICATE-----\n${
        Buffer.from(derB64, 'base64').toString('base64').match(/.{1,64}/g)!.join('\n')
      }\n-----END CERTIFICATE-----`;
      issuerPublicKey = await importX509(pem, issuerHeader.alg ?? 'ES256');
    } else if (issuerHeader.jwk) {
      const { importJWK } = await import('jose');
      issuerPublicKey = (await importJWK(issuerHeader.jwk, issuerHeader.alg ?? 'ES256')) as CryptoKey;
    } else {
      throw new BadRequestException('Issuer JWT has neither x5c nor jwk header');
    }

    // ── 3. Verify issuer JWT signature
    try {
      await jwtVerify(issuerJwt, issuerPublicKey, { algorithms: [issuerHeader.alg ?? 'ES256'] });
    } catch (e) {
      this.logger.error('Issuer JWT signature verification failed', String(e));
      throw new UnauthorizedException('PID issuer signature is invalid');
    }

    // ── 4. Decode selective disclosures → { claim_name: claim_value }
    const disclosed: Record<string, any> = {};
    for (const d of disclosures) {
      if (!d) continue;
      try {
        const decoded = JSON.parse(Buffer.from(d, 'base64url').toString());
        if (Array.isArray(decoded) && decoded.length === 3) {
          disclosed[decoded[1]] = decoded[2];
        }
      } catch { /* skip malformed disclosure */ }
    }

    // ── 5. Verify KB-JWT (key binding)
    // The KB-JWT is signed by the wallet's private key.
    // Its payload must contain our nonce and an sd_hash.
    if (kbJwt) {
      const [, kbPayloadB64] = kbJwt.split('.');
      const kbPayload = JSON.parse(Buffer.from(kbPayloadB64, 'base64url').toString());

      if (kbPayload.nonce !== expectedNonce) {
        throw new UnauthorizedException(
          `KB-JWT nonce mismatch: expected ${expectedNonce}, got ${kbPayload.nonce}`,
        );
      }

      // Verify KB-JWT signature with wallet public key from cnf.jwk
      if (issuerPayload.cnf?.jwk) {
        try {
          const { importJWK } = await import('jose');
          const [kbH] = kbJwt.split('.');
          const kbHeader = JSON.parse(Buffer.from(kbH, 'base64url').toString());
          const alg = kbHeader.alg ?? issuerPayload.cnf.jwk.alg ?? 'ES256';
          // importJWK requires alg when it is not present in the JWK itself
          const walletPubKey = await importJWK(issuerPayload.cnf.jwk, alg);
          await jwtVerify(kbJwt, walletPubKey, { algorithms: [alg] });
          this.logger.log('KB-JWT signature verified ✓');
        } catch (e) {
          this.logger.error('KB-JWT signature verification failed', String(e));
          throw new UnauthorizedException('KB-JWT signature is invalid');
        }
      }
    }

    return { ...issuerPayload, ...disclosed };
  }

  // ── Utility: sign a payload as JWT with x5c header ────────────────────────
  private signWithX5c(payload: Record<string, unknown>, typ: string): string {
    return signCompact({ alg: 'ES256', typ, x5c: [this.x5c] }, payload, this.signingKeyPem);
  }
}
