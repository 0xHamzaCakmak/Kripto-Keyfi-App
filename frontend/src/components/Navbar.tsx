import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, UserCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

const MOCK_WALLET = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

function shortenWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-3)}`;
}

export default function Navbar() {
  const location = useLocation();

  const navLinks = [
    { name: 'Market', path: '/' },
    { name: 'Ecosystem', path: '/ecosystem' },
    { name: 'Chat', path: '/chat' },
    { name: 'Blog', path: '/insights' },
    { name: 'Videos', path: '/videos' },
    { name: 'Academy', path: '/academy' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-outline/10">
      <div className="flex items-center justify-between px-8 py-4 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center gap-12">
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
                  (link.path === '/ecosystem' ? location.pathname.startsWith('/ecosystem') : location.pathname === link.path)
                    ? "text-primary border-b-2 border-primary pb-1"
                    : "text-on-surface-variant"
                )}
              >
                {link.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
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
            className="hero-gradient text-background font-bold text-sm px-4 py-2 rounded-full hover:shadow-[0_0_20px_rgba(141,172,255,0.4)] transition-all active:scale-95 duration-200 inline-flex items-center gap-3"
          >
            <span>{shortenWallet(MOCK_WALLET)}</span>
            <span className="w-8 h-8 rounded-full bg-background/20 flex items-center justify-center border border-white/20">
              <UserCircle2 size={18} />
            </span>
          </Link>
          <button className="text-primary hover:opacity-80 transition-opacity md:hidden">
            <Bell size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
