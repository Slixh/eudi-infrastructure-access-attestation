import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
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

  @Post(':id/invite')
  @ApiOperation({ summary: 'Generate invite token + OID4VP deep-link for wallet' })
  generateInvite(@Param('id') id: string) {
    return this.grantService.generateInviteToken(id);
  }
}
