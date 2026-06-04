import { Controller, Get, Post, Param, Body, Headers, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IssuerService } from './issuer.service';

@ApiTags('issuer (OID4VCI)')
@Controller('issuer')
export class IssuerController {
  constructor(private readonly issuerService: IssuerService) {}

  // Wallet fetches offer object when using credential_offer_uri parameter
  @Get('offers/:preAuthCode')
  @ApiOperation({ summary: 'OID4VCI: fetch credential offer object' })
  getOffer(@Param('preAuthCode') preAuthCode: string) {
    return this.issuerService.getOfferMetadata(preAuthCode);
  }

  // RFC 6749 / OID4VCI token endpoint
  // Content-Type: application/x-www-form-urlencoded (wallet sends form data)
  @Post('token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'OID4VCI: token endpoint (pre-authorized_code grant)' })
  token(@Body() body: Record<string, string>) {
    return this.issuerService.handleTokenRequest(body);
  }

  // Credential endpoint
  @Post('credential')
  @ApiOperation({ summary: 'OID4VCI: credential endpoint — issues EAA SD-JWT VC' })
  credential(
    @Headers('authorization') authHeader: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.issuerService.handleCredentialRequest(authHeader, body);
  }

  // JWKS endpoint — serves issuer public key for credential verification
  @Get('jwks')
  @ApiOperation({ summary: 'OID4VCI: JWKS — issuer public key for SD-JWT VC verification' })
  jwks() {
    return this.issuerService.getJwks();
  }
}
