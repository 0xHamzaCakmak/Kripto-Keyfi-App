import React, { useState, useEffect } from 'react';
import { MainTabType, AiTradingSubTabType, SignalDecision, SignalEvent } from './types';
import { ManagementNavigation } from './components/ManagementNavigation';
import { SignalFlow, SignalFeed } from './components/SignalFlow';
import { BalanceSourceCard } from './components/Dashboard/BalanceSourceCard';
import { ActivePositionsTable } from './components/Dashboard/ActivePositionsTable';
import { PerformanceCard } from './components/Dashboard/PerformanceCard';
import { BotStatsCard } from './components/Dashboard/BotStatsCard';
import { RiskControlCard } from './components/Dashboard/RiskControlCard';
import { BotArenaView } from './components/Dashboard/BotArenaView';
import { ChampionsView } from './components/Dashboard/ChampionsView';
import { MemoryView } from './components/Dashboard/MemoryView';
import { PerformanceDeepView } from './components/Dashboard/PerformanceDeepView';
import { LivePrepView } from './components/Dashboard/LivePrepView';
import { ManualTradeView } from './components/Dashboard/ManualTradeView';
import { PositionsFullView } from './components/Dashboard/PositionsFullView';
import { OrdersFullView } from './components/Dashboard/OrdersFullView';
import { ExchangeAccountsView } from './components/Dashboard/ExchangeAccountsView';
import { GridBotView } from './components/Dashboard/GridBotView';
import { RiskFullView } from './components/Dashboard/RiskFullView';
import { SystemFullView } from './components/Dashboard/SystemFullView';
import { MyBotsView } from './components/Dashboard/MyBotsView';
import { BotGuideView } from './components/Dashboard/BotGuideView';
import { PnLAnalyticsView } from './components/Dashboard/PnLAnalyticsView';
import { SettingsModal } from './components/SettingsModal';
import { BOT_OVERVIEW_STATS, signalEmitter } from './services/mockSignalEngine';
import {
  getTradeProAccounts,
  getTradeProArena,
  getTradeProBalances,
  getTradeProDashboardDetails,
  isDemoAccount,
  tradeProTotalBalance,
  type TradeProArena,
  type TradeProBalance,
  type TradeProDashboardDetails,
  type TradeProExchangeAccount,
  type TradeProMode,
} from './services/backendDashboard';

export default function App() {
  const [stats, setStats] = useState(BOT_OVERVIEW_STATS);
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>('ai-trading');
  const [activeAiSubTab, setActiveAiSubTab] = useState<AiTradingSubTabType>('overview');
  const [isBotsRunning, setIsBotsRunning] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [exchangeAccounts, setExchangeAccounts] = useState<TradeProExchangeAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [tradeMode, setTradeMode] = useState<TradeProMode>('DEMO');
  const [balances, setBalances] = useState<TradeProBalance[]>([]);
  const [balanceAccountId, setBalanceAccountId] = useState('');
  const [arena, setArena] = useState<TradeProArena | null>(null);
  const [arenaAccountId, setArenaAccountId] = useState('');
  const [dashboardDetails, setDashboardDetails] = useState<TradeProDashboardDetails>({ positions: [], operations: [], riskProfile: null, health: null });
  const [detailsAccountId, setDetailsAccountId] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const selectedAccount = exchangeAccounts.find((account) => account.id === selectedAccountId) ?? null;
  const dataAccount = selectedAccount
    ? (tradeMode === 'DEMO'
      ? (isDemoAccount(selectedAccount) ? selectedAccount : exchangeAccounts.find((account) => account.provider === selectedAccount.provider && isDemoAccount(account)))
      : (!isDemoAccount(selectedAccount) ? selectedAccount : exchangeAccounts.find((account) => account.provider === selectedAccount.provider && !isDemoAccount(account))))
    : null;
  const activeArena = dataAccount && arenaAccountId === dataAccount.id ? arena : null;
  const activeBalances = dataAccount && balanceAccountId === dataAccount.id ? balances : [];
  const activeDetails = dataAccount && detailsAccountId === dataAccount.id
    ? { ...dashboardDetails, operations: isDemoAccount(dataAccount) ? dashboardDetails.operations : [] }
    : { positions: [], operations: [], riskProfile: null, health: null };

  useEffect(() => {
    let cancelled = false;
    void getTradeProAccounts()
      .then((accounts) => {
        if (cancelled) return;
        setExchangeAccounts(accounts);
        setSelectedAccountId((current) => current || accounts.find(isDemoAccount)?.id || accounts[0]?.id || '');
        if (accounts.length === 0) setDashboardLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setDashboardError('Borsa hesapları backend üzerinden alınamadı.');
          setDashboardLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let arenaBusy = false;
    if (!dataAccount) {
      setBalances([]);
      setBalanceAccountId('');
      setArena(null);
      setArenaAccountId('');
      setDashboardDetails({ positions: [], operations: [], riskProfile: null, health: null });
      setDetailsAccountId('');
      setDashboardLoading(false);
      setDashboardError('');
      return () => { cancelled = true; };
    }

    const refreshArena = async () => {
      if (arenaBusy) return;
      arenaBusy = true;
      try {
        const nextArena = await getTradeProArena(dataAccount.id);
        if (!cancelled) {
          setArena(nextArena);
          setArenaAccountId(dataAccount.id);
          setDashboardError((current) => current === 'Karar akışı backend üzerinden alınamadı.' ? '' : current);
        }
      } catch {
        if (!cancelled) setDashboardError('Karar akışı backend üzerinden alınamadı.');
      } finally {
        arenaBusy = false;
        if (!cancelled) setDashboardLoading(false);
      }
    };
    const refreshBalances = async () => {
      try {
        const nextBalances = await getTradeProBalances(dataAccount.id);
        if (!cancelled) {
          setBalances(nextBalances);
          setBalanceAccountId(dataAccount.id);
          setDashboardError((current) => current === 'Borsa bakiyesi backend üzerinden alınamadı.' ? '' : current);
        }
      } catch {
        if (!cancelled) {
          setBalances([]);
          setBalanceAccountId('');
          setDashboardError('Borsa bakiyesi backend üzerinden alınamadı.');
        }
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    };
    const refreshDetails = async () => {
      const nextDetails = await getTradeProDashboardDetails(dataAccount.id);
      if (!cancelled) {
        setDashboardDetails(nextDetails);
        setDetailsAccountId(dataAccount.id);
      }
    };

    setDashboardLoading(true);
    setDashboardError('');
    setBalances([]);
    setBalanceAccountId('');
    setArena(null);
    setArenaAccountId('');
    setDashboardDetails({ positions: [], operations: [], riskProfile: null, health: null });
    setDetailsAccountId('');
    void refreshArena();
    void refreshBalances();
    void refreshDetails();
    const arenaTimer = window.setInterval(() => void refreshArena(), 1_000);
    const balanceTimer = window.setInterval(() => void refreshBalances(), 30_000);
    const detailsTimer = window.setInterval(() => void refreshDetails(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(arenaTimer);
      window.clearInterval(balanceTimer);
      window.clearInterval(detailsTimer);
    };
  }, [dataAccount?.id]);

  const handleToggleBotsRunning = () => {
    const running = signalEmitter.toggle();
    setIsBotsRunning(running);
  };

  const handleTriggerSignal = () => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT', 'DOGEUSDT', 'SUIUSDT'];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    const decisions: SignalDecision[] = ['LONG', 'SHORT', 'HOLD'];
    const randomDecision = decisions[Math.floor(Math.random() * decisions.length)];
    const now = new Date();

    const manualSignal: SignalEvent = {
      id: 'manual-' + Date.now(),
      timestamp: now.toTimeString().split(' ')[0],
      timeMs: Date.now(),
      symbol: randomSymbol,
      decision: randomDecision,
      confidence: Math.floor(Math.random() * 35) + 60,
      changePercent: randomDecision === 'LONG' ? 1.25 : randomDecision === 'SHORT' ? -1.1 : 0.2,
      price: 0,
    };

    signalEmitter.emit(manualSignal);
  };

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef] flex flex-col font-['Inter','Plus_Jakarta_Sans',sans-serif] selection:bg-[#00d2ff]/30 selection:text-[#00d2ff] w-full overflow-x-hidden">
      {/* Top Header & Horizontal Navigation Hub (Full Width) */}
      <ManagementNavigation
        activeMainTab={activeMainTab}
        onSelectMainTab={setActiveMainTab}
        activeAiSubTab={activeAiSubTab}
        onSelectAiSubTab={setActiveAiSubTab}
        isBotsRunning={isBotsRunning}
        onToggleBotsRunning={handleToggleBotsRunning}
        onTriggerSignal={handleTriggerSignal}
        onOpenSettings={() => setIsSettingsOpen(true)}
        openPositionsCount={stats.activePositionsCount}
      />

      {/* Main Full-Screen Application View Container */}
      <main className="flex-1 px-3 sm:px-5 lg:px-6 pt-1 pb-4 w-full max-w-[1920px] mx-auto space-y-4">
        {/* TAB ROUTING */}
        {activeMainTab === 'ai-trading' && (
          <>
            {activeAiSubTab === 'overview' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* TOP ROW: Balance Source | Sinyal Akışı (Centerpiece) | Live Signal Feeds */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  {/* 1. KAYNAK / BAKİYE (Cols: 3) */}
                  <div className="lg:col-span-3 h-full">
                    <BalanceSourceCard
                      accounts={exchangeAccounts}
                      selectedAccountId={selectedAccountId}
                      onSelectAccount={setSelectedAccountId}
                      mode={tradeMode}
                      onToggleMode={() => setTradeMode((current) => current === 'DEMO' ? 'LIVE' : 'DEMO')}
                      balances={activeBalances}
                      arena={activeArena}
                      loading={dashboardLoading}
                      hasBackendAccount={Boolean(dataAccount)}
                      error={dashboardError}
                    />
                  </div>

                  {/* 2. SİNYAL AKIŞI HERO (Cols: 5) */}
                  <div className="lg:col-span-5 h-full">
                    <SignalFlow
                      accountId={dataAccount?.id ?? null}
                      arena={activeArena}
                      positions={activeDetails.positions}
                      totalBalance={tradeProTotalBalance(activeBalances)}
                    />
                  </div>

                  {/* 3. SON KARARLAR & CANLI AKIŞ (Cols: 4) */}
                  <div className="lg:col-span-4 h-full">
                    <SignalFeed
                      arena={activeArena}
                      loading={dashboardLoading}
                      hasBackendAccount={Boolean(dataAccount)}
                    />
                  </div>
                </div>

                {/* BOTTOM ROW: Aktif Pozisyonlar | Performans | Bot İstatistikleri | Risk Kontrol */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-stretch">
                  {/* 1. AKTİF POZİSYONLAR (Cols: 5) */}
                  <div className="lg:col-span-5 h-full">
                    <ActivePositionsTable positions={activeDetails.positions} operations={activeDetails.operations} loading={dashboardLoading} />
                  </div>

                  {/* 2. PERFORMANS (Cols: 3) */}
                  <div className="lg:col-span-3 h-full">
                    <PerformanceCard operations={activeDetails.operations} />
                  </div>

                  {/* 3. BOT İSTATİSTİKLERİ (Cols: 2) */}
                  <div className="lg:col-span-2 h-full">
                    <BotStatsCard arena={activeArena} positions={activeDetails.positions} operations={activeDetails.operations} riskProfile={activeDetails.riskProfile} health={activeDetails.health} />
                  </div>

                  {/* 4. RİSK KONTROL (Cols: 2) */}
                  <div className="lg:col-span-2 h-full">
                    <RiskControlCard positions={activeDetails.positions} operations={activeDetails.operations} riskProfile={activeDetails.riskProfile} health={activeDetails.health} />
                  </div>
                </div>
              </div>
            )}

            {activeAiSubTab === 'arena' && <BotArenaView />}
            {activeAiSubTab === 'champions' && <ChampionsView />}
            {activeAiSubTab === 'memory' && <MemoryView />}
            {activeAiSubTab === 'performance' && <PerformanceDeepView />}
            {activeAiSubTab === 'risk' && <RiskFullView />}
            {activeAiSubTab === 'live-prep' && <LivePrepView />}
          </>
        )}

        {activeMainTab === 'positions' && (
          <PositionsFullView
            accountId={dataAccount?.id ?? null}
            positions={activeDetails.positions}
            operations={activeDetails.operations}
            loading={dashboardLoading}
          />
        )}
        {activeMainTab === 'my-bots' && <MyBotsView />}
        {activeMainTab === 'bot-guide' && <BotGuideView />}
        {activeMainTab === 'manual-trade' && <ManualTradeView />}
        {activeMainTab === 'exchange-accounts' && <ExchangeAccountsView />}
        {activeMainTab === 'orders' && <OrdersFullView />}
        {activeMainTab === 'grid-bot' && <GridBotView />}
        {activeMainTab === 'pnl' && <PnLAnalyticsView />}
        {activeMainTab === 'risk' && <RiskFullView />}
        {activeMainTab === 'system' && <SystemFullView />}
      </main>

      {/* Settings & Integration Guide Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
