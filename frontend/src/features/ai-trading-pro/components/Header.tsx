import React, { useState } from 'react';
import {
  Zap,
  Settings,
  Bell,
  ChevronDown,
  TrendingUp,
  Activity,
  Sliders,
  Check,
} from 'lucide-react';

interface HeaderProps {
  decisionsPerMin?: number;
  openPositionsCount?: number;
  totalBalance?: number;
  marginUsed?: number;
  pnl24h?: number;
  pnl24hPercent?: number;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  decisionsPerMin = 49,
  openPositionsCount = 15,
  totalBalance = 10532.82,
  marginUsed = 1248.56,
  pnl24h = 256.34,
  pnl24hPercent = 2.49,
  onOpenSettings,
}) => {
  const [tradingMode, setTradingMode] = useState<'Otomatik' | 'Yarı-Otomatik' | 'Manuel'>('Otomatik');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(true);

  return (
    <header className="w-full bg-[#0b0e11]/90 border-b border-[#2b3139] sticky top-0 z-40 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand / Logo & Mode Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d2ff] to-[#02c076] flex items-center justify-center font-black text-[#0b0e11] shadow-[0_0_15px_rgba(0,210,255,0.4)]">
              Σ
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#eaecef] font-['Inter','Plus_Jakarta_Sans',sans-serif]">
              NEURAL<span className="text-[#00d2ff] font-extrabold">TRADE</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#02c076]/10 border border-[#02c076]/20 text-[11px] font-semibold text-[#02c076]">
            <span className="w-2 h-2 rounded-full bg-[#02c076] shadow-[0_0_8px_#02c076] animate-pulse" />
            <span>SYSTEM LIVE: {decisionsPerMin} ACTIONS/MIN</span>
          </div>
        </div>

        {/* Quick Stats Metric Bar */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs font-['JetBrains_Mono',monospace]">
          {/* Dakikadaki Karar */}
          <div className="flex items-center gap-2.5">
            <div>
              <span className="text-[10px] text-[#848e9c] block font-['Inter','Plus_Jakarta_Sans',sans-serif]">
                Karar Oranı
              </span>
              <div className="flex items-center gap-1 font-bold text-[#eaecef]">
                <span>{decisionsPerMin}</span>
                <span className="text-[10px] text-[#02c076]">/dk</span>
              </div>
            </div>
            {/* Mini Sparkline */}
            <div className="w-12 h-5 flex items-end">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 50 20">
                <path
                  d="M0,15 Q12,12 25,6 T40,8 T50,2"
                  fill="none"
                  stroke="#02c076"
                  strokeWidth="1.8"
                />
              </svg>
            </div>
          </div>

          {/* Açık Pozisyon */}
          <div className="border-l border-[#2b3139] pl-4 xl:pl-6">
            <span className="text-[10px] text-[#848e9c] block font-['Inter','Plus_Jakarta_Sans',sans-serif]">
              Açık Pozisyon
            </span>
            <span className="font-bold text-[#eaecef] text-sm">{openPositionsCount}</span>
          </div>

          {/* Kullanılan Marjin */}
          <div className="border-l border-[#2b3139] pl-4 xl:pl-6">
            <span className="text-[10px] text-[#848e9c] block font-['Inter','Plus_Jakarta_Sans',sans-serif]">
              Kullanılan Marjin
            </span>
            <span className="font-bold text-[#eaecef]">
              {marginUsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              <span className="text-[10px] text-[#848e9c]">USDT</span>
            </span>
          </div>

          {/* Toplam Bakiye */}
          <div className="border-l border-[#2b3139] pl-4 xl:pl-6">
            <span className="text-[10px] text-[#848e9c] block font-['Inter','Plus_Jakarta_Sans',sans-serif]">
              Toplam Bakiye
            </span>
            <span className="font-bold text-[#eaecef]">
              {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
              <span className="text-[10px] text-[#848e9c]">USDT</span>
            </span>
          </div>

          {/* 24s PNL */}
          <div className="border-l border-[#2b3139] pl-4 xl:pl-6">
            <span className="text-[10px] text-[#848e9c] block font-['Inter','Plus_Jakarta_Sans',sans-serif]">
              24s PNL
            </span>
            <span className="font-bold text-[#02c076]">
              +{pnl24h.toFixed(2)} USDT <span className="text-[10px]">(+{pnl24hPercent}%)</span>
            </span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Mode Dropdown */}
          <div className="relative">
            <button
              id="trading-mode-btn"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#02c076]/10 hover:bg-[#02c076]/20 border border-[#02c076]/30 text-[#02c076] text-xs font-semibold transition-all shadow-[0_0_10px_rgba(2,192,118,0.15)]"
            >
              <span className="w-2 h-2 rounded-full bg-[#02c076] animate-pulse" />
              <span>{tradingMode}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {isDropdownOpen && (
              <div
                id="trading-mode-menu"
                className="absolute right-0 mt-1.5 w-44 bg-[#1e2329] border border-[#2b3139] rounded-xl shadow-2xl py-1.5 z-50 text-xs"
              >
                {(['Otomatik', 'Yarı-Otomatik', 'Manuel'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setTradingMode(mode);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#2b3139] text-[#eaecef]"
                  >
                    <span>{mode}</span>
                    {tradingMode === mode && <Check className="w-3.5 h-3.5 text-[#02c076]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings Button */}
          <button
            id="header-settings-btn"
            onClick={onOpenSettings}
            title="Ayarlar"
            className="p-2 rounded-lg bg-[#1e2329] hover:bg-[#2b3139] border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Notification Button */}
          <button
            id="header-notifications-btn"
            title="Bildirimler"
            onClick={() => setHasNotifications(false)}
            className="relative p-2 rounded-lg bg-[#1e2329] hover:bg-[#2b3139] border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {hasNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00d2ff] animate-ping" />
            )}
          </button>

          {/* User Avatar */}
          <div
            id="user-avatar-badge"
            className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f0b90b] to-amber-500 text-[#0b0e11] font-bold text-xs flex items-center justify-center shadow-md select-none cursor-pointer"
          >
            NT
          </div>
        </div>
      </div>
    </header>
  );
};
