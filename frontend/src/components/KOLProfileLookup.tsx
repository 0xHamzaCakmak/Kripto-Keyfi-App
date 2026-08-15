import { useState, type FormEvent } from 'react';
import { BadgeCheck, ExternalLink, LoaderCircle, Search, ShieldCheck, UsersRound } from 'lucide-react';
import type { KOL } from '../services/kolService';
import { workspaceApi, workspaceError, type XProfilePreview } from '../services/kolWorkspaceService';
import { cn } from '../lib/utils';

const categoryOptions = ['Trading', 'Bitcoin', 'Altcoin', 'DeFi', 'NFT', 'Genel Haber', 'Teknik Analiz', 'On-chain', 'Eğitim', 'Mining', 'Meme Coin'];

const formatMetric = (value: number) => new Intl.NumberFormat('tr-TR', { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);

export default function KOLProfileLookup({ onSaved }: { onSaved: (kol: KOL) => void }) {
  const [profileUrl, setProfileUrl] = useState('');
  const [profile, setProfile] = useState<XProfilePreview | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [country, setCountry] = useState('Türkiye');
  const [language, setLanguage] = useState('TR');
  const [busy, setBusy] = useState<'lookup' | 'save' | null>(null);
  const [error, setError] = useState('');

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setBusy('lookup');
    setError('');
    setProfile(null);
    try {
      setProfile(await workspaceApi.adminLookupXProfile(profileUrl));
    } catch (reason) {
      setError(workspaceError(reason, 'X profili bulunamadı.'));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!profile || !categories.length) {
      setError('KOL kaydı için en az bir kategori seçin.');
      return;
    }
    setBusy('save');
    setError('');
    try {
      const kol = await workspaceApi.adminImportXProfile({ profileUrl: profile.profileUrl, categories, country, language });
      onSaved(kol);
      setProfile(null);
      setProfileUrl('');
      setCategories([]);
    } catch (reason) {
      setError(workspaceError(reason, 'KOL kaydedilemedi.'));
    } finally {
      setBusy(null);
    }
  }

  function toggleCategory(category: string) {
    setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-primary/15 bg-surface">
      <div className="border-b border-outline/10 bg-[radial-gradient(circle_at_top_right,rgba(244,189,55,.12),transparent_45%)] p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><UsersRound size={20} /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-primary">X profilinden ekle</p>
            <h2 className="mt-1 font-headline text-xl font-black text-white">Influencer bilgilerini otomatik getir</h2>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">Profil kaydedilmeden önce X API’den gelen bilgileri kontrol edin.</p>
          </div>
        </div>
        <form onSubmit={lookup} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={17} />
            <input required value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} className="input pl-11" placeholder="https://x.com/kullanici" aria-label="X profil bağlantısı" />
          </label>
          <button disabled={busy !== null} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-background disabled:opacity-50">
            {busy === 'lookup' ? <LoaderCircle className="animate-spin" size={17} /> : <Search size={17} />} Kullanıcıyı bul
          </button>
        </form>
      </div>

      {error && <div className="m-5 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

      {profile && <div className="grid gap-5 p-5 md:p-6 xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="flex items-start gap-4">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-xl font-black text-primary">{profile.displayName.slice(0, 2).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-headline text-xl font-black text-white">{profile.displayName}</h3>{profile.verified && <BadgeCheck className="text-[#1d9bf0]" size={18} aria-label="X doğrulaması var" />}</div>
              <a href={profile.profileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary">@{profile.username}<ExternalLink size={13} /></a>
              {profile.location && <p className="mt-1 text-xs text-on-surface-variant">X konumu: {profile.location}</p>}
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-on-surface-variant">{profile.bio || 'Profil açıklaması bulunmuyor.'}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Takipçi', profile.followersCount], ['Takip', profile.followingCount], ['Gönderi', profile.contentCount], ['Liste', profile.listedCount]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-background/50 p-3"><p className="font-headline text-lg font-black text-white">{formatMetric(Number(value))}</p><p className="text-[10px] text-on-surface-variant">{label}</p></div>)}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl bg-background/45 p-4">
          <div><p className="text-xs font-black text-white">Kategori seçin</p><div className="mt-2 flex flex-wrap gap-2">{categoryOptions.map((category) => <button type="button" key={category} onClick={() => toggleCategory(category)} className={cn('rounded-full border px-3 py-1.5 text-[11px] font-bold', categories.includes(category) ? 'border-primary bg-primary text-background' : 'border-outline/15 bg-surface-high text-on-surface-variant')}>{category}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-bold text-on-surface-variant">Ülke<input required value={country} onChange={(event) => setCountry(event.target.value)} className="input mt-1" /></label><label className="text-[10px] font-bold text-on-surface-variant">Dil<input required value={language} onChange={(event) => setLanguage(event.target.value)} className="input mt-1" /></label></div>
          <div className="flex items-start gap-2 rounded-xl border border-secondary/15 bg-secondary/5 p-3 text-[11px] leading-5 text-on-surface-variant"><ShieldCheck className="mt-0.5 shrink-0 text-secondary" size={15} /><span>Bu işlem KriptoKeyfi doğrulama rozeti vermez. Yalnızca profil verisinin X API’den alındığını kaydeder.</span></div>
          <button type="button" onClick={() => void save()} disabled={busy !== null || !categories.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-black text-background disabled:opacity-40">{busy === 'save' ? <LoaderCircle className="animate-spin" size={17} /> : <ShieldCheck size={17} />} KOL olarak kaydet</button>
        </div>
      </div>}
    </section>
  );
}
