import { Controller, Get, Post, Delete, Param, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { GrantService } from './grant.service';
import { CreateGrantDto } from './dto/create-grant.dto';
import { renderInvitePage } from '../views/invite-page.view';

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
    const { deepLink } = await this.grantService.generateInviteToken(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderInvitePage(grant, deepLink));
  }
}
