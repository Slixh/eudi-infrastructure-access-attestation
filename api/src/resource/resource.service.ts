import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { buildPrismaPage, paginate, isPaginated } from '../common/pagination.util';

@Injectable()
export class ResourceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateResourceDto) {
    // Verify location exists
    const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
    if (!location) throw new NotFoundException(`Location ${dto.locationId} not found`);

    try {
      return await this.prisma.resource.create({
        data: {
          name:        dto.name,
          identifier:  dto.identifier,
          description: dto.description ?? null,
          locationId:  dto.locationId,
        },
        include: { location: true },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(`Identifier '${dto.identifier}' is already in use`);
      }
      throw e;
    }
  }

  async findAll(pagination: PaginationDto = {}) {
    const query = {
      orderBy: [{ location: { name: 'asc' as const } }, { name: 'asc' as const }],
      include: {
        location: true,
        _count: { select: { grants: true } },
      },
    };

    if (!isPaginated(pagination)) {
      return this.prisma.resource.findMany(query);
    }

    const [data, total] = await Promise.all([
      this.prisma.resource.findMany({ ...query, ...buildPrismaPage(pagination) }),
      this.prisma.resource.count(),
    ]);
    return paginate(data, total, pagination);
  }

  async findOne(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        location: true,
        grants: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, label: true, status: true, createdAt: true },
        },
      },
    });
    if (!resource) throw new NotFoundException(`Resource ${id} not found`);
    return resource;
  }

  async findByIdentifier(identifier: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { identifier },
      include: { location: true },
    });
    if (!resource) throw new NotFoundException(`Resource with identifier '${identifier}' not found`);
    return resource;
  }

  async update(id: string, dto: UpdateResourceDto) {
    await this.findOne(id);
    try {
      return await this.prisma.resource.update({
        where: { id },
        data: dto,
        include: { location: true },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(`Identifier '${dto.identifier}' is already in use`);
      }
      throw e;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const grantCount = await this.prisma.grant.count({ where: { resources: { some: { id } } } });
    if (grantCount > 0) {
      throw new ConflictException(
        `Resource has ${grantCount} linked grant(s) — revoke them first`,
      );
    }
    return this.prisma.resource.delete({ where: { id } });
  }
}
