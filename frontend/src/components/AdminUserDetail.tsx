import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, LoaderCircle, Pencil, RotateCcw, Save, ShieldAlert, Trash2, UserRound, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getApiErrorMessage } from '../services/apiClient';
import { deleteAdminUser, getAdminUser, getAdminUserProfileSections, resetAdminUserPassword, restoreAdminUser, updateAdminUser, type AdminUserListItem, type AdminUserProfileSection } from '../services/adminUserService';
import AdminUserProfileSections from './AdminUserProfileSections';

const statusLabels: Record<AdminUserListItem['status'], string> = {
  active: 'Aktif', pending: 'Beklemede', passive: 'Pasif', suspended: 'Askıda', deleted: 'Silinmiş',
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Henüz yok';
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}><button type="button" aria-label="Pencereyi kapat" onClick={onClose} className="absolute inset-0 bg-background/85 backdrop-blur-sm" /><section className="relative z-10 w-full max-w-lg rounded-[28px] border border-outline/15 bg-surface p-6 shadow-2xl"><div className="flex items-center justify-between gap-4"><h2 className="font-headline text-xl font-black text-white">{title}</h2><button type="button" onClick={onClose} className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-high hover:text-white" aria-label="Kapat"><X size={18} /></button></div>{children}</section></div>;
}

function PasswordModal({ userId, onClose, onDone }: { userId: string; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await resetAdminUserPassword(userId, password); onDone(); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Şifre sıfırlanamadı.')); }
    finally { setBusy(false); }
  }
  return <ModalShell title="Kullanıcı şifresini sıfırla" onClose={onClose}><form onSubmit={submit} className="mt-5 space-y-4">{error && <div role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm font-bold text-error">{error}</div>}<p className="text-sm leading-6 text-on-surface-variant">Tüm açık oturumlar kapatılır ve kullanıcıdan ilk girişinde şifresini değiştirmesi istenir.</p><label className="text-xs font-bold text-on-surface-variant">Yeni geçici şifre<span className="relative mt-2 block"><input required minLength={8} maxLength={128} autoComplete="new-password" type={visible ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-outline/10 bg-background/60 py-3 pl-4 pr-11 text-sm text-white outline-none focus:border-primary/60" /><button type="button" onClick={() => setVisible((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-on-surface-variant" aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-background disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />} Şifreyi sıfırla</button></form></ModalShell>;
}

export default function AdminUserDetail() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const { user: admin } = useAuth();
  const [user, setUser] = useState<AdminUserListItem | null>(null);
  const [form, setForm] = useState({ displayName: '', username: '', email: '', role: 'user' as AdminUserListItem['role'], status: 'active' as Exclude<AdminUserListItem['status'], 'deleted'>, notes: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sections, setSections] = useState<AdminUserProfileSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionsError, setSectionsError] = useState('');

  function applyUser(next: AdminUserListItem) {
    setUser(next);
    setForm({ displayName: next.displayName ?? '', username: next.username, email: next.email, role: next.role, status: next.status === 'deleted' ? 'active' : next.status, notes: next.notes ?? '' });
  }

  useEffect(() => {
    let active = true; setLoading(true); setError('');
    getAdminUser(userId).then((value) => { if (active) applyUser(value); }).catch((reason) => { if (active) setError(getApiErrorMessage(reason, 'Kullanıcı yüklenemedi.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let active = true; setSectionsLoading(true); setSectionsError('');
    getAdminUserProfileSections(userId)
      .then((value) => { if (active) setSections(value); })
      .catch((reason) => { if (active) setSectionsError(getApiErrorMessage(reason, 'Profil bölümleri yüklenemedi.')); })
      .finally(() => { if (active) setSectionsLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function run(action: () => Promise<AdminUserListItem | void>, successMessage: string) {
    setBusy(true); setError(''); setNotice('');
    try { const updated = await action(); if (updated) applyUser(updated); setNotice(successMessage); return true; }
    catch (reason) { setError(getApiErrorMessage(reason, 'İşlem tamamlanamadı.')); return false; }
    finally { setBusy(false); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() => updateAdminUser(userId, { displayName: form.displayName, username: form.username, email: form.email, role: form.role, status: form.status, notes: form.notes || null }), 'Kullanıcı bilgileri güncellendi.');
    if (saved) setEditing(false);
  }

  if (loading) return <div className="flex min-h-72 items-center justify-center"><LoaderCircle className="animate-spin text-primary" size={30} /></div>;
  if (!user) return <div className="rounded-[28px] border border-error/20 bg-error/10 p-8"><p className="font-bold text-error">{error || 'Kullanıcı bulunamadı.'}</p><Link to="/admin/users" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-primary"><ArrowLeft size={16} /> Listeye dön</Link></div>;
  const isSelf = admin?.id === user.id;
  const inputClass = 'mt-2 w-full rounded-xl border border-outline/10 bg-background/60 px-4 py-3 text-sm text-white outline-none disabled:opacity-60 focus:border-primary/60';

  return <div className="space-y-6">
    <header className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8"><Link to="/admin/users" className="inline-flex items-center gap-2 text-xs font-black text-on-surface-variant hover:text-primary"><ArrowLeft size={15} /> Kullanıcı listesi</Link><div className="mt-5 flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-surface-highest ring-1 ring-outline/10">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="text-primary" size={28} />}</span><div><h1 className="font-headline text-3xl font-black text-white">{user.displayName ?? user.username}</h1><p className="mt-1 text-sm text-on-surface-variant">@{user.username} · {user.email}</p></div></div><span className={`w-fit rounded-xl px-3 py-2 text-xs font-black uppercase ${user.status === 'active' ? 'bg-secondary/10 text-secondary' : user.status === 'deleted' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{statusLabels[user.status]}</span></div></header>
    {notice && <div role="status" className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-bold text-secondary">{notice}</div>}
    {error && <div role="alert" className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form onSubmit={save} className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Temel bilgiler</p><h2 className="mt-1 font-headline text-xl font-black text-white">Hesap bilgileri</h2></div>{!editing && user.status !== 'deleted' && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-4 py-2.5 text-sm font-black text-white"><Pencil size={16} /> Düzenle</button>}</div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-on-surface-variant">Görünen ad<input required disabled={!editing} minLength={2} maxLength={120} value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className={inputClass} /></label><label className="text-xs font-bold text-on-surface-variant">Kullanıcı adı<input required disabled={!editing} minLength={3} maxLength={30} value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className={inputClass} /></label><label className="text-xs font-bold text-on-surface-variant">E-posta<input required disabled={!editing} type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={inputClass} /></label><label className="text-xs font-bold text-on-surface-variant">Rol<select disabled={!editing || isSelf} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminUserListItem['role'] }))} className={inputClass}><option value="user">Kullanıcı</option><option value="admin">Admin</option></select></label><label className="text-xs font-bold text-on-surface-variant">Durum<select disabled={!editing || isSelf} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Exclude<AdminUserListItem['status'], 'deleted'> }))} className={inputClass}><option value="active">Aktif</option><option value="pending">Beklemede</option><option value="passive">Pasif</option><option value="suspended">Askıda</option></select></label><label className="text-xs font-bold text-on-surface-variant md:col-span-2">Admin notu<textarea disabled={!editing} maxLength={5000} rows={5} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Yalnızca adminlerin görebileceği iç not" className={inputClass} /></label></div>{editing && <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => { applyUser(user); setEditing(false); }} className="rounded-xl bg-surface-high px-5 py-3 text-sm font-black text-white">Vazgeç</button><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-background disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} Kaydet</button></div>}</form>
      <aside className="space-y-6"><section className="rounded-[28px] border border-outline/10 bg-surface p-6"><h2 className="font-headline text-lg font-black text-white">Hesap özeti</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs text-on-surface-variant">Kayıt tarihi</dt><dd className="mt-1 font-bold text-white">{formatDate(user.createdAt)}</dd></div><div><dt className="text-xs text-on-surface-variant">Son giriş</dt><dd className="mt-1 font-bold text-white">{formatDate(user.lastLoginAt)}</dd></div><div><dt className="text-xs text-on-surface-variant">Şifre durumu</dt><dd className="mt-1 font-bold text-white">{user.mustChangePassword ? 'Değişiklik bekleniyor' : 'Güncel'}</dd></div></dl></section><section className="rounded-[28px] border border-outline/10 bg-surface p-6"><h2 className="font-headline text-lg font-black text-white">Hesap işlemleri</h2><div className="mt-5 space-y-3"><button disabled={busy || user.status === 'deleted'} onClick={() => setPasswordOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-black text-white disabled:opacity-40"><KeyRound size={16} /> Şifreyi sıfırla</button>{user.status === 'deleted' ? <button disabled={busy} onClick={() => void run(() => restoreAdminUser(userId), 'Kullanıcı geri yüklendi.')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-black text-background disabled:opacity-50"><RotateCcw size={16} /> Geri yükle</button> : <><button disabled={busy || isSelf} onClick={() => void run(() => updateAdminUser(userId, { status: user.status === 'suspended' ? 'active' : 'suspended' }), user.status === 'suspended' ? 'Kullanıcı aktif edildi.' : 'Kullanıcı askıya alındı.')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-black text-primary disabled:opacity-40"><ShieldAlert size={16} /> {user.status === 'suspended' ? 'Aktif et' : 'Askıya al'}</button><button disabled={busy || isSelf} onClick={() => setDeleteOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-error/10 px-4 py-3 text-sm font-black text-error disabled:opacity-40"><Trash2 size={16} /> Kullanıcıyı sil</button></>}</div>{isSelf && <p className="mt-4 text-xs leading-5 text-on-surface-variant">Güvenlik nedeniyle kendi hesabınızın rolünü, durumunu veya silinme durumunu değiştiremezsiniz.</p>}</section></aside>
    </div>
    <section><div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">Bağlı modüller</p><h2 className="mt-1 font-headline text-2xl font-black text-white">Kullanıcı profil bölümleri</h2><p className="mt-2 text-sm text-on-surface-variant">Domain modüllerinin bu kullanıcıya ait kayıtları otomatik olarak burada görünür.</p></div>{sectionsError && <div role="alert" className="mb-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm font-bold text-error">{sectionsError}</div>}<AdminUserProfileSections sections={sections} loading={sectionsLoading} /></section>
    {passwordOpen && <PasswordModal userId={userId} onClose={() => setPasswordOpen(false)} onDone={() => { setPasswordOpen(false); setNotice('Şifre sıfırlandı; açık oturumlar kapatıldı.'); applyUser({ ...user, mustChangePassword: true }); }} />}
    {deleteOpen && <ModalShell title="Kullanıcıyı sil" onClose={() => setDeleteOpen(false)}><div className="mt-5 space-y-5"><p className="text-sm leading-6 text-on-surface-variant"><strong className="text-white">{user.displayName ?? user.username}</strong> hesabı silinmiş durumuna alınacak ve açık oturumları kapatılacak. Bağlı veriler korunur.</p><div className="flex gap-3"><button onClick={() => setDeleteOpen(false)} className="flex-1 rounded-xl bg-surface-high px-4 py-3 text-sm font-black text-white">Vazgeç</button><button disabled={busy} onClick={() => void run(async () => { await deleteAdminUser(userId); setDeleteOpen(false); navigate('/admin/users'); }, 'Kullanıcı silindi.')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-error px-4 py-3 text-sm font-black text-white disabled:opacity-50"><Trash2 size={16} /> Sil</button></div></div></ModalShell>}
  </div>;
}
