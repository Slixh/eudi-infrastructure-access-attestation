import { Controller, Post, Get, Body, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { AccessService } from './access.service';

@ApiTags('access (lock endpoint)')
@Controller('access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  // The physical lock calls this endpoint.
  // It presents the EAA credential it received from the wallet.
  @Post('check')
  @ApiOperation({
    summary: 'Lock calls this to verify an EAA and decide open/deny',
    description: 'Lock sends EAA SD-JWT VC + resourceId. Returns { allowed: true } or 403.',
  })
  @ApiHeader({ name: 'x-lock-secret', description: 'Shared secret configured on the lock' })
  async checkAccess(
    @Body('resourceId') resourceId: string,
    @Body('credential') credential: string,
    @Headers('x-lock-secret') lockSecret: string,
  ) {
    return this.accessService.checkAccess(resourceId, credential, lockSecret);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Access log (admin)' })
  getLogs(@Query('resourceId') resourceId?: string) {
    return this.accessService.getAccessLogs(resourceId);
  }
}
