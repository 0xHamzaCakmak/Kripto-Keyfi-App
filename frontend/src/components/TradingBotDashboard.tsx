import { useEffect, useState } from 'react';
import { Activity, ArrowRight, Bot, Building2, CircleDollarSign, LockKeyhole, ShieldCheck, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, getApiErrorMessage } from '../services/apiClient';

type TradingOverview = {
  moduleStatus: 'TRADING_ADMIN_READY';
  engineStatus: 'READY' | 'UNAVAILABLE';
  liveTradingEnabled: false;
  globalKillSwitch: false;
  connectedExchangeCount: number;
  activeBotCount: number;
  openPositionCount: number | null;
  openOrderCount: number | null;
  environments: string[];
  completedFoundationItems: string[];
  nextPhaseItems: string[];
};

const labels: Record<string, string> = {
  'Dynamic symbol, leverage and margin rules': 'Dinamik sembol, kaldıraç ve margin kuralları',
  'Two-step manual order confirmation': 'İki adımlı manuel emir onayı',
  'Idempotent testnet order submission': 'Idempotent testnet emir gönderimi',
  'Open orders, positions and reduce-only close': 'Açık emir, pozisyon ve reduce-only kapatma',
  'Secret-free trading audit trail': 'Secret içermeyen işlem audit kaydı',
  'Add market and account WebSocket streams': 'Market ve hesap WebSocket akışları',
  'Add reconnect and heartbeat handling': 'Reconnect ve heartbeat yönetimi',
  'Stream live updates to the admin frontend': 'Admin arayüzüne canlı veri akışı',
  'Reconcile uncertain and stale orders': 'Belirsiz ve eski emirlerin mutabakatı',
  'Admin-only backend authorization': 'Admin erişim koruması',
  'Admin navigation and responsive sidebar': 'Responsive yönetim menüsü',
  'Trading module status endpoint': 'Trading durum API’si',
  'Live trading safety lock': 'Canlı işlem güvenlik kilidi',
  'AES-256-GCM credential vault': 'AES-256-GCM credential kasası',
  'Owned multi-exchange account storage': 'Kullanıcı sahipli çoklu hesap modeli',
  'Encrypted exchange credential storage': 'Şifreli borsa credential saklama',
  'Binance Futures testnet adapter': 'Binance Futures testnet adapterı',
  'Bybit V5 demo adapter': 'Bybit V5 demo adapterı',
  'Connection test and balance synchronization': 'Bağlantı testi ve bakiye senkronizasyonu',
  'Validate test credentials from the admin panel': 'Admin panelinden test credential doğrulaması',
  'Verify real testnet balance synchronization': 'Gerçek testnet bakiye senkronizasyonunu doğrulama',
  'Add symbol and leverage metadata synchronization': 'Sembol ve kaldıraç metadata senkronizasyonu',
  'Prepare manual order preview': 'Manuel emir önizleme hazırlığı',
  'Durable trading event outbox': 'Kalıcı ve idempotent işlem event outbox’ı',
  'Binance private account WebSocket': 'Binance private hesap WebSocket’i',
  'Reconnect, heartbeat and listen-key renewal': 'Reconnect, heartbeat ve listen-key yenileme',
  'Authenticated SSE frontend updates': 'Yetkili SSE frontend güncellemeleri',
  'Live submitting, canceling and closing states': 'Canlı gönderiliyor, iptal ve kapanış durumları',
  'Recover exchange state after engine restart': 'Engine restart sonrası borsa state kurtarma',
  'Add Bybit private account WebSocket': 'Bybit private hesap WebSocket’i',
  'Add risk engine and global kill switch': 'Risk motoru ve global kill switch',
};

export default function TradingBotDashboard() {
  const [data, setData] = useState<TradingOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ data: TradingOverview }>('/admin/trading/overview')
      .then((response) => setData(response.data.data))
      .catch((reason) => setError(getApiErrorMessage(reason, 'Trading modülü durumu alınamadı.')));
  }, []);

  const metrics = [
    ['Borsa hesabı', data?.connectedExchangeCount ?? '—', Building2],
    ['Aktif bot', data?.activeBotCount ?? '—', Bot],
    ['Açık pozisyon', data?.openPositionCount ?? '—', CircleDollarSign],
    ['Açık emir', data?.openOrderCount ?? '—', Activity],
  ] as const;

  return <div className="space-y-6">
    <header className="overflow-hidden rounded-[32px] border border-primary/15 bg-gradient-to-br from-surface via-surface to-primary/10 p-6 md:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-secondary"><ShieldCheck size={15}/> Trading admin modülü aktif</div>
          <h1 className="font-headline text-3xl font-black text-white md:text-5xl">Trading Bot Kontrol Merkezi</h1>
          <p className="mt-4 max-w-2xl leading-7 text-on-surface-variant">Çok borsalı bot altyapısının admin kontrol noktası. İlk bağlantılar yalnızca Binance Futures testnet ve Bybit demo ortamlarında kurulacak.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:w-[390px]">
          <Status label="Bot engine" value={data ? (data.engineStatus === 'READY' ? 'Hazır' : 'Erişilemiyor') : 'Kontrol ediliyor'} tone="info"/>
          <Status label="Canlı işlem" value="Kapalı" tone="safe"/>
          <Status label="Kill switch" value="Pasif · yalnızca testnet" tone="safe"/>
          <Status label="Çalışma modu" value="Testnet / Demo" tone="info"/>
        </div>
      </div>
    </header>

    {error && <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">{error}</div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value, Icon]) => <article key={label} className="rounded-[24px] border border-outline/10 bg-surface p-5"><Icon className="text-primary" size={21}/><p className="mt-5 text-sm text-on-surface-variant">{label}</p><p className="mt-1 font-headline text-3xl font-black text-white">{value}</p></article>)}
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <article className="rounded-[28px] border border-outline/10 bg-surface p-6">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-secondary/10 p-3 text-secondary"><ShieldCheck size={22}/></div><div><p className="font-headline text-xl font-extrabold text-white">Hazır olan temel</p><p className="text-sm text-on-surface-variant">Bu sürümde tamamlanan korumalar</p></div></div>
        <div className="mt-6 space-y-3">{data?.completedFoundationItems.map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-surface-high p-4 text-sm font-semibold text-on-surface"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/15 text-secondary">✓</span>{labels[item] ?? item}</div>) ?? <LoadingRows/>}</div>
        <Link to="/admin/trading/accounts" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-background">Borsa hesaplarını yönet <ArrowRight size={17}/></Link>
      </article>

      <article className="rounded-[28px] border border-outline/10 bg-surface p-6">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Workflow size={22}/></div><div><p className="font-headline text-xl font-extrabold text-white">Faz 4 yol haritası</p><p className="text-sm text-on-surface-variant">Gerçek zamanlı akış ve mutabakat adımları</p></div></div>
        <div className="mt-6 space-y-3">{data?.nextPhaseItems.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-outline/10 p-4 text-sm text-on-surface-variant"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">{index + 1}</span>{labels[item] ?? item}</div>) ?? <LoadingRows/>}</div>
      </article>
    </div>

    <div className="flex items-start gap-4 rounded-[24px] border border-tertiary/20 bg-tertiary/5 p-5"><LockKeyhole className="mt-0.5 shrink-0 text-tertiary" size={22}/><div><p className="font-bold text-white">Gerçek para işlemleri kilitli</p><p className="mt-1 text-sm leading-6 text-on-surface-variant">Credential şifreleme, risk motoru, audit log, idempotency ve reconciliation tamamlanmadan canlı borsa işlemi açılmayacak.</p></div></div>
  </div>;
}

function Status({ label, value, tone }: { label: string; value: string; tone: 'safe' | 'info' | 'neutral' }) {
  const tones = { safe: 'bg-secondary/10 text-secondary', info: 'bg-tertiary/10 text-tertiary', neutral: 'bg-surface-highest text-on-surface-variant' };
  return <div className="rounded-2xl border border-outline/10 bg-background/35 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-outline">{label}</p><p className={`mt-2 inline-flex rounded-lg px-2 py-1 text-xs font-bold ${tones[tone]}`}>{value}</p></div>;
}

function LoadingRows() {
  return <>{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-surface-high"/>)}</>;
}
