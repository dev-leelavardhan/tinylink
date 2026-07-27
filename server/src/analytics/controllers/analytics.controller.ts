import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator';
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.analyticsService.verifyOwnership(urlId, user.userId);
    return this.analyticsService.getAggregated(urlId, query.days);
  }

  @Get('clicks')
  async getRecentClicks(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.analyticsService.verifyOwnership(urlId, user.userId);
    return this.analyticsService.getRecentClicks(
      urlId,
      query.page,
      query.limit,
    );
  }
}
