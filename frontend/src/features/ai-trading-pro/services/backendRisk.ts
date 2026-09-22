import { api } from '../../../services/apiClient';
import type { TradingRiskProfile } from '../../../services/aiTradingService';

export const riskDetailFields = [
  ['maxSymbolOpenNotional', 'Parite açık işlem limiti (USDT; 0 = sınırsız)', 0, undefined, 'any'],
  ['maxOpenPositions', 'Vadeli açık pozisyon limiti (0 = sınırsız)', 0, undefined, '1'],
  ['paperMaxOpenPositions', 'Paper açık pozisyon limiti (0 = sınırsız)', 0, undefined, '1'],
  ['maxSymbolPositions', 'Parite pozisyon limiti (0 = sınırsız)', 0, undefined, '1'],
  ['minAvailableBalance', 'Korunacak bakiye (USDT)', 0, undefined, 'any'],
  ['maxRiskPerTradePct', 'İşlem başına risk oranı (0–1; 0.01 = %1)', 0, 1, 'any'],
  ['maxDailyLossPct', 'Günlük kayıp oranı (0–1)', 0, 1, 'any'],
  ['maxWeeklyLossPct', 'Haftalık kayıp oranı (0–1)', 0, 1, 'any'],
  ['maxDrawdownPct', 'Azami düşüş oranı (0–1)', 0, 1, 'any'],
  ['minRiskRewardRatio', 'Asgari getiri / risk oranı', 0.000001, undefined, 'any'],
  ['cooldownSeconds', 'İşlem bekleme süresi (saniye)', 0, 604800, '1'],
  ['maxConsecutiveLosses', 'Ardışık kayıp limiti', 1, 100, '1'],
] as const;

export function buildRiskDetailsPayload(draft: Record<string, string>) {
  const numbers = Object.fromEntries(riskDetailFields.map(([key, , min, max, step]) => {
    const value = Number(draft[key]);
    if (!draft[key]?.trim() || !Number.isFinite(value) || value < min || (max !== undefined && value > max) || (step === '1' && !Number.isInteger(value))) throw new Error('Risk limitlerini kontrol edin.');
    return [key, step === '1' ? value : draft[key]];
  }));
  const symbols = (value: string) => {
    const list = [...new Set(value.split(/[\s,;]+/).filter(Boolean).map((symbol) => symbol.toUpperCase()))];
    if (list.length > 100 || list.some((symbol) => !/^[A-Z0-9]{2,40}$/.test(symbol))) throw new Error('Pariteleri BTCUSDT biçiminde girin (en fazla 100).');
    return list.length ? list : null;
  };
  const allowedSymbols = symbols(draft.allowedSymbols ?? '');
  const blockedSymbols = symbols(draft.blockedSymbols ?? '');
  if (allowedSymbols?.some((symbol) => blockedSymbols?.includes(symbol))) throw new Error('Aynı parite hem izinli hem engelli olamaz.');
  if (draft.marginModePolicy !== 'ISOLATED_ONLY' && draft.marginModePolicy !== 'ALLOW_CROSS') throw new Error('Marjin politikası seçin.');
  return { ...numbers, allowedSymbols, blockedSymbols, marginModePolicy: draft.marginModePolicy };
}

export async function saveRiskDetails(accountId: string, draft: Record<string, string>) {
  return (await api.patch<{ data: TradingRiskProfile }>(`/admin/trading/exchange-accounts/${encodeURIComponent(accountId)}/risk-profile`, buildRiskDetailsPayload(draft))).data.data;
}

export async function setRiskKillSwitch(accountId: string, scope: 'ACCOUNT' | 'GLOBAL', active: boolean, reason: string) {
  return api.post('/admin/trading/risk/kill-switch', {
    scope, active, reason, ...(scope === 'ACCOUNT' ? { exchangeAccountId: accountId } : {}),
  });
}
