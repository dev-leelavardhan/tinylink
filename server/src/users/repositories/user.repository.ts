import { Injectable } from '@nestjs/common';
import { type Prisma, type User, type UserStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

interface UserFilter {
  email?: string;
  status?: UserStatus;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findMany(filter: UserFilter): Promise<User[]> {
    return this.prisma.user.findMany({
      where: this.buildFilter(filter),
    });
  }

  updateLastLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  incrementTokenVersion(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  private buildFilter(filter: UserFilter): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (filter.email) {
      where.email = filter.email;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    return where;
  }
}
