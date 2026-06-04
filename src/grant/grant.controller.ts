import { Controller, Get, Post, Delete, Param, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { GrantService } from './grant.service';
import { CreateGrantDto } from './dto/create-grant.dto';

@ApiTags('grants')
@Controller('grants')
export class GrantController {
  constructor(private readonly grantService: GrantService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new grant (admin)' })
  create(@Body() dto: CreateGrantDto) {
    return this.grantService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all grants (admin)' })
  findAll() {
    return this.grantService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.grantService.findOne(id);
  }

  @Delete(':id/revoke')
  @ApiOperation({ summary: 'Revoke a grant' })
  revoke(@Param('id') id: string) {
    return this.grantService.revoke(id);
  }

  // POST: generate/rotate the invite token (API — returns JSON)
  @Post(':id/invite')
  @ApiOperation({ summary: 'Generate invite token + OID4VP deep-link (JSON)' })
  generateInvite(@Param('id') id: string) {
    return this.grantService.generateInviteToken(id);
  }

  // GET: show invite page with QR code (browser-friendly HTML)
  @Get(':id/invite')
  @ApiOperation({ summary: 'Invite page with QR code for EUDI Wallet' })
  async invitePage(@Param('id') id: string, @Res() res: Response) {
    const grant = await this.grantService.findOne(id);

    // Generate (or reuse existing) invite token
    const { token, deepLink } = await this.grantService.generateInviteToken(id);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(deepLink)}`;

    const statusBadge = {
      PENDING:  { color: '#888',   label: 'Ausstehend' },
      ACTIVE:   { color: '#22c55e', label: 'Aktiv'     },
      REVOKED:  { color: '#ef4444', label: 'Widerrufen' },
    }[grant.status] ?? { color: '#888', label: grant.status };

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zugangseinladung — ${grant.label}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f7; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    }
    .card {
      background: #fff; border-radius: 16px; padding: 2.5rem 2rem;
      max-width: 480px; width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      text-align: center;
    }
    .badge {
      display: inline-block; font-size: .75rem; font-weight: 600;
      padding: .25rem .75rem; border-radius: 999px; color: #fff;
      background: ${statusBadge.color}; margin-bottom: 1rem;
    }
    h1 { font-size: 1.4rem; color: #1a1a2e; margin-bottom: .4rem; }
    .resource { font-size: .9rem; color: #666; margin-bottom: 2rem; }
    .qr { display: block; margin: 0 auto 1.5rem; border-radius: 12px;
          border: 1px solid #e5e7eb; }
    .btn {
      display: inline-block; background: #0066cc; color: #fff;
      padding: .85rem 2rem; border-radius: 10px;
      text-decoration: none; font-weight: 600; font-size: 1rem;
      margin-bottom: 1.5rem; transition: background .15s;
    }
    .btn:hover { background: #0052a3; }
    .hint { font-size: .82rem; color: #999; line-height: 1.6; }
    .token-box {
      background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px;
      padding: .6rem .8rem; margin-top: 1.5rem;
      font-family: monospace; font-size: .72rem; color: #555;
      word-break: break-all; text-align: left;
    }
    .token-label { font-size: .75rem; color: #999; margin-bottom: .3rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${statusBadge.label}</div>
    <h1>${grant.label}</h1>
    <p class="resource">Ressource: <strong>${grant.resourceId}</strong></p>

    <img class="qr" src="${qrUrl}" width="240" height="240" alt="Einladungs-QR-Code">

    <a class="btn" href="${deepLink}">In EUDI Wallet öffnen</a>

    <p class="hint">
      Gleiche Geräte? Button tippen.<br>
      Anderes Gerät? QR-Code mit der EUDI Wallet scannen.
    </p>

    <div class="token-box">
      <div class="token-label">Deep-Link</div>
      ${deepLink}
    </div>
  </div>
</body>
</html>`);
  }
}
