import { useState } from 'react';
import { aiTradingApi, botSymbols, type AutonomousBot } from '../../../../src/services/aiTradingService';
import { getApiErrorMessage } from '../../../../src/services/apiClient';

export function MyBotsView({ bots, loading, error, onRefresh, onRisk }: { bots: AutonomousBot[]; loading: boolean; error: string; onRefresh: () => void; onRisk: () => void }) {
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  async function control(bot: AutonomousBot, action: 'pause' | 'start' | 'resume') {
    if (busy || loading || error) return;
    if (!window.confirm(`${bot.name}: ${action === 'pause' ? 'duraklatma' : 'başlatma'} isteği gönderilsin mi? Açık pozisyonlar kapanmaz. Hesap durdurması ve risk limitleri ayrıca geçerlidir.`)) return;
    setBusy(bot.id); setNotice('');
    try {
      if (action === 'pause') await aiTradingApi.pauseBot(bot.id);
      else if (action === 'resume') await aiTradingApi.resumeBot(bot.id);
      else await aiTradingApi.startBot(bot.id);
      setNotice(`${bot.name}: istek kabul edildi; motorun güncel durumu yeniden okunuyor.`);
      onRefresh();
    } catch (reason) { setNotice(getApiErrorMessage(reason, 'Bot isteği başarısız.')); }
    finally { setBusy(''); }
  }
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5"><div><h1 className="text-xl font-bold">Botlarım · {bots.length} demo bot</h1><p className="mt-2 text-xs text-[#848e9c]">Seçili hesabın gerçek botları. Bot durumu ile hesabın otomatik işlem izni ayrı kontrol edilir.</p></div><div className="flex gap-4"><button disabled={loading || Boolean(busy)} onClick={onRefresh} className="text-sm text-[#00d2ff]">Yenile</button><button onClick={onRisk} className="text-sm text-[#f0b90b]">İşlem ve risk ayarları</button></div></header>
    {error && <p role="alert" className="text-sm text-[#f84960]">{error} Son veriler güncel olmayabilir; bot kontrolleri kapalı.</p>}
    {notice && <p role="status" className="text-sm text-[#f0b90b]">{notice}</p>}
    {!bots.length && <p className="text-sm text-[#848e9c]">{loading ? 'Botlar yükleniyor…' : error ? 'Bot listesi doğrulanamadı.' : 'Seçili hesapta demo bot bulunmuyor.'}</p>}
    <div className="grid gap-4 md:grid-cols-2">{bots.map((bot) => <article key={bot.id} className="space-y-4 rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5">
      <h2 className="font-bold">{bot.name}</h2><p className="text-xs text-[#848e9c]">{botSymbols(bot.symbols).join(', ') || 'Parite yok'} · {bot.strategyVersion?.strategy.family ?? 'Strateji bilgisi yok'}</p>
      <dl className="grid grid-cols-3 gap-3 rounded-xl bg-[#0b0e11] p-3 text-xs"><div><dt>Motor durumu</dt><dd className="mt-1 text-[#00d2ff]">{bot.state}</dd></div><div><dt>Hedef durum</dt><dd className="mt-1">{bot.desiredState}</dd></div><div><dt>Yaşam döngüsü</dt><dd className="mt-1">{bot.lifecycleStatus}</dd></div></dl>
      <div className="flex gap-3"><button disabled={Boolean(busy) || loading || Boolean(error)} onClick={() => void control(bot, bot.desiredState === 'RUNNING' ? 'pause' : bot.state === 'PAUSED' ? 'resume' : 'start')} className="rounded-lg border border-[#00d2ff]/40 px-3 py-2 text-sm text-[#00d2ff] disabled:opacity-40">{busy === bot.id ? 'İşleniyor…' : bot.desiredState === 'RUNNING' ? 'Botu duraklat' : 'Botu başlat'}</button><button onClick={onRisk} className="text-xs text-[#f0b90b]">Hesap parametreleri</button></div>
    </article>)}</div>
  </section>;
}
