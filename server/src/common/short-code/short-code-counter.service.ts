import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SHORT_CODE_SEQUENCE } from './short-code.constants';

@Injectable()
export class ShortCodeCounterService {
  constructor(private readonly prisma: PrismaService) {}

  // The `short_code_counter` sequence is created by Prisma migrations
  // (see migration `identifier_model`), so no runtime DDL is needed here.

  async next(): Promise<bigint> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ nextval: bigint }>>(
      `SELECT nextval('${SHORT_CODE_SEQUENCE}') AS nextval`,
    );

    return rows[0].nextval;
  }
}
