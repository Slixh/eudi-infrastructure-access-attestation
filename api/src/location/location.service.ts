import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { buildPrismaPage, paginate, isPaginated } from '../common/pagination.util';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    return this.prisma.location.create({
      data: {
        name:       dto.name,
        street:     dto.street,
        postalCode: dto.postalCode,
        city:       dto.city,
        country:    dto.country ?? 'DE',
        notes:      dto.notes ?? null,
      },
    });
  }

  async findAll(pagination: PaginationDto = {}) {
    const query = {
      orderBy: { name: 'asc' as const },
      include: { _count: { select: { resources: true } } },
    };

    if (!isPaginated(pagination)) {
      return this.prisma.location.findMany(query);
    }

    const [data, total] = await Promise.all([
      this.prisma.location.findMany({ ...query, ...buildPrismaPage(pagination) }),
      this.prisma.location.count(),
    ]);
    return paginate(data, total, pagination);
  }

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { resources: { orderBy: { name: 'asc' } } },
    });
    if (!location) throw new NotFoundException(`Location ${id} not found`);
    return location;
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const resourceCount = await this.prisma.resource.count({ where: { locationId: id } });
    if (resourceCount > 0) {
      throw new ConflictException(
        `Location has ${resourceCount} resource(s) — remove them first`,
      );
    }
    return this.prisma.location.delete({ where: { id } });
  }
}
