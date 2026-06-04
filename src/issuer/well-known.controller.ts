import { Controller, Get } from '@nestjs/common';
import { IssuerService } from './issuer.service';

// OID4VCI §11.2 alternative discovery path:
// credential_issuer = https://host/issuer
// → wallet fetches https://host/.well-known/openid-credential-issuer/issuer
//
// This controller handles that root-level path in addition to the standard
// /issuer/.well-known/openid-credential-issuer route in IssuerController.
@Controller('.well-known/openid-credential-issuer')
export class WellKnownController {
  constructor(private readonly issuerService: IssuerService) {}

  // Matches: GET /.well-known/openid-credential-issuer/issuer
  @Get('issuer')
  wellKnownIssuer() {
    return this.issuerService.getIssuerMetadata();
  }

  // Matches: GET /.well-known/openid-credential-issuer
  // (credential_issuer = https://host, no path suffix)
  @Get()
  wellKnownRoot() {
    return this.issuerService.getIssuerMetadata();
  }
}
