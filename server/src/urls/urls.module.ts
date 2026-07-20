import { Module } from '@nestjs/common';
import { RedirectController, UrlsController } from './urls.controller';
import { UrlsService } from './service/urls.service';
import { ShortCodeModule } from '../common/short-code/short-code.module';
import { AliasValidatorService } from './service/alias-validator.service';

@Module({
  imports: [ShortCodeModule],
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService, AliasValidatorService],
})
export class UrlsModule {}
