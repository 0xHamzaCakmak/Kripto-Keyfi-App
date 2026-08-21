export type SimulationMode = 'PAPER' | 'SHADOW';
export type MarketStep = { grossPnl: number; fee?: number; funding?: number; marketAgeMs?: number };
export type SimulationConfig = {
  mode?: SimulationMode; startingEquity?: number; connected?: boolean; emergencyStop?: boolean;
  maxDailyLoss?: number; maxFunding?: number; maxMarketAgeMs?: number;
};

export type SimulationResult = {
  mode: SimulationMode; endingEquity: number; netPnl: number; maxDrawdown: number; totalFees: number;
  paperOrders: number; shadowActions: number; riskRejects: string[]; score: number; equityCurve: number[];
};

export async function simulatePaperBot(steps: MarketStep[], config: SimulationConfig = {}): Promise<SimulationResult> {
  const mode = config.mode ?? 'PAPER';
  const starting = config.startingEquity ?? 100;
  let equity = starting; let peak = starting; let maxDrawdown = 0; let totalFees = 0; let dailyPnl = 0;
  let paperOrders = 0; let shadowActions = 0;
  const equityCurve = [equity]; const riskRejects: string[] = [];
  for (const step of steps) {
    await Promise.resolve();
    const rejection = rejectReason(step, dailyPnl, config);
    if (rejection) { riskRejects.push(rejection); continue; }
    const fee = step.fee ?? 0; const funding = step.funding ?? 0;
    const net = step.grossPnl - fee - funding;
    if (mode === 'SHADOW') { shadowActions++; continue; }
    paperOrders++; totalFees += fee; dailyPnl += net; equity += net; peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak === 0 ? 0 : (peak - equity) / peak); equityCurve.push(equity);
  }
  const netPnl = equity - starting;
  return {
    mode, endingEquity: equity, netPnl, maxDrawdown, totalFees, paperOrders, shadowActions, riskRejects,
    score: riskAdjustedScore(starting, netPnl, maxDrawdown, totalFees, equityCurve), equityCurve,
  };
}

function rejectReason(step: MarketStep, dailyPnl: number, config: SimulationConfig) {
  if (config.emergencyStop) return 'EMERGENCY_STOP';
  if (config.connected === false) return 'EXCHANGE_DISCONNECTED';
  if ((step.marketAgeMs ?? 0) > (config.maxMarketAgeMs ?? 60_000)) return 'STALE_MARKET_DATA';
  if (Math.abs(step.funding ?? 0) > (config.maxFunding ?? Number.POSITIVE_INFINITY)) return 'HIGH_FUNDING';
  if (dailyPnl <= -(config.maxDailyLoss ?? Number.POSITIVE_INFINITY)) return 'DAILY_LOSS_LIMIT';
  return null;
}

export function riskAdjustedScore(starting: number, netPnl: number, maxDrawdown: number, fees: number, curve: number[]) {
  const returns = curve.slice(1).map((value, index) => (value - curve[index]!) / Math.max(1, curve[index]!));
  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length : 0;
  const returnContribution = (netPnl / starting) * 30;
  const drawdownPenalty = maxDrawdown * 120;
  const instabilityPenalty = Math.sqrt(variance) * 100;
  const feePenalty = (fees / starting) * 50;
  return Math.max(0, Math.min(100, 50 + returnContribution - drawdownPenalty - instabilityPenalty - feePenalty));
}
