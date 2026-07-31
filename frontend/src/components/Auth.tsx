import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, Chrome, Mail, ShieldCheck, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';
import { getAuthState, loginWithEmail, loginWithGoogleMock, loginWithWalletMock, registerWithEmail } from '../services/authService';
import { completeOnboarding } from '../services/onboardingService';
import { connectWalletMock, WalletProvider } from '../services/walletService';
import { getApiErrorMessage } from '../services/apiClient';

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-180px)] gap-6 lg:grid-cols-[1fr_520px] lg:items-center">
      <section className="relative overflow-hidden rounded-[32px] border border-outline/5 bg-surface p-8 md:p-10">
        <img src="https://picsum.photos/seed/auth-kripto-keyfi/1200/900" alt="Kripto Keyfi" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/30" />
        <div className="relative max-w-2xl space-y-6">
          <span className="inline-flex rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Kripto Keyfi</span>
          <h1 className="font-headline text-4xl font-extrabold text-white md:text-6xl">{title}</h1>
          <p className="text-lg leading-8 text-on-surface-variant">{description}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {['Private key istemeyiz', 'Cüzdan sonra bağlanabilir', 'Backend auth hazır yapı'].map((item) => (
              <div key={item} className="rounded-2xl bg-surface-high/70 p-4 text-sm font-bold text-on-surface"><ShieldCheck className="mb-3 text-secondary" size={18} />{item}</div>
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">{children}</section>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-sm font-bold text-error">{message}</div>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  async function submit(kind: 'email' | 'google' | 'wallet') {
    setError('');
    setLoading(kind);
    try {
      const user = kind === 'email'
        ? await loginWithEmail(email, password)
        : kind === 'google' ? loginWithGoogleMock() : loginWithWalletMock();
      navigate(user.backendRole === 'ADMIN' ? '/admin' : '/onboarding');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Giriş yapılamadı.'));
    } finally {
      setLoading('');
    }
  }

  return (
    <AuthShell title="Kripto Keyfi'ne Giriş Yap" description="Haberleri takip et, akademi içeriklerini kaydet, videoları izle ve Web3 kimliğini oluştur.">
      <div className="space-y-5">
        <button onClick={() => void submit('google')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest"><Chrome size={18} /> {loading === 'google' ? 'Giriş yapılıyor...' : 'Google ile devam et'}</button>
        <div className="grid gap-4">
          <Input label="E-posta" value={email} onChange={setEmail} />
          <Input label="Şifre" value={password} onChange={setPassword} type="password" />
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex items-center gap-2 text-on-surface-variant"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Beni hatırla</label>
          <Link to="/forgot-password" className="font-bold text-primary">Şifremi unuttum</Link>
        </div>
        {error && <ErrorBox message={error} />}
        <button onClick={() => void submit('email')} disabled={Boolean(loading)} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background disabled:opacity-60">{loading === 'email' ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
        <button onClick={() => void submit('wallet')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline/10 bg-surface-high/40 px-4 py-3 text-sm font-bold text-on-surface-variant hover:text-white"><Wallet size={18} /> {loading === 'wallet' ? 'Cüzdan hazırlanıyor...' : 'Cüzdan ile devam et'}</button>
        <p className="text-center text-sm text-on-surface-variant">Hesabın yok mu? <Link to="/register" className="font-bold text-primary">Ücretsiz katıl.</Link></p>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '', confirmPassword: '', terms: false, privacy: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function submit() {
    setError('');
    if (!form.terms || !form.privacy) {
      setError('Kullanım şartları ve gizlilik metni kabul edilmeli.');
      return;
    }
    setLoading(true);
    window.setTimeout(() => {
      try {
        registerWithEmail(form);
        navigate('/onboarding');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kayıt oluşturulamadı.');
      } finally {
        setLoading(false);
      }
    }, 500);
  }

  return (
    <AuthShell title="Ücretsiz Kripto Keyfi hesabı oluştur" description="Kripto, Web3, akademi, video ve topluluk içeriklerini kişiselleştirilmiş şekilde takip et.">
      <div className="space-y-5">
        <button onClick={() => { loginWithGoogleMock(); navigate('/onboarding'); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest"><Chrome size={18} /> Google ile devam et</button>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Ad soyad" value={form.fullName} onChange={(v) => setForm((c) => ({ ...c, fullName: v }))} />
          <Input label="Kullanıcı adı" value={form.username} onChange={(v) => setForm((c) => ({ ...c, username: v }))} />
          <Input label="E-posta" value={form.email} onChange={(v) => setForm((c) => ({ ...c, email: v }))} />
          <Input label="Şifre" value={form.password} onChange={(v) => setForm((c) => ({ ...c, password: v }))} type="password" />
          <Input label="Şifre tekrar" value={form.confirmPassword} onChange={(v) => setForm((c) => ({ ...c, confirmPassword: v }))} type="password" />
        </div>
        <label className="flex gap-3 rounded-2xl bg-surface-high/40 p-4 text-sm text-on-surface-variant"><input type="checkbox" checked={form.terms} onChange={(e) => setForm((c) => ({ ...c, terms: e.target.checked }))} /> Kullanım şartlarını kabul ediyorum.</label>
        <label className="flex gap-3 rounded-2xl bg-surface-high/40 p-4 text-sm text-on-surface-variant"><input type="checkbox" checked={form.privacy} onChange={(e) => setForm((c) => ({ ...c, privacy: e.target.checked }))} /> KVKK / gizlilik metnini kabul ediyorum.</label>
        {error && <ErrorBox message={error} />}
        <button onClick={submit} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background">{loading ? 'Kayıt oluşturuluyor...' : 'Ücretsiz Katıl'}</button>
        <button onClick={() => { loginWithWalletMock(); navigate('/onboarding'); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline/10 bg-surface-high/40 px-4 py-3 text-sm font-bold text-on-surface-variant"><Wallet size={18} /> Cüzdan ile kayıt ol</button>
        <p className="text-sm text-on-surface-variant">Cüzdan bağlamak zorunlu değildir. İstersen daha sonra profilinden bağlayabilirsin.</p>
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <AuthShell title="Şifreni sıfırla" description="E-posta adresini gir, mock sıfırlama bağlantısını gönderelim.">
      <div className="space-y-5">
        <Input label="E-posta adresi" value={email} onChange={setEmail} />
        <button onClick={() => setSent(true)} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background">Sıfırlama bağlantısı gönder</button>
        {sent && <div className="rounded-2xl bg-secondary/10 p-4 text-sm font-bold text-secondary">Şifre sıfırlama bağlantısı e-posta adresine gönderildi.</div>}
      </div>
    </AuthShell>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const options = ['Kripto haberlerini takip etmek istiyorum', 'Akademi içerikleriyle öğrenmek istiyorum', 'Video içerikleri izlemek istiyorum', 'Topluluğa katılmak istiyorum', 'Portföyümü takip etmek istiyorum', 'İçerik üreticisi olmak istiyorum', 'Akademi yazarı olmak istiyorum', 'Projemi tanıtmak istiyorum', 'Developer araçlarını kullanmak istiyorum'];

  function toggle(option: string) {
    setSelected((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  if (!getAuthState()) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8 text-center">
        <h1 className="font-headline text-4xl font-extrabold text-white">Kripto Keyfi'ni nasıl kullanmak istiyorsun?</h1>
        <p className="mt-3 text-on-surface-variant">Deneyimini sana göre kişiselleştirelim.</p>
      </section>
      {!done ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">{options.map((option) => <button key={option} onClick={() => toggle(option)} className={cn('rounded-2xl border p-5 text-left text-sm font-bold', selected.includes(option) ? 'border-primary/30 bg-primary/10 text-primary' : 'border-outline/5 bg-surface text-on-surface hover:bg-surface-high')}>{option}</button>)}</div>
          <button onClick={() => { completeOnboarding(selected); setDone(true); }} className="w-full rounded-xl bg-primary px-5 py-4 text-sm font-bold text-background">Deneyimimi Oluştur</button>
        </>
      ) : (
        <section className="rounded-[32px] border border-outline/5 bg-surface p-6">
          <h2 className="font-headline text-2xl font-bold text-white">Önerilen aksiyonlar</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ['Haberleri keşfet', '/blog'],
              ['Akademiye git', '/academy'],
              ['Video Merkezi’ne git', '/videos'],
              ['Cüzdanını bağla', '/connect-wallet'],
              ['Creator başvurusu yap', '/creator/apply'],
              ['Public profilini tamamla', '/identity']
            ].map(([label, to]) => <Link key={to} to={to} className="rounded-2xl bg-surface-high p-4 text-sm font-bold text-primary hover:bg-surface-highest">{label}</Link>)}
          </div>
          <button onClick={() => navigate('/')} className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Ana sayfaya dön</button>
        </section>
      )}
    </div>
  );
}

export function ConnectWalletPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const providers: WalletProvider[] = ['MetaMask', 'WalletConnect', 'Coinbase Wallet', 'Rabby Wallet', 'Trust Wallet'];
  if (!getAuthState()) return <Navigate to="/login" replace />;

  function connect(provider: WalletProvider) {
    setStatus('Bağlanıyor...');
    window.setTimeout(() => setStatus('İmza isteği mock olarak hazırlandı...'), 500);
    connectWalletMock(provider).then(() => setStatus(`${provider} başarıyla bağlandı.`));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <h1 className="font-headline text-4xl font-extrabold text-white">Cüzdanını Bağla</h1>
        <p className="mt-3 text-on-surface-variant">Portföyünü takip etmek, wallet intelligence kullanmak ve Web3 kimliğini güçlendirmek için cüzdanını bağlayabilirsin.</p>
        <p className="mt-5 rounded-2xl bg-secondary/10 p-4 text-sm font-bold text-secondary">Kripto Keyfi senden private key veya seed phrase istemez. Cüzdan bağlama işlemi sadece adresini doğrulamak içindir.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">{providers.map((provider) => <button key={provider} onClick={() => connect(provider)} className="flex items-center justify-between rounded-2xl border border-outline/5 bg-surface p-5 text-left hover:bg-surface-high"><span className="font-bold text-white">{provider}</span><Wallet className="text-primary" size={20} /></button>)}</div>
      {status && <div className="rounded-2xl bg-primary/10 p-4 text-sm font-bold text-primary">{status}</div>}
      <button onClick={() => navigate('/')} className="rounded-xl bg-surface-high px-5 py-3 text-sm font-bold text-on-surface">Şimdilik geç</button>
    </div>
  );
}

export function LoginRequiredPage({ feature = 'bu sayfa' }: { feature?: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-[32px] border border-outline/5 bg-surface p-8 text-center">
      <Mail className="mx-auto mb-5 text-primary" size={40} />
      <h1 className="font-headline text-3xl font-extrabold text-white">Giriş yapmalısın</h1>
      <p className="mt-3 text-on-surface-variant">{feature} için ücretsiz Kripto Keyfi hesabınla giriş yapabilirsin. Cüzdan bağlamak zorunlu değildir.</p>
      <div className="mt-6 flex justify-center gap-3"><Link to="/login" className="rounded-xl bg-surface-high px-5 py-3 text-sm font-bold text-primary">Giriş Yap</Link><Link to="/register" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Ücretsiz Katıl</Link></div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="space-y-2"><span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface placeholder:text-outline/70" /></label>;
}
