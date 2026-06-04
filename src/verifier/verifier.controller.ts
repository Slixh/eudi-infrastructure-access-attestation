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

    if (!offerUri) {
      res.status(404).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <title>EUDI Access Management</title></head>
        <body style="font-family:sans-serif;max-width:600px;margin:4rem auto;padding:0 1rem">
          <h2>⚠️ Session not found</h2>
          <p>The credential offer has expired or was already collected.</p>
        </body></html>
      `);
      return;
    }

    // Encode the offer URI as a data URI QR code using a public QR API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(offerUri)}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Collect your Access Credential</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 520px; margin: 3rem auto; padding: 0 1.5rem; text-align: center; }
    h1   { font-size: 1.4rem; color: #1a1a2e; }
    p    { color: #555; line-height: 1.6; }
    .card { background: #f8f9fa; border-radius: 12px; padding: 2rem; margin: 1.5rem 0; }
    .qr   { display: block; margin: 0 auto 1.5rem; border-radius: 8px; }
    .btn  { display: inline-block; background: #0066cc; color: #fff; padding: .9rem 2rem;
            border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1rem; }
    .btn:hover { background: #0052a3; }
    .hint { font-size: .85rem; color: #888; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>✅ Identity Verified</h1>
  <p>Your identity was successfully verified.<br>
     Open the link below in your EUDI Wallet to collect your <strong>Access Attestation</strong>.</p>

  <div class="card">
    <img class="qr" src="${qrUrl}" width="240" height="240" alt="Credential offer QR code">
    <a class="btn" href="${offerUri}">Open in EUDI Wallet</a>
  </div>

  <p class="hint">
    Same device? Tap the button above.<br>
    Different device? Scan the QR code with your EUDI Wallet.
  </p>
</body>
</html>`);
  }
}
