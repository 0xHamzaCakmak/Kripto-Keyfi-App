import { describe, expect, it } from 'vitest';
import { contentQuerySchema, eventBodySchema, funnelQuerySchema, rangeQuerySchema } from '../src/modules/analytics/analytics.schema.js';
import { resolveRange } from '../src/modules/analytics/analytics.service.js';

describe('platform analytics contracts', () => {
  it('accepts allow-listed events with flat metadata', () => {
    expect(eventBodySchema.safeParse({ eventName: 'video_open', pagePath: '/videos', metadata: { video_id: 42 } }).success).toBe(true);
  });

  it('rejects unknown events and nested arbitrary metadata', () => {
    expect(eventBodySchema.safeParse({ eventName: 'password_captured' }).success).toBe(false);
    expect(eventBodySchema.safeParse({ eventName: 'video_open', metadata: { private: { email: 'x@example.com' } } }).success).toBe(false);
  });

  it('validates report ranges, funnel steps and content event names', () => {
    expect(rangeQuerySchema.safeParse({ range: '30d' }).success).toBe(true);
    expect(rangeQuerySchema.safeParse({ range: 'custom', start: '2026-08-01', end: '2026-08-16' }).success).toBe(true);
    expect(rangeQuerySchema.safeParse({ range: 'custom' }).success).toBe(false);
    expect(funnelQuerySchema.safeParse({ steps: 'user_register,wallet_connect' }).success).toBe(true);
    expect(contentQuerySchema.safeParse({ event_name: 'video_open', range: '7d' }).success).toBe(true);
    expect(contentQuerySchema.safeParse({ event_name: 'user_login', range: '7d' }).success).toBe(false);
  });

  it('creates a bounded time range', () => {
    const range = resolveRange('7d');
    expect(range.endAt).toBeGreaterThan(range.startAt);
    expect(range.endAt - range.startAt).toBeGreaterThanOrEqual(6 * 24 * 60 * 60 * 1000);
    expect(range.endAt - range.startAt).toBeLessThanOrEqual(8 * 24 * 60 * 60 * 1000);
  });
});
