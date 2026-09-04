import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ExternalLink, X } from 'lucide-react';
import { type TradeProOperation, type TradeProPosition } from '../../services/backendDashboard';
import { getCoinIcon } from '../CoinIcons';

type Props = { positions: TradeProPosition[]; operations: TradeProOperation[]; loading: boolean };
type PositionRow = TradeProPosition & { roe: number; stopLoss: string | null; takeProfit: string | null };

export const ActivePositionsTable: React.FC<Props> = ({ positions, operations, loading }) => {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => positions.filter((position) => Math.abs(Number(position.quantity)) > 0).map((position): PositionRow => {
    const operation = operations.find((item) => item.symbol === position.symbol && item.position?.side === position.side);
    const notional = Math.abs(Number(position.quantity) * Number(position.entryPrice));
    const margin = notional / Math.max(Number(position.leverage), 1);
    return { ...position, roe: margin > 0 ? Number(position.unrealizedPnl) / margin * 100 : 0, stopLoss: operation?.stopLoss ?? null, takeProfit: operation?.takeProfit ?? null };
  }), [operations, positions]);

  return <>
    <div id="active-positions-card" className="h-full bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-5 shadow-xl flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3">
        <div className="flex items-center gap-2"><h3 className="text-xs font-bold tracking-wider text-[#eaecef] uppercase">AKTİF POZİSYONLAR ({rows.length})</h3><span className={`w-2 h-2 rounded-full ${rows.length ? 'bg-[#02c076] shadow-[0_0_6px_#02c076] animate-pulse' : 'bg-[#848e9c]'}`} /></div>
        <button type="button" id="view-all-positions-btn" onClick={() => setShowAll(true)} className="text-xs text-[#00d2ff] hover:text-cyan-300 font-medium transition-colors flex items-center gap-1"><span>Tümünü Gör</span><ExternalLink className="w-3 h-3" /></button>
      </div>
      <div className="max-h-[220px] overflow-auto">{loading && rows.length === 0 ? <Empty text="Pozisyonlar yükleniyor…" /> : rows.length === 0 ? <Empty text="Bu borsa hesabında açık pozisyon yok" /> : <PositionsTable rows={rows} />}</div>
    </div>
    {showAll && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"><div className="flex max-h-[85vh] w-full max-w-6xl flex-col rounded-2xl border border-[#2b3139] bg-[#1e2329] p-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#2b3139] pb-3"><div><h3 className="font-bold text-[#eaecef]">Tüm Açık Pozisyonlar</h3><p className="text-[11px] text-[#848e9c]">Seçili borsa hesabından alınan gerçek pozisyonlar · {rows.length} kayıt</p></div><button type="button" onClick={() => setShowAll(false)} className="rounded-lg border border-[#2b3139] bg-[#0b0e11] p-2 text-[#848e9c] hover:text-[#eaecef]" aria-label="Kapat"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 overflow-auto">{rows.length ? <PositionsTable rows={rows} /> : <Empty text="Açık pozisyon yok" />}</div>
    </div></div>}
  </>;
};

function PositionsTable({ rows }: { rows: PositionRow[] }) {
  return <table className="w-full min-w-[720px] text-left text-xs"><thead className="sticky top-0 z-10 bg-[#1e2329]"><tr className="text-[11px] font-semibold text-[#848e9c] uppercase border-b border-[#2b3139]"><th className="py-2 px-2">PARİTE</th><th className="py-2 px-2">YÖN</th><th className="py-2 px-2 text-right">GİRİŞ</th><th className="py-2 px-2 text-right">MEVCUT</th><th className="py-2 px-2 text-right">ROE</th><th className="py-2 px-2 text-right">PNL (USDT)</th><th className="py-2 px-2 text-right">KAR AL</th><th className="py-2 px-2 text-right">ZARAR KES</th></tr></thead>
    <tbody className="divide-y divide-[#2b3139] font-['JetBrains_Mono',monospace]">{rows.map((position) => { const positive = Number(position.unrealizedPnl) >= 0; return <tr key={position.positionKey} className="hover:bg-[#2b3139]/40 transition-colors">
      <td className="py-2.5 px-2"><div className="flex items-center gap-2">{getCoinIcon(position.symbol, 18)}<span className="font-bold text-[#eaecef]">{position.symbol}</span></div></td>
      <td className="py-2.5 px-2"><span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold border ${position.side === 'LONG' ? 'bg-[#02c076]/15 text-[#02c076] border-[#02c076]/30' : 'bg-[#f84960]/15 text-[#f84960] border-[#f84960]/30'}`}>{position.side === 'LONG' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{position.side}</span></td>
      <td className="py-2.5 px-2 text-right text-[#848e9c]">{price(position.entryPrice)}</td><td className="py-2.5 px-2 text-right text-[#eaecef] font-semibold">{price(position.markPrice)}</td><td className={`py-2.5 px-2 text-right font-bold ${positive ? 'text-[#02c076]' : 'text-[#f84960]'}`}>{signed(position.roe)}%</td><td className={`py-2.5 px-2 text-right font-bold ${positive ? 'text-[#02c076]' : 'text-[#f84960]'}`}>{signed(Number(position.unrealizedPnl))}</td><td className="py-2.5 px-2 text-right text-[#848e9c] text-[11px]">{position.takeProfit ? price(position.takeProfit) : '—'}</td><td className="py-2.5 px-2 text-right text-[#848e9c] text-[11px]">{position.stopLoss ? price(position.stopLoss) : '—'}</td>
    </tr>; })}</tbody></table>;
}
function Empty({ text }: { text: string }) { return <div className="flex min-h-28 items-center justify-center text-xs text-[#848e9c]">{text}</div>; }
function price(value: string) { return Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 8 }); }
function signed(value: number) { return `${value >= 0 ? '+' : ''}${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
