export type PredictionDirection = 'UP' | 'DOWN';
export type PredictionResult = 'Başarılı' | 'Başarısız' | 'Berabere';

export type PredictionHistoryItem = {
  id: string;
  direction: PredictionDirection;
  entryPrice: number;
  resultPrice: number;
  duration: number;
  result: PredictionResult;
  createdAt: string;
};

const HISTORY_KEY = 'kripto-keyfi-up-down-history';
const HISTORY_LIMIT = 20;

function getHistoryKey(scope = 'btc') {
  return scope === 'btc' ? HISTORY_KEY : `${HISTORY_KEY}-${scope}`;
}

export function resolvePrediction(direction: PredictionDirection, entryPrice: number, resultPrice: number): PredictionResult {
  if (resultPrice === entryPrice) return 'Berabere';
  if (direction === 'UP') return resultPrice > entryPrice ? 'Başarılı' : 'Başarısız';
  return resultPrice < entryPrice ? 'Başarılı' : 'Başarısız';
}

export function loadPredictionHistory(scope = 'btc'): PredictionHistoryItem[] {
  try {
    const raw = localStorage.getItem(getHistoryKey(scope));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePredictionHistory(item: PredictionHistoryItem, scope = 'btc') {
  const nextHistory = [item, ...loadPredictionHistory(scope)].slice(0, HISTORY_LIMIT);
  localStorage.setItem(getHistoryKey(scope), JSON.stringify(nextHistory));
  return nextHistory;
}

export function getScoreSummary(history: PredictionHistoryItem[]) {
  const wins = history.filter((item) => item.result === 'Başarılı').length;
  let streak = 0;
  for (const item of history) {
    if (item.result !== 'Başarılı') break;
    streak += 1;
  }
  const successRate = history.length ? Math.round((wins / history.length) * 100) : 0;

  return {
    dailyScore: wins * 40,
    streak,
    totalAttempts: history.length,
    successRate
  };
}
