import { useEffect, useState } from 'react';
import { CheckCircle2, Save, ShieldCheck, UserCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getApiErrorMessage } from '../services/apiClient';
import { updateMyProfile } from '../services/authService';
import { UserAvatar } from './UserAvatar';
import YoutubeCreatorProfile from './YoutubeCreatorProfile';

export default function UserProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ displayName: '', username: '', bio: '', avatarUrl: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm({ displayName: user.fullName, username: user.username, bio: user.bio, avatarUrl: user.avatar });
  }, [user]);

  if (!user) return null;

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateMyProfile({
        displayName: form.displayName,
        username: form.username,
        bio: form.bio || null,
        avatarUrl: form.avatarUrl || null,
      });
      setMessage('Profil bilgileriniz güncellendi.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Profil güncellenemedi.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar avatarUrl={user.avatar} displayName={user.fullName} username={user.username} email={user.email} className="h-24 w-24 rounded-[26px] text-2xl" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">Hesap Profili</p>
            <h1 className="mt-2 truncate font-headline text-3xl font-black text-white">{user.fullName}</h1>
            <p className="truncate text-sm text-on-surface-variant">@{user.username} · {user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold">
              <span className="rounded-lg bg-surface-high px-2 py-1 text-on-surface-variant">{user.backendRole === 'ADMIN' ? 'Yönetici' : 'Standart Kullanıcı'}</span>
              <span className="rounded-lg bg-secondary/10 px-2 py-1 text-secondary">{user.accountStatus}</span>
              <span className="rounded-lg bg-primary/10 px-2 py-1 text-primary">{user.profileCompleted ? 'Profil tamamlandı' : 'Profil eksik'}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="rounded-[32px] border border-outline/5 bg-surface p-6">
          <div className="mb-6 flex items-center gap-3"><UserCircle2 className="text-primary" size={22} /><div><h2 className="font-headline text-xl font-bold text-white">Profil bilgileri</h2><p className="text-xs text-on-surface-variant">Değişiklikler gerçek hesabınıza kaydedilir.</p></div></div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Görünen ad" value={form.displayName} onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} />
            <Field label="Kullanıcı adı" value={form.username} onChange={(value) => setForm((current) => ({ ...current, username: value }))} hint="3–30 karakter; harf, rakam, nokta ve alt çizgi." />
            <div className="md:col-span-2"><Field label="Avatar URL" value={form.avatarUrl} onChange={(value) => setForm((current) => ({ ...current, avatarUrl: value }))} hint="Dosya yükleme henüz yok; güvenli bir http/https görsel adresi kullanabilirsiniz." /></div>
            <label className="space-y-2 md:col-span-2"><span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Biyografi</span><textarea value={form.bio} maxLength={500} rows={5} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} className="w-full resize-none rounded-2xl border border-outline/5 bg-surface-high px-4 py-3 text-sm text-on-surface" /><span className="block text-right text-[10px] text-on-surface-variant">{form.bio.length}/500</span></label>
          </div>
          {error && <div className="mt-5 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}
          {message && <div className="mt-5 rounded-2xl border border-secondary/20 bg-secondary/10 p-4 text-sm font-bold text-secondary">{message}</div>}
          <button type="button" onClick={() => void save()} disabled={saving} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background disabled:opacity-60"><Save size={16} />{saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</button>
        </section>

        <aside className="space-y-4">
          <StatusCard label="E-posta" complete={user.isEmailVerified} completeText="Doğrulandı" emptyText="Doğrulanmadı" />
          <StatusCard label="Hesap profili" complete={user.profileCompleted} completeText="Tamamlandı" emptyText="Biyografi eksik" />
          <StatusCard label="Cüzdan ve Web3" complete={user.isWalletConnected} completeText="Bağlandı" emptyText="Bağlanmadı" />
          <div className="rounded-2xl border border-outline/5 bg-surface p-4 text-xs text-on-surface-variant"><ShieldCheck className="mb-3 text-primary" size={18} />Rol ve hesap durumu bu form üzerinden değiştirilemez.</div>
        </aside>
      </div>
      <YoutubeCreatorProfile />
    </div>
  );
}

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-outline/5 bg-surface-high px-4 py-3 text-sm text-on-surface" />{hint && <span className="block text-[10px] leading-4 text-on-surface-variant">{hint}</span>}</label>;
}

function StatusCard({ label, complete, completeText, emptyText }: { label: string; complete: boolean; completeText: string; emptyText: string }) {
  return <div className="flex items-center justify-between rounded-2xl border border-outline/5 bg-surface p-4"><div><p className="text-xs font-bold text-white">{label}</p><p className="mt-1 text-[10px] text-on-surface-variant">{complete ? completeText : emptyText}</p></div><CheckCircle2 size={18} className={complete ? 'text-secondary' : 'text-outline'} /></div>;
}
