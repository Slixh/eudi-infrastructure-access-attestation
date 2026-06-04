import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { IssuerService } from './issuer/issuer.service';
import { VerboseExceptionFilter } from './logging.filter';
import type { Request, Response, NextFunction } from 'express';

// Centralized well-known routing map → which metadata producer to call.
// This removes ambiguity and duplication across middleware and controllers.
type WellKnownHandler = 'issuer' | 'oauth_as' | 'jwt_vc_issuer' | 'oidc_provider_unsupported';
const WELL_KNOWN_ROUTES: Record<string, WellKnownHandler> = {
  // OID4VCI Issuer metadata
  '/.well-known/openid-credential-issuer': 'issuer',
  '/.well-known/openid-credential-issuer/issuer': 'issuer',
  // OAuth 2.0 Authorization Server Discovery (RFC 8414)
  '/.well-known/oauth-authorization-server': 'oauth_as',
  '/.well-known/oauth-authorization-server/issuer': 'oauth_as',
  // SD-JWT VC: JWT VC Issuer metadata
  '/.well-known/jwt-vc-issuer': 'jwt_vc_issuer',
  '/.well-known/jwt-vc-issuer/issuer': 'jwt_vc_issuer',
  // Placeholders for classic OIDC OP discovery — currently unsupported, respond 404
  '/.well-known/openid-configuration': 'oidc_provider_unsupported',
  '/.well-known/openid-configuration/issuer': 'oidc_provider_unsupported',
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error', 'debug', 'verbose'] });

  // ── Well-known discovery middleware (registered before NestJS routing) ─────
  // Single source of truth: all well-known paths are served here to avoid
  // shadowing controller routes and to keep behavior consistent.
  const issuerService = app.get(IssuerService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const handler = WELL_KNOWN_ROUTES[req.path];
    if (handler) {
      res.setHeader('Cache-Control', 'no-store');
      switch (handler) {
        case 'issuer':
          return res.json(issuerService.getIssuerMetadata());
        case 'oauth_as':
          return res.json(issuerService.getAuthorizationServerMetadata());
        case 'jwt_vc_issuer':
          return res.json(issuerService.getJwtVcIssuerMetadata());
        case 'oidc_provider_unsupported':
          return res.status(404).json({
            error: 'not_found',
            error_description: 'OpenID Provider discovery is not supported by this service',
          });
      }
    }
    next();
  });

  // ── Request logger middleware ──────────────────────────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const body = req.body && Object.keys(req.body).length
      ? JSON.stringify(req.body).slice(0, 500)
      : '(empty)';
    logger.debug(`→ ${req.method} ${req.url}  body: ${body}`);
    next();
  });

  // ── Global exception filter (logs full details on any error) ───────────────
  app.useGlobalFilters(new VerboseExceptionFilter());

  // ── Validation ─────────────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ── Swagger ────────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('EUDI Access Management')
    .setDescription('Grant-based infrastructure access via EUDI Wallet')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
  logger.log(`Swagger UI: http://localhost:${port}/api`);
}

bootstrap();
