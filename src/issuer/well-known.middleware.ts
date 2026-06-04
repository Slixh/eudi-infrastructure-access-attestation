import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { IssuerService } from './issuer.service';

// Middleware approach to /.well-known/* discovery endpoints.
// Runs BEFORE NestJS route matching so it bypasses any routing quirks with
// dots in path prefixes or playit.gg/Traefik path normalization.
//
// Handles all variants that OID4VCI wallets and OAuth clients may request:
//   /.well-known/openid-credential-issuer          (OID4VCI §11.2, issuer at root)
//   /.well-known/openid-credential-issuer/issuer   (OID4VCI §11.2, issuer at /issuer)
//   /.well-known/oauth-authorization-server         (RFC 8414)
//   /.well-known/oauth-authorization-server/issuer  (RFC 8414, AS at /issuer)
//   /.well-known/openid-configuration               (OIDC discovery)
//   /.well-known/openid-configuration/issuer        (OIDC discovery, issuer at /issuer)
@Injectable()
export class WellKnownMiddleware implements NestMiddleware {
  private static readonly HANDLED_PATHS = new Set([
    '/.well-known/openid-credential-issuer',
    '/.well-known/openid-credential-issuer/issuer',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/issuer',
    '/.well-known/openid-configuration',
    '/.well-known/openid-configuration/issuer',
  ]);

  constructor(private readonly issuerService: IssuerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Log ALL requests to spot path encoding differences
    if (req.path.includes('well-known')) {
      console.log(`[WellKnownMiddleware] path="${req.path}" originalUrl="${req.originalUrl}" handled=${WellKnownMiddleware.HANDLED_PATHS.has(req.path)}`);
    }
    if (WellKnownMiddleware.HANDLED_PATHS.has(req.path)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Served-By', 'WellKnownMiddleware');
      return res.json(this.issuerService.getIssuerMetadata());
    }
    next();
  }
}
