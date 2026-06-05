import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { GrantModule } from './grant/grant.module';
import { VerifierModule } from './verifier/verifier.module';
import { IssuerModule } from './issuer/issuer.module';
import { AccessModule } from './access/access.module';
import { LocationModule } from './location/location.module';
import { ResourceModule } from './resource/resource.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LocationModule,
    ResourceModule,
    GrantModule,
    VerifierModule,
    IssuerModule,
    AccessModule,
  ],
})
export class AppModule {}
