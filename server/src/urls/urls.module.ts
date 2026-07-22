import { Module } from '@nestjs/common';
import { UrlsService } from './service/urls.service';
import { ShortCodeModule } from '../common/short-code/short-code.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AliasValidatorService } from './validators/alias-validator.service';
import { UrlStateValidatorService } from './validators/url-state-validator.service';
import { UrlCacheService } from './service/urls-cache.service';
import { UrlCreateService } from './use-cases/url-create.service';
import { UrlRedirectService } from './use-cases/url-redirect.service';
import { UrlRepository } from './repositories/url.repository';
import { UrlMapper } from './mappers/urls.mapper';
import {
  RedirectController,
  UrlsController,
} from './controllers/urls.controller';

@Module({
  imports: [ShortCodeModule, AnalyticsModule],
  controllers: [UrlsController, RedirectController],
  providers: [
    UrlsService,
    AliasValidatorService,
    UrlStateValidatorService,
    UrlCacheService,
    UrlCreateService,
    UrlRedirectService,
    UrlRepository,
    UrlMapper,
  ],
})
export class UrlsModule {}
