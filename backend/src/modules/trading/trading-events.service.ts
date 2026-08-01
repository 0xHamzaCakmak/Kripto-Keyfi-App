import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { ExchangeProvider, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';

const batchSize = 100;
const pollIntervalMs = 750;
const heartbeatIntervalMs = 15_000;

type AppendEventInput = {
  userId: string;
  exchangeAccountId: string;
  provider: ExchangeProvider;
  topic: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  deduplicationKey?: string;
  payload: Prisma.InputJsonValue;
  occurredAt?: Date;
};

export async function appendTradingEvent(input: AppendEventInput) {
  return prisma.tradingOutboxEvent.create({ data: {
    userId: input.userId,
    exchangeAccountId: input.exchangeAccountId,
    provider: input.provider,
    topic: input.topic,
    eventType: input.eventType,
    ...(input.aggregateType ? { aggregateType: input.aggregateType } : {}),
    ...(input.aggregateId ? { aggregateId: input.aggregateId } : {}),
    deduplicationKey: input.deduplicationKey ?? `node:${input.exchangeAccountId}:${randomUUID()}`,
    payload: input.payload,
    occurredAt: input.occurredAt ?? new Date(),
  } });
}

export async function streamTradingEvents(
  userId: string,
  exchangeAccountId: string,
  rawCursor: string | undefined,
  response: Response,
) {
  const account = await prisma.exchangeAccount.findFirst({
    where: { id: exchangeAccountId, userId, isActive: true },
    select: { id: true },
  });
  if (!account) throw new ApiError(404, 'Borsa hesabı bulunamadı.', 'EXCHANGE_ACCOUNT_NOT_FOUND');

  let cursor: bigint;
  if (rawCursor !== undefined) {
    if (!/^\d+$/.test(rawCursor)) throw new ApiError(400, 'Geçersiz event cursor.', 'INVALID_EVENT_CURSOR');
    cursor = BigInt(rawCursor);
  } else {
    const latest = await prisma.tradingOutboxEvent.findFirst({
      where: { userId, exchangeAccountId }, orderBy: { id: 'desc' }, select: { id: true },
    });
    cursor = latest?.id ?? 0n;
  }

  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders();
  writeEvent(response, 'ready', { cursor: cursor.toString(), exchangeAccountId });

  let polling = false;
  let closed = false;
  const poll = async () => {
    if (polling || closed) return;
    polling = true;
    try {
      const events = await prisma.tradingOutboxEvent.findMany({
        where: { userId, exchangeAccountId, id: { gt: cursor } },
        orderBy: { id: 'asc' }, take: batchSize,
      });
      for (const event of events) {
        cursor = event.id;
        writeEvent(response, 'trading', {
          id: event.id.toString(), exchangeAccountId: event.exchangeAccountId,
          topic: event.topic, eventType: event.eventType,
          aggregateType: event.aggregateType, aggregateId: event.aggregateId,
          payload: event.payload, occurredAt: event.occurredAt.toISOString(),
        }, event.id.toString());
      }
    } catch {
      writeEvent(response, 'stream-error', { message: 'Canlı güncelleme geçici olarak kesildi.' });
      close();
    } finally {
      polling = false;
    }
  };

  const pollTimer = setInterval(() => void poll(), pollIntervalMs);
  const heartbeatTimer = setInterval(() => {
    if (!closed) response.write(`: heartbeat ${Date.now()}\n\n`);
  }, heartbeatIntervalMs);
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
    if (!response.writableEnded) response.end();
  };
  response.on('close', close);
  await poll();
}

function writeEvent(response: Response, event: string, data: unknown, id?: string) {
  if (id) response.write(`id: ${id}\n`);
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}
