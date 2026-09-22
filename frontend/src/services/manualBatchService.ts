import { api } from './apiClient';

export type BatchInput = { exchangeAccountId: string; symbols: string[]; side: 'BUY' | 'SELL'; initialMargin: string;
  leverage: number; stopLossPercent: number; takeProfitPercent: number };
export type BatchItem = { symbol: string; quantity: string; markPrice: string; notional: string; margin: string;
  stopLoss: string; takeProfit: string; status: string; detail?: string };
export type ManualBatch = { id: string; exchangeAccountId: string; status: string; expiresAt: string; input: BatchInput;
  items: BatchItem[]; totalMargin: string; totalNotional: string };
export type BatchCandidates = { availableBalance: string; symbols: { symbol: string; baseAsset: string; maxLeverage: number; selectedByDefault: boolean }[] };
const root = '/admin/trading/manual-batches';
export const getBatchCandidates = async (exchangeAccountId: string): Promise<BatchCandidates> => (await api.get(`${root}/candidates`, { params: { exchangeAccountId }, timeout: 60000 })).data.data;
export const previewBatch = async (input: BatchInput): Promise<ManualBatch> => (await api.post(`${root}/preview`, input, { timeout: 120000 })).data.data;
export const confirmBatch = async (id: string, exchangeAccountId: string): Promise<ManualBatch> => (await api.post(`${root}/${id}/confirm`, { exchangeAccountId })).data.data;
export const getBatch = async (id: string, exchangeAccountId: string): Promise<ManualBatch> => (await api.get(`${root}/${id}`, { params: { exchangeAccountId } })).data.data;
