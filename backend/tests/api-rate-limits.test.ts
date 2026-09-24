import express from 'express';
import request from 'supertest';
import { expect, it } from 'vitest';
import { createApiRateLimits } from '../src/middleware/api-rate-limits.js';

it('polling exhaustion does not block login or refresh, while session requests remain limited', async () => {
  const app = express();
  app.use('/api', createApiRateLimits());
  app.use((_req, res) => { res.json({ ok: true }); });
  for (let i = 0; i < 120; i++) await request(app).get('/api/admin/trading/positions').expect(200);
  const blocked = await request(app).get('/api/admin/trading/positions').expect(429);
  expect(blocked.body.error.code).toBe('RATE_LIMITED');
  await request(app).post('/api/auth/login').expect(200);
  await request(app).post('/api/auth/refresh').expect(200);
  for (let i = 0; i < 58; i++) await request(app).get('/api/auth/me').expect(200);
  await request(app).post('/api/auth/refresh').expect(429);
  await request(app).post('/api/admin/trading/orders').expect(200);
});
