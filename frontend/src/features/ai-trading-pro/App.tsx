import React, { useState, useEffect, useRef } from 'react';
import { MainTabType, AiTradingSubTabType } from './types';
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
import { useProBotControl } from './services/useProBotControl';
import { useTradeProPositions } from './services/useTradeProPositions';
import {
  getTradeProAccounts,
  getTradeProArena,
  retainLastArenaDecisions,
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

export default function App({ requestedTab, onTabChange }: { requestedTab?: string | null; onTabChange?: (tab: MainTabType) => void }) {
  const [localTab, setLocalTab] = useState<MainTabType>('ai-trading');
  const mainTabs: MainTabType[] = ['ai-trading', 'positions', 'my-bots', 'bot-guide', 'manual-trade', 'exchange-accounts', 'orders', 'grid-bot', 'pnl', 'risk', 'system'];
  const activeMainTab = requestedTab === undefined ? localTab : mainTabs.includes(requestedTab as MainTabType) ? requestedTab as MainTabType : 'ai-trading';
  const setActiveMainTab = (tab: MainTabType) => { setLocalTab(tab); onTabChange?.(tab); };
  const [accountsRevision, setAccountsRevision] = useState(0);
  const [activeAiSubTab, setActiveAiSubTab] = useState<AiTradingSubTabType>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [exchangeAccounts, setExchangeAccounts] = useState<TradeProExchangeAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const tradeMode: TradeProMode = 'DEMO';
  const [balances, setBalances] = useState<TradeProBalance[]>([]);
  const [balanceAccountId, setBalanceAccountId] = useState('');
  const [arena, setArena] = useState<TradeProArena | null>(null);
  const lastArena = useRef<{ accountId: string; data: TradeProArena } | null>(null);
  const [arenaAccountId, setArenaAccountId] = useState('');
  const [dashboardDetails, setDashboardDetails] = useState<TradeProDashboardDetails>({ operations: [], riskProfile: null, health: null });
  const [detailsAccountId, setDetailsAccountId] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [accountsError, setAccountsError] = useState('');
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Fast Refresh can preserve the removed legacy AI "risk" subtab value.
  // Route that stale value to the single account-wide Risk page immediately.
  useEffect(() => {
    if ((activeAiSubTab as string) === 'risk') {
      setActiveAiSubTab('overview');
      setActiveMainTab('risk');
    }
  }, [activeAiSubTab]);

  const selectedAccount = exchangeAccounts.find((account) => account.id === selectedAccountId) ?? null;
  const dataAccount = selectedAccount?.isActive && isDemoAccount(selectedAccount) ? selectedAccount : null;
  const botControl = useProBotControl(dataAccount?.id ?? null);
  const positionState = useTradeProPositions(dataAccount?.id ?? null);
  const activeArena = dataAccount && arenaAccountId === dataAccount.id ? arena : null;
  const activeBalances = dataAccount && balanceAccountId === dataAccount.id ? balances : [];
  const activeDetails = dataAccount && detailsAccountId === dataAccount.id
    ? { ...dashboardDetails, operations: isDemoAccount(dataAccount) ? dashboardDetails.operations : [] }
    : { operations: [], riskProfile: null, health: null };

  useEffect(() => {
    let cancelled = false;
    setAccountsLoading(true);
    setAccountsError('');
    void getTradeProAccounts()
      .then((accounts) => {
        if (cancelled) return;
        const demoAccounts = accounts.filter((account) => account.isActive && isDemoAccount(account));
        setExchangeAccounts(demoAccounts);
        setSelectedAccountId((current) => (demoAccounts.some((account) => account.id === current) ? current : '') || demoAccounts[0]?.id || '');
        if (accounts.length === 0) setDashboardLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setAccountsError('Borsa hesapları backend üzerinden alınamadı.');
          setDashboardLoading(false);
        }
      }).finally(() => { if (!cancelled) setAccountsLoading(false); });
    return () => { cancelled = true; };
  }, [accountsRevision]);

  useEffect(() => {
    let cancelled = false;
    let arenaBusy = false;
    if (!dataAccount) {
      setBalances([]);
      setBalanceAccountId('');
      setArena(null);
      setArenaAccountId('');
      setDashboardDetails({ operations: [], riskProfile: null, health: null });
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
          const retained = retainLastArenaDecisions(lastArena.current?.accountId === dataAccount.id ? lastArena.current.data : null, nextArena);
          lastArena.current = { accountId: dataAccount.id, data: retained };
          setArena(retained);
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
    setDashboardDetails({ operations: [], riskProfile: null, health: null });
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

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef] flex flex-col font-['Inter','Plus_Jakarta_Sans',sans-serif] selection:bg-[#00d2ff]/30 selection:text-[#00d2ff] w-full overflow-x-hidden">
      {/* Top Header & Horizontal Navigation Hub (Full Width) */}
      <ManagementNavigation
        activeMainTab={activeMainTab}
        onSelectMainTab={setActiveMainTab}
        activeAiSubTab={activeAiSubTab}
        onSelectAiSubTab={setActiveAiSubTab}
        isBotsRunning={botControl.paused === null || botControl.error || botControl.loading ? null : !botControl.paused}
        controlDisabled={botControl.loading || botControl.busy || Boolean(botControl.error) || !botControl.bots.length}
        controlCount={botControl.bots.length}
        onToggleBotsRunning={() => void botControl.toggle()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        accountControl={<div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span className="rounded border border-[#f0b90b]/40 bg-[#f0b90b]/10 px-2 py-1 font-bold text-[#f0b90b]">{selectedAccount ? (selectedAccount.environment === 'TESTNET' ? 'DEMO / TESTNET' : selectedAccount.environment) : 'HESAP SEÇİLMEDİ'}</span>
          <label className="flex min-w-0 flex-wrap items-center gap-2 text-[#848e9c]">Seçili hesap
            <select aria-label="Seçili hesap" value={selectedAccountId} disabled={accountsLoading || !exchangeAccounts.length} onChange={(event) => setSelectedAccountId(event.target.value)} className="max-w-full rounded-lg border border-[#2b3139] bg-[#0b0e11] p-2 text-[#eaecef]">
              {!exchangeAccounts.length && <option value="">{accountsLoading ? 'Hesaplar yükleniyor…' : 'Aktif demo hesabı yok'}</option>}
              {exchangeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.provider} · {account.environment}</option>)}
            </select>
          </label>
          {accountsError && <div role="alert" className="w-full text-[#f84960]">{accountsError} <button type="button" onClick={() => setAccountsRevision((current) => current + 1)} className="underline">Yeniden dene</button></div>}
        </div>}
        botCount={activeArena ? Object.values(activeArena.states).reduce((sum, count) => sum + count, 0) : undefined}
        openPositionsCount={positionState.positions.length}
      />

      {/* Main Full-Screen Application View Container */}
      <main className="flex-1 px-3 sm:px-5 lg:px-6 pt-1 pb-4 w-full max-w-[1920px] mx-auto space-y-4">
        {(activeMainTab === 'ai-trading' || activeMainTab === 'my-bots') && botControl.error && <p role="alert" className="text-sm text-[#f84960]">{botControl.error} <button onClick={botControl.refresh} className="underline">Yeniden dene</button></p>}
        {/* TAB ROUTING */}
        {activeMainTab === 'ai-trading' && (
          <>
            {activeAiSubTab === 'overview' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {activeArena && <p role="status" className="rounded-lg border border-[#2b3139] p-3 text-xs text-[#848e9c]">
                  Analiz: {activeArena.analysisFresh ? 'güncel' : 'yeni karar gelmiyor'} · Otomatik giriş: {botControl.paused === null || botControl.error || botControl.loading ? 'doğrulanamadı' : botControl.paused ? 'kapalı' : 'açık'} · Otomatik nesil geliştirme: {activeArena.evolutionEnabled ? 'etkin' : 'kapalı'}.
                  {' '}Son karar: {activeArena.latestDecisionAt ? new Date(activeArena.latestDecisionAt).toLocaleString('tr-TR') : 'yok'}. Karar veya sinyal üretilmesi, borsaya emir gönderildiği anlamına gelmez.
                </p>}
                {/* TOP ROW: Balance Source | Sinyal Akışı (Centerpiece) | Live Signal Feeds */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  {/* 1. KAYNAK / BAKİYE (Cols: 3) */}
                  <div className="lg:col-span-3 h-full">
                    <BalanceSourceCard
                      accounts={exchangeAccounts}
                      selectedAccountId={selectedAccountId}
                      onSelectAccount={setSelectedAccountId}
                      mode={tradeMode}
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
                      positions={positionState.positions}
                      totalBalance={tradeProTotalBalance(activeBalances)}
                    />
                  </div>

                  {/* 3. SON KARARLAR & CANLI AKIŞ (Cols: 4) */}
                  <div className="lg:col-span-4 h-full">
                    <SignalFeed
                      key={dataAccount?.id ?? 'no-account'}
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
                    <ActivePositionsTable positions={positionState.positions} operations={activeDetails.operations} loading={accountsLoading || positionState.loading} error={positionState.error} hasAccount={Boolean(dataAccount)} onRefresh={positionState.refresh} />
                  </div>

                  {/* 2. PERFORMANS (Cols: 3) */}
                  <div className="lg:col-span-3 h-full">
                    <PerformanceCard operations={activeDetails.operations} />
                  </div>

                  {/* 3. BOT İSTATİSTİKLERİ (Cols: 2) */}
                  <div className="lg:col-span-2 h-full">
                    <BotStatsCard arena={activeArena} positions={positionState.positions} operations={activeDetails.operations} riskProfile={activeDetails.riskProfile} health={activeDetails.health} />
                  </div>

                  {/* 4. RİSK KONTROL (Cols: 2) */}
                  <div className="lg:col-span-2 h-full">
                    <RiskControlCard positions={positionState.positions} operations={activeDetails.operations} riskProfile={activeDetails.riskProfile} health={activeDetails.health} />
                  </div>
                </div>
              </div>
            )}

            {activeAiSubTab === 'arena' && <BotArenaView key={dataAccount?.id ?? "no-account"} accountId={dataAccount?.id ?? null} openPositionsCount={positionState.positions.length} />}
            {activeAiSubTab === 'champions' && <ChampionsView key={dataAccount?.id ?? 'no-account'} accountId={dataAccount?.id ?? null} accountName={dataAccount?.name} />}
            {activeAiSubTab === 'memory' && <MemoryView />}
            {activeAiSubTab === 'performance' && <PerformanceDeepView />}
            {activeAiSubTab === 'live-prep' && <LivePrepView />}
          </>
        )}

        {activeMainTab === 'positions' && (
          <PositionsFullView
            key={dataAccount?.id ?? 'no-account'}
            accountId={dataAccount?.id ?? null}
            positions={positionState.positions}
            operations={activeDetails.operations}
            loading={accountsLoading || positionState.loading}
            error={positionState.error}
            updatedAt={positionState.updatedAt}
            onRefresh={positionState.refresh}
          />
        )}
        {activeMainTab === 'my-bots' && <MyBotsView key={dataAccount?.id ?? "no-account"} bots={botControl.bots} loading={botControl.loading} error={botControl.error} onRefresh={botControl.refresh} onRisk={() => setActiveMainTab("risk")} />}
        {activeMainTab === 'bot-guide' && <BotGuideView />}
        {activeMainTab === 'manual-trade' && <ManualTradeView key={dataAccount?.id ?? 'no-account'} accountId={dataAccount?.id ?? null} accountName={dataAccount?.name} accountType={dataAccount?.accountType} />}
        {activeMainTab === 'exchange-accounts' && <ExchangeAccountsView onAccountsChanged={() => setAccountsRevision((current) => current + 1)} />}
        {activeMainTab === 'orders' && <OrdersFullView key={dataAccount?.id ?? 'no-account'} accountId={dataAccount?.id ?? null} accountName={dataAccount?.name} />}
        {activeMainTab === 'grid-bot' && <GridBotView accountId={dataAccount?.id ?? null} accountName={dataAccount?.name} accountType={dataAccount?.accountType} />}
        {activeMainTab === 'pnl' && <PnLAnalyticsView key={dataAccount?.id ?? 'no-account'} accountId={dataAccount?.id} accountName={dataAccount?.name} />}
        {activeMainTab === 'risk' && <RiskFullView key={dataAccount?.id ?? 'no-account'} accountId={dataAccount?.id ?? null} accountName={dataAccount?.name} />}
        {activeMainTab === 'system' && <SystemFullView />}
      </main>

      {/* Settings & Integration Guide Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
