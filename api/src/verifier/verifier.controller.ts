import { Controller, Get, Post, Query, Body, Res, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { VerifierService } from './verifier.service';
import { renderCompletePage, renderCompleteNotFoundPage } from '../views/complete-page.view';

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
        response:  { type: 'string' },
        state:     { type: 'string' },
        error:     { type: 'string' },
        error_description: { type: 'string' },
      },
    },
  })
  async receiveVpResponse(@Body() body: Record<string, string>) {
    return this.verifierService.handleVpResponse(body);
  }

  // Browser lands here after the wallet POSTs the VP response.
  // Renders an HTML page with the OID4VCI credential offer deep-link.
  // The wallet (same-device) or user (cross-device) taps the link to collect the EAA.
  @Get('complete')
  @ApiOperation({ summary: 'Credential offer page shown to user after VP presentation' })
  complete(@Query('state') state: string, @Res() res: Response) {
    const offerUri = this.verifierService.getCompletion(state);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!offerUri) {
      return res.status(404).send(renderCompleteNotFoundPage());
    }
    res.send(renderCompletePage(offerUri));
  }
}
