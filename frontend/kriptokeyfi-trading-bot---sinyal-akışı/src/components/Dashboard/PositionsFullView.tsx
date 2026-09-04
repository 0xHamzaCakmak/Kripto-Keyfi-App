import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Layers, LoaderCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { closeTradeProPosition, type TradeProOperation, type TradeProPosition } from '../../services/backendDashboard';
import { getCoinIcon } from '../CoinIcons';

type Props = { accountId: string | null; positions: TradeProPosition[]; operations: TradeProOperation[]; loading: boolean };
type CloseScope = 'ALL' | 'PROFITABLE' | string | null;

export const PositionsFullView: React.FC<Props> = ({ accountId, positions, operations, loading }) => {
  const [localPositions, setLocalPositions] = useState(positions);
  const [working, setWorking] = useState<CloseScope>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => setLocalPositions(positions), [positions]);

  const rows = useMemo(() => localPositions.filter((position) => Math.abs(Number(position.quantity)) > 0), [localPositions]);
  const profitable = useMemo(() => rows.filter((position) => Number(position.unrealizedPnl) > 0), [rows]);
  const totalPnl = rows.reduce((sum, position) => sum + Number(position.unrealizedPnl), 0);
  const profitablePnl = profitable.reduce((sum, position) => sum + Number(position.unrealizedPnl), 0);

  async function closePositions(targets: TradeProPosition[], scope: Exclude<CloseScope, null>, confirmation: string) {
    if (!accountId || targets.length === 0 || working || !window.confirm(confirmation)) return;
    setWorking(scope); setNotice(null);
    const closed: string[] = [];
    const failed: string[] = [];
    for (const position of targets) {
      try { await closeTradeProPosition(accountId, position); closed.push(position.positionKey); }
      catch { failed.push(position.symbol); }
    }
    if (closed.length) setLocalPositions((current) => current.filter((position) => !closed.includes(position.positionKey)));
    if (failed.length) setNotice({ tone: 'error', text: closed.length + ' pozisyon kapatıldı; kapatılamayanlar: ' + failed.join(', ') });
    else setNotice({ tone: 'success', text: closed.length + ' pozisyon reduce-only market emriyle kapatıldı.' });
    setWorking(null);
  }

  return <div id="positions-full-view" className="w-full space-y-5 animate-in fade-in duration-200">
    <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-center gap-3.5"><div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#02c076]/40 flex items-center justify-center text-[#02c076] shadow-[0_0_15px_rgba(2,192,118,0.25)]"><Layers className="w-6 h-6" /></div><div><div className="flex items-center gap-2"><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">Açık Pozisyonlar Yönetimi</h1><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">{rows.length} AKTİF İŞLEM</span></div><p className="text-xs text-[#848e9c] mt-0.5">Seçili borsa hesabındaki gerçek açık pozisyonlar ve anlık kâr/zarar değerleri.</p></div></div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Metric label="TOPLAM AÇIK PNL" value={money(totalPnl)} positive={totalPnl >= 0} />
        <Metric label={'KÂRDAKİ ' + profitable.length + ' POZİSYON'} value={money(profitablePnl)} positive />
        <button type="button" disabled={!accountId || profitable.length === 0 || Boolean(working)} onClick={() => void closePositions(profitable, 'PROFITABLE', profitable.length + ' kârlı açık pozisyon market fiyatından kapatılacak. Onaylıyor musunuz?')} className="flex items-center gap-1.5 px-4 py-2 bg-[#02c076]/20 hover:bg-[#02c076]/30 text-[#02c076] border border-[#02c076]/45 rounded-xl text-xs font-bold shadow-[0_0_14px_rgba(2,192,118,0.14)] transition-all disabled:opacity-40">
          {working === 'PROFITABLE' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}<span>Kârdakileri Kapat (Market)</span>
        </button>
        <button type="button" disabled={!accountId || rows.length === 0 || Boolean(working)} onClick={() => void closePositions(rows, 'ALL', 'Tüm açık pozisyonlar market fiyatından kapatılacak. Onaylıyor musunuz?')} className="flex items-center gap-1.5 px-4 py-2 bg-[#f84960]/20 hover:bg-[#f84960]/30 text-[#f84960] border border-[#f84960]/40 rounded-xl text-xs font-bold transition-all disabled:opacity-40">
          {working === 'ALL' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}<span>Tümünü Kapat (Market)</span>
        </button>
      </div>
    </div>

    {notice && <div className={'p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ' + (notice.tone === 'success' ? 'bg-[#02c076]/15 border-[#02c076]/40 text-[#02c076]' : 'bg-[#f84960]/15 border-[#f84960]/40 text-[#f84960]')}><Check className="w-4 h-4" /><span>{notice.text}</span></div>}

    <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl shadow-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-xs border-collapse font-['JetBrains_Mono',monospace]">
      <thead><tr className="bg-[#0b0e11] text-[11px] font-bold text-[#848e9c] uppercase tracking-wider border-b border-[#2b3139]"><th className="py-3 px-4">PARİTE / YÖN</th><th className="py-3 px-4 text-right">BÜYÜKLÜK / MARJİN</th><th className="py-3 px-4 text-right">GİRİŞ / ANLIK</th><th className="py-3 px-4 text-right">LİKİDASYON</th><th className="py-3 px-4 text-right">TP / SL</th><th className="py-3 px-4 text-right">PNL (ROE %)</th><th className="py-3 px-4 text-center">AKSİYON</th></tr></thead>
      <tbody className="divide-y divide-[#2b3139]">{loading && rows.length === 0 ? <Empty text="Açık pozisyonlar backend üzerinden yükleniyor…" /> : rows.length === 0 ? <Empty text={accountId ? 'Bu hesapta açık pozisyon bulunmuyor.' : 'Seçili moda uygun bağlı borsa hesabı yok.'} /> : rows.map((position) => <PositionRow key={position.positionKey} position={position} operation={operations.find((item) => item.symbol === position.symbol && item.position?.side === position.side)} working={working === position.positionKey} disabled={Boolean(working)} onClose={() => void closePositions([position], position.positionKey, position.symbol + ' pozisyonu market fiyatından kapatılacak. Onaylıyor musunuz?')} />)}</tbody>
    </table></div></div>
  </div>;
};

function PositionRow({ position, operation, working, disabled, onClose }: { position: TradeProPosition; operation?: TradeProOperation; working: boolean; disabled: boolean; onClose: () => void }) {
  const pnl = Number(position.unrealizedPnl); const entry = Number(position.entryPrice); const mark = Number(position.markPrice); const quantity = Math.abs(Number(position.quantity)); const leverage = Math.max(Number(position.leverage), 1); const margin = quantity * mark / leverage; const roe = margin > 0 ? pnl / margin * 100 : 0; const profit = pnl > 0;
  return <tr className="hover:bg-[#2b3139]/40 transition-colors"><td className="py-3 px-4"><div className="flex items-center gap-2.5">{getCoinIcon(position.symbol, 18)}<div><div className="flex items-center gap-1.5"><span className="font-bold text-[#eaecef] text-sm">{position.symbol}</span><span className={'text-[10px] font-black px-1.5 py-0.5 rounded border ' + (position.side === 'LONG' ? 'bg-[#02c076]/20 text-[#02c076] border-[#02c076]/40' : 'bg-[#f84960]/20 text-[#f84960] border-[#f84960]/40')}>{position.side === 'LONG' ? <ArrowUpRight className="inline w-3 h-3" /> : <ArrowDownRight className="inline w-3 h-3" />} {position.side} {leverage}x</span></div><span className="text-[10px] text-[#848e9c]">{position.marginMode} · reduce-only kapatma</span></div></div></td>
    <td className="py-3 px-4 text-right"><div className="font-bold text-[#eaecef]">{number(quantity)} {baseAsset(position.symbol)}</div><div className="text-[11px] text-[#848e9c]">{money(margin)} Marjin</div></td><td className="py-3 px-4 text-right"><div className="font-bold text-[#eaecef]">{number(entry)}</div><div className="text-[11px] text-[#00d2ff]">{number(mark)}</div></td><td className="py-3 px-4 text-right text-[#f84960] font-bold">{position.liquidationPrice ? number(Number(position.liquidationPrice)) : '—'}</td><td className="py-3 px-4 text-right text-[11px]"><div className="text-[#02c076] font-bold">TP: {operation?.takeProfit ? number(Number(operation.takeProfit)) : '—'}</div><div className="text-[#f84960] font-bold">SL: {operation?.stopLoss ? number(Number(operation.stopLoss)) : '—'}</div></td><td className="py-3 px-4 text-right"><div className={'text-sm font-black ' + (profit ? 'text-[#02c076]' : 'text-[#f84960]')}>{money(pnl)} USDT</div><div className={'text-[11px] font-bold ' + (profit ? 'text-[#02c076]' : 'text-[#f84960]')}>({signed(roe)}%)</div></td><td className="py-3 px-4 text-center"><button type="button" disabled={disabled} onClick={onClose} className="px-3 py-1.5 bg-[#f84960]/15 hover:bg-[#f84960]/30 text-[#f84960] border border-[#f84960]/30 rounded-lg text-xs font-bold transition-colors disabled:opacity-40">{working ? 'Kapatılıyor…' : 'Market Kapat'}</button></td></tr>;
}

function Metric({ label, value, positive }: { label: string; value: string; positive: boolean }) { return <div className="hidden sm:block text-right font-['JetBrains_Mono',monospace]"><span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">{label}</span><span className={'text-sm font-black ' + (positive ? 'text-[#02c076]' : 'text-[#f84960]')}>{value} USDT</span></div>; }
function Empty({ text }: { text: string }) { return <tr><td colSpan={7} className="py-10 text-center text-xs text-[#848e9c]">{text}</td></tr>; }
function baseAsset(symbol: string) { return symbol.replace(/(USDT|USDC|BUSD|FDUSD|USD)$/i, ''); }
function number(value: number) { return value.toLocaleString('tr-TR', { maximumFractionDigits: 8 }); }
function signed(value: number) { return (value > 0 ? '+' : '') + value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function money(value: number) { return (value > 0 ? '+' : '') + value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
