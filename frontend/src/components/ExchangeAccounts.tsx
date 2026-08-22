import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, Eye, EyeOff, KeyRound, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { api, getApiErrorMessage } from '../services/apiClient';

type Provider = 'BINANCE' | 'BYBIT';
type ExchangeAccount = {
  id: string;
  name: string;
  provider: Provider;
  environment: 'TESTNET' | 'DEMO';
  accountType: 'USDT_M' | 'UNIFIED';
  apiKeyHint: string;
  description?: string;
  isActive: boolean;
  connectionStatus: 'CONNECTED' | 'ERROR' | 'DISABLED';
  canTrade: boolean;
  executionEngine: 'TYPESCRIPT' | 'GO';
  withdrawalEnabled: boolean;
  lastConnectedAt?: string;
  lastSyncAt?: string;
};

type WalletType = 'SPOT' | 'USD_M_FUTURES' | 'UNIFIED';
type Balance = { walletType: WalletType; asset: string; walletBalance: string; availableBalance: string; lockedBalance?: string; unrealizedPnl: string; priceUsdt?: string; valueUsdt?: string };

const emptyForm = { name: '', provider: 'BINANCE' as Provider, apiKey: '', apiSecret: '', description: '' };

export default function ExchangeAccounts() {
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ExchangeAccount | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [balances, setBalances] = useState<Record<string, Balance[]>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>({});
  const [balanceErrors, setBalanceErrors] = useState<Record<string, string>>({});

  const loadAllBalances = useCallback(async (nextAccounts: ExchangeAccount[]) => {
    setBalances({});
    setBalanceErrors({});
    setBalanceLoading(Object.fromEntries(nextAccounts.map((account) => [account.id, true])));
    const results = await Promise.all(nextAccounts.map(async (account) => {
      try {
        const response = await api.get<{ data: Balance[] }>(`/admin/trading/exchange-accounts/${account.id}/balances`);
        return { ok: true as const, accountId: account.id, balances: response.data.data };
      } catch (reason) {
        return { ok: false as const, accountId: account.id, error: getApiErrorMessage(reason, 'Bakiyeler alınamadı.') };
      }
    }));
    const nextBalances: Record<string, Balance[]> = {};
    const nextErrors: Record<string, string> = {};
    for (const result of results) {
      if (result.ok) nextBalances[result.accountId] = result.balances;
      else nextErrors[result.accountId] = result.error;
    }
    setBalances(nextBalances);
    setBalanceErrors(nextErrors);
    setBalanceLoading({});
  }, []);

  const loadAccounts = useCallback(async () => {
    setError('');
    try {
      const response = await api.get<{ data: ExchangeAccount[] }>('/admin/trading/exchange-accounts');
      setAccounts(response.data.data);
      void loadAllBalances(response.data.data);
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Borsa hesapları alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, [loadAllBalances]);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true); setFormError(''); setError(''); setNotice('');
    const isBinance = form.provider === 'BINANCE';
    try {
      if (editingAccount) {
        await api.patch(`/admin/trading/exchange-accounts/${editingAccount.id}/credentials`, {
          apiKey: form.apiKey,
          apiSecret: form.apiSecret,
        });
      } else {
        await api.post('/admin/trading/exchange-accounts', {
          ...form,
          environment: isBinance ? 'TESTNET' : 'DEMO',
          accountType: isBinance ? 'USDT_M' : 'UNIFIED',
        });
      }
      const rotated = editingAccount !== null;
      setForm(emptyForm); setShowForm(false); setShowSecret(false); setEditingAccount(null);
      setNotice(rotated ? 'API bilgileri doğrulandı ve mevcut hesap üzerinde yeniden şifrelendi.' : 'Borsa hesabı doğrulandı ve şifreli olarak kaydedildi.');
      await loadAccounts();
    } catch (reason) {
      setFormError(getApiErrorMessage(reason, 'Borsa hesabı doğrulanamadı.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function testConnection(account: ExchangeAccount) {
    setWorkingId(account.id); setError(''); setNotice('');
    try {
      await api.post(`/admin/trading/exchange-accounts/${account.id}/test`);
      setNotice(`${account.name} bağlantısı başarıyla doğrulandı.`);
      await loadAccounts();
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Bağlantı testi başarısız oldu.'));
    } finally { setWorkingId(''); }
  }

  async function remove(account: ExchangeAccount) {
    if (!window.confirm(`${account.name} hesabını ve şifreli credential verilerini silmek istiyor musunuz?`)) return;
    setWorkingId(account.id); setError('');
    try {
      await api.delete(`/admin/trading/exchange-accounts/${account.id}`);
      setBalances((current) => { const next = { ...current }; delete next[account.id]; return next; });
      setNotice('Borsa hesabı silindi.');
      await loadAccounts();
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Borsa hesabı silinemedi.'));
    } finally { setWorkingId(''); }
  }

  return <div className="space-y-6">
    <header className="flex flex-col gap-5 rounded-[30px] border border-outline/10 bg-surface p-6 md:flex-row md:items-center md:justify-between md:p-8">
      <div><p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Trading Bot / Faz 2</p><h1 className="mt-2 font-headline text-3xl font-black text-white md:text-4xl">Borsa Hesapları</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">Binance Demo Spot/Main ve USDⓈ-M Futures bakiyelerini tek bağlantıda izleyin. Anahtarlar sunucuda AES-256-GCM ile şifrelenir.</p></div>
      <button type="button" onClick={() => { setEditingAccount(null); setForm(emptyForm); setFormError(''); setShowForm(true); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-background"><Plus size={18}/> Hesap ekle</button>
    </header>

    <div className="flex items-start gap-3 rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-sm text-on-surface-variant"><ShieldCheck className="mt-0.5 shrink-0 text-tertiary" size={20}/><p>Yalnızca testnet/demo anahtarları kabul edilir. Para çekme yetkisini kapalı tutun ve mümkünse sunucu IP adresini whitelist’e ekleyin.</p></div>
    {error && <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">{error}</div>}
    {notice && <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4 text-secondary">{notice}</div>}

    {loading ? <div className="grid gap-4 md:grid-cols-2">{[1,2].map((item) => <div key={item} className="h-56 animate-pulse rounded-[26px] bg-surface"/>)}</div> : accounts.length === 0 ? (
      <div className="rounded-[28px] border border-dashed border-outline/20 bg-surface/60 px-6 py-16 text-center"><Building2 className="mx-auto text-outline" size={34}/><h2 className="mt-4 font-headline text-xl font-extrabold text-white">Henüz borsa hesabı yok</h2><p className="mt-2 text-sm text-on-surface-variant">İlk testnet hesabınızı ekleyerek bağlantıyı doğrulayabilirsiniz.</p></div>
    ) : <div className="space-y-4">{accounts.map((account) => (
      <article key={account.id} className="rounded-[26px] border border-outline/10 bg-surface p-5 md:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(270px,0.8fr)_minmax(0,2.2fr)] xl:items-center">
          <div className="flex min-w-0 items-center gap-3"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Building2 size={22}/></div><div className="min-w-0 flex-1"><h2 className="truncate font-headline text-lg font-extrabold text-white">{account.name}</h2><p className="mt-1 text-xs text-on-surface-variant">{account.provider === 'BINANCE' ? 'Binance Demo · Spot + Futures' : `Bybit V5 · ${account.environment}`}</p></div><span className="rounded-lg bg-secondary/10 px-2 py-1 text-[10px] font-black uppercase text-secondary">Bağlı</span></div>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-5"><Info label="API Key" value={account.apiKeyHint}/><Info label="Hesap tipi" value={account.provider === 'BINANCE' ? 'SPOT + USDT_M' : account.accountType}/><Info label="İşlem yetkisi" value={account.canTrade ? 'Var' : 'Yok'}/><Info label="Executor" value={account.executionEngine === 'GO' ? 'GO ENGINE' : 'TYPESCRIPT'}/><Info label="Son bağlantı" value={account.lastConnectedAt ? new Date(account.lastConnectedAt).toLocaleString('tr-TR') : '—'}/></dl>
        </div>
        {account.withdrawalEnabled && <div className="mt-4 flex gap-2 rounded-xl bg-error/10 p-3 text-xs text-error"><AlertTriangle size={16}/> Para çekme/transfer yetkisi açık görünüyor; anahtarı değiştirmeniz önerilir.</div>}
        {!account.canTrade && <div className="mt-4 flex items-start gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-xs leading-5 text-error"><AlertTriangle className="mt-0.5 shrink-0" size={16}/><span>Hesap okunabiliyor ancak Futures işlem yetkisi kapalı. Manuel emir için Binance Demo API anahtarında işlem/Futures yetkisini açın, ardından aşağıdaki “Bağlantıyı test et” butonuyla yetki durumunu yenileyin.</span></div>}
        <BalanceGroups provider={account.provider} balances={balances[account.id] ?? []} loading={balanceLoading[account.id] === true} error={balanceErrors[account.id]}/>
        <div className="mt-5 flex flex-wrap gap-2"><Action onClick={() => void testConnection(account)} disabled={workingId === account.id} icon={RefreshCw} label="Bağlantıyı test et"/><Action onClick={() => { setEditingAccount(account); setForm({ name: account.name, provider: account.provider, apiKey: '', apiSecret: '', description: account.description ?? '' }); setFormError(''); setShowForm(true); }} disabled={workingId === account.id} icon={KeyRound} label="API bilgilerini yenile"/><button type="button" onClick={() => void remove(account)} disabled={workingId === account.id} className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-error hover:bg-error/10 disabled:opacity-50"><Trash2 size={15}/> Sil</button></div>
      </article>
    ))}</div>}

    {showForm && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-outline/10 bg-surface p-5 shadow-2xl md:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-primary">Güvenli bağlantı</p><h2 className="mt-2 font-headline text-2xl font-black text-white">{editingAccount ? 'API bilgilerini yenile' : 'Borsa hesabı ekle'}</h2></div><button type="button" onClick={() => { setShowForm(false); setEditingAccount(null); }} className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-high"><X size={20}/></button></div>
      <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
        {formError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/20 bg-error/10 p-4 text-sm leading-6 text-error"><AlertTriangle className="mt-0.5 shrink-0" size={18}/><span>{formError}</span></div>}
        {!editingAccount && <Field label="Hesap adı"><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input" placeholder="Binance Test Hesabım"/></Field>}
        {!editingAccount && <Field label="Borsa ve ortam"><select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as Provider })} className="input"><option value="BINANCE">Binance Demo · Spot/Main + USDⓈ-M Futures</option><option value="BYBIT">Bybit V5 · Demo · Unified</option></select></Field>}
        <Field label="API Key"><div className="relative"><KeyRound className="absolute left-3 top-3.5 text-outline" size={17}/><input required minLength={8} maxLength={256} autoComplete="off" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} className="input pl-10"/></div></Field>
        <Field label="API Secret"><div className="relative"><input required minLength={8} maxLength={256} type={showSecret ? 'text' : 'password'} autoComplete="new-password" value={form.apiSecret} onChange={(event) => setForm({ ...form, apiSecret: event.target.value })} className="input pr-11"/><button type="button" onClick={() => setShowSecret((value) => !value)} className="absolute right-3 top-3 text-outline" aria-label={showSecret ? 'Secret gizle' : 'Secret göster'}>{showSecret ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></Field>
        {!editingAccount && <Field label="Açıklama (isteğe bağlı)"><textarea maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input min-h-24 resize-y" placeholder="Bu hesabın kullanım amacı"/></Field>}
        <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-3 text-xs leading-5 text-on-surface-variant"><AlertTriangle className="mt-0.5 shrink-0 text-primary" size={16}/> Kaydetmeden önce salt-okunur hesap isteğiyle anahtar doğrulanır. Binance için demo.binance.com hesabında oluşturulan anahtarı kullanın. Secret daha sonra arayüzde gösterilmez.</div>
        <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-black text-background disabled:opacity-60">{submitting ? <LoaderCircle className="animate-spin" size={18}/> : <ShieldCheck size={18}/>} {editingAccount ? 'Doğrula ve yeniden şifrele' : 'Doğrula ve şifreli kaydet'}</button>
      </form>
    </div></div>}
  </div>;
}

function BalanceGroups({ provider, balances, loading, error }: { provider: Provider; balances: Balance[]; loading: boolean; error: string | undefined }) {
  const groups: Array<{ type: WalletType; title: string; subtitle: string }> = provider === 'BINANCE'
    ? [
        { type: 'SPOT', title: 'Demo Spot / Main', subtitle: 'Spot cüzdan varlıkları' },
        { type: 'USD_M_FUTURES', title: 'USDⓈ-M Futures', subtitle: 'Vadeli işlem teminat bakiyeleri' },
      ]
    : [{ type: 'UNIFIED', title: 'Unified Hesap', subtitle: 'Birleşik işlem bakiyeleri' }];

  return <div className={`mt-5 grid gap-4 ${groups.length > 1 ? 'xl:grid-cols-2' : ''}`}>
    {groups.map((group) => {
      const rows = balances.filter((balance) => balance.walletType === group.type);
      return <section key={group.type} className="min-w-0 overflow-hidden rounded-2xl border border-outline/10 bg-background/35 p-3 sm:p-4">
        <div className="mb-4"><h3 className="text-base font-black text-white">{group.title}</h3><p className="mt-0.5 text-[11px] text-outline">{group.subtitle}</p></div>
        {loading ? <BalanceTableLoading/> : error ? <div className="rounded-xl border border-error/20 bg-error/10 p-3 text-xs leading-5 text-error">{error}</div> : group.type === 'SPOT' ? <SpotBalanceTable rows={rows}/> : <TradingBalanceTable rows={rows}/>} 
      </section>;
    })}
  </div>;
}

function SpotBalanceTable({ rows }: { rows: Balance[] }) {
  const stableAssets = rows
    .filter((balance) => balance.asset === 'USDT' || balance.asset === 'USDC')
    .sort((left, right) => ['USDT', 'USDC'].indexOf(left.asset) - ['USDT', 'USDC'].indexOf(right.asset));
  const otherAssets = rows.filter((balance) => balance.asset !== 'USDT' && balance.asset !== 'USDC');

  if (!rows.length) return <EmptyBalance/>;
  return <><div className="hidden overflow-hidden rounded-xl border border-outline/10 sm:block">
    <table className="w-full table-fixed text-left text-[11px] 2xl:text-xs">
      <colgroup><col className="w-[24%]"/><col className="w-[21%]"/><col className="w-[20%]"/><col className="w-[13%]"/><col className="w-[22%]"/></colgroup>
      <thead className="bg-surface-high text-[9px] font-black uppercase tracking-[0.08em] text-outline 2xl:text-[10px]"><tr><th className="px-2 py-3">Varlık</th><th className="px-2 py-3 text-right">Toplam</th><th className="px-2 py-3 text-right">Kullanılabilir</th><th className="px-2 py-3 text-right">Kilitli</th><th className="px-2 py-3 text-right">USDT Değeri</th></tr></thead>
      <tbody>{stableAssets.length > 0 && <SpotTableGroup title="USDT / USDC" balances={stableAssets}/>} {otherAssets.length > 0 && <SpotTableGroup title="Diğer Varlıklar" balances={otherAssets}/>}</tbody>
    </table>
  </div><MobileBalanceList rows={rows} spot/></>;
}

function SpotTableGroup({ title, balances }: { title: string; balances: Balance[] }) {
  return <><tr className="border-t border-outline/10 bg-primary/[0.04]"><th colSpan={5} className="px-2 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-primary">{title}</th></tr>{balances.map((balance) => <tr key={balance.asset} className="border-t border-outline/10 text-on-surface-variant hover:bg-surface-high/40">
    <td className="px-2 py-3"><span className="font-black text-white">{balance.asset}</span>{balance.priceUsdt && balance.asset !== 'USDT' && <span className="mt-0.5 block break-words text-[9px] leading-4 text-outline">1 {balance.asset} ≈ {formatAmount(balance.priceUsdt, 8)} USDT</span>}</td>
    <td className="break-words px-2 py-3 text-right font-semibold tabular-nums text-on-surface"><span className="block">{formatAmount(balance.walletBalance, 8)}</span><span className="text-[9px] text-outline">{balance.asset}</span></td>
    <td className="break-words px-2 py-3 text-right tabular-nums">{formatAmount(balance.availableBalance, 8)}</td>
    <td className={`break-words px-2 py-3 text-right tabular-nums ${isNonZeroAmount(balance.lockedBalance) ? 'font-bold text-primary' : ''}`}>{formatAmount(balance.lockedBalance ?? '0', 8)}</td>
    <td className="break-words px-2 py-3 text-right font-bold tabular-nums text-secondary">{balance.valueUsdt ? <><span className="block">≈ {formatAmount(balance.valueUsdt, 4)}</span><span className="text-[9px]">USDT</span></> : '—'}</td>
  </tr>)}</>;
}

function TradingBalanceTable({ rows }: { rows: Balance[] }) {
  if (!rows.length) return <EmptyBalance/>;
  return <><div className="hidden overflow-hidden rounded-xl border border-outline/10 sm:block"><table className="w-full table-fixed text-left text-[11px] 2xl:text-xs">
    <colgroup><col className="w-[18%]"/><col className="w-[29%]"/><col className="w-[27%]"/><col className="w-[26%]"/></colgroup>
    <thead className="bg-surface-high text-[9px] font-black uppercase tracking-[0.07em] text-outline 2xl:text-[10px]"><tr><th className="px-2 py-3">Varlık</th><th className="px-2 py-3 text-right">Toplam</th><th className="px-2 py-3 text-right">Kullanılabilir</th><th className="px-2 py-3 text-right">Gerçekleşmemiş PnL</th></tr></thead>
    <tbody>{rows.map((balance) => <tr key={`${balance.walletType}-${balance.asset}`} className="border-t border-outline/10 text-on-surface-variant hover:bg-surface-high/40"><td className="px-2 py-3 font-black text-white">{balance.asset}</td><td className="break-words px-2 py-3 text-right font-semibold tabular-nums text-on-surface"><span className="block">{formatAmount(balance.walletBalance, 8)}</span><span className="text-[9px] text-outline">{balance.asset}</span></td><td className="break-words px-2 py-3 text-right tabular-nums">{formatAmount(balance.availableBalance, 8)}</td><td className={`break-words px-2 py-3 text-right font-semibold tabular-nums ${isNonZeroAmount(balance.unrealizedPnl) ? 'text-primary' : ''}`}>{formatAmount(balance.unrealizedPnl, 8)}</td></tr>)}</tbody>
  </table></div><MobileBalanceList rows={rows}/></>;
}

function MobileBalanceList({ rows, spot = false }: { rows: Balance[]; spot?: boolean }) {
  return <div className="space-y-2 sm:hidden">{rows.map((balance) => <div key={`${balance.walletType}-${balance.asset}`} className="rounded-xl border border-outline/10 bg-surface-high/35 p-3">
    <div className="flex items-start justify-between gap-3"><div><p className="font-black text-white">{balance.asset}</p>{spot && balance.priceUsdt && balance.asset !== 'USDT' && <p className="mt-0.5 text-[9px] text-outline">1 {balance.asset} ≈ {formatAmount(balance.priceUsdt, 8)} USDT</p>}</div>{spot && balance.valueUsdt && <p className="text-right text-xs font-bold tabular-nums text-secondary">≈ {formatAmount(balance.valueUsdt, 4)} USDT</p>}</div>
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><MobileValue label="Toplam" value={`${formatAmount(balance.walletBalance, 8)} ${balance.asset}`}/><MobileValue label="Kullanılabilir" value={formatAmount(balance.availableBalance, 8)}/>{spot ? <MobileValue label="Kilitli" value={formatAmount(balance.lockedBalance ?? '0', 8)} tone={isNonZeroAmount(balance.lockedBalance) ? 'primary' : undefined}/> : <MobileValue label="Gerçekleşmemiş PnL" value={formatAmount(balance.unrealizedPnl, 8)} tone={isNonZeroAmount(balance.unrealizedPnl) ? 'primary' : undefined}/>}</dl>
  </div>)}</div>;
}

function MobileValue({ label, value, tone }: { label: string; value: string; tone?: 'primary' }) {
  return <div className="min-w-0"><dt className="text-[9px] font-black uppercase tracking-wider text-outline">{label}</dt><dd className={`mt-1 break-words font-semibold tabular-nums ${tone === 'primary' ? 'text-primary' : 'text-on-surface'}`}>{value}</dd></div>;
}

function BalanceTableLoading() { return <div className="space-y-2 rounded-xl border border-outline/10 p-3">{[1, 2, 3].map((row) => <div key={row} className="h-10 animate-pulse rounded-lg bg-surface-high/70"/>)}</div>; }
function EmptyBalance() { return <p className="rounded-xl border border-outline/10 p-4 text-xs leading-5 text-on-surface-variant">Bu cüzdanda sıfırdan farklı bakiye bulunamadı.</p>; }

function isNonZeroAmount(value?: string) { return value !== undefined && !/^[-+]?0*(?:\.0*)?$/.test(value); }
function formatAmount(value: string, maximumFractionDigits: number) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits }).format(number) : value;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-bold text-on-surface-variant">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl bg-surface-high p-3"><dt className="text-[10px] font-black uppercase tracking-wider text-outline">{label}</dt><dd className="mt-1 break-words text-sm font-semibold leading-5 text-on-surface">{value}</dd></div>; }
function Action({ onClick, disabled, icon: Icon, label }: { onClick: () => void; disabled: boolean; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) { return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-white disabled:opacity-50"><Icon size={15} className={disabled ? 'animate-spin' : ''}/>{label}</button>; }
