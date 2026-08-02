import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, UserCircle2, Menu, X, ShieldCheck, Award, LogOut, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { logout, MockAuthUser } from '../services/authService';
import { useAuth } from '../auth/AuthContext';
import { UserAvatar } from './UserAvatar';

const MOCK_WALLET = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

function shortenWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-3)}`;
}

export default function Navbar() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const { user: authUser, status: authStatus, error: authError } = useAuth();

  const navLinks = [
    { name: 'Anasayfa', path: '/' },
    { name: 'Airdrop Manager', path: '/token-airdrop-manager' },
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
  }, [location.pathname]);

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
            {(authStatus === 'initializing' || authStatus === 'refreshing') && !authUser ? (
              <div className="h-10 w-32 animate-pulse rounded-full bg-surface-high" aria-label="Kullanıcı yükleniyor" />
            ) : authStatus === 'error' && !authUser ? (
              <span title={authError || undefined} className="rounded-full border border-error/20 bg-error/10 px-3 py-2 text-[10px] font-bold text-error">Oturum servisi erişilemiyor</span>
            ) : !authUser ? (
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
                  <span className="hidden max-w-36 truncate sm:inline">{authUser.isWalletConnected && authUser.walletAddress ? shortenWallet(authUser.walletAddress) : authUser.fullName || authUser.username || authUser.email.split('@')[0]}</span>
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-background/20">
                    <UserAvatar avatarUrl={authUser.avatar} displayName={authUser.fullName} username={authUser.username} email={authUser.email} className="h-full w-full text-[10px]" />
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
                  <UserAvatar avatarUrl={authUser.avatar} displayName={authUser.fullName} username={authUser.username} email={authUser.email} className="h-full w-full text-[10px]" />
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
  const roleLinks = [
    { id: 'creator', label: 'Creator Dashboard', to: '/creator/dashboard', applyTo: '/creator/apply' },
    { id: 'author', label: 'Author Dashboard', to: '/author/dashboard', applyTo: '/identity' },
    { id: 'project_owner', label: 'Project Dashboard', to: '/project/dashboard', applyTo: '/identity' },
    { id: 'developer', label: 'Developer Dashboard', to: '/developer/dashboard', applyTo: '/identity' }
  ];

  return (
    <div className="absolute right-0 top-12 z-[80] max-h-[calc(100vh-5rem)] w-[min(92vw,350px)] overflow-y-auto overscroll-contain rounded-2xl border border-outline/10 bg-surface p-3 shadow-2xl shadow-black/40">
      <div className="mb-2 rounded-xl bg-surface-high p-3">
        <div className="flex items-center gap-2">
          <UserAvatar avatarUrl={authUser.avatar} displayName={authUser.fullName} username={authUser.username} email={authUser.email} className="h-9 w-9 rounded-xl text-xs" />
          <div className="min-w-0">
            <p className="truncate font-headline text-sm font-extrabold text-white">{authUser.fullName}</p>
            <p className="truncate text-[10px] text-on-surface-variant">@{authUser.username} / {authUser.email}</p>
            {authUser.isWalletConnected && authUser.walletAddress ? (
              <p className="mt-1 text-xs text-secondary">{shortenWallet(authUser.walletAddress)}</p>
            ) : (
              <Link to="/connect-wallet" className="mt-1 inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">Cüzdan Bağla</Link>
            )}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-surface p-2">
            <p className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">Trust</p>
            <p className="text-[10px] font-bold leading-5 text-on-surface-variant">Henüz oluşmadı</p>
          </div>
          <div className="rounded-lg bg-surface p-2">
            <p className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant">Reputation</p>
            <p className="text-[10px] font-bold leading-5 text-on-surface-variant">Henüz oluşmadı</p>
          </div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {authUser.roles.length ? authUser.roles.map((role) => (
          <span key={role} className="rounded-md bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">{role}</span>
        )) : <span className="rounded-md bg-surface-high px-2 py-1 text-[9px] font-bold text-on-surface-variant">Standart Kullanıcı</span>}
      </div>

      <div className="mb-2 grid gap-1">
        {[
          ['Hesap Profili', authUser.profileCompleted ? 'Tamamlandı' : 'Eksik'],
          ['Cüzdan ve Web3', authUser.isWalletConnected ? 'Tamamlandı' : 'Bağlanmadı'],
          ['Profesyonel Profil', authUser.capabilities.some((item) => item.status === 'APPROVED') ? 'Tamamlandı' : authUser.capabilities.some((item) => item.status === 'PENDING') ? 'İnceleniyor' : 'Eksik']
        ].map(([label, status]) => (
          <div key={label} className="flex items-center justify-between rounded-lg bg-surface-high/50 px-2 py-1 text-[10px]">
            <span className="font-bold text-on-surface">{label}</span>
            <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold', status === 'Tamamlandı' ? 'bg-secondary/10 text-secondary' : status === 'İnceleniyor' ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant')}>{status}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {authUser.backendRole === 'ADMIN' && <MenuLink to="/admin" label="Admin Paneli" icon={ShieldCheck} />}
        <MenuLink to="/profile" label="Profilim" icon={UserCircle2} />
        <UpcomingMenuItem label="My Assets" icon={Award} />
        <UpcomingMenuItem label="Identity Center" icon={ShieldCheck} />
        {roleLinks.map((item) => <UpcomingMenuItem key={item.id} label={item.label} />)}
        <UpcomingMenuItem label="Security" icon={ShieldCheck} />
        <UpcomingMenuItem label="Settings" icon={Settings} />
        <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-error hover:bg-error/10">
          <LogOut size={14} /> Çıkış Yap
        </button>
      </div>
    </div>
  );
}

function UpcomingMenuItem({ label, icon: Icon }: { label: string; icon?: React.ComponentType<{ size?: number }> }) {
  return <button type="button" disabled title="Bu özellik hazırlanıyor" className="flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs font-bold text-on-surface-variant opacity-65"><span className="flex items-center gap-2">{Icon && <Icon size={14} />}{label}</span><span className="rounded-md bg-surface-highest px-1.5 py-0.5 text-[9px]">Yakında</span></button>;
}

function MenuLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-high hover:text-white">
      <Icon size={14} />
      {label}
    </Link>
  );
}
