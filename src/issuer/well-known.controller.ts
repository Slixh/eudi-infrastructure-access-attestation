import { Controller, Get, All, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IssuerService } from './issuer.service';

// Root-level OID4VCI / OAuth 2.0 well-known discovery.
//
// A single catch-all route under /.well-known/ handles all discovery variants
// so we don't fight NestJS path-to-regexp for exact path matching.
@Controller()
export class WellKnownController {
  constructor(private readonly issuerService: IssuerService) {}

  // Catches all GET requests under /.well-known/* and serves issuer metadata.
  // OID4VCI §11.2 paths:
  //   /.well-known/openid-credential-issuer
  //   /.well-known/openid-credential-issuer/issuer
  // RFC 8414 paths:
  //   /.well-known/oauth-authorization-server
  //   /.well-known/oauth-authorization-server/issuer
  // OIDC discovery (some wallets):
  //   /.well-known/openid-configuration
  //   /.well-known/openid-configuration/issuer
  @Get([
    '.well-known/openid-credential-issuer',
    '.well-known/openid-credential-issuer/issuer',
    '.well-known/oauth-authorization-server',
    '.well-known/oauth-authorization-server/issuer',
    '.well-known/openid-configuration',
    '.well-known/openid-configuration/issuer',
  ])
  wellKnown() {
    return this.issuerService.getIssuerMetadata();
  }
}
