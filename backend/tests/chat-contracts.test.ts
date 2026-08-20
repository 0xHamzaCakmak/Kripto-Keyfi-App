import { ChatRoomStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { createRoomBodySchema, messagesQuerySchema, reactMessagePayloadSchema, sendMessagePayloadSchema, updateRoomStatusBodySchema } from '../src/modules/chat/chat.schema.js';
import { CHAT_PRUNE_BATCH, CHAT_PRUNE_THRESHOLD, sanitizeChatContent } from '../src/modules/chat/chat.service.js';

describe('chat contracts', () => {
  it('validates room administration payloads', () => {
    expect(createRoomBodySchema.safeParse({ slug: 'bitcoin-teknik', name: 'Bitcoin Teknik', category: 'Teknik', displayOrder: 20 }).success).toBe(true);
    expect(createRoomBodySchema.safeParse({ slug: '../admin', name: 'Bad', category: 'Teknik' }).success).toBe(false);
    expect(updateRoomStatusBodySchema.safeParse({ status: ChatRoomStatus.CLOSED }).success).toBe(true);
  });

  it('bounds message history and content', () => {
    expect(messagesQuerySchema.parse({ limit: '50' })).toEqual({ limit: 50 });
    expect(messagesQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(sendMessagePayloadSchema.safeParse({ roomSlug: 'global-stream', content: 'x'.repeat(2_001) }).success).toBe(false);
  });

  it('allows only supported reactions', () => {
    expect(reactMessagePayloadSchema.safeParse({ messageId: '42', reactionType: 'alpha' }).success).toBe(true);
    expect(reactMessagePayloadSchema.safeParse({ messageId: '42', reactionType: 'angry' }).success).toBe(false);
  });

  it('removes HTML delimiters and control characters', () => {
    expect(sanitizeChatContent('  <script>alert(1)</script>\u0000  ')).toBe('scriptalert(1)/script');
  });

  it('uses the requested bounded retention window', () => {
    expect(CHAT_PRUNE_THRESHOLD).toBe(1_100);
    expect(CHAT_PRUNE_BATCH).toBe(100);
  });
});
