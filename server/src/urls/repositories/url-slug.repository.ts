import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UrlSlugRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string): Promise<{ urlId: string } | null> {
    return this.prisma.urlSlug.findUnique({
      where: { slug },
      select: { urlId: true },
    });
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const count = await this.prisma.urlSlug.count({ where: { slug } });
    return count > 0;
  }

  async createMany(
    data: Array<{ slug: string; urlId: string }>,
  ): Promise<void> {
    await this.prisma.urlSlug.createMany({ data, skipDuplicates: true });
  }

  async deleteByUrlId(urlId: string): Promise<void> {
    await this.prisma.urlSlug.deleteMany({ where: { urlId } });
  }
}
