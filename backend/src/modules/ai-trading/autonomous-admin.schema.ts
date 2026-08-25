import { z } from 'zod';
import { createFactoryBotBodySchema } from './bot-factory.schema.js';

export const autonomousBotParamsSchema = z.object({ id: z.string().min(1) }).strict();
export const createAutonomousPaperBotSchema = createFactoryBotBodySchema.extend({ mode: z.literal('PAPER').default('PAPER') }).strict();
export const autonomousGenerationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
}).strict();
export const triggerPaperGenerationSchema = z.object({
  populationTarget: z.number().int().min(1).max(1_000).default(20),
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
export const testnetFleetActivationSchema = z.object({
  confirmation: z.literal('ENABLE 20 BINANCE TESTNET BOTS'),
  note: z.string().trim().min(3).max(500),
}).strict();
export const paperFleetActivationSchema = z.object({
  confirmation: z.literal('RUN 20 PAPER BOTS'),
  note: z.string().trim().min(3).max(500),
}).strict();
export const resetPaperAccountingSchema = z.object({
  confirmation: z.literal('RESET PAPER PNL'),
  note: z.string().trim().min(3).max(500),
}).strict();
export const resetTestnetAccountingSchema = z.object({
  confirmation: z.literal('RESET TESTNET PNL'),
  note: z.string().trim().min(3).max(500),
}).strict();
export const closePaperPositionSchema = z.object({
  stopBot: z.boolean().default(false),
  note: z.string().trim().min(3).max(500).optional(),
}).strict();

export type TriggerPaperGenerationInput = z.infer<typeof triggerPaperGenerationSchema>;
export type PromotionReviewInput = z.infer<typeof promotionReviewSchema>;
export type NonCriticalBotSettingsInput = z.infer<typeof nonCriticalBotSettingsSchema>;
export type BotCapitalInput = z.infer<typeof botCapitalSchema>;
export type TestnetActivationInput = z.infer<typeof testnetActivationSchema>;
export type TestnetFleetActivationInput = z.infer<typeof testnetFleetActivationSchema>;
export type PaperFleetActivationInput = z.infer<typeof paperFleetActivationSchema>;
export type ResetPaperAccountingInput = z.infer<typeof resetPaperAccountingSchema>;
export type ClosePaperPositionInput = z.infer<typeof closePaperPositionSchema>;
