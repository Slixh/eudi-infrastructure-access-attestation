import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GrantController } from './grant.controller';
import { GrantService } from './grant.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRY', '7d')) as any },
      }),
    }),
  ],
  controllers: [GrantController],
  providers: [GrantService],
  exports: [GrantService],
})
export class GrantModule {}
