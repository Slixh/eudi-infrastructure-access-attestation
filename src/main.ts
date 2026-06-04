import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { VerboseExceptionFilter } from './logging.filter';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error', 'debug', 'verbose'] });

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
