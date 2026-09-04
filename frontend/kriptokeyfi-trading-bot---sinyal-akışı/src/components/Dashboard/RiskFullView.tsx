import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Zap,
  Info,
  RotateCcw,
  SlidersHorizontal,
  Flame,
  Check,
  TrendingUp,
  Cpu,
  Power,
  KeyRound,
  Coins,
  Scale,
  Gauge,
  Activity,
  Layers,
  Sparkles,
  Server
} from 'lucide-react';
import { RiskProfileConfig } from '../../types';

// Default Risk Configurations per Account
const DEFAULT_CONFIGS: Record<string, RiskProfileConfig> = {
  'binance-test': {
    accountId: 'binance-test',
    accountName: 'Binance Test · BINANCE TESTNET',
    globalKillSwitch: false,
    accountKillSwitch: false,
    botQuotaMargin: 500,
    minTradeMargin: 100,
    maxNotionalPerOrder: 10000,
    maxInitialMarginPerOrder: 500,
    accountMaxOpenNotional: 125000,
    pairMaxOpenNotional: 10000,
    minLeverage: 5,
    maxLeverage: 20,
    maxOpenPositionsFutures: 20,
    maxOpenPositionsPaper: 100,
    maxOpenPositionsPerPair: 1,
    maxOrdersPerMinute: 100,
    maxOrdersPerDay: 100000,
    minProtectedBalance: 100,
    updatedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  },
  'binance-live': {
    accountId: 'binance-live',
    accountName: 'Binance Live · BINANCE LIVE (Kurumsal Vadeli)',
    globalKillSwitch: false,
    accountKillSwitch: false,
    botQuotaMargin: 1000,
    minTradeMargin: 200,
    maxNotionalPerOrder: 25000,
    maxInitialMarginPerOrder: 1000,
    accountMaxOpenNotional: 250000,
    pairMaxOpenNotional: 25000,
    minLeverage: 3,
    maxLeverage: 15,
    maxOpenPositionsFutures: 15,
    maxOpenPositionsPaper: 50,
    maxOpenPositionsPerPair: 2,
    maxOrdersPerMinute: 60,
    maxOrdersPerDay: 50000,
    minProtectedBalance: 500,
    updatedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  },
  'bybit-main': {
    accountId: 'bybit-main',
    accountName: 'Bybit Unified · BYBIT MAINNET',
    globalKillSwitch: false,
    accountKillSwitch: false,
    botQuotaMargin: 750,
    minTradeMargin: 150,
    maxNotionalPerOrder: 15000,
    maxInitialMarginPerOrder: 750,
    accountMaxOpenNotional: 180000,
    pairMaxOpenNotional: 15000,
    minLeverage: 5,
    maxLeverage: 20,
    maxOpenPositionsFutures: 18,
    maxOpenPositionsPaper: 80,
    maxOpenPositionsPerPair: 1,
    maxOrdersPerMinute: 80,
    maxOrdersPerDay: 80000,
    minProtectedBalance: 250,
    updatedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  },
};

const TICKER_DATA = [
  { symbol: 'AVAX/USD', price: '$7.42', change: '+1.25%', isUp: true },
  { symbol: 'XAUT/USD', price: '$4,456', change: '-0.02%', isUp: false },
  { symbol: 'ARB/USD', price: '$0.09', change: '+1.76%', isUp: true },
  { symbol: 'BTC/USD', price: '$78,870', change: '+0.80%', isUp: true },
  { symbol: 'ETH/USD', price: '$2,506', change: '+2.12%', isUp: true },
  { symbol: 'BNB/USD', price: '$699.68', change: '+0.90%', isUp: true },
  { symbol: 'SOL/USD', price: '$184.20', change: '+3.45%', isUp: true },
];

export const RiskFullView: React.FC = () => {
  const [selectedAccount, setSelectedAccount] = useState<string>('binance-test');
  const [config, setConfig] = useState<RiskProfileConfig>(() => {
    const saved = localStorage.getItem('kriptokeyfi_risk_config_binance-test');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_CONFIGS['binance-test'];
      }
    }
    return DEFAULT_CONFIGS['binance-test'];
  });

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);

  // When account changes, load its configuration
  const handleAccountChange = (accountId: string) => {
    setSelectedAccount(accountId);
    const saved = localStorage.getItem(`kriptokeyfi_risk_config_${accountId}`);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
        showToast(`${DEFAULT_CONFIGS[accountId]?.accountName || accountId} risk profili yüklendi`, 'success');
        return;
      } catch (e) {}
    }
    setConfig(DEFAULT_CONFIGS[accountId] || DEFAULT_CONFIGS['binance-test']);
    showToast(`${DEFAULT_CONFIGS[accountId]?.accountName || accountId} varsayılan profili yüklendi`, 'success');
  };

  const showToast = (message: string, type: 'success' | 'warn' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const handleFieldChange = (field: keyof RiskProfileConfig, value: number) => {
    setConfig((prev) => ({
      ...prev,
      [field]: isNaN(value) ? 0 : value,
    }));
  };

  // Preset 1: Sınırsız üst limitleri doldur (Tüm azami sınırları 0 yapar)
  const handleFillUnlimitedLimits = () => {
    setConfig((prev) => ({
      ...prev,
      maxNotionalPerOrder: 0,
      maxInitialMarginPerOrder: 0,
      accountMaxOpenNotional: 0,
      pairMaxOpenNotional: 0,
      maxOpenPositionsFutures: 0,
      maxOpenPositionsPaper: 0,
      maxOpenPositionsPerPair: 0,
      maxOrdersPerMinute: 0,
      maxOrdersPerDay: 0,
    }));
    showToast('Sınırsız profil uygulandı: Tüm azami üst limitler 0 (sınırsız) olarak ayarlandı.', 'warn');
  };

  // Preset 2: Sonlu limitleri otomatik hesapla
  const handleAutoCalculateFiniteLimits = () => {
    const quota = config.botQuotaMargin > 0 ? config.botQuotaMargin : 500;
    const maxLev = config.maxLeverage > 0 ? config.maxLeverage : 20;
    const theoreticalMaxNotional = quota * maxLev;
    const estimatedPositions = config.maxOpenPositionsFutures > 0 ? config.maxOpenPositionsFutures : 20;

    setConfig((prev) => ({
      ...prev,
      botQuotaMargin: quota,
      minTradeMargin: Math.max(50, Math.round(quota * 0.1)),
      maxNotionalPerOrder: theoreticalMaxNotional,
      maxInitialMarginPerOrder: quota,
      accountMaxOpenNotional: theoreticalMaxNotional * (estimatedPositions > 0 ? Math.min(15, estimatedPositions) : 10),
      pairMaxOpenNotional: theoreticalMaxNotional,
      minLeverage: Math.min(prev.minLeverage || 5, maxLev),
      maxLeverage: maxLev,
      maxOpenPositionsFutures: estimatedPositions,
      maxOpenPositionsPaper: 100,
      maxOpenPositionsPerPair: 1,
      maxOrdersPerMinute: 100,
      maxOrdersPerDay: 100000,
      minProtectedBalance: Math.max(100, Math.round(quota * 0.2)),
    }));
    showToast('Sonlu limitler başarıyla hesaplandı: Kota ve kaldıraç bazlı güvenli parametreler yüklendi.', 'success');
  };

  // Reset to default for current account
  const handleResetToDefault = () => {
    const base = DEFAULT_CONFIGS[selectedAccount] || DEFAULT_CONFIGS['binance-test'];
    setConfig({ ...base });
    showToast('Varsayılan parametreler geri yüklendi.', 'warn');
  };

  // Toggle Global Kill Switch
  const handleToggleGlobalKillSwitch = () => {
    const nextState = !config.globalKillSwitch;
    setConfig((prev) => ({ ...prev, globalKillSwitch: nextState }));
    if (nextState) {
      showToast('🚨 GLOBAL KILL SWITCH AKTİF: Tüm bot ve işlem emirleri durduruldu!', 'error');
    } else {
      showToast('✅ Global Kill Switch Devre Dışı: Risk limitleri tekrar geçerli.', 'success');
    }
  };

  // Toggle Account Kill Switch
  const handleToggleAccountKillSwitch = () => {
    const nextState = !config.accountKillSwitch;
    setConfig((prev) => ({ ...prev, accountKillSwitch: nextState }));
    if (nextState) {
      showToast(`🚨 HESAP KİLİTLENDİ (${config.accountName}): Yeni pozisyon girişi engellendi!`, 'error');
    } else {
      showToast(`✅ Hesap Kilidi Kaldırıldı: ${config.accountName} işlemlere açıldı.`, 'success');
    }
  };

  // Save to LocalStorage / Mock Go Engine DB
  const handleSaveLimits = () => {
    setSaveStatus('saving');
    const updatedConfig: RiskProfileConfig = {
      ...config,
      updatedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setTimeout(() => {
      localStorage.setItem(`kriptokeyfi_risk_config_${selectedAccount}`, JSON.stringify(updatedConfig));
      setConfig(updatedConfig);
      setSaveStatus('saved');
      showToast(`✓ Limitler Go Risk Engine veritabanına başarıyla kaydedildi! (${selectedAccount})`, 'success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 600);
  };

  // Calculated Real-Time Metrics
  const calculatedTheoreticalNotional = (config.botQuotaMargin || 0) * (config.maxLeverage || 0);
  const calculatedAccountCapacity = (config.maxOpenPositionsFutures || 0) * (config.botQuotaMargin || 0);

  return (
    <div id="risk-full-view" className="w-full space-y-5 animate-in fade-in duration-200 pb-24">
      {/* Toast Notification Alert */}
      {notification && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-top-4 duration-200 ${
            notification.type === 'error'
              ? 'bg-[#f84960]/20 border-[#f84960] text-[#f84960]'
              : notification.type === 'warn'
              ? 'bg-[#f0b90b]/20 border-[#f0b90b] text-[#f0b90b]'
              : 'bg-[#02c076]/20 border-[#02c076] text-[#02c076]'
          }`}
        >
          {notification.type === 'error' ? (
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          ) : notification.type === 'warn' ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* 1. HEADER & ACCOUNT SELECTOR */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 pb-5 border-b border-[#2b3139]/80">
          {/* Title & Icon */}
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#f0b90b]/40 flex items-center justify-center text-[#f0b90b] shadow-[0_0_20px_rgba(240,185,11,0.25)] flex-shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                  Risk Yönetimi
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30">
                  GO RISK ENGINE v2.4
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#02c076] animate-pulse" />
                  DB Senkronize
                </span>
              </div>
              <p className="text-xs text-[#848e9c] mt-1">
                Bot ve manuel işlemlerin geçmek zorunda olduğu merkezi güvenlik limitleri.
              </p>
            </div>
          </div>

          {/* Quick Engine Telemetry */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 bg-[#0b0e11] rounded-xl border border-[#2b3139] flex items-center gap-2.5">
              <Server className="w-4 h-4 text-[#00d2ff]" />
              <div className="text-right">
                <div className="text-[10px] text-[#848e9c]">Motor Gecikmesi</div>
                <div className="text-xs font-bold text-[#00d2ff] font-['JetBrains_Mono',monospace]">0.74 ms</div>
              </div>
            </div>
            <div className="px-3.5 py-2 bg-[#0b0e11] rounded-xl border border-[#2b3139] flex items-center gap-2.5">
              <ClockIcon className="w-4 h-4 text-[#f0b90b]" />
              <div className="text-right">
                <div className="text-[10px] text-[#848e9c]">Son Güncelleme</div>
                <div className="text-xs font-bold text-[#eaecef] font-['JetBrains_Mono',monospace]">{config.updatedAt}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Borsa Hesabı Seçici */}
        <div className="pt-4 space-y-1.5">
          <label className="text-xs font-bold text-[#848e9c] uppercase tracking-wider block">
            Borsa hesabı
          </label>
          <div className="relative">
            <select
              id="risk-account-selector"
              value={selectedAccount}
              onChange={(e) => handleAccountChange(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-colors appearance-none cursor-pointer pr-10"
            >
              <option value="binance-test">Binance Test · BINANCE TESTNET</option>
              <option value="binance-live">Binance Live · BINANCE LIVE (Kurumsal Vadeli)</option>
              <option value="bybit-main">Bybit Unified · BYBIT MAINNET</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#848e9c]">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* 2. GO RISK ENGINE NOTICE BANNER */}
      <div className="bg-[#1e2329]/60 border border-[#f0b90b]/30 rounded-xl p-4 flex items-start gap-3 text-xs leading-relaxed text-[#c9d1d9] shadow-lg">
        <AlertTriangle className="w-5 h-5 text-[#f0b90b] flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#f0b90b]">Go Risk Engine Güvenlik Bildirisi: </span>
          Bu profil Go Risk Engine tarafından her karar öncesinde veritabanından okunur. Tüm azami parasal, pozisyon adedi ve emir sıklığı limitlerinde 0 uygulama sınırı olmadığı anlamına gelir; kullanılabilir bakiye, Binance filtreleri, stop-loss ve kill switch kontrolleri devam eder.
        </div>
      </div>

      {/* 3. KILL SWITCH CARDS (Global & Account) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Global Kill Switch */}
        <div
          id="global-kill-switch-card"
          className={`border rounded-2xl p-5 shadow-xl transition-all ${
            config.globalKillSwitch
              ? 'bg-[#f84960]/10 border-[#f84960] shadow-[0_0_25px_rgba(248,73,96,0.25)]'
              : 'bg-[#1e2329]/80 border-[#2b3139]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                config.globalKillSwitch ? 'bg-[#f84960]/20 text-[#f84960]' : 'bg-[#02c076]/20 text-[#02c076]'
              }`}
            >
              <Power className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#eaecef]">Global kill switch</h3>
          </div>
          <p
            className={`text-xs font-semibold mb-4 ${
              config.globalKillSwitch ? 'text-[#f84960]' : 'text-[#02c076]'
            }`}
          >
            {config.globalKillSwitch
              ? '● AKTİF · TÜM İŞLEMLER VE BOTLAR KİLİTLENDİ'
              : '● Pasif · Risk limitleri geçerli'}
          </p>

          <button
            id="toggle-global-kill-switch"
            onClick={handleToggleGlobalKillSwitch}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
              config.globalKillSwitch
                ? 'bg-[#02c076] hover:bg-[#02c076]/90 text-black shadow-[0_0_15px_rgba(2,192,118,0.4)]'
                : 'bg-[#f84960] hover:bg-[#f84960]/90 text-white shadow-[0_0_15px_rgba(248,73,96,0.3)]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{config.globalKillSwitch ? 'Acil Durdurmayı Devre Dışı Bırak' : 'Acil durdurmayı etkinleştir'}</span>
          </button>
        </div>

        {/* Hesap Kill Switch */}
        <div
          id="account-kill-switch-card"
          className={`border rounded-2xl p-5 shadow-xl transition-all ${
            config.accountKillSwitch
              ? 'bg-[#f84960]/10 border-[#f84960] shadow-[0_0_25px_rgba(248,73,96,0.25)]'
              : 'bg-[#1e2329]/80 border-[#2b3139]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                config.accountKillSwitch ? 'bg-[#f84960]/20 text-[#f84960]' : 'bg-[#02c076]/20 text-[#02c076]'
              }`}
            >
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#eaecef]">Hesap kill switch</h3>
          </div>
          <p
            className={`text-xs font-semibold mb-4 ${
              config.accountKillSwitch ? 'text-[#f84960]' : 'text-[#02c076]'
            }`}
          >
            {config.accountKillSwitch
              ? `● AKTİF · ${config.accountName} İÇİN EMİR GİRİŞİ KAPALI`
              : '● Pasif · Risk limitleri geçerli'}
          </p>

          <button
            id="toggle-account-kill-switch"
            onClick={handleToggleAccountKillSwitch}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
              config.accountKillSwitch
                ? 'bg-[#02c076] hover:bg-[#02c076]/90 text-black shadow-[0_0_15px_rgba(2,192,118,0.4)]'
                : 'bg-[#f84960] hover:bg-[#f84960]/90 text-white shadow-[0_0_15px_rgba(248,73,96,0.3)]'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>{config.accountKillSwitch ? 'Hesap Kilidini Aç' : 'Acil durdurmayı etkinleştir'}</span>
          </button>
        </div>
      </div>

      {/* 4. PRESETS & AUTOMATED GENERATORS */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="btn-fill-unlimited"
            onClick={handleFillUnlimitedLimits}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#02c076]/10 hover:bg-[#02c076]/20 text-[#02c076] border border-[#02c076]/40 transition-all flex items-center gap-2 shadow-[0_0_12px_rgba(2,192,118,0.15)]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Sınırsız üst limitleri doldur</span>
          </button>

          <button
            id="btn-calc-finite"
            onClick={handleAutoCalculateFiniteLimits}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/40 transition-all flex items-center gap-2 shadow-[0_0_12px_rgba(240,185,11,0.15)]"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Sonlu limitleri otomatik hesapla</span>
          </button>

          <button
            id="btn-reset-default"
            onClick={handleResetToDefault}
            className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#848e9c] hover:text-[#eaecef] bg-[#0b0e11] hover:bg-[#2b3139]/60 border border-[#2b3139] transition-all flex items-center gap-1.5 ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Varsayılana Sıfırla</span>
          </button>
        </div>

        <p className="text-xs text-[#848e9c] leading-relaxed">
          Sınırsız profil üst limitleri 0 yapar. Sonlu profil, bir botun tüm kotasını azami kaldıraçla kullanabileceği değerlere göre hesaplanır; kaydetmeden önce değiştirebilirsiniz.
        </p>
      </div>

      {/* 5. LIVE CALCULATED METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-3.5 shadow-lg">
          <div className="text-[11px] text-[#848e9c] flex items-center gap-1.5 mb-1">
            <Coins className="w-3.5 h-3.5 text-[#f0b90b]" />
            <span>Teorik Max Pozisyon</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-[#eaecef] font-['JetBrains_Mono',monospace]">
            {calculatedTheoreticalNotional.toLocaleString('en-US')} USDT
          </div>
          <div className="text-[10px] text-[#848e9c] mt-0.5">Kota ({config.botQuotaMargin}) × Kaldıraç ({config.maxLeverage}x)</div>
        </div>

        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-3.5 shadow-lg">
          <div className="text-[11px] text-[#848e9c] flex items-center gap-1.5 mb-1">
            <Gauge className="w-3.5 h-3.5 text-[#00d2ff]" />
            <span>Kaldıraç Bandı</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-[#00d2ff] font-['JetBrains_Mono',monospace]">
            {config.minLeverage}x — {config.maxLeverage}x
          </div>
          <div className="text-[10px] text-[#848e9c] mt-0.5">Min - Max Güvenlik Sınırı</div>
        </div>

        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-3.5 shadow-lg">
          <div className="text-[11px] text-[#848e9c] flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-[#02c076]" />
            <span>Hesap Teminat Yükü</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-[#02c076] font-['JetBrains_Mono',monospace]">
            {calculatedAccountCapacity.toLocaleString('en-US')} USDT
          </div>
          <div className="text-[10px] text-[#848e9c] mt-0.5">{config.maxOpenPositionsFutures} Pozisyon × {config.botQuotaMargin} USDT</div>
        </div>

        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-3.5 shadow-lg">
          <div className="text-[11px] text-[#848e9c] flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-[#f84960]" />
            <span>Korunan Bakiye</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-[#eaecef] font-['JetBrains_Mono',monospace]">
            {config.minProtectedBalance} USDT
          </div>
          <div className="text-[10px] text-[#848e9c] mt-0.5">Dokunulmaz Güvenlik Rezervi</div>
        </div>
      </div>

      {/* 6. THE 14 RISK ENGINE CONFIGURATION FIELDS */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#2b3139]">
          <h2 className="text-base font-bold text-[#eaecef] flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#f0b90b]" />
            <span>Merkezi Risk Parametreleri</span>
          </h2>
          <span className="text-xs text-[#848e9c] font-['JetBrains_Mono',monospace]">14 Parametre Aktif</span>
        </div>

        {/* Form Inputs Grid (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Bot başına teminat kotası */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Bot başına teminat kotası (PAPER / TESTNET / LIVE)</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'quota' ? null : 'quota')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">USDT</span>
            </div>
            <input
              id="field-bot-quota-margin"
              type="number"
              value={config.botQuotaMargin}
              onChange={(e) => handleFieldChange('botQuotaMargin', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">En az 100 USDT olmalı.</p>
          </div>

          {/* 2. Asgari işlem teminatı */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Asgari işlem teminatı</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'min-margin' ? null : 'min-margin')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">USDT</span>
            </div>
            <input
              id="field-min-trade-margin"
              type="number"
              value={config.minTradeMargin}
              onChange={(e) => handleFieldChange('minTradeMargin', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">En fazla 500 USDT; örnek dengeli aralık kotanın %1–%10'u.</p>
          </div>

          {/* 3. Emir başına azami notional */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Emir başına azami notional</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'max-notional' ? null : 'max-notional')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">USDT</span>
            </div>
            <input
              id="field-max-notional-per-order"
              type="number"
              value={config.maxNotionalPerOrder}
              onChange={(e) => handleFieldChange('maxNotionalPerOrder', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">Tam kota için 0 veya en az 10000 USDT.</p>
          </div>

          {/* 4. Emir başına azami başlangıç teminatı */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Emir başına azami başlangıç teminatı</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'max-init-margin' ? null : 'max-init-margin')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">USDT</span>
            </div>
            <input
              id="field-max-init-margin-per-order"
              type="number"
              value={config.maxInitialMarginPerOrder}
              onChange={(e) => handleFieldChange('maxInitialMarginPerOrder', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">Tam kota için 0 veya 500 USDT.</p>
          </div>

          {/* 5. Hesap açık notional limiti */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Hesap açık notional limiti</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'acc-open-notional' ? null : 'acc-open-notional')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">USDT</span>
            </div>
            <input
              id="field-account-max-open-notional"
              type="number"
              value={config.accountMaxOpenNotional}
              onChange={(e) => handleFieldChange('accountMaxOpenNotional', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">Mevcut pozisyon adediyle 0 veya yaklaşık 200000 USDT.</p>
          </div>

          {/* 6. Parite açık notional limiti */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Parite açık notional limiti</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'pair-open-notional' ? null : 'pair-open-notional')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">USDT</span>
            </div>
            <input
              id="field-pair-max-open-notional"
              type="number"
              value={config.pairMaxOpenNotional}
              onChange={(e) => handleFieldChange('pairMaxOpenNotional', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">Mevcut parite adediyle 0 veya yaklaşık 10000 USDT.</p>
          </div>

          {/* 7. Asgari kaldıraç */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Asgari kaldıraç</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'min-lev' ? null : 'min-lev')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">x</span>
            </div>
            <input
              id="field-min-leverage"
              type="number"
              value={config.minLeverage}
              onChange={(e) => handleFieldChange('minLeverage', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">Azami kaldıraç 20x değerini aşmamalı.</p>
          </div>

          {/* 8. Azami kaldıraç */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Azami kaldıraç</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'max-lev' ? null : 'max-lev')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">x</span>
            </div>
            <input
              id="field-max-leverage"
              type="number"
              value={config.maxLeverage}
              onChange={(e) => handleFieldChange('maxLeverage', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">Teorik tam-kota notionalı 10000 USDT.</p>
          </div>

          {/* 9. Futures Testnet / Live azami açık pozisyon */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Futures Testnet / Live azami açık pozisyon</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'max-pos-live' ? null : 'max-pos-live')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">Adet</span>
            </div>
            <input
              id="field-max-open-pos-futures"
              type="number"
              value={config.maxOpenPositionsFutures}
              onChange={(e) => handleFieldChange('maxOpenPositionsFutures', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">Sonluysa en az 1; 0 sınırsız.</p>
          </div>

          {/* 10. PAPER / Training azami açık pozisyon */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>PAPER / Training azami açık pozisyon</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'max-pos-paper' ? null : 'max-pos-paper')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">Adet</span>
            </div>
            <input
              id="field-max-open-pos-paper"
              type="number"
              value={config.maxOpenPositionsPaper}
              onChange={(e) => handleFieldChange('maxOpenPositionsPaper', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">0 sınırsız; yalnızca PAPER/Training için.</p>
          </div>

          {/* 11. Parite başına azami açık pozisyon */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Parite başına azami açık pozisyon</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'max-pos-pair' ? null : 'max-pos-pair')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">Adet</span>
            </div>
            <input
              id="field-max-open-pos-pair"
              type="number"
              value={config.maxOpenPositionsPerPair}
              onChange={(e) => handleFieldChange('maxOpenPositionsPerPair', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">En fazla 20; 0 sınırsız.</p>
          </div>

          {/* 12. Dakikalık emir limiti */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Dakikalık emir limiti</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'min-order-rate' ? null : 'min-order-rate')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">Emir/dk</span>
            </div>
            <input
              id="field-max-orders-per-minute"
              type="number"
              value={config.maxOrdersPerMinute}
              onChange={(e) => handleFieldChange('maxOrdersPerMinute', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">0 sınırsız; Binance API limiti yine geçerli.</p>
          </div>

          {/* 13. Günlük emir limiti */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Günlük emir limiti</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'daily-order-limit' ? null : 'daily-order-limit')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">Emir/gün</span>
            </div>
            <input
              id="field-max-orders-per-day"
              type="number"
              value={config.maxOrdersPerDay}
              onChange={(e) => handleFieldChange('maxOrdersPerDay', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">0 sınırsız; TP/SL emirleri de sayılır.</p>
          </div>

          {/* 14. Korunacak minimum bakiye */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#eaecef] flex items-center gap-1.5">
                <span>Korunacak minimum bakiye</span>
                <button
                  type="button"
                  onClick={() => setActiveTooltip(activeTooltip === 'protected-balance' ? null : 'protected-balance')}
                  className="text-[#848e9c] hover:text-[#f0b90b] transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              <span className="text-[10px] font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">USDT</span>
            </div>
            <input
              id="field-min-protected-balance"
              type="number"
              value={config.minProtectedBalance}
              onChange={(e) => handleFieldChange('minProtectedBalance', parseFloat(e.target.value))}
              className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-sm font-['JetBrains_Mono',monospace] font-bold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-[#848e9c]">0 rezerv ayırmaz; pozitif değer kullanılmadan korunur.</p>
          </div>
        </div>

        {/* Explanatory Footer Text */}
        <div className="pt-4 border-t border-[#2b3139]/80 flex items-start gap-2 text-xs text-[#848e9c]">
          <Info className="w-4 h-4 text-[#f0b90b] flex-shrink-0 mt-0.5" />
          <p>
            Her alanın yanındaki <span className="text-[#eaecef] font-medium">ℹ️ simgesine</span> gelerek neyi etkilediğini ve diğer değerlerle ilişkisini görebilirsiniz. 0 yalnızca azami limitlerde sınırsızdır; bot kotası, asgari teminat ve kaldıraç pozitif kalmalıdır.
          </p>
        </div>
      </div>

      {/* 7. BOTTOM STICKY ADMIN SECURITY & ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b0e11]/95 border-t border-[#2b3139] backdrop-blur-xl px-4 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <div className="w-full max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Admin Security Badge & Live Ticker */}
          <div className="flex items-center gap-4 overflow-x-auto w-full md:w-auto scrollbar-none">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2329] rounded-lg border border-[#2b3139] flex-shrink-0">
              <KeyRound className="w-3.5 h-3.5 text-[#02c076]" />
              <span className="text-xs font-bold text-[#eaecef]">Admin güvenlik işlemi</span>
              <span className="text-[10px] text-[#02c076] font-mono">SHA-256 OK</span>
            </div>

            {/* Live Ticker Items */}
            <div className="flex items-center gap-3 text-xs font-['JetBrains_Mono',monospace]">
              {TICKER_DATA.map((t) => (
                <div key={t.symbol} className="flex items-center gap-1.5 flex-shrink-0 bg-[#0b0e11] px-2.5 py-1 rounded-md border border-[#2b3139]">
                  <span className="text-[#848e9c] text-[11px]">{t.symbol}</span>
                  <span className="text-[#eaecef] font-bold text-[11px]">{t.price}</span>
                  <span className={`text-[10px] font-bold ${t.isUp ? 'text-[#02c076]' : 'text-[#f84960]'}`}>
                    {t.change}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Save Limits Button */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              id="btn-save-risk-limits"
              onClick={handleSaveLimits}
              disabled={saveStatus === 'saving'}
              className="w-full md:w-auto px-6 py-2.5 bg-[#f0b90b] hover:bg-[#fcd535] text-black font-bold rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(240,185,11,0.3)] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {saveStatus === 'saving' ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Limitler Kaydedildi!</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Limitleri kaydet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
