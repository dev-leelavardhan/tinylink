import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { hashIp, parseUserAgent, normalizeReferrer } from '../utils/helpers';
import { type ClickJobData } from '../analytics.interface';

@Injectable()
export class AnalyticsClickService {
  private readonly ipSalt: string;

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly config: ConfigService,
  ) {
    this.ipSalt = this.config.getOrThrow<string>('IP_HASH_SALT');
  }

  async processClick(data: ClickJobData): Promise<void> {
    const { urlId, userAgent, referrer, ip } = data;

    const { browser, os, device } = parseUserAgent(userAgent);
    const ipHash = hashIp(ip, this.ipSalt);
    const country = await this.resolveCountry(ip);

    await this.repository.create({
      url: { connect: { id: urlId } },
      browser,
      os,
      device,
      country,
      ipHash,
      referrer: normalizeReferrer(referrer),
    });

    await this.repository.updateLastAccessedAt(urlId);
  }

  private async resolveCountry(ip?: string): Promise<string | null> {
    try {
      const maxmind = require('maxmind');
      const lookup = await maxmind.open(
        this.config.getOrThrow<string>('GEOLITE2_DB_PATH'),
      );
      if (ip) {
        const result = lookup.get(ip);
        return result?.country?.iso_code ?? null;
      }
    } catch {
      // GeoIP is best-effort, don't fail the job
    }
    return null;
  }
}
