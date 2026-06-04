import { Controller, Get, Post, Delete, Param, Body, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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

  // GET: returns grant details + a fresh invite token + deep-link (JSON)
  // Returns 404 when the grant is already ACTIVE (already issued — invite no longer valid).
  @Get(':id/invite')
  @ApiOperation({ summary: 'Get grant details + OID4VP invite deep-link (JSON)' })
  async getInvite(@Param('id') id: string) {
    const grant = await this.grantService.findOne(id);
    if (grant.status === 'ACTIVE') {
      throw new NotFoundException('This grant has already been issued');
    }
    const { token, deepLink } = await this.grantService.generateInviteToken(id);
    return { grant, token, deepLink };
  }

  // POST: generate/rotate the invite token (also returns JSON — kept for API clients)
  @Post(':id/invite')
  @ApiOperation({ summary: 'Rotate invite token + OID4VP deep-link (JSON)' })
  generateInvite(@Param('id') id: string) {
    return this.grantService.generateInviteToken(id);
  }
}
