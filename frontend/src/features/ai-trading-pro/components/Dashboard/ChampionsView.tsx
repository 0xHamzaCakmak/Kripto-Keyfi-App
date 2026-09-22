import { useEffect, useState } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';
import { getCoinIcon } from '../CoinIcons';
import { getProChampions, type ChampionRow } from '../../services/backendChampions';
import { getApiErrorMessage } from '../../../../services/apiClient';

const number = (value: number | null, suffix = '') => value === null ? '—' : `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}${suffix}`;
export function ChampionsTable({ rows }: { rows: ChampionRow[] }) {
  return <div className="overflow-x-auto rounded-xl border border-[#2b3139] bg-[#1e2329]"><table className="w-full min-w-[1100px] text-left text-xs">
    <thead className="bg-[#0b0e11] text-[#848e9c]"><tr>{['Sıra', 'Bot / Strateji', 'Parite', 'İşlem', 'Net PnL (USDT)', 'ROI', 'Kazanma', 'Profit factor', 'Sharpe', 'Max DD', 'Skor', 'Ölçüm zamanı'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
    <tbody>{rows.map(bot => <tr key={bot.id} className="border-t border-[#2b3139]">
      <td className="p-3 text-[#f0b90b]">{bot.rank === null ? '—' : `#${bot.rank}`}</td>
      <td className="p-3"><b>{bot.name}</b><p className="text-[10px] text-[#848e9c]">{bot.strategy ?? 'Strateji belirtilmemiş'} · {bot.generation === null ? 'Nesil yok' : `${bot.generation}. nesil`}</p><p className="text-[10px] text-[#848e9c]">{bot.state} · {bot.lifecycle}</p></td>
      <td className="p-3"><span className="flex items-center gap-2">{getCoinIcon(bot.symbol, 18)}{bot.symbol}</span></td>
      <td className="p-3">{bot.totalTrades}</td><td className={`p-3 ${(bot.netPnl ?? 0) < 0 ? 'text-[#f84960]' : 'text-[#02c076]'}`}>{number(bot.netPnl)}</td>
      <td className="p-3">{number(bot.roi, '%')}</td><td className="p-3">{number(bot.winRate, '%')}</td><td className="p-3">{number(bot.profitFactor)}</td><td className="p-3">{number(bot.sharpe)}</td><td className="p-3">{number(bot.maxDrawdown, '%')}</td>
      <td className="p-3 text-[#f0b90b]">{bot.score === null ? 'Yetersiz veri' : number(bot.score)}</td><td className="p-3 text-[#848e9c]">{bot.snapshotAt ? new Date(bot.snapshotAt).toLocaleString('tr-TR') : 'Ölçüm yok'}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function ChampionsView({ accountId, accountName }: { accountId: string | null; accountName?: string }) {
  const [data, setData] = useState<{ accountId: string; rows: ChampionRow[]; fetchedAt: string } | null>(null);
  const [loading, setLoading] = useState(Boolean(accountId));
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    setLoading(Boolean(accountId)); setError(''); setData(null);
    if (!accountId) return () => controller.abort();
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const next = await getProChampions(accountId, controller.signal);
        if (!controller.signal.aborted) { setData({ ...next, accountId }); setError(''); }
      } catch (reason) { if (!controller.signal.aborted) setError(getApiErrorMessage(reason, 'Bot performansları alınamadı.')); }
      finally { busy = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [accountId, revision]);
  const rows = data?.accountId === accountId ? data.rows : [];
  const leaders = rows.filter(bot => bot.rank !== null).slice(0, 3);
  return <section id="champions-view" className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#2b3139] bg-[#1e2329] p-6">
      <div><h1 className="flex items-center gap-3 text-xl font-bold"><Trophy className="text-[#f0b90b]"/> Champions (Liderlik Tablosu)</h1><p className="mt-2 text-xs text-[#848e9c]">{accountName ?? 'Hesap seçilmedi'} · {rows.length} gerçek DEMO botu · kayıtlı performans skoruna göre sıralı</p></div>
      <button disabled={!accountId || loading} onClick={() => setRevision(v => v + 1)} className="flex items-center gap-2 rounded-lg border border-[#2b3139] px-3 py-2 text-xs text-[#00d2ff] disabled:opacity-40"><RefreshCw size={14}/> Yenile</button>
    </header>
    <p className="text-xs text-[#848e9c]">Son kayıtlı performans ölçümleri; tüm kayıtlı dönem. 30 günlük getiri değildir. İşlem sayısı ve ölçüm tarihiyle birlikte değerlendirin. Eşit skorlar aynı sırayı paylaşır; ölçümü olmayan botlar listenin sonunda gösterilir.</p>
    {error && <p role="alert" className="rounded-lg bg-[#f84960]/10 p-3 text-sm text-[#f84960]">{error}{rows.length > 0 && ' Son başarılı okumadaki veriler gösteriliyor.'}</p>}
    {!error && loading && <p role="status">Botlar yükleniyor…</p>}
    {!loading && !error && !rows.length && <p>{accountId ? 'Seçili hesapta arşivlenmemiş DEMO botu yok.' : 'Üst menüden hesap seçin.'}</p>}
    {!!rows.length && !leaders.length && <p className="text-sm text-[#848e9c]">Liderlik sıralaması için yeterli kayıtlı işlem/skor yok.</p>}
    <div className="grid gap-4 md:grid-cols-3">{leaders.map(bot => <article key={bot.id} className="rounded-2xl border border-[#f0b90b]/40 bg-[#1e2329] p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="font-bold"><span className="mr-2 text-[#f0b90b]">#{bot.rank}</span>{bot.name}</h2>{getCoinIcon(bot.symbol, 24)}</div>
      <p className="mt-2 text-xs text-[#848e9c]">{bot.symbol} · {bot.strategy ?? '—'}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-[#0b0e11] p-3 text-xs"><p>ROI<br/><b>{number(bot.roi, '%')}</b></p><p>Kazanma<br/><b>{number(bot.winRate, '%')}</b></p><p>Skor<br/><b className="text-[#f0b90b]">{number(bot.score)}</b></p></div>
      <p className="mt-3 text-xs text-[#848e9c]">{bot.totalTrades} kayıtlı işlem · {bot.snapshotAt ? new Date(bot.snapshotAt).toLocaleString('tr-TR') : 'Ölçüm yok'}</p>
    </article>)}</div>
    {!!rows.length && <ChampionsTable rows={rows}/>}
  </section>;
}
