import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/database.helper';
import { PrismaService } from '../src/prisma/prisma.service';

function getCookies(res: request.Response): string[] {
  const header = res.headers['set-cookie'];
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

function findRefreshCookie(res: request.Response): string | undefined {
  return getCookies(res).find((c) => c.startsWith('refresh_token='));
}

describe('Auth Flow (e2e)', () => {
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

  async function registerAndVerify(
    email = 'auth-e2e@example.com',
    password = 'StrongPass123!',
  ): Promise<string> {
    await request(app.getHttpServer() as Server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    // Verify the user directly for E2E test purposes
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true, status: 'ACTIVE' },
    });

    return email;
  }

  describe('Registration', () => {
    it('registers a new user and returns message', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/auth/register')
        .send({ email: 'reg-e2e@example.com', password: 'StrongPass123!' })
        .expect(201);

      const { message, email: regEmail } = response.body as {
        message: string;
        email: string;
      };
      expect(message).toContain('Registration successful');
      expect(regEmail).toBe('reg-e2e@example.com');
    });

    it('rejects duplicate registration', async () => {
      await request(app.getHttpServer() as Server)
        .post('/auth/register')
        .send({ email: 'dup-e2e@example.com', password: 'StrongPass123!' })
        .expect(201);

      await request(app.getHttpServer() as Server)
        .post('/auth/register')
        .send({ email: 'dup-e2e@example.com', password: 'StrongPass123!' })
        .expect(409);
    });
  });

  describe('Login and Refresh', () => {
    it('logs in and returns access token with refresh cookie', async () => {
      const email = await registerAndVerify();

      const response = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email, password: 'StrongPass123!' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).not.toHaveProperty('refreshToken');

      const refreshCookie = findRefreshCookie(response);
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/auth');
    });

    it('refreshes tokens using cookie', async () => {
      const email = await registerAndVerify();

      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email, password: 'StrongPass123!' })
        .expect(200);

      const cookies = getCookies(loginResponse);

      const refreshResponse = await request(app.getHttpServer() as Server)
        .post('/auth/refresh')
        .set('Cookie', cookies)
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body).toHaveProperty('expiresIn');
      expect(findRefreshCookie(refreshResponse)).toBeDefined();
    });

    it('rejects refresh without cookie', async () => {
      await request(app.getHttpServer() as Server)
        .post('/auth/refresh')
        .expect(401);
    });
  });

  describe('Logout', () => {
    it('logs out and clears refresh cookie', async () => {
      const email = await registerAndVerify();

      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email, password: 'StrongPass123!' })
        .expect(200);

      const cookies = getCookies(loginResponse);
      const accessToken = (loginResponse.body as { accessToken: string })
        .accessToken;

      const logoutResponse = await request(app.getHttpServer() as Server)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies)
        .expect(200);

      const { message: logoutMsg } = logoutResponse.body as { message: string };
      expect(logoutMsg).toContain('Logged out');

      const clearedCookie = findRefreshCookie(logoutResponse);
      expect(clearedCookie).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('lists active sessions', async () => {
      const email = await registerAndVerify();

      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email, password: 'StrongPass123!' })
        .expect(200);

      const accessToken = (loginResponse.body as { accessToken: string })
        .accessToken;

      const sessionsResponse = await request(app.getHttpServer() as Server)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(sessionsResponse.body)).toBe(true);
      expect(
        (sessionsResponse.body as unknown[]).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('revokes all other sessions', async () => {
      const email = await registerAndVerify();

      const login1 = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email, password: 'StrongPass123!' })
        .expect(200);

      const login2 = await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({ email, password: 'StrongPass123!' })
        .expect(200);

      const token2 = (login2.body as { accessToken: string }).accessToken;
      const cookies2 = getCookies(login2);

      await request(app.getHttpServer() as Server)
        .delete('/auth/sessions')
        .set('Authorization', `Bearer ${token2}`)
        .set('Cookie', cookies2)
        .expect(200);

      // Session 1's token should no longer work
      const token1 = (login1.body as { accessToken: string }).accessToken;
      await request(app.getHttpServer() as Server)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${token1}`)
        .expect(401);
    });
  });

  describe('Verified User Gating', () => {
    it('rejects login for unverified user', async () => {
      await request(app.getHttpServer() as Server)
        .post('/auth/register')
        .send({
          email: 'unverified-e2e@example.com',
          password: 'StrongPass123!',
        })
        .expect(201);

      await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({
          email: 'unverified-e2e@example.com',
          password: 'StrongPass123!',
        })
        .expect(403);
    });
  });
});
