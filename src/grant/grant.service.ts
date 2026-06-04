import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGrantDto } from './dto/create-grant.dto';
import { GrantStatus } from '@prisma/client';

@Injectable()
export class GrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async create(dto: CreateGrantDto) {
    return this.prisma.grant.create({
      data: { label: dto.label, resourceId: dto.resourceId },
    });
  }

  async findAll() {
    return this.prisma.grant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const grant = await this.prisma.grant.findUnique({ where: { id } });
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

    const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
    // OID4VP Authorization Request deep-link — wallet opens this URL
    // The VerifierModule serves the actual request_uri behind /verifier/request
    const deepLink = `openid4vp://authorize?request_uri=${encodeURIComponent(
      `${baseUrl}/verifier/request?inviteToken=${token}`,
    )}`;

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
