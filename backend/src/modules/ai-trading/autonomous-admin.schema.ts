import { z } from 'zod';
import { createFactoryBotBodySchema } from './bot-factory.schema.js';

export const autonomousBotParamsSchema = z.object({ id: z.string().min(1) }).strict();
export const createAutonomousPaperBotSchema = createFactoryBotBodySchema.extend({ mode: z.literal('PAPER').default('PAPER') }).strict();
export const autonomousGenerationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
}).strict();
export const triggerPaperGenerationSchema = z.object({
  populationTarget: z.number().int().min(1).max(1_000).default(100),
  note: z.string().trim().min(3).max(500).optional(),
}).strict();
export const promotionReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().min(3).max(500),
}).strict();
export const nonCriticalBotSettingsSchema = z.object({
  intervalSeconds: z.number().int().min(10).max(3_600),
}).strict();
export const botCapitalSchema = z.object({
  action: z.enum(['SET', 'ADD']),
  amountUsdt: z.number().finite().min(1).max(10_000),
  note: z.string().trim().min(3).max(500).optional(),
}).strict();
export const testnetActivationSchema = z.object({
  confirmation: z.literal('ENABLE BINANCE TESTNET'),
  note: z.string().trim().min(3).max(500),
}).strict();

export type TriggerPaperGenerationInput = z.infer<typeof triggerPaperGenerationSchema>;
export type PromotionReviewInput = z.infer<typeof promotionReviewSchema>;
export type NonCriticalBotSettingsInput = z.infer<typeof nonCriticalBotSettingsSchema>;
export type BotCapitalInput = z.infer<typeof botCapitalSchema>;
export type TestnetActivationInput = z.infer<typeof testnetActivationSchema>;
