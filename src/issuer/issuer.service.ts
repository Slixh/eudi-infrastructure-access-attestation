import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GrantService } from '../grant/grant.service';

// ---------------------------------------------------------------------------
// OID4VCI Issuer flow (OpenID for Verifiable Credential Issuance — draft 13+)
//
// High-level sequence:
//   1. VerifierService calls createCredentialOffer() after successful VP verification
//   2. Wallet fetches the credential offer (GET /issuer/offers/:id)
//   3. Wallet performs token request → POST /issuer/token  (pre-auth code grant)
//   4. Wallet requests the credential → POST /issuer/credential
//   5. This service signs an SD-JWT VC (the EAA) and returns it
// ---------------------------------------------------------------------------

@Injectable()
export class IssuerService {
  private readonly logger = new Logger(IssuerService.name);

  // In-memory offer store — replace with Redis/DB for production
  private readonly pendingOffers = new Map<string, { grantId: string; pidSubject: string; preAuthCode: string }>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly grantService: GrantService,
  ) {}

  // -------------------------------------------------------------------------
  // Called by VerifierService after VP verification.
  // Creates a pre-authorized credential offer and returns its URI.
  //
  // TODO (concrete steps):
  //   a) Import VcIssuer builder from @sphereon/oid4vci-issuer:
  //        import { VcIssuer, VcIssuerBuilder } from '@sphereon/oid4vci-issuer'
  //        import { IssuerMetadata } from '@sphereon/oid4vci-common'
  //
  //   b) Build a VcIssuer ONCE at module init:
  //        this.vcIssuer = new VcIssuerBuilder()
  //          .withIssuerMetadata({
  //            credential_issuer: `${baseUrl}/issuer`,
  //            credential_endpoint: `${baseUrl}/issuer/credential`,
  //            credentials_supported: [EAA_CREDENTIAL_METADATA],  // define separately
  //          })
  //          .withInMemoryCNonceState()
  //          .withInMemoryCredentialOfferState()
  //          .build()
  //
  //   c) Call vcIssuer.createCredentialOfferURI({
  //        grants: { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
  //          'pre-authorized_code': preAuthCode,
  //          user_pin_required: false,
  //        }},
  //        credentials: ['eu.europa.ec.eudi.pid.eaa.1'],
  //      })
  //      This returns a credential offer URI like:
  //        openid-credential-offer://?credential_offer_uri=https://...
  //
  //   d) Store preAuthCode → { grantId, pidSubject } mapping in pendingOffers map
  //
  //   e) Return the full credential offer URI to the wallet
  // -------------------------------------------------------------------------
  async createCredentialOffer(grantId: string, pidSubject: string): Promise<string> {
    const preAuthCode = crypto.randomUUID();
    this.pendingOffers.set(preAuthCode, { grantId, pidSubject, preAuthCode });

    // PLACEHOLDER — replace with real VcIssuer.createCredentialOfferURI() (see TODO above)
    this.logger.warn('createCredentialOffer: STUB — implement OID4VCI offer');
    const baseUrl = this.config.get('PUBLIC_BASE_URL', 'http://localhost:3000');
    return `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(
      `${baseUrl}/issuer/offers/${preAuthCode}`,
    )}`;
  }

  // -------------------------------------------------------------------------
  // Called by wallet to exchange pre-auth code for an access token.
  //
  // TODO (concrete steps):
  //   a) Validate grant_type === 'urn:ietf:params:oauth:grant-type:pre-authorized_code'
  //   b) Look up preAuthCode in pendingOffers map
  //   c) Generate a short-lived access token (sign with ISSUER_PRIVATE_KEY_JWK using jose)
  //   d) Store access token → grantId mapping
  //   e) Return { access_token, token_type: 'bearer', expires_in: 300, c_nonce: <random> }
  //      (c_nonce is needed for proof of possession in the credential request)
  // -------------------------------------------------------------------------
  async handleTokenRequest(body: Record<string, string>): Promise<Record<string, unknown>> {
    this.logger.warn('handleTokenRequest: STUB — implement token endpoint');
    const { 'pre-authorized_code': code } = body;
    if (!code || !this.pendingOffers.has(code)) {
      throw new NotFoundException('Unknown pre-authorized_code');
    }
    const cNonce = crypto.randomUUID();
    return {
      access_token: `stub-token-${crypto.randomUUID()}`,
      token_type: 'bearer',
      expires_in: 300,
      c_nonce: cNonce,
    };
  }

  // -------------------------------------------------------------------------
  // Called by wallet to request the actual EAA credential.
  //
  // TODO (concrete steps):
  //   a) Validate Bearer token from Authorization header
  //   b) Validate proof of possession JWT (wallet proves it holds the private key):
  //        const { payload } = await jwtVerify(body.proof.jwt, walletPublicKey)
  //        Verify payload.nonce === stored c_nonce for this session
  //
  //   c) Build the SD-JWT VC payload:
  //        const claims = {
  //          vct: 'eu.europa.ec.eudi.pid.eaa.1',
  //          iss: issuerDid,
  //          sub: walletDid,                // from proof JWT
  //          iat: Math.floor(Date.now()/1000),
  //          exp: iat + 365*24*3600,
  //          // EAA-specific claims:
  //          'eu.europa.ec.eudi.pid.eaa.1': {
  //            granted_resource: grant.resourceId,
  //            grant_id: grant.id,
  //          },
  //        }
  //
  //   d) Sign as SD-JWT VC using @sd-jwt/sd-jwt-vc:
  //        import { SDJwtVcInstance } from '@sd-jwt/sd-jwt-vc'
  //        const sdjwt = new SDJwtVcInstance({
  //          signer: async (data) => sign(data, issuerPrivateKey),   // jose SignJWT
  //          hasher: (data, alg) => digest(data, alg),
  //          hashAlg: 'sha-256',
  //          saltGenerator: () => crypto.randomUUID(),
  //        })
  //        const credential = await sdjwt.issue(claims, disclosureFrame)
  //        disclosureFrame marks which fields the holder can selectively disclose
  //
  //   e) Activate the grant: grantService.activate(grantId, pidSubject, credentialId)
  //
  //   f) Return { format: 'vc+sd-jwt', credential: <sd-jwt-string> }
  // -------------------------------------------------------------------------
  async handleCredentialRequest(
    authHeader: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.logger.warn('handleCredentialRequest: STUB — implement SD-JWT VC issuance');
    return {
      format: 'vc+sd-jwt',
      credential: 'STUB-CREDENTIAL-NOT-REAL',
    };
  }

  // Serve credential offer metadata (wallet fetches this after scanning QR)
  getOfferMetadata(preAuthCode: string) {
    const offer = this.pendingOffers.get(preAuthCode);
    if (!offer) throw new NotFoundException('Offer not found or expired');
    return {
      credential_issuer: this.config.get('PUBLIC_BASE_URL', 'http://localhost:3000') + '/issuer',
      credentials: ['eu.europa.ec.eudi.pid.eaa.1'],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthCode,
          user_pin_required: false,
        },
      },
    };
  }
}
