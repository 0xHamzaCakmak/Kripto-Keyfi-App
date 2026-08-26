import type { TestnetAccountSummary } from '../../services/aiTradingService';
import { formatMoney, formatPercent } from './AITradingUI';

export function TestnetBalanceStrip({ summary }: { summary: TestnetAccountSummary | null }) {
  if (!summary) return <div className="text-xs font-bold text-outline">TESTNET bakiyesi yükleniyor…</div>;
  if (!summary.connected) return <div className="rounded-xl border border-outline/15 bg-background/30 px-3 py-2 text-xs font-bold text-outline">TESTNET hesabı bağlı değil</div>;
  const assets = summary.collateralAssets?.map((item) => `${item.asset}: ${formatMoney(Number(item.walletBalance))}`).join(' · ') || 'USDT + USDC';
  return <div className="flex w-full max-w-full flex-nowrap items-center gap-x-4 overflow-x-auto rounded-xl border border-secondary/20 bg-secondary/5 px-3 py-2 text-xs" title={`Yalnız USD-M Futures USDT + USDC · ${assets} · Açık notional: ${formatMoney(Number(summary.activeNotional))}`}>
    <BalanceDatum label="Başlangıç" value={formatMoney(Number(summary.startingBalance))} />
    <BalanceDatum label="Boşta" value={formatMoney(Number(summary.availableBalance))} />
    <BalanceDatum label="İşlemde" value={formatMoney(Number(summary.activeMargin))} />
    <BalanceDatum label="Açık aktivite" value={`${summary.activeBots} bot · ${summary.activeEntryOrders} işlem`} />
    <BalanceDatum label="Açık PnL" value={formatMoney(Number(summary.unrealizedPnl))} tone={Number(summary.unrealizedPnl)} />
    <BalanceDatum label={Number(summary.netPnl) >= 0 ? 'Kâr' : 'Zarar'} value={`${formatMoney(Math.abs(Number(summary.netPnl)))} · ${formatPercent(summary.pnlPercent)}`} tone={Number(summary.netPnl)} />
    <BalanceDatum label="Toplam değer" value={formatMoney(Number(summary.equity))} tone={Number(summary.netPnl)} />
  </div>;
}

function BalanceDatum({ label, value, tone = null }: { label: string; value: string; tone?: number | null }) {
  return <span className="shrink-0 whitespace-nowrap"><span className="text-on-surface-variant">{label}: </span><strong className={tone === null || tone >= 0 ? 'text-secondary' : 'text-error'}>{value}</strong></span>;
}
