import { Controller, Get, Post, Query, Body, Res, Header, NotFoundException, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { VerifierService } from './verifier.service';

@ApiTags('verifier (OID4VP)')
@Controller('verifier')
export class VerifierController {
  constructor(private readonly verifierService: VerifierService) {}

  // Wallet fetches the Authorization Request Object (JAR) via request_uri.
  // Content-Type must be application/oauth-authz-req+jwt per OID4VP §11.
  @Get('request')
  @Header('Content-Type', 'application/oauth-authz-req+jwt')
  @ApiOperation({ summary: 'OID4VP: serve Authorization Request Object (JAR)' })
  @ApiQuery({ name: 'inviteToken', required: true })
  async getAuthorizationRequest(
    @Query('inviteToken') inviteToken: string,
    @Res() res: Response,
  ) {
    const jar = await this.verifierService.buildAuthorizationRequest(inviteToken);
    res.send(jar);
  }

  // Wallet POSTs the encrypted VP response here (direct_post.jwt).
  // Body: application/x-www-form-urlencoded
  //   - response = JWE compact serialization   (direct_post.jwt mode)
  //   - state    = inviteToken                 (may be absent; looked up via kid)
  //   OR:
  //   - error / error_description              (wallet error response)
  @Post('response')
  @ApiOperation({ summary: 'OID4VP: receive VP Token from wallet (direct_post.jwt)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        response:          { type: 'string' },
        state:             { type: 'string' },
        error:             { type: 'string' },
        error_description: { type: 'string' },
      },
    },
  })
  @HttpCode(200)
  async receiveVpResponse(@Body() body: Record<string, string>) {
    return this.verifierService.handleVpResponse(body);
  }

  // Panel completion page fetches this to get the credential offer URI.
  // Returns { offerUri } — the panel renders the QR code and button.
  @Get('complete')
  @ApiOperation({ summary: 'OID4VP: get credential offer URI after VP presentation' })
  @ApiQuery({ name: 'state', required: true })
  getCompletion(@Query('state') state: string) {
    const offerUri = this.verifierService.getCompletion(state);
    if (!offerUri) throw new NotFoundException('Session not found or already consumed');
    return { offerUri };
  }
}
