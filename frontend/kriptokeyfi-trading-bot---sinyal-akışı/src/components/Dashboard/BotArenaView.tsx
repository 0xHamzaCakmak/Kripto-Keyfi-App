import React, { useState, useMemo, useEffect } from 'react';
import { getProArena } from '../../services/backendArena';
import { updateTradingExecutionProfile } from '../../../../src/services/tradingService';
import { getApiErrorMessage } from '../../../../src/services/apiClient';
import { getCoinIcon } from '../CoinIcons';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  Search,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Layers,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface BotArenaViewProps {
  accountId: string | null;
  openPositionsCount: number;
  onSelectCoin?: (symbol: string) => void;
}

export const BotArenaView: React.FC<BotArenaViewProps> = ({ onSelectCoin, accountId, openPositionsCount }) => {
  const [entryPaused, setEntryPaused] = useState<boolean | null>(null);
  const botsRunning = entryPaused === false;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('trading-execution-updated', refresh);
    return () => window.removeEventListener('trading-execution-updated', refresh);
  }, []);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('ALL');
  const [selectedGeneration, setSelectedGeneration] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<string>('ALL');
  const [minPnl, setMinPnl] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('index');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [bots, setBots] = useState<Awaited<ReturnType<typeof getProArena>>['bots']>([]);
  useEffect(() => {
    let active = true;
    let fetching = false;
    setBots([]); setEntryPaused(null); setError(''); setLoading(Boolean(accountId));
    if (!accountId) return;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const result = await getProArena(accountId);
        if (active) { setBots(result.bots); setEntryPaused(result.entryPaused); setError(result.error); }
      } catch (reason) { if (active) { setEntryPaused(null); setError(getApiErrorMessage(reason, 'Arena alınamadı.')); } }
      finally { fetching = false; if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accountId, revision]);

  // Filter & Sort logic
  const filteredBots = useMemo(() => {
    return bots
      .filter((bot) => {
        if (selectedStatus !== 'ALL' && bot.status !== selectedStatus) return false;
        if (selectedStrategy !== 'ALL' && bot.strategy !== selectedStrategy) return false;
        if (selectedGeneration !== 'ALL' && bot.generation !== selectedGeneration) return false;

        if (minScore === '50+' && (bot.score ?? -Infinity) < 50) return false;
        if (minScore === '70+' && (bot.score ?? -Infinity) < 70) return false;
        if (minScore === '85+' && (bot.score ?? -Infinity) < 85) return false;
        if (minPnl === 'POSITIVE' && (bot.totalPnl === null || bot.totalPnl <= 0)) return false;
        if (minPnl === 'NEGATIVE' && (bot.totalPnl === null || bot.totalPnl >= 0)) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            bot.name.toLowerCase().includes(q) ||
            bot.coin.toLowerCase().includes(q) ||
            bot.strategy.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score') return (b.score ?? -Infinity) - (a.score ?? -Infinity);
        if (sortBy === 'totalPnl') return (b.totalPnl || 0) - (a.totalPnl || 0);
        if (sortBy === 'openPnl') return (b.openPnl || 0) - (a.openPnl || 0);
        if (sortBy === 'tradesCount') return (b.tradesCount ?? -1) - (a.tradesCount ?? -1);
        return a.index - b.index;
      });
  }, [bots, selectedStatus, selectedStrategy, selectedGeneration, minScore, minPnl, sortBy, searchQuery]);

  const activePositionsCount = openPositionsCount;
  const scoreProducedCount = bots.filter((b) => b.score !== null).length;

  const handleToggleGlobalBots = async () => {
    if (!accountId || entryPaused === null || busy || loading) return;
    if (!window.confirm('Seçili demo hesabının otomatik işlem durumu değiştirilsin mi?')) return;
    setBusy(true); setError('');
    try { const profile = await updateTradingExecutionProfile(accountId, { entryPaused: !entryPaused }); setEntryPaused(profile.entryPaused); setRevision((value) => value + 1); }
    catch (reason) { setError(getApiErrorMessage(reason, 'İşlem durumu değiştirilemedi.')); }
    finally { setBusy(false); }
  };
  const handleRefresh = () => setRevision((value) => value + 1);

  return (
    <div id="bot-arena-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {error && <div role="alert" className="rounded-xl bg-[#f84960]/10 p-3 text-sm text-[#f84960]">{error}</div>}
      {loading && <p className="text-sm text-[#848e9c]">Arena yükleniyor…</p>}
      {!loading && !bots.length && <p className="text-sm text-[#848e9c]">{accountId ? "Bu demo hesabında bot bulunmuyor." : "Aktif demo hesabı seçin."}</p>}
      {/* Bot Arena Hero Banner */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#f0b90b]/40 flex items-center justify-center text-[#f0b90b] shadow-[0_0_15px_rgba(240,185,11,0.25)] shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef] font-['Inter',sans-serif]">
                Bot Arena
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00d2ff]/15 text-[#00d2ff] border border-[#00d2ff]/30">
                PRO MOTOR
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#848e9c] mt-0.5">
              Seçili demo hesabının botlarını, skorlarını ve borsa işlemlerini izleyin.
            </p>
          </div>
        </div>

        {/* Global Action Buttons (Matching Screenshot) */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="px-3 py-1.5 rounded-lg bg-[#0b0e11] border border-[#2b3139] text-xs font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">
            {bots.length} TESTNET botu
          </div>

          <button
            id="btn-arena-start-toggle"
            disabled={busy || loading || !accountId || entryPaused === null}
            onClick={() => void handleToggleGlobalBots()}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
              botsRunning
                ? 'bg-[#f84960]/20 hover:bg-[#f84960]/30 text-[#f84960] border border-[#f84960]/40'
                : 'bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] shadow-[0_0_15px_rgba(2,192,118,0.4)]'
            }`}
          >
            {botsRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{botsRunning ? 'İşlemleri Durdur' : 'Yeni İşlemleri Başlat'}</span>
          </button>

          <button
            id="btn-arena-refresh"
            disabled={busy || loading || !accountId}
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-[#0b0e11] shadow-[0_0_15px_rgba(240,185,11,0.3)] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Warning/Status Banner (Exact match from Screenshot) */}
      <div
        className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all ${
          botsRunning
            ? 'bg-[#02c076]/10 border-[#02c076]/30 text-[#02c076]'
            : 'bg-[#f84960]/10 border-[#f84960]/30 text-[#f84960]'
        }`}
      >
        {botsRunning ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#02c076]" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#f84960]" />
        )}
        <span>
          {entryPaused === null ? 'İşlem durumu henüz doğrulanamadı.' : botsRunning
            ? 'Botlar devrede: Yeni emir girişi, gerçek zamanlı sinyal akışı ve otomatik açık pozisyon yönetimi aktiftir.'
            : 'Botlar durduruldu: yeni emir girişi ve otomatik açık pozisyon yönetimi kapalıdır.'}
        </span>
      </div>

      {/* Arena 5-Card Metrics Grid (Exact match from Screenshot) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: TESTNET BOTU */}
        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider">TESTNET BOTU</span>
          <div className="my-2 text-2xl sm:text-3xl font-black font-['JetBrains_Mono',monospace] text-[#02c076]">
            {bots.length}
          </div>
          <span className="text-[11px] text-[#848e9c]">Seçili hesaptaki botlar</span>
        </div>

        {/* Card 2: SCORE ÜRETİLEN */}
        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider">SCORE ÜRETİLEN</span>
          <div className="my-2 text-2xl sm:text-3xl font-black font-['JetBrains_Mono',monospace] text-[#eaecef]">
            {scoreProducedCount}
          </div>
          <span className="text-[11px] text-[#848e9c]">Aktif model skoru</span>
        </div>

        {/* Card 3: CHALLENGER */}
        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider">CHALLENGER</span>
          <div className="my-2 text-2xl sm:text-3xl font-black font-['JetBrains_Mono',monospace] text-[#eaecef]">
            {bots.filter((bot) => bot.lifecycle === 'CHALLENGER').length}
          </div>
          <span className="text-[11px] text-[#848e9c]">A/B test botu</span>
        </div>

        {/* Card 4: KAPANMIŞ TESTNET İŞLEM */}
        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider">
            KAPANMIŞ TESTNET İŞLEM
          </span>
          <div className="my-2 text-2xl sm:text-3xl font-black font-['JetBrains_Mono',monospace] text-[#eaecef]">
            0
          </div>
          <span className="text-[11px] text-[#848e9c]">Başarıyla kapatılan</span>
        </div>

        {/* Card 5: AÇIK TESTNET POZİSYON */}
        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider">
            AÇIK TESTNET POZİSYON
          </span>
          <div className="my-2 text-2xl sm:text-3xl font-black font-['JetBrains_Mono',monospace] text-[#02c076]">
            {activePositionsCount}
          </div>
          <span className="text-[11px] text-[#848e9c]">Anlık piyasada aktif</span>
        </div>
      </div>

      {/* Filter and Sorting Section (Exact match from Screenshot) */}
      <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-[#2b3139]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#f0b90b]" />
            <h3 className="text-xs font-bold text-[#eaecef] uppercase tracking-wider">Filtreler ve sıralama</h3>
          </div>

          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#848e9c] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Bot veya coin ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#eaecef] placeholder-[#848e9c] focus:outline-none focus:border-[#00d2ff]"
            />
          </div>
        </div>

        {/* 7 Filter Selectors Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-[#848e9c] uppercase mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-[#eaecef] focus:outline-none focus:border-[#00d2ff] font-medium"
            >
              <option value="ALL">Tümü</option>
              {[...new Set(bots.map((bot) => bot.status))].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-[10px] font-bold text-[#848e9c] uppercase mb-1">Strategy</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-[#eaecef] focus:outline-none focus:border-[#00d2ff] font-medium"
            >
              <option value="ALL">Tümü</option>
              {[...new Set(bots.map((bot) => bot.strategy))].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>

          {/* Generation */}
          <div>
            <label className="block text-[10px] font-bold text-[#848e9c] uppercase mb-1">Generation</label>
            <select
              value={selectedGeneration}
              onChange={(e) => setSelectedGeneration(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-[#eaecef] focus:outline-none focus:border-[#00d2ff] font-medium"
            >
              <option value="ALL">Tümü</option>
              {[...new Set(bots.map((bot) => bot.generation))].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>

          {/* Min score */}
          <div>
            <label className="block text-[10px] font-bold text-[#848e9c] uppercase mb-1">Min score</label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-[#eaecef] focus:outline-none focus:border-[#00d2ff] font-medium"
            >
              <option value="ALL">Tümü</option>
              <option value="50+">50+</option>
              <option value="70+">70+</option>
              <option value="85+">85+ Elite</option>
            </select>
          </div>

          {/* Min PnL */}
          <div>
            <label className="block text-[10px] font-bold text-[#848e9c] uppercase mb-1">Min PnL</label>
            <select
              value={minPnl}
              onChange={(e) => setMinPnl(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-[#eaecef] focus:outline-none focus:border-[#00d2ff] font-medium"
            >
              <option value="ALL">Tümü</option>
              <option value="POSITIVE">Pozitif Kâr</option>
              <option value="NEGATIVE">Zarar Durumu</option>
            </select>
          </div>

          {/* Sırala */}
          <div>
            <label className="block text-[10px] font-bold text-[#848e9c] uppercase mb-1">Sırala</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-[#eaecef] focus:outline-none focus:border-[#00d2ff] font-medium"
            >
              <option value="index">Bot No (#001..)</option>
              <option value="score">Score</option>
              <option value="openPnl">Açık PnL</option>
              <option value="totalPnl">Toplam PnL</option>
              <option value="tradesCount">İşlem Sayısı</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bot Arena Main Table (Exact replica of user screenshot #1 & #3) */}
      <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0b0e11] text-[11px] font-bold text-[#848e9c] uppercase tracking-wider border-b border-[#2b3139]">
                <th className="py-3 px-4">BOT</th>
                <th className="py-3 px-4">POZİSYON VE İŞLEM ÖZETİ</th>
                <th className="py-3 px-4 text-center">SCORE</th>
                <th className="py-3 px-4 text-right">TOPLAM PNL</th>
                <th className="py-3 px-4 text-right">AÇIK PNL</th>
                <th className="py-3 px-4 text-right">ROI</th>
                <th className="py-3 px-4 text-right">PF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b3139] font-['JetBrains_Mono',monospace]">
              {filteredBots.map((bot) => {
                const hasPosition = bot.directionLeverage !== null;
                const isProfit = (bot.currentPnl || 0) >= 0;
                return (
                  <tr
                    key={bot.id}
                    className="hover:bg-[#2b3139]/40 transition-colors group"
                  >
                    {/* Bot Title & Demo Account Badge */}
                    <td className="py-3 px-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#0b0e11] border border-[#f0b90b]/40 text-[#f0b90b] flex items-center justify-center font-bold text-[11px]">
                          {bot.index}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#eaecef] font-['Inter',sans-serif] text-xs">
                              {bot.name}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                bot.status === 'RUNNING'
                                  ? 'bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30'
                                  : bot.status === 'PAUSED'
                                  ? 'bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30'
                                  : 'bg-[#f84960]/15 text-[#f84960] border border-[#f84960]/30'
                              }`}
                            >
                              {bot.status}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="inline-block px-2 py-0.5 text-[9px] font-bold tracking-tight bg-[#f84960]/15 text-[#f84960] border border-[#f84960]/40 rounded font-['Inter',sans-serif]">
                              {bot.accountLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Pozisyon ve İşlem Özeti (COIN, GİRİŞ FİYATI, YÖN / KALDIRAÇ, ANLIK PNL, İŞLEM) */}
                    <td className="py-3 px-4 align-middle">
                      <div className="bg-[#0b0e11]/90 border border-[#2b3139] rounded-xl p-2.5 grid grid-cols-5 gap-2 text-center text-[10px]">
                        {/* COIN */}
                        <div className="text-left">
                          <span className="text-[#848e9c] text-[9px] uppercase block font-['Inter',sans-serif]">COIN</span>
                          <div className="flex items-center gap-1 font-bold text-[#f0b90b] mt-0.5">
                            {getCoinIcon(bot.coin, 14)}
                            <span>{bot.coin}</span>
                          </div>
                        </div>

                        {/* GİRİŞ FİYATI */}
                        <div>
                          <span className="text-[#848e9c] text-[9px] uppercase block font-['Inter',sans-serif]">GİRİŞ FİYATI</span>
                          <span className="text-[#eaecef] font-bold mt-0.5 block">
                            {bot.entryPrice ? `$${bot.entryPrice.toLocaleString()}` : '—'}
                          </span>
                        </div>

                        {/* YÖN / KALDIRAÇ */}
                        <div>
                          <span className="text-[#848e9c] text-[9px] uppercase block font-['Inter',sans-serif]">YÖN / KALDIRAÇ</span>
                          <span
                            className={`font-bold mt-0.5 block ${
                              bot.directionLeverage?.startsWith('LONG')
                                ? 'text-[#02c076]'
                                : bot.directionLeverage?.startsWith('SHORT')
                                ? 'text-[#f84960]'
                                : 'text-[#848e9c]'
                            }`}
                          >
                            {bot.directionLeverage || '—'}
                          </span>
                        </div>

                        {/* ANLIK PNL */}
                        <div>
                          <span className="text-[#848e9c] text-[9px] uppercase block font-['Inter',sans-serif]">ANLIK PNL</span>
                          <span
                            className={`font-bold mt-0.5 block ${
                              bot.currentPnl !== null
                                ? isProfit
                                  ? 'text-[#02c076]'
                                  : 'text-[#f84960]'
                                : 'text-[#848e9c]'
                            }`}
                          >
                            {bot.currentPnl !== null ? `${isProfit ? '+' : ''}$${bot.currentPnl}` : '—'}
                          </span>
                        </div>

                        {/* İŞLEM */}
                        <div>
                          <span className="text-[#848e9c] text-[9px] uppercase block font-['Inter',sans-serif]">İŞLEM</span>
                          <span className="text-[#eaecef] font-bold mt-0.5 block">
                            {bot.tradesCount ?? '—'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* SCORE */}
                    <td className="py-3 px-4 text-center align-middle">
                      <span
                        className={`text-sm font-black ${
                          bot.score >= 85
                            ? 'text-[#02c076]'
                            : bot.score >= 70
                            ? 'text-[#00d2ff]'
                            : bot.score > 0
                            ? 'text-[#f0b90b]'
                            : 'text-[#848e9c]'
                        }`}
                      >
                        {bot.score ?? '—'}
                      </span>
                    </td>

                    {/* TOPLAM PNL */}
                    <td className="py-3 px-4 text-right align-middle font-bold text-xs">
                      {bot.totalPnl !== null ? (
                        <span className={bot.totalPnl >= 0 ? 'text-[#02c076]' : 'text-[#f84960]'}>
                          {bot.totalPnl >= 0 ? '+' : ''}${bot.totalPnl.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[#848e9c]">—</span>
                      )}
                    </td>

                    {/* AÇIK PNL */}
                    <td className="py-3 px-4 text-right align-middle font-bold text-xs">
                      {bot.openPnl !== null ? (
                        <span className={bot.openPnl >= 0 ? 'text-[#02c076]' : 'text-[#f84960]'}>
                          {bot.openPnl >= 0 ? '+' : ''}${bot.openPnl.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[#848e9c]">—</span>
                      )}
                    </td>

                    {/* ROI */}
                    <td className="py-3 px-4 text-right align-middle font-bold text-xs">
                      {bot.roi !== null ? (
                        <span className={bot.roi >= 0 ? 'text-[#02c076]' : 'text-[#f84960]'}>
                          %{bot.roi.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-[#848e9c]">—</span>
                      )}
                    </td>

                    {/* PF (Profit Factor) */}
                    <td className="py-3 px-4 text-right align-middle font-bold text-xs text-[#eaecef]">
                      {bot.profitFactor !== null ? bot.profitFactor.toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
