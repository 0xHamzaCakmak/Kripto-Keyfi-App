import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, UserCircle2, Menu, X, ShieldCheck, Award, LogOut, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { getCurrentUser } from '../services/userService';
import { getAuthState, logout, MockAuthUser } from '../services/authService';

const MOCK_WALLET = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

function shortenWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-3)}`;
}

export default function Navbar() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [authUser, setAuthUser] = useState<MockAuthUser | null>(() => getAuthState());
  const user = getCurrentUser();

  const navLinks = [
    { name: 'Anasayfa', path: '/' },
    { name: 'Ekosistem', path: '/ecosystem' },
    { name: 'Keyfi Oyunlar', path: '/games' },
    { name: 'Sohbet', path: '/chat' },
    { name: 'Haberler', path: '/blog' },
    { name: 'Videolar', path: '/videos' },
    { name: 'Akademik', path: '/academy' },
  ];

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsAccountOpen(false);
    setAuthUser(getAuthState());
  }, [location.pathname]);

  useEffect(() => {
    function syncAuth() {
      setAuthUser(getAuthState());
    }
    window.addEventListener('kripto-keyfi-auth-change', syncAuth);
    return () => window.removeEventListener('kripto-keyfi-auth-change', syncAuth);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  function isActivePath(path: string) {
    return path === '/ecosystem'
      ? location.pathname.startsWith('/ecosystem')
      : path === '/games'
        ? location.pathname.startsWith('/games')
      : path === '/blog'
        ? location.pathname.startsWith('/blog') || location.pathname.startsWith('/insights')
      : location.pathname === path;
  }

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-outline/10">
        <div className="flex items-center justify-between px-4 py-4 w-full max-w-[1600px] mx-auto md:px-8">
          <div className="flex items-center gap-4 md:gap-12">
            <button
              type="button"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="md:hidden w-10 h-10 rounded-2xl border border-outline/10 bg-surface-high text-on-surface inline-flex items-center justify-center hover:bg-surface-highest transition-colors"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="hidden md:flex items-center gap-8 font-headline font-medium text-sm tracking-tight">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={cn(
                    "transition-colors hover:text-white",
                    isActivePath(link.path)
                      ? "text-primary border-b-2 border-primary pb-1"
                      : "text-on-surface-variant"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="relative group hidden lg:block">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-outline">
                <Search size={16} />
              </div>
              <input
                className="bg-surface-highest border-none rounded-full py-2 pl-10 pr-4 text-sm w-64 focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-outline/60 text-on-surface"
                placeholder="Search assets..."
                type="text"
              />
            </div>
            {!authUser ? (
              <div className="flex items-center gap-2">
                <Link to="/login" className="hidden rounded-full bg-surface-high px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-highest sm:inline-flex">Giriş Yap</Link>
                <Link to="/register" className="hero-gradient rounded-full px-4 py-2 text-sm font-bold text-background">Ücretsiz Katıl</Link>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAccountOpen((open) => !open)}
                  className="hero-gradient text-background font-bold text-sm px-3 py-2 rounded-full hover:shadow-[0_0_20px_rgba(141,172,255,0.4)] transition-all active:scale-95 duration-200 inline-flex items-center gap-2 md:px-4 md:gap-3"
                >
                  <span className="hidden sm:inline">{authUser.isWalletConnected && authUser.walletAddress ? shortenWallet(authUser.walletAddress) : authUser.username}</span>
                  <span className="w-8 h-8 rounded-full bg-background/20 flex items-center justify-center border border-white/20 overflow-hidden">
                    <img src={authUser.avatar || user.avatar} alt={authUser.username} className="h-full w-full object-cover" />
                  </span>
                </button>
                {isAccountOpen && <AccountCenterMenu authUser={authUser} />}
              </div>
            )}
            <button type="button" className="text-primary hover:opacity-80 transition-opacity md:hidden">
              <Bell size={20} />
            </button>
          </div>
        </div>
      </nav>

      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 transition-all duration-300",
          isMobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!isMobileMenuOpen}
      >
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setIsMobileMenuOpen(false)}
          className={cn(
            "absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-300",
            isMobileMenuOpen ? "opacity-100" : "opacity-0"
          )}
        />

        <aside
          className={cn(
            "absolute left-2 top-2 bottom-2 w-[min(88vw,360px)] overflow-y-auto rounded-[32px] border border-yellow-400/70 bg-surface px-5 pt-24 pb-8 shadow-2xl shadow-yellow-500/10 transition-transform duration-300",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-6 rounded-[28px] border border-yellow-400/30 bg-surface-high p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface-variant">{authUser ? 'Account' : 'Guest'}</p>
            {authUser ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-headline text-lg font-extrabold text-white">{authUser.username}</p>
                  <p className="text-sm text-on-surface-variant">{authUser.isWalletConnected && authUser.walletAddress ? shortenWallet(authUser.walletAddress) : 'Cüzdan bağlı değil'}</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-background/40 text-primary">
                  <img src={authUser.avatar} alt={authUser.username} className="h-full w-full object-cover" />
                </span>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link to="/login" className="rounded-xl bg-surface px-3 py-3 text-center text-sm font-bold text-primary">Giriş Yap</Link>
                <Link to="/register" className="rounded-xl bg-primary px-3 py-3 text-center text-sm font-bold text-background">Ücretsiz Katıl</Link>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-4 font-headline text-base font-semibold transition-all",
                  isActivePath(link.path)
                    ? "bg-primary/12 text-primary border border-primary/20"
                    : "bg-surface-high text-on-surface-variant hover:bg-surface-highest hover:text-white border border-transparent"
                )}
              >
                <span>{link.name}</span>
                <span className="text-xs uppercase tracking-[0.2em] opacity-60">
                  {isActivePath(link.path) ? 'Live' : 'Go'}
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

function AccountCenterMenu({ authUser }: { authUser: MockAuthUser }) {
  const user = getCurrentUser();
  const roleLinks = [
    { id: 'creator', label: 'Creator Dashboard', to: '/creator/dashboard', applyTo: '/creator/apply' },
    { id: 'author', label: 'Author Dashboard', to: '/author/dashboard', applyTo: '/identity' },
    { id: 'project_owner', label: 'Project Dashboard', to: '/project/dashboard', applyTo: '/identity' },
    { id: 'developer', label: 'Developer Dashboard', to: '/developer/dashboard', applyTo: '/identity' }
  ];

  return (
    <div className="absolute right-0 top-14 z-[80] w-[min(92vw,380px)] rounded-[28px] border border-outline/10 bg-surface p-4 shadow-2xl shadow-black/40">
      <div className="mb-4 rounded-2xl bg-surface-high p-4">
        <div className="flex items-center gap-3">
          <img src={authUser.avatar || user.avatar} alt={authUser.username} className="h-12 w-12 rounded-2xl bg-background" />
          <div className="min-w-0">
            <p className="truncate font-headline text-lg font-extrabold text-white">{authUser.fullName}</p>
            <p className="text-xs text-on-surface-variant">@{authUser.username} / {authUser.email}</p>
            {authUser.isWalletConnected && authUser.walletAddress ? (
              <p className="mt-1 text-xs text-secondary">{shortenWallet(authUser.walletAddress)}</p>
            ) : (
              <Link to="/connect-wallet" className="mt-2 inline-flex rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">Cüzdan Bağla</Link>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Trust</p>
            <p className="font-headline text-xl font-black text-secondary">{authUser.trustScore}</p>
          </div>
          <div className="rounded-xl bg-surface p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Reputation</p>
            <p className="font-headline text-xl font-black text-primary">{authUser.reputationScore}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {user.roles.filter((role) => role.status === 'verified').map((role) => (
          <span key={role.id} className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{role.label}</span>
        ))}
      </div>

      <div className="mb-4 grid gap-2">
        {[
          ['Hesap Kimliği', authUser.isEmailVerified || authUser.isGoogleConnected ? 'Tamamlandı' : 'Eksik'],
          ['Web3 Kimliği', authUser.isWalletConnected ? 'Tamamlandı' : 'Eksik'],
          ['Profesyonel Kimlik', authUser.pendingRoles.length ? 'Onay bekleniyor' : 'Eksik']
        ].map(([label, status]) => (
          <div key={label} className="flex items-center justify-between rounded-xl bg-surface-high/50 px-3 py-2 text-xs">
            <span className="font-bold text-on-surface">{label}</span>
            <span className={cn('rounded-lg px-2 py-1 font-bold', status === 'Tamamlandı' ? 'bg-secondary/10 text-secondary' : status === 'Onay bekleniyor' ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant')}>{status}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <MenuLink to={`/u/${user.username}`} label="Public Profile'a git" icon={UserCircle2} />
        <MenuLink to="/assets" label="My Assets" icon={Award} />
        <MenuLink to="/identity" label="Identity Center" icon={ShieldCheck} />
        {roleLinks.map((item) => {
          const role = user.roles.find((current) => current.id === item.id);
          const verified = role?.status === 'verified';
          const pending = role?.status === 'pending' || role?.status === 'verification_pending' || role?.status === 'admin_review';
          return (
            <Link key={item.id} to={verified ? item.to : item.applyTo} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-high hover:text-white">
              <span>{item.label}</span>
              <span className={cn('rounded-lg px-2 py-1 text-[10px]', verified ? 'bg-secondary/10 text-secondary' : pending ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant')}>
                {verified ? 'Verified' : pending ? 'Onay bekleniyor' : 'Başvur'}
              </span>
            </Link>
          );
        })}
        <MenuLink to="/settings/security" label="Security" icon={ShieldCheck} />
        <MenuLink to="/settings/wallets" label="Settings" icon={Settings} />
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-error hover:bg-error/10">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}

function MenuLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-high hover:text-white">
      <Icon size={16} />
      {label}
    </Link>
  );
}
