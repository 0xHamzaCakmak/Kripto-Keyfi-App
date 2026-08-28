import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bot, CircleDollarSign, Database, Gauge, HelpCircle, RefreshCw, Save, Server, ShieldAlert, ShieldCheck, Wifi } from 'lucide-react';
import TradingBots from './TradingBots';
import { api, getApiErrorMessage } from '../services/apiClient';
import { getTradingAccounts, getTradingBotPaperPerformance, getTradingBots, type TradingAccount, type TradingBot, type TradingBotPaperPerformance } from '../services/tradingService';

type RiskProfile = {
  exchangeAccountId: string; enabled: boolean; accountKillSwitch: boolean; killSwitchReason: string | null;
  globalKillSwitch: boolean; globalKillSwitchReason: string | null; maxOrderNotional: string; maxInitialMargin: string;
  maxAccountOpenNotional: string; maxOpenPositions: number; paperMaxOpenPositions: number; maxSymbolPositions: number; minLeverage: number; maxLeverage: number;
  botAllocationUsdt: string; minInitialMarginUsdt: string; testnetBotAllocationUsdt: string; testnetMinInitialMarginUsdt: string; maxSymbolOpenNotional: string;
  effectiveMaxOpenPositions?: { paper: number; futuresTestnet: number; live: number };
  minAvailableBalance: string; maxOrdersPerMinute: number; maxDailyOrders: number; allowedSymbols: string[] | null; blockedSymbols: string[] | null;
};
type RiskEvent = { id: string; source: string; decision: string; code: string; message: string; occurredAt: string };
type TradingOverview = { moduleStatus: string; engineStatus: string; liveTradingEnabled: boolean; globalKillSwitch: boolean; connectedExchangeCount: number; activeBotCount: number; completedFoundationItems: string[]; nextPhaseItems: string[] };
type RiskForm = {
  botAllocationUsdt: string; minInitialMarginUsdt: string; maxOrderNotional: string; maxInitialMargin: string;
  maxAccountOpenNotional: string; maxSymbolOpenNotional: string; minLeverage: number; maxLeverage: number;
  maxOpenPositions: number; paperMaxOpenPositions: number; maxSymbolPositions: number; maxOrdersPerMinute: number;
  maxDailyOrders: number; minAvailableBalance: string;
};

export function GridBotsPage() { return <TradingBots fixedType="GRID"/>; }

export function TradingProfitLossPage() {
  const [rows, setRows] = useState<Array<{ bot: TradingBot; performance: TradingBotPaperPerformance }>>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const bots = (await getTradingBots()).filter((bot) => bot.mode === 'PAPER'); const results = await Promise.all(bots.map(async (bot) => ({ bot, performance: await getTradingBotPaperPerformance(bot.id) }))); setRows(results); } catch (reason) { setError(getApiErrorMessage(reason, 'Kâr/zarar verileri alınamadı.')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => rows.reduce((sum, row) => { const p = row.performance.position; if (p) { sum.realized += Number(p.realizedPnl); sum.unrealized += Number(p.unrealizedPnl); sum.fees += Number(p.totalFees); sum.net += Number(p.netPnl); sum.fills += p.totalFills; } return sum; }, { realized: 0, unrealized: 0, fees: 0, net: 0, fills: 0 }), [rows]);
  return <Page title="Kâr / Zarar" subtitle="PAPER botların ücret ve slippage sonrası sanal performans merkezi." icon={CircleDollarSign} action={<RefreshButton onClick={() => void load()}/> }>
    <Notice text="Bu rakamlar simülasyondur; gerçek borsa sonucu değildir. Varsayılan hesaplama 4 bps ücret ve 2 bps slippage içerir."/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Net PnL" value={`${money(totals.net)} USDT`} tone={totals.net >= 0 ? 'safe' : 'danger'}/><Metric label="Gerçekleşen" value={money(totals.realized)}/><Metric label="Gerçekleşmemiş" value={money(totals.unrealized)}/><Metric label="Toplam ücret" value={money(totals.fees)}/><Metric label="Sanal fill" value={String(totals.fills)}/></div>
    {error && <ErrorBox text={error}/>} {loading ? <Loading/> : rows.length === 0 ? <Empty text="Henüz PAPER bot veya sanal performans kaydı yok."/> : <div className="overflow-hidden rounded-[24px] border border-outline/10 bg-surface"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-high text-xs uppercase text-outline"><tr><th className="p-4">Bot</th><th className="p-4">Pozisyon</th><th className="p-4">Ort. giriş</th><th className="p-4">Net PnL</th><th className="p-4">Ücret</th><th className="p-4">Fill</th></tr></thead><tbody>{rows.map(({ bot, performance }) => { const p = performance.position; return <tr key={bot.id} className="border-t border-outline/10"><td className="p-4"><p className="font-bold text-white">{bot.name}</p><p className="text-xs text-on-surface-variant">{bot.symbol} · {bot.type}</p></td><td className="p-4">{p ? positionSide(p.netQuantity) : 'Henüz yok'}</td><td className="p-4">{p ? decimal(p.avgEntryPrice) : '—'}</td><td className={`p-4 font-bold ${p && Number(p.netPnl) < 0 ? 'text-error' : 'text-secondary'}`}>{p ? money(Number(p.netPnl)) : '—'}</td><td className="p-4">{p ? money(Number(p.totalFees)) : '—'}</td><td className="p-4">{p?.totalFills ?? 0}</td></tr>; })}</tbody></table></div></div>}
  </Page>;
}

export function TradingRiskManagementPage() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]); const [accountId, setAccountId] = useState('');
  const [profile, setProfile] = useState<RiskProfile | null>(null); const [events, setEvents] = useState<RiskEvent[]>([]);
  const [form, setForm] = useState<RiskForm>({ botAllocationUsdt: '', minInitialMarginUsdt: '', maxOrderNotional: '', maxInitialMargin: '', maxAccountOpenNotional: '', maxSymbolOpenNotional: '', minLeverage: 5, maxLeverage: 20, maxOpenPositions: 1, paperMaxOpenPositions: 100, maxSymbolPositions: 1, maxOrdersPerMinute: 1, maxDailyOrders: 1, minAvailableBalance: '' });
  const [reason, setReason] = useState('Admin güvenlik işlemi'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState('');
  useEffect(() => { getTradingAccounts().then((items) => { setAccounts(items); setAccountId(items[0]?.id ?? ''); }).catch((e) => setError(getApiErrorMessage(e, 'Hesaplar alınamadı.'))); }, []);
  const load = useCallback(async () => { if (!accountId) return; setLoading(true); setError(''); try { const [p, e] = await Promise.all([api.get<{data: RiskProfile}>(`/admin/trading/exchange-accounts/${accountId}/risk-profile`), api.get<{data: RiskEvent[]}>(`/admin/trading/exchange-accounts/${accountId}/risk-events`)]); const next = p.data.data; setProfile(next); setEvents(e.data.data); setForm({ botAllocationUsdt: next.botAllocationUsdt, minInitialMarginUsdt: next.minInitialMarginUsdt, maxOrderNotional: next.maxOrderNotional, maxInitialMargin: next.maxInitialMargin, maxAccountOpenNotional: next.maxAccountOpenNotional, maxSymbolOpenNotional: next.maxSymbolOpenNotional, minLeverage: next.minLeverage, maxLeverage: next.maxLeverage, maxOpenPositions: next.maxOpenPositions, paperMaxOpenPositions: next.paperMaxOpenPositions, maxSymbolPositions: next.maxSymbolPositions, maxOrdersPerMinute: next.maxOrdersPerMinute, maxDailyOrders: next.maxDailyOrders, minAvailableBalance: next.minAvailableBalance }); } catch (e) { setError(getApiErrorMessage(e, 'Risk profili alınamadı.')); } finally { setLoading(false); } }, [accountId]);
  useEffect(() => { void load(); }, [load]);
  async function save() { if (!accountId || !window.confirm('Merkezi risk limitleri PAPER, TESTNET, manuel, Grid ve ileride yetkilendirilecek LIVE işlemleri etkiler. Değişiklikleri kaydetmek istiyor musunuz?')) return; setSaving(true); setError(''); setSaved(''); try { await api.patch(`/admin/trading/exchange-accounts/${accountId}/risk-profile`, form); await load(); setSaved(`Risk profili kaydedildi. Bot kotası: ${form.botAllocationUsdt} USDT; kaldıraç: ${form.minLeverage}x–${form.maxLeverage}x.`); } catch (e) { setError(getApiErrorMessage(e, 'Risk profili kaydedilemedi.')); } finally { setSaving(false); } }
  async function kill(scope: 'GLOBAL'|'ACCOUNT', active: boolean) { if (reason.trim().length < 3) { setError('Kill switch için en az 3 karakterlik sebep yazın.'); return; } const scopeLabel = scope === 'GLOBAL' ? 'global' : 'hesap'; if (!window.confirm(active ? `${scopeLabel} emergency stop etkinleştirilsin mi? Yeni işlemler engellenecektir.` : `${scopeLabel} emergency stop kaldırılsın mı? Risk limitleri geçerli olmaya devam eder.`)) return; setSaving(true); try { await api.post('/admin/trading/risk/kill-switch', { scope, active, reason, ...(scope === 'ACCOUNT' ? { exchangeAccountId: accountId } : {}) }); await load(); } catch (e) { setError(getApiErrorMessage(e, 'Kill switch değiştirilemedi.')); } finally { setSaving(false); } }
  function applyUnlimitedPreset() {
    setForm((current) => ({ ...current,
      botAllocationUsdt: positiveText(current.botAllocationUsdt, '100000'),
      minInitialMarginUsdt: positiveText(current.minInitialMarginUsdt, '1000'),
      maxOrderNotional: '0', maxInitialMargin: '0', maxAccountOpenNotional: '0', maxSymbolOpenNotional: '0',
      maxOpenPositions: 0, paperMaxOpenPositions: 0, maxSymbolPositions: 0, maxOrdersPerMinute: 0, maxDailyOrders: 0,
      minAvailableBalance: '0',
    }));
  }
  function applyCalculatedPreset() {
    setForm((current) => {
      const allocation = positiveNumber(current.botAllocationUsdt, 100000);
      const minimumMargin = Math.min(allocation, positiveNumber(current.minInitialMarginUsdt, Math.max(20, allocation * 0.01)));
      const maximumLeverage = Math.max(current.minLeverage, current.maxLeverage);
      const openPositions = current.maxOpenPositions > 0 ? current.maxOpenPositions : 20;
      const paperPositions = current.paperMaxOpenPositions > 0 ? current.paperMaxOpenPositions : 100;
      const symbolPositions = current.maxSymbolPositions > 0 ? Math.min(current.maxSymbolPositions, openPositions) : 1;
      const maximumOrderNotional = allocation * maximumLeverage;
      return { ...current, botAllocationUsdt: inputNumber(allocation), minInitialMarginUsdt: inputNumber(minimumMargin),
        maxInitialMargin: inputNumber(allocation), maxOrderNotional: inputNumber(maximumOrderNotional),
        maxSymbolOpenNotional: inputNumber(maximumOrderNotional * symbolPositions),
        maxAccountOpenNotional: inputNumber(maximumOrderNotional * openPositions),
        maxOpenPositions: openPositions, paperMaxOpenPositions: paperPositions, maxSymbolPositions: symbolPositions,
        maxOrdersPerMinute: current.maxOrdersPerMinute > 0 ? current.maxOrdersPerMinute : 100,
        maxDailyOrders: current.maxDailyOrders > 0 ? current.maxDailyOrders : 5000 };
    });
  }
  const relationshipWarnings = riskRelationshipWarnings(form);
  return <Page title="Risk Yönetimi" subtitle="Bot ve manuel işlemlerin geçmek zorunda olduğu merkezi güvenlik limitleri." icon={ShieldAlert}>
    <div className="rounded-[22px] border border-outline/10 bg-surface p-5"><label className="text-sm font-bold text-on-surface-variant">Borsa hesabı</label><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-2 w-full rounded-xl border border-outline/15 bg-background/40 p-3 text-white">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.provider} {a.environment}</option>)}</select></div>
    {error && <ErrorBox text={error}/>} {saved && <div className="rounded-2xl border border-secondary/25 bg-secondary/10 p-4 text-secondary">{saved}</div>}
    {loading ? <Loading/> : profile && <>
      <Notice text="Bu profil Go Risk Engine tarafından her karar öncesinde veritabanından okunur. Tüm azami parasal, pozisyon adedi ve emir sıklığı limitlerinde 0 uygulama sınırı olmadığı anlamına gelir; kullanılabilir bakiye, Binance filtreleri, stop-loss ve kill switch kontrolleri devam eder."/>
      <div className="grid gap-4 lg:grid-cols-2"><KillCard title="Global kill switch" active={profile.globalKillSwitch} reason={profile.globalKillSwitchReason} onChange={(active) => void kill('GLOBAL', active)} disabled={saving}/><KillCard title="Hesap kill switch" active={profile.accountKillSwitch} reason={profile.killSwitchReason} onChange={(active) => void kill('ACCOUNT', active)} disabled={saving}/></div>
      <div className="rounded-[24px] border border-outline/10 bg-surface p-6">
        <h2 className="font-headline text-xl font-black text-white">Admin kontrollü risk limitleri</h2>
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={applyUnlimitedPreset} className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-2 text-sm font-black text-secondary">Sınırsız üst limitleri doldur</button><button type="button" onClick={applyCalculatedPreset} className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-black text-primary">Sonlu limitleri otomatik hesapla</button></div>
        <p className="mt-3 text-xs leading-5 text-outline">Sınırsız profil üst limitleri 0 yapar. Sonlu profil, bir botun tüm kotasını azami kaldıraçla kullanabileceği değerlere göre hesaplanır; kaydetmeden önce değiştirebilirsiniz.</p>
        {relationshipWarnings.length > 0 && <div className="mt-4 rounded-2xl border border-tertiary/25 bg-tertiary/5 p-4"><p className="text-sm font-black text-tertiary">Değer ilişkisi uyarıları</p><ul className="mt-2 space-y-1 text-xs leading-5 text-on-surface-variant">{relationshipWarnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(form).map(([key, value]) => <RiskLimitField key={key} fieldKey={key as keyof RiskForm} value={value} form={form} onChange={(next) => setForm((current) => ({ ...current, [key]: integerRiskFields.has(key as keyof RiskForm) ? Number(next) : String(next) }))}/>)}</div>
        <p className="mt-4 text-xs leading-5 text-outline">Her alanın yanındaki <HelpCircle className="inline-block" size={14}/> simgesine gelerek neyi etkilediğini ve diğer değerlerle ilişkisini görebilirsiniz. 0 yalnızca azami limitlerde sınırsızdır; bot kotası, asgari teminat ve kaldıraç pozitif kalmalıdır.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Değişiklik nedeni / kill switch sebebi" className="flex-1 rounded-xl border border-outline/15 bg-background/40 p-3 text-white"/><button disabled={saving} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-background"><Save size={17}/> Limitleri kaydet</button></div>
      </div>
      <div className="rounded-[24px] border border-outline/10 bg-surface p-6"><h2 className="font-headline text-xl font-black text-white">Son risk kararları</h2><div className="mt-4 space-y-2">{events.length === 0 ? <p className="text-sm text-on-surface-variant">Henüz risk olayı yok.</p> : events.slice(0,10).map((event) => <div key={event.id} className="rounded-xl bg-surface-high p-3"><div className="flex justify-between gap-3"><span className={`text-xs font-black ${event.decision === 'APPROVED' ? 'text-secondary' : 'text-error'}`}>{event.decision} · {event.code}</span><span className="text-xs text-outline">{date(event.occurredAt)}</span></div><p className="mt-2 text-sm text-on-surface-variant">{event.message}</p></div>)}</div></div>
    </>}
  </Page>;
}

export function TradingSystemStatusPage() {
  const [overview, setOverview] = useState<TradingOverview | null>(null); const [bots, setBots] = useState<TradingBot[]>([]); const [accounts, setAccounts] = useState<TradingAccount[]>([]); const [backend, setBackend] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async () => { setError(''); try { const [health, o, b, a] = await Promise.all([api.get('/health'), api.get<{data: TradingOverview}>('/admin/trading/overview'), getTradingBots(), getTradingAccounts()]); setBackend(health.status === 200); setOverview(o.data.data); setBots(b); setAccounts(a); } catch (e) { setError(getApiErrorMessage(e, 'Sistem durumu alınamadı.')); } }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15000); return () => window.clearInterval(timer); }, [load]);
  const running = bots.filter((b) => b.state === 'RUNNING').length; const errors = bots.filter((b) => ['ERROR','RISK_BLOCKED','EMERGENCY_STOPPED'].includes(b.state)).length;
  return <Page title="Sistem Durumu" subtitle="Trading servisleri, bağlantılar ve bot scheduler sağlığı." icon={Activity} action={<RefreshButton onClick={() => void load()}/> }>
    {error && <ErrorBox text={error}/>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatusCard icon={Server} label="Node backend" ok={backend} value={backend ? 'Çalışıyor' : 'Erişilemiyor'}/><StatusCard icon={Database} label="Veritabanı" ok={backend} value={backend ? 'Bağlı' : 'Bilinmiyor'}/><StatusCard icon={Wifi} label="Bağlı hesap" ok={accounts.some((a) => a.connectionStatus === 'CONNECTED')} value={`${accounts.filter((a) => a.connectionStatus === 'CONNECTED').length} / ${accounts.length}`}/><StatusCard icon={Bot} label="Bot scheduler" ok={running > 0 && errors === 0} value={`${running} çalışıyor · ${errors} sorun`}/></div>
    <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-[24px] border border-outline/10 bg-surface p-6"><h2 className="font-headline text-xl font-black text-white">Güvenlik durumu</h2><div className="mt-4 space-y-3"><StatusLine label="Canlı işlem" value={overview?.liveTradingEnabled ? 'Açık' : 'Kilitli'} safe={!overview?.liveTradingEnabled}/><StatusLine label="Global kill switch" value={overview?.globalKillSwitch ? 'Aktif' : 'Pasif'} safe={!overview?.globalKillSwitch}/><StatusLine label="Çalışma ortamı" value="Testnet / Demo" safe/><StatusLine label="AI emir yetkisi" value="Kapalı" safe/></div></div><div className="rounded-[24px] border border-outline/10 bg-surface p-6"><h2 className="font-headline text-xl font-black text-white">Bot durumları</h2><div className="mt-4 space-y-2">{bots.map((bot) => <div key={bot.id} className="flex items-center justify-between rounded-xl bg-surface-high p-3"><div><p className="font-bold text-white">{bot.name}</p><p className="text-xs text-on-surface-variant">{bot.symbol} · {bot.mode}</p></div><span className={`rounded-lg px-2 py-1 text-xs font-black ${bot.state === 'RUNNING' ? 'bg-secondary/10 text-secondary' : ['ERROR','RISK_BLOCKED'].includes(bot.state) ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary'}`}>{bot.state}</span></div>)}</div></div></div>
  </Page>;
}

const riskLabels: Record<string,string> = { botAllocationUsdt:'Bot başına teminat kotası (PAPER / TESTNET / LIVE)', minInitialMarginUsdt:'Asgari işlem teminatı', maxOrderNotional:'Emir başına azami notional', maxInitialMargin:'Emir başına azami başlangıç teminatı', maxAccountOpenNotional:'Hesap açık notional limiti', maxSymbolOpenNotional:'Parite açık notional limiti', minLeverage:'Asgari kaldıraç', maxLeverage:'Azami kaldıraç', maxOpenPositions:'Futures Testnet / Live azami açık pozisyon', paperMaxOpenPositions:'PAPER / Training azami açık pozisyon', maxSymbolPositions:'Parite başına azami açık pozisyon', maxOrdersPerMinute:'Dakikalık emir limiti', maxDailyOrders:'Günlük emir limiti', minAvailableBalance:'Korunacak minimum bakiye' };
const integerRiskFields = new Set<keyof RiskForm>(['minLeverage', 'maxLeverage', 'maxOpenPositions', 'paperMaxOpenPositions', 'maxSymbolPositions', 'maxOrdersPerMinute', 'maxDailyOrders']);
const riskHelp: Record<keyof RiskForm, string> = {
  botAllocationUsdt: 'Tek bir botun pozisyon açarken kullanabileceği toplam başlangıç teminatı bütçesidir. Notional değildir. Örneğin 1.000 USDT kota ve 20x kaldıraç teorik olarak en fazla 20.000 USDT notional üretir. Pozitif olmalı ve asgari işlem teminatından küçük olmamalıdır.',
  minInitialMarginUsdt: 'Her yeni emir için hedeflenen en düşük başlangıç teminatıdır. Bot gerektiğinde risk hesabına göre daha büyük teminat kullanabilir fakat bot kotasını aşamaz. Kaldıraçtan önce uygulanır: 1.000 USDT × 17x yaklaşık 17.000 USDT notional demektir.',
  maxOrderNotional: 'Tek bir emrin fiyat × miktar değeridir. Başlangıç teminatı değildir. Sonlu kullanılacaksa tam bot kotasının engellenmemesi için en az bot kotası × azami kaldıraç olmalıdır. 0 uygulama tarafındaki bu üst sınırı kapatır.',
  maxInitialMargin: 'Tek emrin kullanabileceği en yüksek başlangıç teminatıdır. Sonlu kullanılacaksa asgari işlem teminatından küçük olamaz; botun tüm kotasını kullanabilmesi için bot kotasına eşit olmalıdır. 0 sınırsızdır.',
  maxAccountOpenNotional: 'Bu borsa hesabındaki bütün açık vadeli pozisyonların toplam mutlak notional tavanıdır. Sonlu güvenli eşleşme: emir notional kapasitesi × hesap açık pozisyon sayısı. 0 sınırsızdır.',
  maxSymbolOpenNotional: 'Aynı paritedeki açık pozisyonların toplam mutlak notional tavanıdır. Sonlu güvenli eşleşme: emir notional kapasitesi × parite başına pozisyon sayısı. 0 sınırsızdır.',
  minLeverage: 'Botun seçebileceği en düşük kaldıraçtır. Asgari emir notionalı yaklaşık asgari teminat × seçilen kaldıraçtır. Mevcut uygulama profili 5x–20x aralığını kabul eder.',
  maxLeverage: 'Botun seçebileceği en yüksek kaldıraçtır. Teorik emir kapasitesi bot kotası × bu değerdir. Binance sembole ve toplam pozisyon büyüklüğüne göre daha düşük bir kaldıraç uygulayabilir; uygulamadaki azami değer 20x’tir.',
  maxOpenPositions: 'Futures Testnet/Live hesapta eş zamanlı açık pozisyon adedi üst sınırıdır. 0 uygulama sınırını kapatır. Sonluysa parite başına pozisyon limitinden küçük olmamalıdır.',
  paperMaxOpenPositions: 'Yalnızca PAPER/Training simülasyonundaki eş zamanlı açık pozisyon sayısıdır. Gerçek Binance pozisyonlarını etkilemez. 0 uygulama sınırını kapatır.',
  maxSymbolPositions: 'Aynı paritede izin verilen açık pozisyon/leg sayısıdır. Hedge modunda LONG ve SHORT ayrı leg olabilir. Sonluysa hesap açık pozisyon sınırını aşmamalıdır. 0 uygulama sınırını kapatır.',
  maxOrdersPerMinute: 'Yeni giriş, çıkış, koruma, iptal ve emir değiştirme çağrılarının dakikalık uygulama tavanıdır. 0 bu uygulama tavanını kapatır; Binance’in kendi API hız limitleri devam eder.',
  maxDailyOrders: 'Hesabın bir gün içinde gönderebileceği toplam emir çağrısı tavanıdır. 0 uygulama tavanını kapatır. Çok düşük değer TP/SL ve yeniden giriş emirlerini de engelleyebilir.',
  minAvailableBalance: 'Yeni emirden sonra hesapta korunması istenen kullanılabilir USDT rezervidir. Bu bir üst limit değildir. 0 rezerv ayırmaz; pozisyon açmak için Binance’in istediği gerçek margin yine bulunmalıdır.',
};

function RiskLimitField({ fieldKey, value, form, onChange }: { fieldKey: keyof RiskForm; value: string | number; form: RiskForm; onChange: (value: string) => void }) {
  const recommendation = riskRecommendation(fieldKey, form);
  return <label className="min-w-0 text-sm font-bold text-on-surface-variant">
    <span className="flex items-center gap-2">{riskLabels[fieldKey] ?? fieldKey}<span className="group relative inline-flex"><button type="button" aria-label={`${riskLabels[fieldKey]} açıklaması`} className="rounded-full text-outline transition hover:text-primary focus:text-primary focus:outline-none"><HelpCircle size={16}/></button><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-80 -translate-x-1/2 rounded-xl border border-outline/20 bg-background p-3 text-left text-xs font-normal leading-5 text-on-surface-variant shadow-2xl group-hover:block group-focus-within:block"><strong className="mb-1 block text-white">{riskLabels[fieldKey]}</strong>{riskHelp[fieldKey]}<span className="mt-2 block border-t border-outline/15 pt-2 font-bold text-primary">Bu değerlere göre: {recommendation}</span></span></span></span>
    <input type="number" min="0" placeholder={riskPlaceholder(fieldKey, form)} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-outline/15 bg-background/40 p-3 text-white placeholder:text-outline/60"/>
    <span className="mt-1 block min-h-8 text-[11px] font-normal leading-4 text-outline">{recommendation}</span>
  </label>;
}

function riskRecommendation(field: keyof RiskForm, form: RiskForm) {
  const allocation = positiveNumber(form.botAllocationUsdt, 0);
  const minimumMargin = positiveNumber(form.minInitialMarginUsdt, 0);
  const maximumLeverage = Math.max(1, form.maxLeverage || 1);
  const orderCapacity = allocation * maximumLeverage;
  const orderLimit = positiveNumber(form.maxOrderNotional, orderCapacity);
  const openPositions = form.maxOpenPositions > 0 ? form.maxOpenPositions : 1;
  const symbolPositions = form.maxSymbolPositions > 0 ? form.maxSymbolPositions : 1;
  const recommendations: Record<keyof RiskForm, string> = {
    botAllocationUsdt: minimumMargin > 0 ? `En az ${inputNumber(minimumMargin)} USDT olmalı.` : 'Asgari teminattan büyük veya ona eşit olmalı.',
    minInitialMarginUsdt: allocation > 0 ? `En fazla ${inputNumber(allocation)} USDT; örnek dengeli aralık kotanın %1–%10’u.` : 'Bot kotasını aşmamalı.',
    maxOrderNotional: orderCapacity > 0 ? `Tam kota için 0 veya en az ${inputNumber(orderCapacity)} USDT.` : '0 sınırsızdır; sonlu değer kota × azami kaldıraçtan düşük olmamalı.',
    maxInitialMargin: allocation > 0 ? `Tam kota için 0 veya ${inputNumber(allocation)} USDT.` : '0 sınırsızdır; sonlu değer asgari teminattan düşük olmamalı.',
    maxAccountOpenNotional: orderLimit > 0 ? `Mevcut pozisyon adediyle 0 veya yaklaşık ${inputNumber(orderLimit * openPositions)} USDT.` : '0 sınırsızdır.',
    maxSymbolOpenNotional: orderLimit > 0 ? `Mevcut parite adediyle 0 veya yaklaşık ${inputNumber(orderLimit * symbolPositions)} USDT.` : '0 sınırsızdır.',
    minLeverage: `Azami kaldıraç ${form.maxLeverage}x değerini aşmamalı.`,
    maxLeverage: allocation > 0 ? `Teorik tam-kota notionalı ${inputNumber(orderCapacity)} USDT.` : 'Mevcut uygulama üst sınırı 20x.',
    maxOpenPositions: form.maxSymbolPositions > 0 ? `Sonluysa en az ${form.maxSymbolPositions}; 0 sınırsız.` : '0 sınırsızdır.',
    paperMaxOpenPositions: '0 sınırsız; yalnızca PAPER/Training için.',
    maxSymbolPositions: form.maxOpenPositions > 0 ? `En fazla ${form.maxOpenPositions}; 0 sınırsız.` : 'Hesap adedi sınırsız; 0 burada da sınırsız.',
    maxOrdersPerMinute: '0 sınırsız; Binance API limiti yine geçerli.',
    maxDailyOrders: '0 sınırsız; TP/SL emirleri de sayılır.',
    minAvailableBalance: '0 rezerv ayırmaz; pozitif değer kullanılmadan korunur.',
  };
  return recommendations[field];
}

function riskPlaceholder(field: keyof RiskForm, form: RiskForm) {
  if (field === 'botAllocationUsdt') return 'Örn. 100000';
  if (field === 'minInitialMarginUsdt') return 'Örn. bot kotasının %1–%10’u';
  if (field === 'maxOrderNotional') return `0 veya ${inputNumber(positiveNumber(form.botAllocationUsdt, 0) * Math.max(form.maxLeverage, 1))}`;
  return ['minLeverage', 'maxLeverage'].includes(field) ? undefined : '0 = sınırsız';
}

function riskRelationshipWarnings(form: RiskForm) {
  const warnings: string[] = [];
  const allocation = positiveNumber(form.botAllocationUsdt, 0);
  const minimumMargin = positiveNumber(form.minInitialMarginUsdt, 0);
  const maxMargin = Number(form.maxInitialMargin);
  const maxOrder = Number(form.maxOrderNotional);
  const minimumHighLeverageNotional = minimumMargin * Math.max(form.maxLeverage, 1);
  if (minimumMargin > allocation && allocation > 0) warnings.push('Asgari işlem teminatı bot kotasını aşıyor; profil kaydedilemez.');
  if (maxMargin > 0 && maxMargin < minimumMargin) warnings.push(`Azami başlangıç teminatı, asgari ${inputNumber(minimumMargin)} USDT emri engeller. 0 veya daha yüksek bir değer kullanın.`);
  if (maxOrder > 0 && maxOrder < minimumHighLeverageNotional) warnings.push(`Azami notional, ${form.maxLeverage}x kaldıraçtaki asgari emri engelleyebilir. 0 veya en az ${inputNumber(minimumHighLeverageNotional)} USDT kullanın.`);
  if (form.maxOpenPositions > 0 && form.maxSymbolPositions > form.maxOpenPositions) warnings.push('Parite pozisyon adedi hesap pozisyon adedinden büyük olamaz.');
  return warnings;
}

function positiveNumber(value: string | number, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
function positiveText(value: string, fallback: string) { return positiveNumber(value, 0) > 0 ? value : fallback; }
function inputNumber(value: number) { return Number.isFinite(value) ? Number(value.toFixed(2)).toString() : '0'; }
function Page({ title, subtitle, icon: Icon, action, children }: { title:string; subtitle:string; icon:typeof Bot; action?:React.ReactNode; children:React.ReactNode }) { return <div className="space-y-6"><header className="rounded-[30px] border border-primary/15 bg-gradient-to-br from-surface via-surface to-primary/10 p-6 md:p-8"><div className="flex items-center justify-between gap-4"><div><div className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary"><Icon/></div><h1 className="mt-4 font-headline text-3xl font-black text-white md:text-4xl">{title}</h1><p className="mt-2 text-on-surface-variant">{subtitle}</p></div>{action}</div></header>{children}</div>; }
function Metric({label,value,tone}:{label:string;value:string;tone?:'safe'|'danger'}) { return <div className="rounded-[22px] border border-outline/10 bg-surface p-5"><p className="text-sm text-on-surface-variant">{label}</p><p className={`mt-2 font-headline text-2xl font-black ${tone === 'danger' ? 'text-error' : tone === 'safe' ? 'text-secondary' : 'text-white'}`}>{value}</p></div>; }
function StatusCard({icon:Icon,label,ok,value}:{icon:typeof Bot;label:string;ok:boolean;value:string}) { return <div className="rounded-[22px] border border-outline/10 bg-surface p-5"><Icon className={ok?'text-secondary':'text-error'}/><p className="mt-4 text-sm text-on-surface-variant">{label}</p><p className={`mt-1 font-bold ${ok?'text-secondary':'text-error'}`}>{value}</p></div>; }
function StatusLine({label,value,safe}:{label:string;value:string;safe:boolean}) { return <div className="flex items-center justify-between rounded-xl bg-surface-high p-3"><span className="text-sm text-on-surface-variant">{label}</span><span className={`text-xs font-black ${safe?'text-secondary':'text-error'}`}>{value}</span></div>; }
function KillCard({title,active,reason,onChange,disabled}:{title:string;active:boolean;reason:string|null;onChange:(active:boolean)=>void;disabled:boolean}) { return <div className={`rounded-[24px] border p-5 ${active?'border-error/30 bg-error/5':'border-secondary/20 bg-secondary/5'}`}><ShieldAlert className={active?'text-error':'text-secondary'}/><h2 className="mt-3 font-headline text-xl font-black text-white">{title}</h2><p className={`mt-2 text-sm font-bold ${active?'text-error':'text-secondary'}`}>{active?'AKTİF · Yeni işlemler engelli':'Pasif · Risk limitleri geçerli'}</p>{reason&&<p className="mt-2 text-xs text-on-surface-variant">Son sebep: {reason}</p>}<button disabled={disabled} onClick={()=>onChange(!active)} className={`mt-4 rounded-xl px-4 py-2 text-sm font-black ${active?'bg-secondary text-background':'bg-error text-white'}`}>{active?'Kilidi kaldır':'Acil durdurmayı etkinleştir'}</button></div>; }
function Notice({text}:{text:string}) { return <div className="flex gap-3 rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-sm text-on-surface-variant"><AlertTriangle className="shrink-0 text-tertiary" size={19}/>{text}</div>; }
function ErrorBox({text}:{text:string}) { return <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">{text}</div>; }
function Empty({text}:{text:string}) { return <div className="rounded-[24px] border border-dashed border-outline/20 bg-surface p-10 text-center text-on-surface-variant">{text}</div>; }
function Loading() { return <div className="h-40 animate-pulse rounded-[24px] bg-surface"/>; }
function RefreshButton({onClick}:{onClick:()=>void}) { return <button onClick={onClick} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-background"><RefreshCw size={17}/> Yenile</button>; }
function money(value:number) { return value.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:8}); }
function decimal(value:string) { return Number(value).toLocaleString('tr-TR',{maximumFractionDigits:8}); }
function positionSide(quantity:string) { return Number(quantity)>0?'LONG':Number(quantity)<0?'SHORT':'FLAT'; }
function date(value:string) { return new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)); }
