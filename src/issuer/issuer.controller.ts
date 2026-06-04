import { Controller, Get, Post, Param, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IssuerService } from './issuer.service';

@ApiTags('issuer (OID4VCI)')
@Controller('issuer')
export class IssuerController {
  constructor(private readonly issuerService: IssuerService) {}

  // Wallet fetches offer metadata from this URL
  @Get('offers/:preAuthCode')
  @ApiOperation({ summary: 'OID4VCI: fetch credential offer object' })
  getOffer(@Param('preAuthCode') preAuthCode: string) {
    return this.issuerService.getOfferMetadata(preAuthCode);
  }

  // RFC 6749 token endpoint — wallet exchanges pre-auth code for access token
  @Post('token')
  @ApiOperation({ summary: 'OID4VCI: token endpoint (pre-authorized_code grant)' })
  token(@Body() body: Record<string, string>) {
    return this.issuerService.handleTokenRequest(body);
  }

  // Credential endpoint — wallet presents access token + proof, gets SD-JWT VC
  @Post('credential')
  @ApiOperation({ summary: 'OID4VCI: credential endpoint — issues SD-JWT EAA' })
  credential(
    @Headers('authorization') authHeader: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.issuerService.handleCredentialRequest(authHeader, body);
  }

  // Well-known metadata endpoint (wallets auto-discover via this)
  @Get('.well-known/openid-credential-issuer')
  @ApiOperation({ summary: 'OID4VCI: Issuer metadata discovery' })
  wellKnown() {
    return {
      credential_issuer: process.env.PUBLIC_BASE_URL + '/issuer',
      credential_endpoint: process.env.PUBLIC_BASE_URL + '/issuer/credential',
      token_endpoint: process.env.PUBLIC_BASE_URL + '/issuer/token',
      credentials_supported: [
        {
          format: 'vc+sd-jwt',
          id: 'eu.europa.ec.eudi.pid.eaa.1',
          vct: 'eu.europa.ec.eudi.pid.eaa.1',
          cryptographic_binding_methods_supported: ['did:key', 'jwk'],
          credential_signing_alg_values_supported: ['EdDSA', 'ES256'],
        },
      ],
    };
  }
}
