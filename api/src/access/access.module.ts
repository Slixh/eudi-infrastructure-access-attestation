import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { GrantModule } from '../grant/grant.module';

@Module({
  imports: [GrantModule],
  controllers: [AccessController],
  providers: [AccessService],
})
export class AccessModule {}
