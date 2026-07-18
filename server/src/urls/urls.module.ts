import { Module } from '@nestjs/common';
import { RedirectController, UrlsController } from './urls.controller';
import { UrlsService } from './urls.service';

@Module({
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService],
})
export class UrlsModule {}
