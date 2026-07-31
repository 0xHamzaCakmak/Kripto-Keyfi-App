import { useEffect, useState } from 'react';
import { Activity, ArrowRight, Bot, Building2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, getApiErrorMessage } from '../services/apiClient';

type DashboardData = { userCount: number; activeBotCount: number; connectedExchangeCount: number; systemStatus: string };

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ data: DashboardData }>('/admin/dashboard')
      .then((response) => setData(response.data.data))
      .catch((reason) => setError(getApiErrorMessage(reason, 'Dashboard bilgileri alınamadı.')));
  }, []);

  const cards = [
    ['Toplam kullanıcı', data?.userCount ?? '—', Users],
    ['Aktif bot', data?.activeBotCount ?? 0, Bot],
    ['Bağlı borsa hesabı', data?.connectedExchangeCount ?? 0, Building2],
    ['Sistem durumu', data?.systemStatus ?? 'Yükleniyor', Activity],
  ] as const;

  return <div className="space-y-6">
    <section className="flex flex-col gap-5 rounded-[32px] border border-outline/5 bg-surface p-6 md:flex-row md:items-center md:justify-between md:p-8">
      <div><p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">Admin Paneli</p><h1 className="mt-2 font-headline text-4xl font-extrabold text-white">Hoş geldiniz, {user?.fullName}</h1></div>
      <Link to="/admin/trading" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Trading Bot’a git <ArrowRight size={18}/></Link>
    </section>
    {error && <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">{error}</div>}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon]) => <article key={label} className="rounded-[28px] border border-outline/5 bg-surface p-6"><Icon className="text-primary"/><p className="mt-6 text-sm text-on-surface-variant">{label}</p><p className="mt-2 font-headline text-3xl font-black text-white">{value}</p></article>)}</div>
    <section className="rounded-[28px] border border-primary/15 bg-primary/5 p-6"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Yeni modül</p><h2 className="mt-2 font-headline text-2xl font-extrabold text-white">Trading Bot temeli hazır</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">Admin koruması, responsive yönetim menüsü ve güvenli durum ekranı eklendi. Canlı işlemler kapalı; sıradaki adım testnet borsa hesapları.</p></section>
  </div>;
}
