import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { GrantModule } from './grant/grant.module';
import { VerifierModule } from './verifier/verifier.module';
import { IssuerModule } from './issuer/issuer.module';
import { AccessModule } from './access/access.module';
import { WellKnownMiddleware } from './issuer/well-known.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    GrantModule,
    VerifierModule,
    IssuerModule,
    AccessModule,
  ],
})
export class AppModule implements NestModule {
  // Register the well-known middleware globally so it runs before any route
  // matching — this reliably serves OID4VCI/OIDC/RFC-8414 discovery for all
  // path variants that wallets may request.
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WellKnownMiddleware).forRoutes('*');
  }
}
