import { Module } from '@nestjs/common';
import { UrlsService } from './service/urls.service';
import { ShortCodeModule } from '../common/short-code/short-code.module';
import { AliasValidatorService } from './validators/alias-validator.service';
import { UrlCacheService } from './service/urls-cache.service';
import {
  RedirectController,
  UrlsController,
} from './controllers/urls.controller';

@Module({
  imports: [ShortCodeModule],
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService, AliasValidatorService, UrlCacheService],
})
export class UrlsModule {}
