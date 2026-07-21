import { Injectable } from '@nestjs/common';
import { UrlCreateService } from '../use-cases/url-create.service';
import { UrlRedirectService } from '../use-cases/url-redirect.service';
import { CreateUrlDto } from '../dto/create-url.dto';

@Injectable()
export class UrlsService {
  constructor(
    private readonly creator: UrlCreateService,
    private readonly redirector: UrlRedirectService,
  ) {}

  create(dto: CreateUrlDto) {
    return this.creator.create(dto);
  }

  redirect(shortCode: string) {
    return this.redirector.redirect(shortCode);
  }
}
