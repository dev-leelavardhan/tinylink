import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { UrlRepository } from '../../urls/repositories/url.repository';
import {
  analyticsQuerySchema,
  paginationQuerySchema,
  type AnalyticsQueryDto,
  type PaginationQueryDto,
} from '../dto/analytics-query.dto';
import { AnalyticsService } from '../service/analytics.service';

@Controller('urls/:urlId/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly urlRepository: UrlRepository,
  ) {}

  @Get()
  async getAggregated(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: AnalyticsQueryDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    await this.verifyOwnership(urlId, req.user.userId);
    return this.analyticsService.getAggregated(urlId, query.days);
  }

  @Get('clicks')
  async getRecentClicks(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQueryDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    await this.verifyOwnership(urlId, req.user.userId);
    return this.analyticsService.getRecentClicks(
      urlId,
      query.page,
      query.limit,
    );
  }

  private async verifyOwnership(urlId: string, userId: string): Promise<void> {
    const url = await this.urlRepository.findById(urlId);
    if (!url) {
      throw new ForbiddenException('URL not found');
    }
    if (url.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this URL analytics',
      );
    }
  }
}
