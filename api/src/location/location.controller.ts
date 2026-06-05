import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('locations')
@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a location' })
  create(@Body() dto: CreateLocationDto) {
    return this.locationService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all locations (with resource count). Add ?page=1&limit=20 for pagination.' })
  findAll(@Query() pagination: PaginationDto) {
    return this.locationService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a location with its resources' })
  findOne(@Param('id') id: string) {
    return this.locationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a location' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a location (fails if resources exist)' })
  remove(@Param('id') id: string) {
    return this.locationService.remove(id);
  }
}
