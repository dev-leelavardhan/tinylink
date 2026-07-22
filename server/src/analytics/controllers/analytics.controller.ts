import { Controller, Get, Param, Query } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/zod/common.validation';
import {
  analyticsQuerySchema,
  paginationQuerySchema,
  type AnalyticsQueryDto,
  type PaginationQueryDto,
} from '../dto/analytics-query.dto';
import { AnalyticsService } from '../service/analytics.service';

@Controller('urls/:urlId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  getAggregated(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getAggregated(urlId, query.days);
  }

  @Get('clicks')
  getRecentClicks(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: PaginationQueryDto,
  ) {
    return this.analyticsService.getRecentClicks(
      urlId,
      query.page,
      query.limit,
    );
  }
}
