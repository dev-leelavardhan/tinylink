import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from '../service/analytics.service';
import {
  analyticsQuerySchema,
  paginationQuerySchema,
} from '../dto/analytics-query.dto';
import { ZodValidationPipe } from '../../common/zod/common.validation';

@Controller('urls/:urlId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getAggregated(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: { days: number },
  ) {
    return this.analyticsService.getAggregated(urlId, query.days);
  }

  @Get('clicks')
  async getRecentClicks(
    @Param('urlId') urlId: string,
    @Query(new ZodValidationPipe(paginationQuerySchema))
    query: { page: number; limit: number },
  ) {
    return this.analyticsService.getRecentClicks(
      urlId,
      query.page,
      query.limit,
    );
  }
}
