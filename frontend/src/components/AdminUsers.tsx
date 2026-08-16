import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Filter, LoaderCircle, Plus, Search, ShieldCheck, UserPlus, UserRound, UsersRound, X } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import { createAdminUser, getAdminUsers, type AdminUserListItem, type AdminUserPagination } from '../services/adminUserService';

const statusLabels: Record<AdminUserListItem['status'], string> = {
  active: 'Aktif',
  pending: 'Beklemede',
  passive: 'Pasif',
  suspended: 'Askıda',
  deleted: 'Silinmiş',
};

const statusStyles: Record<AdminUserListItem['status'], string> = {
  active: 'bg-secondary/10 text-secondary',
  pending: 'bg-primary/10 text-primary',
  passive: 'bg-outline/10 text-on-surface-variant',
  suspended: 'bg-error/10 text-error',
  deleted: 'bg-error/10 text-error',
};

function formatDate(value: string | null) {
  if (!value) return 'Henüz giriş yapmadı';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function UserAvatar({ user }: { user: AdminUserListItem }) {
  if (user.avatarUrl) return <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />;
  const initial = (user.displayName ?? user.username).trim().charAt(0).toLocaleUpperCase('tr-TR');
  return <span className="font-headline text-lg font-black text-primary">{initial || <UserRound size={19} />}</span>;
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (user: AdminUserListItem) => void }) {
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '', role: 'user' as AdminUserListItem['role'] });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { onCreated(await createAdminUser(form)); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Kullanıcı oluşturulamadı.')); }
    finally { setBusy(false); }
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-outline/10 bg-background/60 px-4 py-3 text-sm text-white outline-none placeholder:text-outline focus:border-primary/60';
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
      <button type="button" aria-label="Kullanıcı ekleme penceresini kapat" onClick={onClose} className="absolute inset-0 bg-background/85 backdrop-blur-sm" />
      <form onSubmit={submit} className="relative z-10 w-full max-w-2xl rounded-[28px] border border-outline/15 bg-surface p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserPlus size={22} /></span><div><h2 id="create-user-title" className="font-headline text-2xl font-black text-white">Yeni kullanıcı oluştur</h2><p className="mt-1 text-sm text-on-surface-variant">Hesap doğrudan aktif edilir ve ilk girişte şifre değişikliği istenir.</p></div></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-high hover:text-white" aria-label="Kapat"><X size={19} /></button></div>
        {error && <div role="alert" className="mt-5 rounded-xl border border-error/30 bg-error/10 p-3 text-sm font-bold text-error">{error}</div>}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-bold text-on-surface-variant">Görünen ad<input required minLength={2} maxLength={120} value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Ad Soyad" className={inputClass} /></label>
          <label className="text-xs font-bold text-on-surface-variant">Kullanıcı adı<input required minLength={3} maxLength={30} value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="kullanici_adi" className={inputClass} /></label>
          <label className="text-xs font-bold text-on-surface-variant md:col-span-2">E-posta<input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="kullanici@example.com" className={inputClass} /></label>
          <label className="text-xs font-bold text-on-surface-variant">Geçici şifre<span className="relative mt-2 block"><input required minLength={8} maxLength={128} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="En az 8 karakter" className="w-full rounded-xl border border-outline/10 bg-background/60 py-3 pl-4 pr-11 text-sm text-white outline-none placeholder:text-outline focus:border-primary/60" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-on-surface-variant hover:text-white" aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          <label className="text-xs font-bold text-on-surface-variant">Rol<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminUserListItem['role'] }))} className={inputClass}><option value="user">Kullanıcı</option><option value="admin">Admin</option></select></label>
        </div>
        <div className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-on-surface-variant">Sistem otomatik e-posta göndermez. Geçici giriş bilgilerini kullanıcıya güvenli bir kanaldan iletmeyi unutmayın.</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={onClose} className="rounded-xl bg-surface-high px-5 py-3 text-sm font-black text-white disabled:opacity-50">Vazgeç</button><button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-background disabled:cursor-wait disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <UserPlus size={17} />}{busy ? 'Oluşturuluyor' : 'Kullanıcı oluştur'}</button></div>
      </form>
    </div>
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [pagination, setPagination] = useState<AdminUserPagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<AdminUserListItem['status'] | ''>('');
  const [role, setRole] = useState<AdminUserListItem['role'] | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, status, role]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getAdminUsers({ search: debouncedSearch || undefined, status: status || undefined, role: role || undefined, page, limit: 20 })
      .then((result) => { if (active) { setUsers(result.users); setPagination(result.pagination); } })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, 'Kullanıcı listesi yüklenemedi.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedSearch, page, reloadKey, role, status]);

  function created(user: AdminUserListItem) {
    setCreateOpen(false);
    setNotice(`${user.displayName ?? user.username} oluşturuldu. Giriş bilgilerini kendisine iletmeyi unutmayın.`);
    setPage(1);
    setReloadKey((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-primary">Yönetim modülü</p><h1 className="mt-1 font-headline text-3xl font-black text-white">Kullanıcı Yönetimi</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">Hesapları arayın; rol, durum, kayıt ve son giriş bilgilerini tek merkezden inceleyin.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button type="button" onClick={() => { setNotice(''); setCreateOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-black text-background"><Plus size={18} /> Kullanıcı Ekle</button><div className="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-primary"><UsersRound size={21} /><div><p className="text-[10px] font-black uppercase tracking-wider">Bulunan kullanıcı</p><p className="text-xl font-black">{pagination.total}</p></div></div></div>
        </div>
      </header>

      <section className="rounded-[28px] border border-outline/10 bg-surface p-4 md:p-6">
        <div className="grid gap-3 lg:grid-cols-[1fr_200px_180px]">
          <label className="relative"><span className="sr-only">Kullanıcı ara</span><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="İsim, kullanıcı adı veya e-posta ara..." className="w-full rounded-2xl border border-outline/10 bg-background/55 py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-outline focus:border-primary/60" /></label>
          <label className="relative"><span className="sr-only">Duruma göre filtrele</span><Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} /><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="w-full appearance-none rounded-2xl border border-outline/10 bg-background/55 py-3.5 pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-primary/60"><option value="">Tüm silinmemiş hesaplar</option><option value="active">Aktif</option><option value="pending">Beklemede</option><option value="passive">Pasif</option><option value="suspended">Askıda</option><option value="deleted">Silinmiş</option></select></label>
          <label><span className="sr-only">Role göre filtrele</span><select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="w-full rounded-2xl border border-outline/10 bg-background/55 px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-primary/60"><option value="">Tüm roller</option><option value="user">Kullanıcı</option><option value="admin">Admin</option></select></label>
        </div>
      </section>

      {notice && <div role="status" className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-bold text-secondary">{notice}</div>}
      {error && <div role="alert" className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}
      <section className="overflow-hidden rounded-[28px] border border-outline/10 bg-surface">
        {loading ? <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="animate-spin text-primary" size={28} /></div> : users.length === 0 ? <div className="p-12 text-center"><UsersRound className="mx-auto text-on-surface-variant" size={38} /><h2 className="mt-4 font-headline text-xl font-bold text-white">Kullanıcı bulunamadı</h2><p className="mt-2 text-sm text-on-surface-variant">Arama veya filtreleri değiştirerek tekrar deneyin.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-background/55 text-[10px] font-black uppercase tracking-wider text-on-surface-variant"><tr><th className="px-5 py-4">Kullanıcı</th><th className="px-5 py-4">E-posta</th><th className="px-5 py-4">Rol</th><th className="px-5 py-4">Durum</th><th className="px-5 py-4">Kayıt tarihi</th><th className="px-5 py-4">Son giriş</th></tr></thead><tbody className="divide-y divide-outline/10">{users.map((user) => <tr key={user.id} tabIndex={0} role="link" onClick={() => navigate(`/admin/users/${user.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(`/admin/users/${user.id}`); }} className="cursor-pointer bg-surface transition hover:bg-surface-high focus:bg-surface-high focus:outline-none"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-highest ring-1 ring-outline/10"><UserAvatar user={user} /></span><span className="min-w-0"><span className="block max-w-52 truncate text-sm font-black text-white">{user.displayName ?? user.username}</span><span className="mt-0.5 block text-xs text-on-surface-variant">@{user.username}</span></span></div></td><td className="px-5 py-4 text-sm text-on-surface-variant">{user.email}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase ${user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant'}`}>{user.role === 'admin' && <ShieldCheck size={13} />}{user.role === 'admin' ? 'Admin' : 'Kullanıcı'}</span></td><td className="px-5 py-4"><span className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase ${statusStyles[user.status]}`}>{statusLabels[user.status]}</span></td><td className="px-5 py-4 text-xs text-on-surface-variant">{formatDate(user.createdAt)}</td><td className="px-5 py-4 text-xs text-on-surface-variant">{formatDate(user.lastLoginAt)}</td></tr>)}</tbody></table></div>}
        {pagination.totalPages > 1 && <footer className="flex items-center justify-between border-t border-outline/10 px-5 py-4"><p className="text-xs text-on-surface-variant">Sayfa {pagination.page} / {pagination.totalPages}</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl bg-surface-high p-2.5 text-white disabled:opacity-30" aria-label="Önceki sayfa"><ChevronLeft size={17} /></button><button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-surface-high p-2.5 text-white disabled:opacity-30" aria-label="Sonraki sayfa"><ChevronRight size={17} /></button></div></footer>}
      </section>
      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} onCreated={created} />}
    </div>
  );
}
