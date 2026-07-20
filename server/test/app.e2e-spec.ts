import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';

import { CreateUrlResponseDto } from '../src/urls/dto/create-utl-response-dto';
import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/database.helper';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns Hello World', () => {
    return request(app.getHttpServer() as Server)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports database connectivity', () => {
    return request(app.getHttpServer() as Server)
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', db: 'up' });
  });
});

describe('Urls API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await app.close();
  });

  it('POST /urls creates a short URL', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/urls')
      .send({ originalUrl: 'https://e2e.example/create' })
      .expect(201);

    const body = response.body as CreateUrlResponseDto;

    expect(body).toMatchObject({
      originalUrl: 'https://e2e.example/create',
      shortCode: expect.any(String) as string,
      shortUrl: expect.stringMatching(/^http/) as string,
    });
  });

  it('POST /urls validates request bodies', async () => {
    const response = await request(app.getHttpServer() as Server)
      .post('/urls')
      .send({ originalUrl: 'not-a-valid-url' })
      .expect(400);

    expect((response.body as { message: string }).message).toBe(
      'Validation failed',
    );
  });

  it('GET /:shortCode redirects to the original URL', async () => {
    const created = await request(app.getHttpServer() as Server)
      .post('/urls')
      .send({
        originalUrl: 'https://e2e.example/redirect',
        customAlias: 'e2e-link',
      })
      .expect(201);

    const createdBody = created.body as CreateUrlResponseDto;

    await request(app.getHttpServer() as Server)
      .get('/e2e-link')
      .expect(302)
      .expect('Location', 'https://e2e.example/redirect');

    await request(app.getHttpServer() as Server)
      .get(`/${createdBody.shortCode}`)
      .expect(302)
      .expect('Location', 'https://e2e.example/redirect');
  });

  it('GET /:shortCode returns 404 for unknown codes', () => {
    return request(app.getHttpServer() as Server)
      .get('/does-not-exist')
      .expect(404);
  });
});
