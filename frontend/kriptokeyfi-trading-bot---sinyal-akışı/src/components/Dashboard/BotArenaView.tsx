import React, { useState, useMemo } from 'react';
import { ArenaBotItem } from '../../types';
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
  onSelectCoin?: (symbol: string) => void;
}

export const BotArenaView: React.FC<BotArenaViewProps> = ({ onSelectCoin }) => {
  const [botsRunning, setBotsRunning] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('ALL');
  const [selectedGeneration, setSelectedGeneration] = useState<string>('ALL');
  const [selectedRegime, setSelectedRegime] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<string>('ALL');
  const [minPnl, setMinPnl] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('index');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Initial 20 Binance TESTNET bots as shown in screenshots
  const [bots, setBots] = useState<ArenaBotItem[]>([
    {
      id: 'bot-001',
      index: 1,
      name: 'AI Momentum G1 #001',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'BTCUSDT',
      entryPrice: 63840.5,
      directionLeverage: 'LONG 10x',
      currentPnl: 142.8,
      tradesCount: 28,
      score: 88,
      totalPnl: 486.2,
      openPnl: 142.8,
      roi: 14.28,
      profitFactor: 2.45,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 71.4,
    },
    {
      id: 'bot-002',
      index: 2,
      name: 'AI Momentum G1 #002',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'ETHUSDT',
      entryPrice: 3450.2,
      directionLeverage: 'LONG 10x',
      currentPnl: 58.4,
      tradesCount: 24,
      score: 82,
      totalPnl: 312.5,
      openPnl: 58.4,
      roi: 8.52,
      profitFactor: 1.95,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 66.7,
    },
    {
      id: 'bot-003',
      index: 3,
      name: 'AI Momentum G1 #003',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'BTCUSDT',
      entryPrice: null,
      directionLeverage: null,
      currentPnl: null,
      tradesCount: 19,
      score: 74,
      totalPnl: 185.0,
      openPnl: null,
      roi: 6.2,
      profitFactor: 1.72,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Ranging',
      winRate: 63.1,
    },
    {
      id: 'bot-004',
      index: 4,
      name: 'AI Momentum G1 #004',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'SOLUSDT',
      entryPrice: 154.2,
      directionLeverage: 'LONG 15x',
      currentPnl: 92.6,
      tradesCount: 31,
      score: 91,
      totalPnl: 640.8,
      openPnl: 92.6,
      roi: 18.64,
      profitFactor: 2.88,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 77.4,
    },
    {
      id: 'bot-005',
      index: 5,
      name: 'AI Momentum G1 #005',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'XRPUSDT',
      entryPrice: 0.582,
      directionLeverage: 'SHORT 8x',
      currentPnl: -14.2,
      tradesCount: 16,
      score: 68,
      totalPnl: 94.2,
      openPnl: -14.2,
      roi: -2.1,
      profitFactor: 1.41,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bearish',
      winRate: 56.2,
    },
    {
      id: 'bot-006',
      index: 6,
      name: 'AI Momentum G1 #006',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'BTCUSDT',
      entryPrice: null,
      directionLeverage: null,
      currentPnl: null,
      tradesCount: 0,
      score: 0,
      totalPnl: null,
      openPnl: null,
      roi: null,
      profitFactor: null,
      status: 'STOPPED',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 0,
    },
    {
      id: 'bot-007',
      index: 7,
      name: 'AI Momentum G1 #007',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'BNBUSDT',
      entryPrice: 590.1,
      directionLeverage: 'LONG 10x',
      currentPnl: 45.2,
      tradesCount: 18,
      score: 79,
      totalPnl: 210.4,
      openPnl: 45.2,
      roi: 7.8,
      profitFactor: 1.82,
      status: 'RUNNING',
      strategy: 'Mean Reversion',
      generation: 'G1',
      regime: 'Ranging',
      winRate: 64.0,
    },
    {
      id: 'bot-008',
      index: 8,
      name: 'AI Momentum G1 #008',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'AVAXUSDT',
      entryPrice: 28.4,
      directionLeverage: 'LONG 12x',
      currentPnl: 34.1,
      tradesCount: 22,
      score: 84,
      totalPnl: 280.9,
      openPnl: 34.1,
      roi: 9.4,
      profitFactor: 2.1,
      status: 'RUNNING',
      strategy: 'Breakout',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 72.7,
    },
    {
      id: 'bot-009',
      index: 9,
      name: 'AI Momentum G1 #009',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'DOGEUSDT',
      entryPrice: null,
      directionLeverage: null,
      currentPnl: null,
      tradesCount: 12,
      score: 65,
      totalPnl: 78.2,
      openPnl: null,
      roi: 3.5,
      profitFactor: 1.35,
      status: 'PAUSED',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'High Volatility',
      winRate: 50.0,
    },
    {
      id: 'bot-010',
      index: 10,
      name: 'AI Momentum G1 #010',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'NEARUSDT',
      entryPrice: 4.82,
      directionLeverage: 'LONG 10x',
      currentPnl: 28.6,
      tradesCount: 17,
      score: 77,
      totalPnl: 195.3,
      openPnl: 28.6,
      roi: 6.9,
      profitFactor: 1.76,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 64.7,
    },
    {
      id: 'bot-011',
      index: 11,
      name: 'AI Momentum G1 #011',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'ADAUSDT',
      entryPrice: null,
      directionLeverage: null,
      currentPnl: null,
      tradesCount: 0,
      score: 0,
      totalPnl: null,
      openPnl: null,
      roi: null,
      profitFactor: null,
      status: 'STOPPED',
      strategy: 'Grid ML',
      generation: 'G1',
      regime: 'Ranging',
      winRate: 0,
    },
    {
      id: 'bot-012',
      index: 12,
      name: 'AI Momentum G1 #012',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'LINKUSDT',
      entryPrice: 12.4,
      directionLeverage: 'LONG 10x',
      currentPnl: 22.1,
      tradesCount: 15,
      score: 80,
      totalPnl: 165.7,
      openPnl: 22.1,
      roi: 7.2,
      profitFactor: 1.9,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 66.7,
    },
    {
      id: 'bot-013',
      index: 13,
      name: 'AI Momentum G1 #013',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'SUIUSDT',
      entryPrice: 1.85,
      directionLeverage: 'LONG 12x',
      currentPnl: 48.9,
      tradesCount: 26,
      score: 89,
      totalPnl: 420.5,
      openPnl: 48.9,
      roi: 15.2,
      profitFactor: 2.65,
      status: 'RUNNING',
      strategy: 'Breakout',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 76.9,
    },
    {
      id: 'bot-014',
      index: 14,
      name: 'AI Momentum G1 #014',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'PEPEUSDT',
      entryPrice: null,
      directionLeverage: null,
      currentPnl: null,
      tradesCount: 14,
      score: 72,
      totalPnl: 110.3,
      openPnl: null,
      roi: 4.8,
      profitFactor: 1.55,
      status: 'PAUSED',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'High Volatility',
      winRate: 57.1,
    },
    {
      id: 'bot-015',
      index: 15,
      name: 'AI Momentum G1 #015',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'APTUSDT',
      entryPrice: 8.9,
      directionLeverage: 'LONG 10x',
      currentPnl: 18.4,
      tradesCount: 11,
      score: 75,
      totalPnl: 132.0,
      openPnl: 18.4,
      roi: 5.9,
      profitFactor: 1.68,
      status: 'RUNNING',
      strategy: 'Mean Reversion',
      generation: 'G1',
      regime: 'Ranging',
      winRate: 63.6,
    },
    {
      id: 'bot-016',
      index: 16,
      name: 'AI Momentum G1 #016',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'FETUSDT',
      entryPrice: 1.34,
      directionLeverage: 'LONG 10x',
      currentPnl: 31.2,
      tradesCount: 20,
      score: 83,
      totalPnl: 260.4,
      openPnl: 31.2,
      roi: 9.8,
      profitFactor: 2.2,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 70.0,
    },
    {
      id: 'bot-017',
      index: 17,
      name: 'AI Momentum G1 #017',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'RENDERUSDT',
      entryPrice: 5.65,
      directionLeverage: 'LONG 10x',
      currentPnl: 15.6,
      tradesCount: 13,
      score: 78,
      totalPnl: 145.8,
      openPnl: 15.6,
      roi: 6.4,
      profitFactor: 1.8,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 61.5,
    },
    {
      id: 'bot-018',
      index: 18,
      name: 'AI Momentum G1 #018',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'INJUSDT',
      entryPrice: 22.8,
      directionLeverage: 'LONG 10x',
      currentPnl: 27.3,
      tradesCount: 19,
      score: 81,
      totalPnl: 230.1,
      openPnl: 27.3,
      roi: 8.7,
      profitFactor: 2.05,
      status: 'RUNNING',
      strategy: 'Breakout',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 68.4,
    },
    {
      id: 'bot-019',
      index: 19,
      name: 'AI Momentum G1 #019',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'SHIBUSDT',
      entryPrice: null,
      directionLeverage: null,
      currentPnl: null,
      tradesCount: 0,
      score: 0,
      totalPnl: null,
      openPnl: null,
      roi: null,
      profitFactor: null,
      status: 'STOPPED',
      strategy: 'Grid ML',
      generation: 'G1',
      regime: 'Ranging',
      winRate: 0,
    },
    {
      id: 'bot-020',
      index: 20,
      name: 'AI Momentum G1 #020',
      accountLabel: 'DEMO - BİNANCE TESTNET - TEST BAKİYESİ',
      coin: 'TONUSDT',
      entryPrice: 5.25,
      directionLeverage: 'LONG 10x',
      currentPnl: 24.8,
      tradesCount: 15,
      score: 80,
      totalPnl: 172.6,
      openPnl: 24.8,
      roi: 7.4,
      profitFactor: 1.92,
      status: 'RUNNING',
      strategy: 'AI Momentum',
      generation: 'G1',
      regime: 'Bullish',
      winRate: 66.7,
    },
  ]);

  // Filter & Sort logic
  const filteredBots = useMemo(() => {
    return bots
      .filter((bot) => {
        if (selectedStatus !== 'ALL' && bot.status !== selectedStatus) return false;
        if (selectedStrategy !== 'ALL' && bot.strategy !== selectedStrategy) return false;
        if (selectedGeneration !== 'ALL' && bot.generation !== selectedGeneration) return false;
        if (selectedRegime !== 'ALL' && bot.regime !== selectedRegime) return false;
        if (minScore === '50+' && bot.score < 50) return false;
        if (minScore === '70+' && bot.score < 70) return false;
        if (minScore === '85+' && bot.score < 85) return false;
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
        if (sortBy === 'score') return b.score - a.score;
        if (sortBy === 'totalPnl') return (b.totalPnl || 0) - (a.totalPnl || 0);
        if (sortBy === 'openPnl') return (b.openPnl || 0) - (a.openPnl || 0);
        if (sortBy === 'tradesCount') return b.tradesCount - a.tradesCount;
        return a.index - b.index;
      });
  }, [bots, selectedStatus, selectedStrategy, selectedGeneration, selectedRegime, minScore, minPnl, sortBy, searchQuery]);

  const activePositionsCount = bots.filter((b) => b.openPnl !== null).length;
  const scoreProducedCount = bots.filter((b) => b.score > 0).length;

  const handleToggleGlobalBots = () => {
    setBotsRunning((prev) => !prev);
  };

  const handleRefresh = () => {
    // Quick score and pnl jitter simulation
    setBots((prev) =>
      prev.map((b) => {
        if (b.status === 'RUNNING' && b.currentPnl !== null) {
          const delta = (Math.random() - 0.48) * 4;
          const newCurrent = Number((b.currentPnl + delta).toFixed(2));
          return {
            ...b,
            currentPnl: newCurrent,
            openPnl: newCurrent,
            totalPnl: Number(((b.totalPnl || 0) + delta * 0.2).toFixed(2)),
          };
        }
        return b;
      })
    );
  };

  return (
    <div id="bot-arena-view" className="w-full space-y-5 animate-in fade-in duration-200">
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
              20 Binance TESTNET botunun skorunu, işlem geçmişini ve sermaye kotasını tek yerden izleyin.
            </p>
          </div>
        </div>

        {/* Global Action Buttons (Matching Screenshot) */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="px-3 py-1.5 rounded-lg bg-[#0b0e11] border border-[#2b3139] text-xs font-bold text-[#848e9c] font-['JetBrains_Mono',monospace]">
            20 TESTNET botu
          </div>

          <button
            id="btn-arena-start-toggle"
            onClick={handleToggleGlobalBots}
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
          {botsRunning
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
            20
          </div>
          <span className="text-[11px] text-[#848e9c]">Sabit filo: 20</span>
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
            0
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
              <option value="ALL">ALL</option>
              <option value="RUNNING">RUNNING</option>
              <option value="STOPPED">STOPPED</option>
              <option value="PAUSED">PAUSED</option>
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
              <option value="ALL">ALL</option>
              <option value="AI Momentum">AI Momentum</option>
              <option value="Mean Reversion">Mean Reversion</option>
              <option value="Breakout">Breakout</option>
              <option value="Grid ML">Grid ML</option>
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
              <option value="ALL">ALL</option>
              <option value="G1">G1</option>
              <option value="G2">G2</option>
              <option value="G3">G3</option>
            </select>
          </div>

          {/* Regime */}
          <div>
            <label className="block text-[10px] font-bold text-[#848e9c] uppercase mb-1">Regime</label>
            <select
              value={selectedRegime}
              onChange={(e) => setSelectedRegime(e.target.value)}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2.5 py-1.5 text-[#eaecef] focus:outline-none focus:border-[#00d2ff] font-medium"
            >
              <option value="ALL">ALL</option>
              <option value="Bullish">Bullish</option>
              <option value="Bearish">Bearish</option>
              <option value="Ranging">Ranging</option>
              <option value="High Volatility">High Volatility</option>
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
                            {bot.tradesCount}
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
                        {bot.score}
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
