import React from 'react';
import { MainTabType, AiTradingSubTabType } from '../types';
import {
  Sparkles,
  LayoutGrid,
  Bot,
  Layers,
  BookOpen,
  SlidersHorizontal,
  Building2,
  Clock,
  Grid,
  DollarSign,
  ShieldAlert,
  Server,
  Trophy,
  Database,
  BarChart3,
  Activity,
  Play,
  Pause,
  Zap,
  RotateCcw,
  Search,
  Settings,
  Bell,
  CheckCircle2,
  Flame,
} from 'lucide-react';

interface ManagementNavigationProps {
  activeMainTab: MainTabType;
  onSelectMainTab: (tab: MainTabType) => void;
  activeAiSubTab: AiTradingSubTabType;
  onSelectAiSubTab: (tab: AiTradingSubTabType) => void;
  isBotsRunning: boolean;
  onToggleBotsRunning: () => void;
  onTriggerSignal: () => void;
  onOpenSettings: () => void;
  openPositionsCount: number;
}

export const ManagementNavigation: React.FC<ManagementNavigationProps> = ({
  activeMainTab,
  onSelectMainTab,
  activeAiSubTab,
  onSelectAiSubTab,
  isBotsRunning,
  onToggleBotsRunning,
  onTriggerSignal,
  onOpenSettings,
  openPositionsCount,
}) => {
  const mainTabs = [
    { id: 'ai-trading' as MainTabType, label: 'AI Trading', icon: Sparkles, badge: 'PRO' },
    { id: 'positions' as MainTabType, label: 'Pozisyonlar', icon: Layers, badge: `${openPositionsCount}` },
    { id: 'my-bots' as MainTabType, label: 'Botlarım', icon: Bot },
    { id: 'bot-guide' as MainTabType, label: 'Bot Rehberi', icon: BookOpen },
    { id: 'manual-trade' as MainTabType, label: 'Manuel İşlem', icon: SlidersHorizontal, badge: 'CANLI' },
    { id: 'exchange-accounts' as MainTabType, label: 'Borsa Hesapları', icon: Building2 },
    { id: 'orders' as MainTabType, label: 'Emirler', icon: Clock },
    { id: 'grid-bot' as MainTabType, label: 'Grid Bot', icon: Grid },
    { id: 'pnl' as MainTabType, label: 'Kâr / Zarar', icon: DollarSign },
    { id: 'risk' as MainTabType, label: 'Risk', icon: ShieldAlert },
    { id: 'system' as MainTabType, label: 'Sistem', icon: Server },
  ];

  const aiSubTabs = [
    { id: 'overview' as AiTradingSubTabType, label: 'Genel Bakış (Sinyal Akışı)', icon: LayoutGrid },
    { id: 'arena' as AiTradingSubTabType, label: 'Arena (20 Bot)', icon: Bot, badge: '20' },
    { id: 'champions' as AiTradingSubTabType, label: 'Champions', icon: Trophy },
    { id: 'memory' as AiTradingSubTabType, label: 'Memory', icon: Database },
    { id: 'performance' as AiTradingSubTabType, label: 'Performance', icon: BarChart3 },
    { id: 'risk' as AiTradingSubTabType, label: 'Risk', icon: ShieldAlert },
    { id: 'live-prep' as AiTradingSubTabType, label: 'Live hazırlık', icon: Activity },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Top Global Bar */}
      <div className="w-full bg-[#0b0e11]/95 border-b border-[#2b3139] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f0b90b] to-amber-500 flex items-center justify-center font-black text-[#0b0e11] shadow-[0_0_12px_rgba(240,185,11,0.4)]">
              K
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#f0b90b] uppercase block">
                KRİPTOKEYFİ
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-[#eaecef] tracking-tight leading-none">
                Yönetim Merkezi
              </h2>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#2b3139]">
            <span className="w-2 h-2 rounded-full bg-[#02c076] animate-pulse" />
            <span className="text-[11px] font-semibold text-[#02c076] font-['JetBrains_Mono',monospace]">
              {isBotsRunning ? 'BOTLAR AKTİF (20 MOTOR)' : 'BOTLAR BEKLEMEDE'}
            </span>
          </div>
        </div>

        {/* Global Action Hub */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Quick Signal Generator */}
          <button
            onClick={onTriggerSignal}
            title="Anlık Test Sinyali ve Lazer Akışı Üret"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00d2ff]/10 hover:bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/30 text-xs font-bold transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sinyal Tetikle</span>
          </button>

          {/* Master Bot Start / Stop Toggle */}
          <button
            onClick={onToggleBotsRunning}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
              isBotsRunning
                ? 'bg-[#f84960]/20 hover:bg-[#f84960]/30 text-[#f84960] border border-[#f84960]/40'
                : 'bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] shadow-[0_0_12px_rgba(2,192,118,0.4)]'
            }`}
          >
            {isBotsRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isBotsRunning ? 'Botları Durdur' : 'Botları Başlat'}</span>
          </button>

          {/* Settings / API Guide Modal */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-[#1e2329] hover:bg-[#2b3139] border border-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition-colors"
            title="Entegrasyon ve API Ayarları"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Admin User Profile Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#2b3139]">
            <div className="hidden lg:block text-right">
              <span className="text-xs font-bold text-[#eaecef] block leading-tight">
                KriptoKeyfi Admin
              </span>
              <span className="text-[9px] font-bold text-[#02c076] uppercase">ADMİN OTURUMU</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-[#f0b90b] text-[#0b0e11] font-black text-xs flex items-center justify-center shadow">
              KA
            </div>
          </div>
        </div>
      </div>

      {/* Main Module Card (Exact match of Screenshot 2 & 3) */}
      <div className="w-full bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl px-4 pt-1 pb-1 sm:px-5 shadow-xl space-y-4">
        {/* Module Header & Subtext */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-black tracking-widest text-[#f0b90b] uppercase block font-['Inter',sans-serif]">
              YÖNETİM MODÜLÜ
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#eaecef] tracking-tight">
              Trading Bot
            </h1>
          </div>
          <p className="text-xs text-[#848e9c] sm:text-right">
            Botlar, hesaplar, işlemler ve risk kontrolleri tek çalışma alanında.
          </p>
        </div>

        {/* Primary Main Tab Bar (Horizontal Scrollable) */}
        <div className="overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max bg-[#0b0e11] p-1.5 rounded-xl border border-[#2b3139]">
            {mainTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeMainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`main-tab-${tab.id}`}
                  onClick={() => onSelectMainTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#f0b90b] text-[#0b0e11] shadow-[0_0_15px_rgba(240,185,11,0.35)]'
                      : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#1e2329]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                        isActive
                          ? 'bg-[#0b0e11] text-[#f0b90b]'
                          : 'bg-[#1e2329] text-[#02c076] border border-[#2b3139]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-Tab Bar (Displayed when AI Trading is active, as in screenshot 2 & 3) */}
        {activeMainTab === 'ai-trading' && (
          <div className="pt-2 border-t border-[#2b3139]/80 overflow-x-auto pb-1">
            <div className="flex items-center gap-2 min-w-max">
              {aiSubTabs.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = activeAiSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    id={`ai-subtab-${sub.id}`}
                    onClick={() => onSelectAiSubTab(sub.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isSubActive
                        ? 'bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/40 shadow-[0_0_10px_rgba(240,185,11,0.15)]'
                        : 'text-[#848e9c] hover:text-[#eaecef] bg-[#0b0e11]/60 border border-transparent hover:border-[#2b3139]'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                    {sub.badge && (
                      <span className="text-[9px] px-1 bg-[#f0b90b]/20 text-[#f0b90b] rounded font-black">
                        {sub.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
