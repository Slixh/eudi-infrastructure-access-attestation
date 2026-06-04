import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GrantStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// AccessService — called by the physical lock/door controller
//
// The lock sends the EAA SD-JWT VC it received from the wallet + its own
// resource ID, and this service decides whether to grant access.
//
// TODO (concrete steps for verifyPresentation):
//   a) Validate the shared secret from the lock's X-Lock-Secret header against
//      ACCESS_SHARED_SECRET env var (HMAC or simple string compare for now)
//
//   b) Decode the SD-JWT VC (same as in VerifierService step 2c):
//        const [issuerJwt, ...disclosures] = credential.split('~')
//        const { payload } = await jwtVerify(issuerJwt, issuerPublicKey)
//        Verify iss === TRUSTED_PID_ISSUER_DID (same trust chain check!)
//
//   c) Verify the EAA claims:
//        payload['eu.europa.ec.eudi.pid.eaa.1'].granted_resource === resourceId
//        payload.exp > Date.now()/1000  (not expired)
//
//   d) Look up the grant by credentialId (payload.jti or a custom claim):
//        grant.status === ACTIVE
//        grant.resourceId === resourceId
//
//   e) Write an AccessLog entry (success/failure + reason)
//
//   f) Return { allowed: true } or throw ForbiddenException
// ---------------------------------------------------------------------------

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async checkAccess(
    resourceId: string,
    credential: string,
    lockSecret: string,
  ): Promise<{ allowed: boolean }> {
    // Validate the lock's shared secret
    const expectedSecret = this.config.get<string>('ACCESS_SHARED_SECRET');
    if (!expectedSecret || lockSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid lock secret');
    }

    // PLACEHOLDER — replace with real SD-JWT VC verification (see TODO above)
    this.logger.warn('checkAccess: STUB — implement EAA credential verification');

    // For now: look up any ACTIVE grant for this resourceId as a placeholder
    const grant = await this.prisma.grant.findFirst({
      where: { resourceId, status: GrantStatus.ACTIVE },
    });

    if (!grant) {
      await this.prisma.accessLog.create({
        data: { grantId: 'unknown', success: false, reason: 'no active grant for resource' },
      }).catch(() => {});
      throw new ForbiddenException('No active grant for this resource');
    }

    await this.prisma.accessLog.create({
      data: { grantId: grant.id, success: true },
    });

    return { allowed: true };
  }

  async getAccessLogs(resourceId?: string) {
    return this.prisma.accessLog.findMany({
      where: resourceId ? { grant: { resourceId } } : undefined,
      include: { grant: { select: { label: true, resourceId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
