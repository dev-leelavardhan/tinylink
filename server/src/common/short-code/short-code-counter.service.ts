import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SHORT_CODE_SEQUENCE } from './short-code.constants';

@Injectable()
export class ShortCodeCounterService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS ${SHORT_CODE_SEQUENCE}`,
    );
  }

  async next(): Promise<bigint> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ nextval: bigint }>>(
      `SELECT nextval('${SHORT_CODE_SEQUENCE}') AS nextval`,
    );

    return rows[0].nextval;
  }
}
