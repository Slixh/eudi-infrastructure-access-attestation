import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('resources')
@Controller('resources')
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a resource at a location' })
  create(@Body() dto: CreateResourceDto) {
    return this.resourceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all resources (with location + grant count). Add ?page=1&limit=20 for pagination.' })
  findAll(@Query() pagination: PaginationDto) {
    return this.resourceService.findAll(pagination);
  }

  @Get('by-identifier')
  @ApiOperation({ summary: 'Look up a resource by its machine identifier' })
  @ApiQuery({ name: 'identifier', required: true })
  findByIdentifier(@Query('identifier') identifier: string) {
    return this.resourceService.findByIdentifier(identifier);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a resource with location and linked grants' })
  findOne(@Param('id') id: string) {
    return this.resourceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a resource (name, identifier, description)' })
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourceService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resource (fails if linked grants exist)' })
  remove(@Param('id') id: string) {
    return this.resourceService.remove(id);
  }
}
