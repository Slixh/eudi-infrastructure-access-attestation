import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as path from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const dbUrl = process.env.DATABASE_URL?.replace('file:', '') ?? './dev.db';
    const adapter = new PrismaBetterSqlite3({ url: path.resolve(dbUrl) });
    super({ adapter } as any);
  }

  async onModuleInit() {
    await (this as any).$connect();
  }

  async onModuleDestroy() {
    await (this as any).$disconnect();
  }
}
