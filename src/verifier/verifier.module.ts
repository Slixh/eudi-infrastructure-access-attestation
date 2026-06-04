import { Module } from '@nestjs/common';
import { VerifierController } from './verifier.controller';
import { VerifierService } from './verifier.service';
import { GrantModule } from '../grant/grant.module';
import { IssuerModule } from '../issuer/issuer.module';

@Module({
  imports: [GrantModule, IssuerModule],
  controllers: [VerifierController],
  providers: [VerifierService],
})
export class VerifierModule {}
