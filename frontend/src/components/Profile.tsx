import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Copy,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  Lock,
  Mail,
  MessageSquare,
  PlayCircle,
  Rocket,
  Settings,
  Shield,
  Twitter,
  User,
  Wallet,
  Youtube
} from 'lucide-react';
import { PlatformRole } from '../types';
import { cn } from '../lib/utils';
import { getCurrentUser, getPublicProfile, getRoleStatus } from '../services/userService';
import { applyForCreator, checkCreatorVerification, getCreatorApplicationStatus, getCreatorDashboard } from '../services/creatorService';
import { getAuthState } from '../services/authService';

function shorten(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-[24px] border border-outline/5 bg-surface p-10 text-center"><p className="font-headline text-xl font-bold text-white">{title}</p><p className="mt-2 text-sm text-on-surface-variant">{description}</p></div>;
}

export default function IdentityCenter() {
  const user = getCurrentUser();
  const auth = getAuthState();

  return (
    <div className="space-y-8">
      <ProfileHeaderCard />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-[32px] border border-outline/5 bg-surface p-6">
            <h2 className="font-headline text-2xl font-extrabold text-white">Identity Center</h2>
            <p className="mt-2 text-on-surface-variant">Kripto Keyfi üzerindeki kimliğini, rollerini, itibarını ve güvenlik ayarlarını yönet.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Info label="Public username" value={`@${user.username}`} />
              <Info label="Email" value={user.email} />
              <Info label="Wallet" value={shorten(user.walletAddress)} />
              <Info label="Member Since" value={user.memberSince} />
              <Info label="Public Profile URL" value={`/u/${user.username}`} />
              <Info label="Bio" value={user.bio} />
            </div>
          </section>

          <section className="rounded-[32px] border border-outline/5 bg-surface p-6">
            <h2 className="mb-5 font-headline text-2xl font-extrabold text-white">Kimlik Katmanları</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <IdentityLayer title="Hesap Kimliği" items={['E-posta', 'Google', 'Kullanıcı adı', 'Profil bilgileri']} status={auth?.isEmailVerified || auth?.isGoogleConnected ? 'Tamamlandı' : 'Eksik'} />
              <IdentityLayer title="Web3 Kimliği" items={['Cüzdan', 'Wallet signature', 'Network bilgileri']} status={auth?.isWalletConnected ? 'Tamamlandı' : 'Eksik'} cta="/connect-wallet" />
              <IdentityLayer title="Profesyonel Kimlik" items={['Creator', 'Author', 'Project Owner', 'Developer']} status={auth?.pendingRoles.length ? 'Onay bekleniyor' : 'Eksik'} cta="/creator/apply" />
            </div>
          </section>

          <section className="rounded-[32px] border border-outline/5 bg-surface p-6">
            <h2 className="mb-5 font-headline text-2xl font-extrabold text-white">Roles & Permissions</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {user.roles.map((role) => <RoleStatusCard key={role.id} role={role} />)}
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            <AuthorRolePreview />
            <ProjectOwnerRolePreview />
            <DeveloperRolePreview />
          </section>
        </div>
        <aside className="space-y-6">
          <ReputationCard />
          <UserBadges />
          <SecurityCard />
        </aside>
      </div>
    </div>
  );
}

function IdentityLayer({ title, items, status, cta }: { title: string; items: string[]; status: 'Tamamlandı' | 'Eksik' | 'Onay bekleniyor'; cta?: string }) {
  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface-high/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-headline text-lg font-bold text-white">{title}</h3>
        <span className={cn('rounded-lg px-2 py-1 text-[10px] font-bold', status === 'Tamamlandı' ? 'bg-secondary/10 text-secondary' : status === 'Onay bekleniyor' ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant')}>{status}</span>
      </div>
      <div className="mt-4 space-y-2">{items.map((item) => <p key={item} className="text-sm text-on-surface-variant">{item}</p>)}</div>
      {cta && <Link to={cta} className="mt-4 inline-flex rounded-xl bg-surface px-4 py-2 text-xs font-bold text-primary hover:bg-surface-high">Tamamla</Link>}
    </div>
  );
}

function ProfileHeaderCard() {
  const user = getCurrentUser();
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-outline/5 bg-surface">
      <img src={user.coverImage} alt={user.username} className="h-52 w-full object-cover opacity-60" />
      <div className="p-6 md:-mt-16 md:flex md:items-end md:justify-between md:gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <img src={user.avatar} alt={user.fullName} className="h-28 w-28 rounded-[28px] border-4 border-surface bg-background" />
          <div>
            <h1 className="font-headline text-4xl font-black text-white">{user.fullName}</h1>
            <p className="mt-1 text-on-surface-variant">@{user.username}</p>
            <div className="mt-3 flex flex-wrap gap-2">{user.badges.slice(0, 4).map((badge) => <span key={badge} className="rounded-lg bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">{badge}</span>)}</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
          <Link to={`/u/${user.username}`} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background">View Public Profile</Link>
          <button className="rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface">Edit Profile</button>
        </div>
      </div>
    </section>
  );
}

function RoleStatusCard({ role }: { role: PlatformRole }) {
  const routeMap: Record<string, string> = {
    creator: '/creator/dashboard',
    author: '/author/dashboard',
    project_owner: '/project/dashboard',
    developer: '/developer/dashboard'
  };
  const applyMap: Record<string, string> = {
    creator: '/creator/apply',
    author: '/identity',
    project_owner: '/identity',
    developer: '/identity'
  };
  const verified = role.status === 'verified';
  const pending = role.status === 'pending';

  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface-high/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-headline text-lg font-bold text-white">{role.label}</h3>
          <p className="mt-1 text-xs text-on-surface-variant">Status: {role.status}</p>
        </div>
        <span className={cn('rounded-lg px-2 py-1 text-[10px] font-bold uppercase', verified ? 'bg-secondary/10 text-secondary' : pending ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant')}>
          {verified ? 'Verified' : pending ? 'Pending' : 'Not Applied'}
        </span>
      </div>
      {role.submittedAt && <p className="mt-3 text-xs text-on-surface-variant">Submitted: {role.submittedAt}</p>}
      {role.id !== 'user' && (
        <Link to={verified ? routeMap[role.id] || '/identity' : applyMap[role.id] || '/identity'} className="mt-4 inline-flex rounded-xl bg-surface px-4 py-2 text-xs font-bold text-primary hover:bg-surface-high">
          {verified ? 'Dashboarda git' : pending ? 'Onay bekleniyor' : 'Başvuru yap'}
        </Link>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-surface-high/50 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p><p className="mt-1 text-sm font-bold text-white">{value}</p></div>;
}

function ReputationCard() {
  const user = getCurrentUser();
  return <section className="rounded-[24px] border border-outline/5 bg-surface p-6"><h3 className="font-headline text-xl font-bold text-white">Reputation</h3><div className="mt-5 grid grid-cols-2 gap-3"><Info label="Trust Score" value={`${user.trustScore}`} /><Info label="Reputation" value={`${user.reputationScore}`} /></div></section>;
}

function UserBadges() {
  const user = getCurrentUser();
  return <section className="rounded-[24px] border border-outline/5 bg-surface p-6"><h3 className="mb-4 font-headline text-xl font-bold text-white">Badges</h3><div className="grid grid-cols-2 gap-3">{user.badges.map((badge) => <div key={badge} className="rounded-2xl bg-surface-high/50 p-3 text-sm font-bold text-primary"><Award className="mb-2" size={18} />{badge}</div>)}</div></section>;
}

function SecurityCard() {
  return <section className="rounded-[24px] border border-outline/5 bg-surface p-6"><h3 className="mb-4 flex items-center gap-2 font-headline text-xl font-bold text-white"><Shield className="text-secondary" size={20} /> Security</h3><div className="space-y-3"><p className="rounded-2xl bg-secondary/10 p-4 text-sm font-bold text-secondary">KYC Verified</p><p className="rounded-2xl bg-primary/10 p-4 text-sm font-bold text-primary">2FA Active</p><Link to="/settings/security" className="block rounded-2xl bg-surface-high p-4 text-sm font-bold text-on-surface">Security Settings</Link></div></section>;
}

function AuthorRolePreview() {
  return <RolePreview title="Author Preview" stats={['12 makale', '84K okunma', '3 onay bekliyor']} cta="Akademi Yazarı Başvurusu Yap" />;
}
function ProjectOwnerRolePreview() {
  return <RolePreview title="Project Owner" stats={['Projelerim 2', 'Tokenlarım 4', 'Rating 4.6']} cta="Project Owner Başvurusu" />;
}
function DeveloperRolePreview() {
  return <RolePreview title="Developer" stats={['Smart contracts 7', 'Audit reports 3', 'Dev rep 820']} cta="Developer Dashboard" />;
}
function RolePreview({ title, stats, cta }: { title: string; stats: string[]; cta: string }) {
  return <div className="rounded-[24px] border border-outline/5 bg-surface p-5"><h3 className="font-headline text-lg font-bold text-white">{title}</h3><div className="mt-4 space-y-2">{stats.map((stat) => <p key={stat} className="rounded-xl bg-surface-high/50 px-3 py-2 text-sm text-on-surface-variant">{stat}</p>)}</div><button className="mt-4 rounded-xl bg-primary/10 px-4 py-2 text-xs font-bold text-primary">{cta}</button></div>;
}

export function PublicProfile() {
  const { username } = useParams();
  const user = getPublicProfile(username || '');
  if (!user) return <EmptyState title="Public profile bulunamadı" description="Aradığınız kullanıcı mevcut değil." />;
  const social = [
    ['YouTube', user.socialLinks.youtube, Youtube],
    ['X', user.socialLinks.twitter, Twitter],
    ['LinkedIn', user.socialLinks.linkedin, Linkedin],
    ['GitHub', user.socialLinks.github, Github],
    ['Website', user.socialLinks.website, Globe]
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-outline/5 bg-surface">
        <img src={user.coverImage} alt={user.username} className="h-64 w-full object-cover opacity-70" />
        <div className="-mt-14 p-6">
          <img src={user.avatar} alt={user.fullName} className="h-28 w-28 rounded-[28px] border-4 border-surface bg-background" />
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-headline text-4xl font-black text-white">{user.fullName}</h1>
              <p className="text-on-surface-variant">@{user.username} / {user.location}</p>
              <p className="mt-4 max-w-3xl leading-7 text-on-surface-variant">{user.bio}</p>
              <div className="mt-4 flex flex-wrap gap-2">{user.roles.filter((role) => role.status === 'verified').map((role) => <span key={role.id} className="rounded-lg bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">{role.label}</span>)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-72">
              <Info label="Trust" value={`${user.trustScore}`} />
              <Info label="Reputation" value={`${user.reputationScore}`} />
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <PublicContributions />
        </section>
        <aside className="space-y-6">
          <section className="rounded-[24px] border border-outline/5 bg-surface p-6"><h3 className="mb-4 font-headline text-xl font-bold text-white">Social Links</h3><div className="space-y-2">{social.filter(([, url]) => url).map(([label, url, Icon]) => <a key={String(label)} href={String(url)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:text-primary"><Icon size={16} /> {String(label)}</a>)}</div></section>
          <section className="rounded-[24px] border border-outline/5 bg-surface p-6"><h3 className="mb-4 font-headline text-xl font-bold text-white">Wallet</h3><p className="font-mono text-sm text-on-surface-variant">{shorten(user.walletAddress)}</p></section>
        </aside>
      </div>
    </div>
  );
}

function PublicContributions() {
  const items = [
    { title: 'Yayınladığı videolar', value: '18', icon: PlayCircle },
    { title: 'Yazdığı makaleler', value: '12', icon: Mail },
    { title: 'Sahip olduğu projeler', value: '2', icon: Rocket },
    { title: 'Chat reputation', value: '8420', icon: MessageSquare },
    { title: 'Topluluk puanı', value: '4.8', icon: BadgeCheck }
  ];
  return <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div key={item.title} className="rounded-[24px] border border-outline/5 bg-surface p-6"><item.icon className="mb-4 text-primary" size={24} /><p className="font-headline text-3xl font-black text-white">{item.value}</p><p className="mt-1 text-sm text-on-surface-variant">{item.title}</p></div>)}</div>;
}

export function CreatorApplyPage() {
  const user = getCurrentUser();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: user.fullName,
    username: user.username,
    bio: user.bio,
    youtubeUrl: user.socialLinks.youtube || '',
    channelName: 'Kripto Keyfi Hamza',
    categories: ['Kripto', 'Web3', 'Eğitim'],
    socialLinks: Object.values(user.socialLinks).filter(Boolean).join('\n'),
    motivation: '',
    accepted: false
  });

  function submit() {
    if (!form.accepted) return;
    applyForCreator(form);
    setSubmitted(true);
  }

  if (submitted) return <CreatorVerificationPage />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <h1 className="font-headline text-4xl font-extrabold text-white">Kripto Keyfi Creator Network'e Katıl</h1>
        <p className="mt-3 text-on-surface-variant">YouTube kanalını doğrula, videolarını Kripto Keyfi Video Merkezi'nde yayınla ve Web3 topluluğunda kendi içerik kimliğini oluştur.</p>
      </section>
      <section className="grid gap-4 rounded-[32px] border border-outline/5 bg-surface p-6 md:grid-cols-2">
        {[
          ['Ad soyad', 'fullName'],
          ['Public username', 'username'],
          ['YouTube kanal linki', 'youtubeUrl'],
          ['Kanal adı', 'channelName']
        ].map(([label, key]) => <Input key={key} label={label} value={String(form[key as keyof typeof form])} onChange={(value) => setForm((current) => ({ ...current, [key]: value }))} />)}
        <label className="md:col-span-2 space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Bio</span><textarea value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} className="h-24 w-full rounded-2xl border-none bg-surface-high p-4 text-sm text-on-surface" /></label>
        <label className="md:col-span-2 space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Neden Creator olmak istiyorsun?</span><textarea value={form.motivation} onChange={(event) => setForm((current) => ({ ...current, motivation: event.target.value }))} className="h-28 w-full rounded-2xl border-none bg-surface-high p-4 text-sm text-on-surface" /></label>
        <div className="md:col-span-2 flex flex-wrap gap-2">{['Kripto', 'Bitcoin', 'Ethereum', 'DeFi', 'Web3', 'Blockchain', 'Solidity', 'Güvenlik', 'Trading', 'Eğitim'].map((cat) => <button key={cat} type="button" onClick={() => setForm((current) => ({ ...current, categories: current.categories.includes(cat) ? current.categories.filter((item) => item !== cat) : [...current.categories, cat] }))} className={cn('rounded-full px-3 py-2 text-xs font-bold', form.categories.includes(cat) ? 'bg-primary text-background' : 'bg-surface-high text-on-surface-variant')}>{cat}</button>)}</div>
        <label className="md:col-span-2 flex gap-3 rounded-2xl bg-surface-high/50 p-4 text-sm text-on-surface-variant"><input type="checkbox" checked={form.accepted} onChange={(event) => setForm((current) => ({ ...current, accepted: event.target.checked }))} /> Paylaştığım kanalın bana ait olduğunu ve doğrulama sürecini tamamlayacağımı kabul ediyorum.</label>
        <button onClick={submit} className="md:col-span-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Creator Başvurusu Yap</button>
      </section>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface" /></label>;
}

export function CreatorVerificationPage() {
  const [application, setApplication] = useState(getCreatorApplicationStatus());
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <h1 className="font-headline text-4xl font-extrabold text-white">YouTube Kanal Doğrulama</h1>
        <p className="mt-3 text-on-surface-variant">Bu doğrulama kodunu veya profil linkini YouTube kanal açıklamana ya da son videonun açıklama/sabit yorum alanına ekle.</p>
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <VerificationBox label="Verification Code" value={application.verificationCode} />
        <VerificationBox label="Verification Link" value={application.verificationLink} />
      </section>
      <section className="rounded-[24px] border border-outline/5 bg-surface p-6">
        <h2 className="font-headline text-2xl font-bold text-white">Status</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-4">{['Doğrulama bekleniyor', 'Admin onayı bekleniyor', 'Onaylandı', 'Reddedildi'].map((status, index) => <div key={status} className={cn('rounded-2xl p-4 text-sm font-bold', index === 0 || application.status === 'admin_review' && index === 1 ? 'bg-primary/10 text-primary' : 'bg-surface-high text-on-surface-variant')}>{status}</div>)}</div>
        <button onClick={() => setApplication(checkCreatorVerification())} className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Doğrulamayı kontrol et</button>
      </section>
    </div>
  );
}

function VerificationBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[24px] border border-outline/5 bg-surface p-6"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p><p className="mt-3 break-all font-mono text-lg font-bold text-white">{value}</p><button onClick={() => navigator.clipboard?.writeText(value)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-surface-high px-4 py-2 text-sm font-bold text-primary"><Copy size={16} /> Kopyala</button></div>;
}

export function CreatorDashboard() {
  const dashboard = getCreatorDashboard();
  if (!dashboard.hasAccess) return <CreatorGate />;
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8"><h1 className="font-headline text-4xl font-extrabold text-white">Creator Dashboard</h1><p className="mt-3 text-on-surface-variant">YouTube Studio + Web3 identity dashboard.</p></section>
      <div className="grid gap-4 md:grid-cols-4">{Object.entries(dashboard.overview).map(([key, value]) => <Info key={key} label={key} value={String(value)} />)}</div>
      <section className="rounded-[24px] border border-outline/5 bg-surface p-6"><h2 className="mb-5 font-headline text-2xl font-bold text-white">My Channel</h2><div className="flex gap-4"><img src={dashboard.channel.avatar} alt={dashboard.channel.name} className="h-16 w-16 rounded-2xl" /><div><p className="font-bold text-white">{dashboard.channel.name}</p><p className="text-sm text-on-surface-variant">{dashboard.channel.description}</p><p className="mt-2 text-xs text-primary">{dashboard.channel.verificationStatus} / Sync {dashboard.channel.lastSync}</p></div></div><button className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-background">Manuel senkronize et</button></section>
      <section className="rounded-[24px] border border-outline/5 bg-surface p-6"><h2 className="mb-5 font-headline text-2xl font-bold text-white">My Videos</h2><div className="space-y-3">{dashboard.videos.map((video) => <div key={video.id} className="flex flex-col gap-4 rounded-2xl bg-surface-high/50 p-4 md:flex-row md:items-center"><img src={video.thumbnail} alt={video.title} className="h-24 w-36 rounded-xl object-cover" /><div className="flex-1"><p className="font-bold text-white">{video.title}</p><p className="text-xs text-on-surface-variant">{video.publishedAt} / {video.duration} / {video.category}</p></div><span className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{video.status}</span><button className="rounded-xl bg-surface px-3 py-2 text-xs font-bold text-on-surface">Yayından kaldırma talebi</button></div>)}</div></section>
      <section className="grid gap-6 md:grid-cols-3"><RolePreview title="Content Insights" stats={['En çok izlenen: ETF video', 'En çok yorum: DeFi rehberi', 'Son 30 gün +18%']} cta="Detayları aç" /><RolePreview title="Profile & Branding" stats={['Bio hazır', 'Kapak görseli aktif', 'Rozetler seçili']} cta="Düzenle" /><RolePreview title="Settings" stats={['Auto sync açık', 'Shorts gösterilsin', 'Yorumlar açık']} cta="Ayarlar" /></section>
    </div>
  );
}

function CreatorGate() {
  return <div className="mx-auto max-w-3xl rounded-[32px] border border-outline/5 bg-surface p-8 text-center"><Youtube className="mx-auto mb-5 text-primary" size={42} /><h1 className="font-headline text-4xl font-extrabold text-white">Kripto Keyfi Creator Network'e Katıl</h1><p className="mt-4 text-on-surface-variant">YouTube kanalını doğrula, videolarını Kripto Keyfi Video Merkezi'nde yayınla ve Web3 topluluğunda kendi içerik kimliğini oluştur.</p><Link to="/creator/apply" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Creator Başvurusu Yap</Link></div>;
}

export function PlaceholderDashboard({ title }: { title: string }) {
  return <div className="rounded-[32px] border border-outline/5 bg-surface p-10 text-center"><Settings className="mx-auto mb-4 text-primary" size={36} /><h1 className="font-headline text-4xl font-extrabold text-white">{title}</h1><p className="mt-3 text-on-surface-variant">Bu dashboard için temel rota ve erişim altyapısı hazır. Detaylı yönetim paneli sonraki modülde genişletilecek.</p></div>;
}
