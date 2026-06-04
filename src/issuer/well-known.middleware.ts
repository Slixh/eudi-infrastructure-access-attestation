import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { IssuerService } from './issuer.service';

@Injectable()
export class WellKnownMiddleware implements NestMiddleware {
  // OID4VCI / OAuth AS / OIDC discovery paths
  private static readonly ISSUER_METADATA_PATHS = new Set([
    '/.well-known/openid-credential-issuer',
    '/.well-known/openid-credential-issuer/issuer',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/issuer',
    '/.well-known/openid-configuration',
    '/.well-known/openid-configuration/issuer',
  ]);

  // SD-JWT VC §4.3 — JWT VC Issuer Metadata (JWKS for credential verification)
  private static readonly JWT_VC_PATHS = new Set([
    '/.well-known/jwt-vc-issuer',
    '/.well-known/jwt-vc-issuer/issuer',
  ]);

  constructor(private readonly issuerService: IssuerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Cache-Control', 'no-store');

    if (WellKnownMiddleware.ISSUER_METADATA_PATHS.has(req.path)) {
      return res.json(this.issuerService.getIssuerMetadata());
    }

    if (WellKnownMiddleware.JWT_VC_PATHS.has(req.path)) {
      // Inline JWKS so the wallet can verify issued SD-JWT VCs offline
      return res.json(this.issuerService.getJwtVcIssuerMetadata());
    }

    next();
  }
}
