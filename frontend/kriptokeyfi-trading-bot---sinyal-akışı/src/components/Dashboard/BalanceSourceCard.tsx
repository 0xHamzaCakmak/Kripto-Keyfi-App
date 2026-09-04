import React, { useMemo } from 'react';
import { type CurrencyDistribution } from '../../types';
import {
  type TradeProArena,
  type TradeProBalance,
  type TradeProExchangeAccount,
  type TradeProMode,
} from '../../services/backendDashboard';

type BalanceSourceCardProps = {
  accounts: TradeProExchangeAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  mode: TradeProMode;
  onToggleMode: () => void;
  balances: TradeProBalance[];
  arena: TradeProArena | null;
  loading: boolean;
  hasBackendAccount: boolean;
  error?: string;
};

const assetColors: Record<string, string> = {
  USDT: 'bg-[#02c076]',
  BUSD: 'bg-[#f0b90b]',
  USDC: 'bg-[#00d2ff]',
  BNB: 'bg-[#9353d3]',
};

export const BalanceSourceCard: React.FC<BalanceSourceCardProps> = ({
  accounts, selectedAccountId, onSelectAccount, mode, onToggleMode, balances,
  arena, loading, hasBackendAccount, error,
}) => {
  const summary = useMemo(() => summarizeBalances(balances), [balances]);
  const walletGroups = useMemo(() => groupWalletBalances(balances), [balances]);
  const runningBots = arena?.states.RUNNING ?? 0;
  const totalBots = Object.values(arena?.states ?? {}).reduce((sum, count) => sum + count, 0);
  const isActive = hasBackendAccount && runningBots > 0;

  return (
    <div id="balance-source-card" className="h-full bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#2b3139]">
          <h3 className="shrink-0 text-xs font-bold tracking-wider text-[#eaecef] uppercase font-['Inter','Plus_Jakarta_Sans',sans-serif]">KAYNAK / BAKİYE</h3>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <select
              aria-label="Borsa hesabı"
              value={selectedAccountId}
              onChange={(event) => onSelectAccount(event.target.value)}
              disabled={accounts.length === 0}
              className="min-w-0 max-w-[112px] rounded border border-[#2b3139] bg-[#0b0e11] px-1.5 py-1 text-[9px] font-bold uppercase text-[#eaecef] outline-none focus:border-[#00d2ff] disabled:text-[#848e9c]"
            >
              {accounts.length === 0 && <option value="">BORSA YOK</option>}
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.provider} · {account.name}</option>)}
            </select>
            <button
              type="button"
              onClick={onToggleMode}
              aria-label={`İşlem modu: ${mode}`}
              className={`rounded border px-1.5 py-1 text-[9px] font-bold transition-colors ${mode === 'DEMO' ? 'border-[#f0b90b]/40 bg-[#f0b90b]/10 text-[#f0b90b]' : 'border-[#02c076]/40 bg-[#02c076]/10 text-[#02c076]'}`}
            >
              {mode}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#1e2329] border border-[#02c076] flex items-center justify-center text-[#02c076] shadow-[0_0_15px_rgba(2,192,118,0.3)]">
            <span className="text-lg font-bold font-['JetBrains_Mono',monospace]">$</span>
          </div>
          <div>
            <div className="text-[11px] text-[#848e9c] uppercase font-medium">TOPLAM BAKİYE</div>
            <div className="text-xl sm:text-2xl font-bold font-['JetBrains_Mono',monospace] text-[#02c076] tracking-tight flex items-baseline gap-1.5">
              <span>{loading ? '—' : formatBalance(summary.total)}</span>
              <span className="text-xs text-[#eaecef] font-semibold">USDT</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 p-2.5 rounded-lg bg-[#0b0e11]/70 border border-[#2b3139] text-xs">
          <div>
            <span className="text-[10px] text-[#848e9c] block">KULLANILABİLİR</span>
            <span className="font-bold text-[#eaecef] font-['JetBrains_Mono',monospace]">
              {loading ? '—' : formatBalance(summary.available)} <span className="text-[10px] text-[#848e9c] font-normal">USDT (%{summary.availablePercent})</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[#848e9c] block">KULLANILAN</span>
            <span className="font-bold text-[#eaecef] font-['JetBrains_Mono',monospace]">
              {loading ? '—' : formatBalance(summary.used)} <span className="text-[10px] text-[#848e9c] font-normal">USDT (%{summary.usedPercent})</span>
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[10px] font-bold text-[#848e9c] tracking-wider uppercase mb-2">PARA DAĞILIMI</div>
          <div className="space-y-1.5 text-xs">
            {summary.distributions.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${item.color}`} /><span className="text-[#eaecef] font-semibold">{item.name}</span></div>
                <div className="flex items-center gap-3 font-['JetBrains_Mono',monospace]"><span className="text-[#eaecef]">{item.amount > 0 ? formatBalance(item.amount) : '–'}</span><span className="text-[#848e9c] w-8 text-right">%{item.percentage}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-[#2b3139]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[#848e9c] uppercase">BOT DURUMU</span>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${isActive ? 'bg-[#02c076]/15 border-[#02c076]/40 text-[#02c076]' : 'bg-[#848e9c]/10 border-[#848e9c]/30 text-[#848e9c]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#02c076] shadow-[0_0_6px_#02c076] animate-pulse' : 'bg-[#848e9c]'}`} />
            <span>{isActive ? 'AKTİF' : 'PASİF'}</span>
          </div>
        </div>
        <p className="text-[10px] text-[#848e9c] mb-2.5">{error || (!hasBackendAccount && mode === 'LIVE' ? 'Live API bağlı değil' : `${runningBots}/${totalBots} bot çalışıyor`)}</p>

        <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-2 border-t border-[#2b3139] font-['JetBrains_Mono',monospace]">
          <div><span className="text-[#848e9c] block text-[9px]">ÇALIŞMA SÜRESİ</span><span className="text-[#eaecef] font-semibold">{formatUptime(arena?.oldestRunningAt)}</span></div>
          <div><span className="text-[#848e9c] block text-[9px]">SON SİNYAL</span><span className="text-[#eaecef] font-semibold">{formatTime(arena?.latestDecisionAt)}</span></div>
          <div><span className="text-[#848e9c] block text-[9px]">SON GÜNCELLEME</span><span className="text-[#eaecef] font-semibold">{formatTime(arena?.refreshedAt)}</span></div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#2b3139]">
          <div className="mb-2 text-[10px] font-bold tracking-wider text-[#848e9c] uppercase">CÜZDAN VARLIKLARI</div>
          <div className={`grid gap-2 ${walletGroups.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {(walletGroups.length > 0 ? walletGroups : [{ type: 'EMPTY', label: mode === 'LIVE' ? 'LIVE' : 'CÜZDAN', rows: [] }]).map((group) => (
              <div key={group.type} className="min-w-0 rounded-lg border border-[#2b3139] bg-[#0b0e11]/50 p-2">
                <div className="mb-1.5 flex items-center justify-between gap-1">
                  <span className="text-[9px] font-bold text-[#00d2ff]">{group.label}</span>
                  <span className="text-[8px] text-[#848e9c]">{group.rows.length} VARLIK</span>
                </div>
                <div className="max-h-28 space-y-1 overflow-y-auto pr-0.5 font-['JetBrains_Mono',monospace]">
                  {group.rows.length === 0 && <div className="py-2 text-center text-[9px] text-[#848e9c]">Varlık yok</div>}
                  {group.rows.map((row) => (
                    <div key={`${group.type}-${row.asset}`} className="flex items-center justify-between gap-1 text-[9px]">
                      <span className="truncate font-bold text-[#eaecef]">{row.asset}</span>
                      <span className="truncate text-right text-[#eaecef]" title={`${row.walletBalance} ${row.asset}`}>{formatAssetAmount(row.walletBalance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function summarizeBalances(balances: TradeProBalance[]) {
  const byAsset = new Map<string, number>();
  let total = 0;
  let available = 0;
  for (const balance of balances) {
    const price = finiteNumber(balance.priceUsdt) || 1;
    const value = finiteNumber(balance.valueUsdt) || finiteNumber(balance.walletBalance) * price;
    const availableValue = finiteNumber(balance.availableBalance) * price;
    if (value <= 0) continue;
    total += value;
    available += Math.max(0, Math.min(availableValue, value));
    byAsset.set(balance.asset, (byAsset.get(balance.asset) ?? 0) + value);
  }
  const sorted = [...byAsset.entries()].sort((left, right) => right[1] - left[1]);
  const preferredAssets = ['USDT', 'BUSD', 'USDC', 'BNB'];
  const visibleNames = [...new Set([...sorted.map(([name]) => name), ...preferredAssets])].slice(0, 4);
  const visibleSet = new Set(visibleNames);
  const rows: Array<[string, number]> = [
    ...visibleNames.map((name) => [name, byAsset.get(name) ?? 0] as [string, number]),
    ['DİĞER', sorted.filter(([name]) => !visibleSet.has(name)).reduce((sum, item) => sum + item[1], 0)],
  ];
  const distributions: CurrencyDistribution[] = rows.map(([name, amount]) => ({
    name, amount, percentage: total > 0 ? Math.round((amount / total) * 100) : 0, color: assetColors[name] ?? 'bg-[#848e9c]',
  }));
  const used = Math.max(total - available, 0);
  return { total, available, used, availablePercent: total > 0 ? Math.round((available / total) * 100) : 0, usedPercent: total > 0 ? Math.round((used / total) * 100) : 0, distributions };
}

function groupWalletBalances(balances: TradeProBalance[]) {
  const definitions = [
    { type: 'SPOT' as const, label: 'SPOT' },
    { type: 'USD_M_FUTURES' as const, label: 'FUTURES' },
    { type: 'UNIFIED' as const, label: 'UNIFIED' },
  ];
  return definitions.flatMap((definition) => {
    const rows = balances
      .filter((balance) => balance.walletType === definition.type && (finiteNumber(balance.walletBalance) > 0 || finiteNumber(balance.valueUsdt) > 0))
      .sort((left, right) => (finiteNumber(right.valueUsdt) || finiteNumber(right.walletBalance)) - (finiteNumber(left.valueUsdt) || finiteNumber(left.walletBalance)));
    return rows.length > 0 ? [{ ...definition, rows }] : [];
  });
}

function finiteNumber(value: string | undefined) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function formatBalance(value: number) { return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatAssetAmount(value: string) { const amount = finiteNumber(value); return amount.toLocaleString('en-US', { minimumFractionDigits: amount > 0 && amount < 1 ? 4 : 2, maximumFractionDigits: 6 }); }
function formatTime(value: string | null | undefined) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('tr-TR', { hour12: false }); }
function formatUptime(value: string | null | undefined) {
  if (!value) return '—';
  const milliseconds = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—';
  const totalMinutes = Math.floor(milliseconds / 60_000);
  return `${Math.floor(totalMinutes / 1_440)}g ${Math.floor((totalMinutes % 1_440) / 60)}s ${totalMinutes % 60}d`;
}
