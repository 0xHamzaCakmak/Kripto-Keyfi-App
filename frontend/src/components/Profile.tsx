import React, { useState } from 'react';
import {
  User,
  Mail,
  Shield,
  Wallet,
  Award,
  Settings,
  LogOut,
  ChevronRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  History,
  Lock,
  Bell,
  Eye,
  EyeOff
} from 'lucide-react';
import type { UserProfile } from '../types';
import { cn } from '../lib/utils';

const MOCK_USER: UserProfile = {
  name: 'Hamza Cakmak',
  email: '0xhamzacakmak@gmail.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hamza',
  tier: 'Diamond Elite',
  walletAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  trustScore: 98,
  isVerified: true
};

export default function Profile() {
  const [showWallet, setShowWallet] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(MOCK_USER.walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <section className="glass-panel rounded-[32px] p-8 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-tertiary/10 blur-[100px] -ml-32 -mb-32" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-[28px] bg-gradient-to-br from-primary to-tertiary p-1">
              <img
                src={MOCK_USER.avatar}
                alt={MOCK_USER.name}
                className="w-full h-full rounded-[24px] bg-background object-cover"
              />
            </div>
            {MOCK_USER.isVerified && (
              <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-secondary text-background flex items-center justify-center border-4 border-background shadow-lg">
                <CheckCircle2 size={17} />
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
              <h2 className="text-4xl font-headline font-black tracking-tight text-white">{MOCK_USER.name}</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest w-fit mx-auto md:mx-0">
                <Award size={12} />
                {MOCK_USER.tier}
              </span>
            </div>
            <p className="text-on-surface-variant flex items-center justify-center md:justify-start gap-2">
              <Mail size={16} className="text-outline" />
              {MOCK_USER.email}
            </p>
            <div className="flex items-center justify-center md:justify-start gap-6 pt-4">
              <div className="text-center md:text-left">
                <p className="text-[10px] text-outline uppercase tracking-widest font-bold">Trust Score</p>
                <p className="text-3xl font-headline font-black text-secondary">{MOCK_USER.trustScore}%</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center md:text-left">
                <p className="text-[10px] text-outline uppercase tracking-widest font-bold">Member Since</p>
                <p className="text-3xl font-headline font-black text-white">OCT 2023</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto">
            <button className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              <Settings size={18} />
              Edit Profile
            </button>
            <button className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-error/10 hover:text-error hover:border-error/30 transition-all flex items-center justify-center gap-2">
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
        <div className="space-y-8">
          <section className="bg-surface rounded-[32px] p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                <Wallet size={20} className="text-primary" />
                Connected Wallet
              </h3>
              <button className="text-xs text-primary font-bold hover:underline">Manage Wallets</button>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-tertiary/20 flex items-center justify-center border border-white/10 shrink-0">
                  <User size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">Main Wallet (Metamask)</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-mono text-on-surface-variant truncate">
                      {showWallet ? MOCK_USER.walletAddress : `${MOCK_USER.walletAddress.slice(0, 6)}...${MOCK_USER.walletAddress.slice(-4)}`}
                    </p>
                    <button
                      onClick={() => setShowWallet(!showWallet)}
                      className="text-outline hover:text-on-surface transition-colors shrink-0"
                    >
                      {showWallet ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg hover:bg-white/10 text-on-surface-variant transition-all"
                >
                  {copied ? <CheckCircle2 size={18} className="text-secondary" /> : <Copy size={18} />}
                </button>
                <a
                  href={`https://etherscan.io/address/${MOCK_USER.walletAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg hover:bg-white/10 text-on-surface-variant transition-all"
                >
                  <ExternalLink size={18} />
                </a>
              </div>
            </div>
          </section>

          <section className="bg-surface rounded-[32px] p-6 border border-white/10 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-white">
              <Shield size={20} className="text-secondary" />
              Security & Verification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">KYC Verified</p>
                  <p className="text-[10px] text-on-surface-variant">Level 3 Access Enabled</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Lock size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">2FA Active</p>
                  <p className="text-[10px] text-on-surface-variant">Authenticator App Linked</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer border border-transparent hover:border-white/10">
                <div className="flex items-center gap-3">
                  <History size={18} className="text-outline" />
                  <span className="text-sm font-medium text-white">Login History</span>
                </div>
                <ChevronRight size={18} className="text-outline group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer border border-transparent hover:border-white/10">
                <div className="flex items-center gap-3">
                  <Bell size={18} className="text-outline" />
                  <span className="text-sm font-medium text-white">Notification Settings</span>
                </div>
                <ChevronRight size={18} className="text-outline group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-surface rounded-[32px] p-6 border border-white/10 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-white">
              <Award size={20} className="text-tertiary" />
              Achievements
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group relative">
                  <div
                    className={cn(
                      'w-11 h-11 rounded-full flex items-center justify-center transition-all group-hover:scale-110',
                      i <= 4 ? 'bg-tertiary/20 text-tertiary' : 'bg-surface-high text-outline grayscale'
                    )}
                  >
                    <Award size={24} />
                  </div>
                  {i > 4 && (
                    <div className="absolute top-2 right-2">
                      <Lock size={10} className="text-outline" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all">
              View All Badges
            </button>
          </section>

          <section className="bg-surface rounded-[32px] p-6 border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-error">
              <AlertCircle size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Account Risk</h3>
            </div>
            <div className="space-y-2">
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-secondary w-[5%]" />
              </div>
              <p className="text-[10px] text-outline text-right font-bold">VERY LOW RISK</p>
            </div>
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              Your account security is optimal. No suspicious activity detected in the last 30 days.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
