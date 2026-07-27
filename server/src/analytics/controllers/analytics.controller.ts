import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
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
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getAggregated(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: AnalyticsQueryDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    await this.analyticsService.verifyOwnership(urlId, req.user.userId);
    return this.analyticsService.getAggregated(urlId, query.days);
  }

  @Get('clicks')
  async getRecentClicks(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQueryDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    await this.analyticsService.verifyOwnership(urlId, req.user.userId);
    return this.analyticsService.getRecentClicks(
      urlId,
      query.page,
      query.limit,
    );
  }
}
