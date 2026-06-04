import { Controller, Get, Post, Query, Body, Res, Header } from '@nestjs/common';
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

  // Wallet POSTs the encrypted VP response here.
  // direct_post.jwt: body = { response: <JWE>, state: <inviteToken> }
  // direct_post (Erica fallback): body = { vp_token: <SD-JWT>, state: <inviteToken> }
  // Both arrive as application/x-www-form-urlencoded
  @Post('response')
  @ApiOperation({ summary: 'OID4VP: receive VP Token from wallet (direct_post.jwt)' })
  @ApiBody({ schema: { type: 'object', properties: { response: { type: 'string' }, state: { type: 'string' } } } })
  async receiveVpResponse(@Body() body: Record<string, string>) {
    return this.verifierService.handleVpResponse(body);
  }

  // Browser lands here after the wallet has posted the VP response.
  // The frontend polls this endpoint or redirects to show the credential offer QR.
  @Get('complete')
  @ApiOperation({ summary: 'Landing page after wallet completes VP presentation' })
  complete(@Query('state') state: string) {
    return { status: 'complete', state, message: 'VP presentation accepted. Check your wallet for the credential offer.' };
  }
}
