import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CountryResponse, Reader } from 'maxmind';
import { open } from 'maxmind';
import { PinoLogger } from 'nestjs-pino';
import { access } from 'node:fs/promises';

import { AnalyticsRepository } from '../repositories/analytics.repository';
import { type ClickJobData } from '../types';
import { hashIp, normalizeReferrer, parseUserAgent } from '../utils/helpers';

@Injectable()
export class AnalyticsClickService implements OnModuleInit {
  private readonly ipSalt: string;
  private readonly geoLiteDbPath: string;

  private geoIpReader!: Reader<CountryResponse>;

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AnalyticsClickService.name);

    this.ipSalt = this.config.getOrThrow<string>('IP_HASH_SALT');
    this.geoLiteDbPath = this.config.get<string>('GEOLITE2_DB_PATH', '');
  }

  async onModuleInit(): Promise<void> {
    try {
      await access(this.geoLiteDbPath);
      this.geoIpReader = await open<CountryResponse>(this.geoLiteDbPath);

      this.logger.info(
        { database: this.geoLiteDbPath },
        'GeoLite2 database loaded',
      );
    } catch {
      this.logger.warn(
        { database: this.geoLiteDbPath },
        'GeoLite2 database not found, country resolution disabled',
      );
    }
  }

  async processClick(data: ClickJobData): Promise<void> {
    const { urlId, identifierId, userAgent, referrer, ip } = data;

    const { browser, os, device } = parseUserAgent(userAgent);
    const ipHash = hashIp(ip, this.ipSalt);
    const country = this.resolveCountry(ip);

    try {
      await this.repository.create({
        url: { connect: { id: urlId } },
        identifier: { connect: { id: identifierId } },
        browser,
        os,
        device,
        country,
        ipHash,
        referrer: normalizeReferrer(referrer),
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && err.code === 'P2025') {
        this.logger.warn(
          { urlId, identifierId },
          'URL or Identifier not found, skipping analytics recording',
        );
        return;
      }
      throw err;
    }
  }

  private resolveCountry(ip?: string): string | null {
    if (!ip || !this.geoIpReader) {
      return null;
    }

    try {
      const result = this.geoIpReader.get(ip);

      return result?.country?.iso_code ?? null;
    } catch (err: unknown) {
      this.logger.warn({ err }, 'Failed to resolve country from GeoIP');
      return null;
    }
  }
}
