import { Module } from '@nestjs/common';
import { RedirectController, UrlsController } from './urls.controller';
import { UrlsService } from './urls.service';
import { ShortCodeModule } from '../common/short-code/short-code.module';

@Module({
  imports: [ShortCodeModule],
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService],
})
export class UrlsModule {}
