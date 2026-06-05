import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGrantDto } from './dto/create-grant.dto';
import { GrantStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { buildPrismaPage, paginate, isPaginated } from '../common/pagination.util';

@Injectable()
export class GrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateGrantDto) {
    // Resolve resource identifiers to auto-populate the legacy resourceId claim
    const resources = await this.prisma.resource.findMany({
      where: { id: { in: dto.resourceEntityIds } },
      select: { id: true, identifier: true },
    });
    const resourceId = resources.map((r) => r.identifier).join(',');

    return this.prisma.grant.create({
      data: {
        label:        dto.label,
        resourceId,
        resources:    { connect: dto.resourceEntityIds.map((id) => ({ id })) },
        pidFirstName:  dto.pidFirstName  ?? null,
        pidFamilyName: dto.pidFamilyName ?? null,
        pidBirthdate:  dto.pidBirthdate  ?? null,
      },
      include: { resources: { include: { location: true } } },
    });
  }

  async findAll(pagination: PaginationDto = {}) {
    const query = {
      orderBy: { createdAt: 'desc' as const },
      include: { resources: { include: { location: true } } },
    };

    if (!isPaginated(pagination)) {
      return this.prisma.grant.findMany(query);
    }

    const [data, total] = await Promise.all([
      this.prisma.grant.findMany({ ...query, ...buildPrismaPage(pagination) }),
      this.prisma.grant.count(),
    ]);
    return paginate(data, total, pagination);
  }

  async findOne(id: string) {
    const grant = await this.prisma.grant.findUnique({
      where: { id },
      include: { resources: { include: { location: true } } },
    });
    if (!grant) throw new NotFoundException(`Grant ${id} not found`);
    return grant;
  }

  async revoke(id: string) {
    await this.findOne(id);
    return this.prisma.grant.update({
      where: { id },
      data: { status: GrantStatus.REVOKED },
    });
  }

  // Generates a signed JWT invite token and stores it on the grant.
  // The token payload contains the grantId — the VerifierModule uses it
  // to look up the grant after the wallet presents the PID VP.
  async generateInviteToken(id: string): Promise<{ token: string; deepLink: string }> {
    const grant = await this.findOne(id);
    const token = this.jwt.sign({ sub: grant.id, type: 'invite' });
    await this.prisma.grant.update({ where: { id }, data: { inviteToken: token } });

    const baseUrl  = this.config.get('PUBLIC_BASE_URL', 'http://localhost:3000');
    // client_id must be present in the deep-link itself (OID4VP §5.2 / HAIP §6).
    // The wallet checks client_id BEFORE fetching the request_uri.
    const clientId = this.config.get('RP_CLIENT_ID', '');
    const requestUri = `${baseUrl}/verifier/request?inviteToken=${token}`;
    // OID4VP Authorization Request deep-link — wallet opens this URL
    // The VerifierModule serves the actual JAR (request object) behind /verifier/request
    const deepLink =
      `openid4vp://authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&client_id_scheme=x509_hash` +
      `&request_uri=${encodeURIComponent(requestUri)}`;

    return { token, deepLink };
  }

  async findByInviteToken(token: string) {
    return this.prisma.grant.findUnique({ where: { inviteToken: token } });
  }

  async activate(id: string, pidSubject: string, credentialId: string) {
    return this.prisma.grant.update({
      where: { id },
      data: { status: GrantStatus.ACTIVE, pidSubject, credentialId },
    });
  }
}
