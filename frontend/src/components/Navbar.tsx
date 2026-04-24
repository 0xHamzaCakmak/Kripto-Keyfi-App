import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, UserCircle2, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

const MOCK_WALLET = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

function shortenWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-3)}`;
}

export default function Navbar() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Market', path: '/' },
    { name: 'Ecosystem', path: '/ecosystem' },
    { name: 'Chat', path: '/chat' },
    { name: 'Blog', path: '/insights' },
    { name: 'Videos', path: '/videos' },
    { name: 'Academy', path: '/academy' },
  ];

  useEffect(() => {
    setIsMobileMenuOpen(false);
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
            <Link to="/" className="text-xl font-black tracking-tighter text-white font-headline uppercase">
              Kripto Keyfi
            </Link>
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
            <Link
              to="/profile"
              className="hero-gradient text-background font-bold text-sm px-3 py-2 rounded-full hover:shadow-[0_0_20px_rgba(141,172,255,0.4)] transition-all active:scale-95 duration-200 inline-flex items-center gap-2 md:px-4 md:gap-3"
            >
              <span className="hidden sm:inline">{shortenWallet(MOCK_WALLET)}</span>
              <span className="w-8 h-8 rounded-full bg-background/20 flex items-center justify-center border border-white/20">
                <UserCircle2 size={18} />
              </span>
            </Link>
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
            "absolute left-0 top-0 h-full w-[min(88vw,360px)] border-r border-outline/10 bg-surface px-5 pt-24 pb-8 shadow-2xl transition-transform duration-300",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-6 rounded-[28px] border border-outline/10 bg-surface-high p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface-variant">Wallet</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-headline text-lg font-extrabold text-white">Kripto Keyfi</p>
                <p className="text-sm text-on-surface-variant">{shortenWallet(MOCK_WALLET)}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-background/40 text-primary">
                <UserCircle2 size={20} />
              </span>
            </div>
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
