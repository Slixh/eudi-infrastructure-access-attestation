import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { IssuerService } from './issuer/issuer.service';
import { VerboseExceptionFilter } from './logging.filter';
import type { Request, Response, NextFunction } from 'express';

// All /.well-known/* paths the wallet may request for OID4VCI / SD-JWT VC discovery.
// Registered as a raw Express middleware (app.use) so they work regardless of
// whether NestJS has a matching controller route.
const WELL_KNOWN_ISSUER_PATHS = new Set([
  '/.well-known/openid-credential-issuer',
  '/.well-known/openid-credential-issuer/issuer',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-authorization-server/issuer',
  '/.well-known/openid-configuration',
  '/.well-known/openid-configuration/issuer',
]);

const WELL_KNOWN_JWT_VC_PATHS = new Set([
  '/.well-known/jwt-vc-issuer',
  '/.well-known/jwt-vc-issuer/issuer',
]);

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error', 'debug', 'verbose'] });

  // ── Well-known discovery middleware (registered before NestJS routing) ─────
  // Must use app.use() here — NestJS MiddlewareConsumer.forRoutes('*') only
  // applies to registered controller routes, not arbitrary unmatched paths.
  const issuerService = app.get(IssuerService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (WELL_KNOWN_ISSUER_PATHS.has(req.path)) {
      res.setHeader('Cache-Control', 'no-store');
      // Serve the correct document per path
      if (req.path === '/.well-known/oauth-authorization-server' || req.path === '/.well-known/oauth-authorization-server/issuer') {
        return res.json(issuerService.getAuthorizationServerMetadata());
      }
      return res.json(issuerService.getIssuerMetadata());
    }
    if (WELL_KNOWN_JWT_VC_PATHS.has(req.path)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(issuerService.getJwtVcIssuerMetadata());
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
