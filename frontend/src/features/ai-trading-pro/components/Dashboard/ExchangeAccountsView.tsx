import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Building2, Eye, EyeOff, KeyRound, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { api, getApiErrorMessage } from '../../../../services/apiClient';

type Provider = 'BINANCE' | 'BYBIT';
type ExchangeAccount = {
  id: string;
  name: string;
  provider: Provider;
  environment: 'TESTNET' | 'DEMO';
  accountType: 'USDT_M' | 'UNIFIED' | 'SPOT';
  apiKeyHint: string;
  description?: string;
  isActive: boolean;
  connectionStatus: 'CONNECTED' | 'DEGRADED' | 'ERROR' | 'DISABLED';
  canTrade: boolean;
  executionEngine: 'TYPESCRIPT' | 'GO';
  withdrawalEnabled: boolean;
  lastConnectedAt?: string;
  lastSyncAt?: string;
};

type WalletType = 'SPOT' | 'USD_M_FUTURES' | 'UNIFIED';
type Balance = { walletType: WalletType; asset: string; walletBalance: string; availableBalance: string; lockedBalance?: string; unrealizedPnl: string; priceUsdt?: string; valueUsdt?: string };

const emptyForm = { name: '', provider: 'BINANCE' as Provider, accountType: 'USDT_M' as ExchangeAccount['accountType'], apiKey: '', apiSecret: '', description: '' };

export function ExchangeAccountsView({ onAccountsChanged }: { onAccountsChanged?: () => void }) {
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
  const balanceRevision = useRef(0);

  const loadAllBalances = useCallback(async (nextAccounts: ExchangeAccount[]) => {
    const revision = ++balanceRevision.current;
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
    if (revision !== balanceRevision.current) return;
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
    setLoading(true);
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
          accountType: isBinance ? form.accountType : 'UNIFIED',
        });
      }
      onAccountsChanged?.();
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

  async function enableTrading(account: ExchangeAccount) {
    setWorkingId(account.id); setError(''); setNotice('');
    try {
      await api.post(`/admin/trading/exchange-accounts/${account.id}/execution-engine`, { executionEngine: 'GO' });
      await loadAccounts(); onAccountsChanged?.();
      setNotice('Demo hesap merkezi risk kontrollü işlemlere hazır.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'İşlem motoru etkinleştirilemedi.')); }
    finally { setWorkingId(''); }
  }

  async function testConnection(account: ExchangeAccount) {
    setWorkingId(account.id); setNotice(''); setError('');
    try {
      await api.post(`/admin/trading/exchange-accounts/${account.id}/test`);
      onAccountsChanged?.();
      setNotice(`${account.name} bağlantısı başarıyla doğrulandı.`);
      await loadAccounts();
    } catch (reason) {
      await loadAccounts();
      onAccountsChanged?.();
      setError(getApiErrorMessage(reason, 'Bağlantı testi başarısız oldu.'));
    } finally { setWorkingId(''); }
  }

  async function remove(account: ExchangeAccount) {
    if (!window.confirm(`${account.name} hesabını ve şifreli credential verilerini silmek istiyor musunuz?`)) return;
    setWorkingId(account.id); setError(''); setNotice('');
    try {
      await api.delete(`/admin/trading/exchange-accounts/${account.id}`);
      setBalances((current) => { const next = { ...current }; delete next[account.id]; return next; });
      onAccountsChanged?.();
      setNotice('Borsa hesabı silindi.');
      await loadAccounts();
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Borsa hesabı silinemedi.'));
    } finally { setWorkingId(''); }
  }

  return <div id="exchange-accounts-view" className="w-full space-y-5 animate-in fade-in duration-200">
    <header className="flex flex-col gap-5 rounded-2xl border border-[#848e9c]/10 bg-[#1e2329] p-6 md:flex-row md:items-center md:justify-between md:p-8">
      <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#00d2ff]">AI Trading Pro / Multi-Exchange</p><h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">Borsa Hesapları & API Entegrasyonları</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#848e9c]">Binance Testnet ve Bybit Demo hesaplarınızın bağlantı durumunu ve cüzdan bakiyelerini yönetin.</p></div>
      <button type="button" onClick={() => { setEditingAccount(null); setForm(emptyForm); setFormError(''); setShowSecret(false); setShowForm(true); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#00d2ff] px-5 py-3 text-sm font-black text-[#0b0e11]"><Plus size={18}/> Yeni Borsa / API Ekle</button>
    </header>

    <div className="flex items-start gap-3 rounded-2xl border border-[#f0b90b]/20 bg-[#f0b90b]/5 p-4 text-sm text-[#848e9c]"><ShieldCheck className="mt-0.5 shrink-0 text-[#f0b90b]" size={20}/><p>Yalnızca testnet/demo anahtarları kabul edilir. Para çekme yetkisini kapalı tutun ve mümkünse sunucu IP adresini whitelist’e ekleyin.</p></div>
    <button type="button" onClick={() => void loadAccounts()} disabled={loading || Boolean(workingId) || submitting} className="inline-flex items-center gap-2 rounded-xl border border-[#848e9c]/20 px-4 py-2 text-xs font-bold text-[#00d2ff] disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Hesapları ve bakiyeleri yenile</button>
    {error && <div role="alert" className="rounded-2xl border border-[#f84960]/20 bg-[#f84960]/10 p-4 text-[#f84960]">{error}</div>}
    {notice && <div role="status" className="rounded-2xl border border-[#02c076]/20 bg-[#02c076]/10 p-4 text-[#02c076]">{notice}</div>}

    {loading ? <div className="grid gap-4 md:grid-cols-2">{[1,2].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-[#1e2329]"/>)}</div> : accounts.length === 0 && !error ? (
      <div className="rounded-2xl border border-dashed border-[#848e9c]/20 bg-[#1e2329]/60 px-6 py-16 text-center"><Building2 className="mx-auto text-[#848e9c]" size={34}/><h2 className="mt-4 text-xl font-extrabold text-white">Henüz borsa hesabı yok</h2><p className="mt-2 text-sm text-[#848e9c]">İlk testnet hesabınızı ekleyerek bağlantıyı doğrulayabilirsiniz.</p></div>
    ) : <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">{accounts.map((account) => (
      <article key={account.id} className="rounded-2xl border border-[#848e9c]/10 bg-[#1e2329] p-5 md:p-6">
        <div className="grid gap-4">
          <div className="flex min-w-0 items-center gap-3"><div className="rounded-2xl bg-[#00d2ff]/10 p-3 text-[#00d2ff]"><Building2 size={22}/></div><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-extrabold text-white">{account.name}</h2><p className="mt-1 text-xs text-[#848e9c]">{account.provider === 'BINANCE' ? 'Binance Demo · Spot + Futures' : `Bybit V5 · ${account.environment}`}</p></div><span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase ${account.isActive && account.connectionStatus === "CONNECTED" ? "bg-[#02c076]/10 text-[#02c076]" : "bg-[#f84960]/10 text-[#f84960]"}`}>{!account.isActive || account.connectionStatus === "DISABLED" ? "Pasif" : account.connectionStatus === "CONNECTED" ? "Bağlı" : account.connectionStatus === "DEGRADED" ? "Kısıtlı bağlantı" : "Bağlantı hatası"}</span></div>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><Info label="API Key" value={account.apiKeyHint}/><Info label="Hesap tipi" value={account.accountType}/><Info label="İşlem yetkisi" value={account.canTrade ? 'Var' : 'Yok'}/><Info label="Executor" value={account.executionEngine === 'GO' ? 'GO ENGINE' : 'TYPESCRIPT'}/><Info label="Son bağlantı" value={account.lastConnectedAt ? new Date(account.lastConnectedAt).toLocaleString('tr-TR') : '—'}/></dl>
        </div>
        {account.withdrawalEnabled && <div className="mt-4 flex gap-2 rounded-xl bg-[#f84960]/10 p-3 text-xs text-[#f84960]"><AlertTriangle size={16}/> Para çekme/transfer yetkisi açık görünüyor; anahtarı değiştirmeniz önerilir.</div>}
        {account.executionEngine !== 'GO' && <div className="mt-4"><Action onClick={() => void enableTrading(account)} disabled={Boolean(workingId) || submitting || !account.canTrade} icon={ShieldCheck} label="Demo işlem motorunu etkinleştir"/></div>}
        {!account.canTrade && <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#f84960]/20 bg-[#f84960]/10 p-3 text-xs leading-5 text-[#f84960]"><AlertTriangle className="mt-0.5 shrink-0" size={16}/><span>Hesap okunabiliyor ancak işlem yetkisi kapalı. Demo API anahtarında seçili piyasanın işlem yetkisini açın, ardından bağlantıyı test edin.</span></div>}
        <BalanceGroups provider={account.provider} balances={balances[account.id] ?? []} loading={balanceLoading[account.id] === true} error={balanceErrors[account.id]}/>
        <div className="mt-5 flex flex-wrap gap-2"><Action onClick={() => void testConnection(account)} disabled={Boolean(workingId) || submitting} icon={RefreshCw} label="Bağlantıyı test et"/><Action onClick={() => { setEditingAccount(account); setForm({ name: account.name, provider: account.provider, accountType: account.accountType, apiKey: '', apiSecret: '', description: account.description ?? '' }); setFormError(''); setShowSecret(false); setShowForm(true); }} disabled={Boolean(workingId) || submitting} icon={KeyRound} label="API bilgilerini yenile"/><button type="button" onClick={() => void remove(account)} disabled={Boolean(workingId) || submitting} className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#f84960] hover:bg-[#f84960]/10 disabled:opacity-50"><Trash2 size={15}/> Sil</button></div>
      </article>
    ))}</div>}

    {showForm && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0b0e11]/85 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-label={editingAccount ? "API bilgilerini yenile" : "Borsa hesabı ekle"} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#848e9c]/10 bg-[#1e2329] p-5 shadow-2xl md:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-[#00d2ff]">Güvenli bağlantı</p><h2 className="mt-2 text-2xl font-black text-white">{editingAccount ? 'API bilgilerini yenile' : 'Borsa hesabı ekle'}</h2></div><button type="button" aria-label="Formu kapat" disabled={submitting} onClick={() => { setShowForm(false); setEditingAccount(null); setForm(emptyForm); setShowSecret(false); }} className="rounded-xl p-2 text-[#848e9c] hover:bg-[#2b3139]"><X size={20}/></button></div>
      <form onSubmit={(event) => void submit(event)} className="mt-6"><fieldset disabled={submitting} className="space-y-4">
        {formError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#f84960]/20 bg-[#f84960]/10 p-4 text-sm leading-6 text-[#f84960]"><AlertTriangle className="mt-0.5 shrink-0" size={18}/><span>{formError}</span></div>}
        {!editingAccount && <Field label="Hesap adı"><input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input" placeholder="Binance Test Hesabım"/></Field>}
        {!editingAccount && <Field label="Borsa ve ortam"><select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as Provider, accountType: event.target.value === 'BINANCE' ? 'USDT_M' : 'UNIFIED' })} className="input"><option value="BINANCE">Binance Demo</option><option value="BYBIT">Bybit V5 · Demo · Unified</option></select></Field>}
        {!editingAccount && form.provider === 'BINANCE' && <Field label="İşlem piyasası"><select value={form.accountType} onChange={event => setForm({ ...form, accountType: event.target.value as ExchangeAccount['accountType'] })} className="input"><option value="USDT_M">USDⓈ-M Futures</option><option value="SPOT">Spot</option></select></Field>}
        <Field label="API Key"><div className="relative"><KeyRound className="absolute left-3 top-3.5 text-[#848e9c]" size={17}/><input required minLength={8} maxLength={256} autoComplete="off" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} className="input pl-10"/></div></Field>
        <Field label="API Secret"><div className="relative"><input required minLength={8} maxLength={256} type={showSecret ? 'text' : 'password'} autoComplete="new-password" value={form.apiSecret} onChange={(event) => setForm({ ...form, apiSecret: event.target.value })} className="input pr-11"/><button type="button" onClick={() => setShowSecret((value) => !value)} className="absolute right-3 top-3 text-[#848e9c]" aria-label={showSecret ? 'Secret gizle' : 'Secret göster'}>{showSecret ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></Field>
        {!editingAccount && <Field label="Açıklama (isteğe bağlı)"><textarea maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input min-h-24 resize-y" placeholder="Bu hesabın kullanım amacı"/></Field>}
        <div className="flex items-start gap-3 rounded-xl bg-[#00d2ff]/5 p-3 text-xs leading-5 text-[#848e9c]"><AlertTriangle className="mt-0.5 shrink-0 text-[#00d2ff]" size={16}/> Kaydetmeden önce salt-okunur hesap isteğiyle anahtar doğrulanır. Binance için demo.binance.com hesabında oluşturulan anahtarı kullanın. Secret daha sonra arayüzde gösterilmez.</div>
        <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d2ff] px-5 py-3.5 text-sm font-black text-[#0b0e11] disabled:opacity-60">{submitting ? <LoaderCircle className="animate-spin" size={18}/> : <ShieldCheck size={18}/>} {editingAccount ? 'Doğrula ve yeniden şifrele' : 'Doğrula ve şifreli kaydet'}</button>
      </fieldset></form>
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

  return <>
    <div className="mt-4 grid gap-4">
      {groups.map((group) => {
        const rows = balances.filter((balance) => balance.walletType === group.type);
        return <section key={group.type} className="min-w-0 overflow-hidden rounded-2xl border border-[#848e9c]/10 bg-[#0b0e11]/35 p-3 sm:p-4">
          <div className="mb-4"><h3 className="text-base font-black text-white">{group.title}</h3><p className="mt-0.5 text-[11px] text-[#848e9c]">{group.subtitle}</p></div>
          {loading ? <BalanceTableLoading/> : error ? <div className="rounded-xl border border-[#f84960]/20 bg-[#f84960]/10 p-3 text-xs leading-5 text-[#f84960]">{error}</div> : group.type === 'SPOT' ? <SpotBalanceTable rows={rows}/> : <TradingBalanceTable rows={rows}/>}
        </section>;
      })}
    </div>
  </>;
}

function SpotBalanceTable({ rows }: { rows: Balance[] }) {
  const stableAssets = rows
    .filter((balance) => balance.asset === 'USDT' || balance.asset === 'USDC')
    .sort((left, right) => ['USDT', 'USDC'].indexOf(left.asset) - ['USDT', 'USDC'].indexOf(right.asset));
  const otherAssets = rows.filter((balance) => balance.asset !== 'USDT' && balance.asset !== 'USDC');

  if (!rows.length) return <EmptyBalance/>;
  return <><div className="hidden overflow-hidden rounded-xl border border-[#848e9c]/10 sm:block">
    <table className="w-full table-fixed text-left text-[11px] 2xl:text-xs">
      <colgroup><col className="w-[24%]"/><col className="w-[21%]"/><col className="w-[20%]"/><col className="w-[13%]"/><col className="w-[22%]"/></colgroup>
      <thead className="bg-[#2b3139] text-[9px] font-black uppercase tracking-[0.08em] text-[#848e9c] 2xl:text-[10px]"><tr><th className="px-2 py-3">Varlık</th><th className="px-2 py-3 text-right">Toplam</th><th className="px-2 py-3 text-right">Kullanılabilir</th><th className="px-2 py-3 text-right">Kilitli</th><th className="px-2 py-3 text-right">USDT Değeri</th></tr></thead>
      <tbody>{stableAssets.length > 0 && <SpotTableGroup title="USDT / USDC" balances={stableAssets}/>} {otherAssets.length > 0 && <SpotTableGroup title="Diğer Varlıklar" balances={otherAssets}/>}</tbody>
    </table>
  </div><MobileBalanceList rows={rows} spot/></>;
}

function SpotTableGroup({ title, balances }: { title: string; balances: Balance[] }) {
  return <><tr className="border-t border-[#848e9c]/10 bg-[#00d2ff]/[0.04]"><th colSpan={5} className="px-2 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#00d2ff]">{title}</th></tr>{balances.map((balance) => <tr key={balance.asset} className="border-t border-[#848e9c]/10 text-[#848e9c] hover:bg-[#2b3139]/40">
    <td className="px-2 py-3"><span className="font-black text-white">{balance.asset}</span>{balance.priceUsdt && balance.asset !== 'USDT' && <span className="mt-0.5 block break-words text-[9px] leading-4 text-[#848e9c]">1 {balance.asset} ≈ {formatAmount(balance.priceUsdt, 8)} USDT</span>}</td>
    <td className="break-words px-2 py-3 text-right font-semibold tabular-nums text-[#eaecef]"><span className="block">{formatAmount(balance.walletBalance, 8)}</span><span className="text-[9px] text-[#848e9c]">{balance.asset}</span></td>
    <td className="break-words px-2 py-3 text-right tabular-nums">{formatAmount(balance.availableBalance, 8)}</td>
    <td className={`break-words px-2 py-3 text-right tabular-nums ${isNonZeroAmount(balance.lockedBalance) ? 'font-bold text-[#00d2ff]' : ''}`}>{formatAmount(balance.lockedBalance ?? '0', 8)}</td>
    <td className="break-words px-2 py-3 text-right font-bold tabular-nums text-[#02c076]">{balance.valueUsdt ? <><span className="block">≈ {formatAmount(balance.valueUsdt, 4)}</span><span className="text-[9px]">USDT</span></> : '—'}</td>
  </tr>)}</>;
}

function TradingBalanceTable({ rows }: { rows: Balance[] }) {
  if (!rows.length) return <EmptyBalance/>;
  return <><div className="hidden overflow-hidden rounded-xl border border-[#848e9c]/10 sm:block"><table className="w-full table-fixed text-left text-[11px] 2xl:text-xs">
    <colgroup><col className="w-[18%]"/><col className="w-[29%]"/><col className="w-[27%]"/><col className="w-[26%]"/></colgroup>
    <thead className="bg-[#2b3139] text-[9px] font-black uppercase tracking-[0.07em] text-[#848e9c] 2xl:text-[10px]"><tr><th className="px-2 py-3">Varlık</th><th className="px-2 py-3 text-right">Toplam</th><th className="px-2 py-3 text-right">Kullanılabilir</th><th className="px-2 py-3 text-right">Gerçekleşmemiş PnL</th></tr></thead>
    <tbody>{rows.map((balance) => <tr key={`${balance.walletType}-${balance.asset}`} className="border-t border-[#848e9c]/10 text-[#848e9c] hover:bg-[#2b3139]/40"><td className="px-2 py-3 font-black text-white">{balance.asset}</td><td className="break-words px-2 py-3 text-right font-semibold tabular-nums text-[#eaecef]"><span className="block">{formatAmount(balance.walletBalance, 8)}</span><span className="text-[9px] text-[#848e9c]">{balance.asset}</span></td><td className="break-words px-2 py-3 text-right tabular-nums">{formatAmount(balance.availableBalance, 8)}</td><td className={`break-words px-2 py-3 text-right font-semibold tabular-nums ${isNonZeroAmount(balance.unrealizedPnl) ? 'text-[#00d2ff]' : ''}`}>{formatAmount(balance.unrealizedPnl, 8)}</td></tr>)}</tbody>
  </table></div><MobileBalanceList rows={rows}/></>;
}

function MobileBalanceList({ rows, spot = false }: { rows: Balance[]; spot?: boolean }) {
  return <div className="space-y-2 sm:hidden">{rows.map((balance) => <div key={`${balance.walletType}-${balance.asset}`} className="rounded-xl border border-[#848e9c]/10 bg-[#2b3139]/35 p-3">
    <div className="flex items-start justify-between gap-3"><div><p className="font-black text-white">{balance.asset}</p>{spot && balance.priceUsdt && balance.asset !== 'USDT' && <p className="mt-0.5 text-[9px] text-[#848e9c]">1 {balance.asset} ≈ {formatAmount(balance.priceUsdt, 8)} USDT</p>}</div>{spot && balance.valueUsdt && <p className="text-right text-xs font-bold tabular-nums text-[#02c076]">≈ {formatAmount(balance.valueUsdt, 4)} USDT</p>}</div>
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><MobileValue label="Toplam" value={`${formatAmount(balance.walletBalance, 8)} ${balance.asset}`}/><MobileValue label="Kullanılabilir" value={formatAmount(balance.availableBalance, 8)}/>{spot ? <MobileValue label="Kilitli" value={formatAmount(balance.lockedBalance ?? '0', 8)} tone={isNonZeroAmount(balance.lockedBalance) ? 'primary' : undefined}/> : <MobileValue label="Gerçekleşmemiş PnL" value={formatAmount(balance.unrealizedPnl, 8)} tone={isNonZeroAmount(balance.unrealizedPnl) ? 'primary' : undefined}/>}</dl>
  </div>)}</div>;
}

function MobileValue({ label, value, tone }: { label: string; value: string; tone?: 'primary' }) {
  return <div className="min-w-0"><dt className="text-[9px] font-black uppercase tracking-wider text-[#848e9c]">{label}</dt><dd className={`mt-1 break-words font-semibold tabular-nums ${tone === 'primary' ? 'text-[#00d2ff]' : 'text-[#eaecef]'}`}>{value}</dd></div>;
}

function BalanceTableLoading() { return <div className="space-y-2 rounded-xl border border-[#848e9c]/10 p-3">{[1, 2, 3].map((row) => <div key={row} className="h-10 animate-pulse rounded-lg bg-[#2b3139]/70"/>)}</div>; }
function EmptyBalance() { return <p className="rounded-xl border border-[#848e9c]/10 p-4 text-xs leading-5 text-[#848e9c]">Bu cüzdanda sıfırdan farklı bakiye bulunamadı.</p>; }

function isNonZeroAmount(value?: string) { return value !== undefined && !/^[-+]?0*(?:\.0*)?$/.test(value); }
function formatAmount(value: string, maximumFractionDigits: number) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits }).format(number) : value;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-bold text-[#848e9c]">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-xl bg-[#2b3139] p-3"><dt className="text-[10px] font-black uppercase tracking-wider text-[#848e9c]">{label}</dt><dd className="mt-1 break-words text-sm font-semibold leading-5 text-[#eaecef]">{value}</dd></div>; }
function Action({ onClick, disabled, icon: Icon, label }: { onClick: () => void; disabled: boolean; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) { return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 rounded-xl bg-[#2b3139] px-3 py-2 text-xs font-bold text-[#848e9c] hover:text-white disabled:opacity-50"><Icon size={15} className={disabled ? 'animate-spin' : ''}/>{label}</button>; }
