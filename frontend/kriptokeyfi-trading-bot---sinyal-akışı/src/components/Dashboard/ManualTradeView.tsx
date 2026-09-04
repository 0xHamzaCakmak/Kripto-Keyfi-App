import React, { useState, useMemo } from 'react';
import { getCoinIcon } from '../CoinIcons';
import {
  Zap,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  SlidersHorizontal,
  DollarSign,
  TrendingUp,
  Filter,
  CheckSquare,
  Square,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Clock,
  Send,
  X,
  Gauge,
  Cpu,
  Coins
} from 'lucide-react';

interface BatchCoinBot {
  id: string;
  index: number;
  symbol: string;
  name: string;
  strategy: string;
  price: number;
  change24h: number;
  score: number;
  status: 'READY' | 'ACTIVE_POSITION' | 'STOPPED' | 'PAUSED';
  currentPosition?: string;
  regime: string;
}

const INITIAL_BOTS_DATA: BatchCoinBot[] = [
  { id: 'bot-001', index: 1, symbol: 'BTCUSDT', name: 'AI Momentum G1 #001', strategy: 'AI Momentum', price: 63840.5, change24h: 3.24, score: 88, status: 'READY', regime: 'Bullish' },
  { id: 'bot-002', index: 2, symbol: 'ETHUSDT', name: 'AI Momentum G1 #002', strategy: 'AI Momentum', price: 3450.2, change24h: 2.15, score: 82, status: 'READY', regime: 'Bullish' },
  { id: 'bot-003', index: 3, symbol: 'SOLUSDT', name: 'AI Momentum G1 #003', strategy: 'AI Momentum', price: 154.2, change24h: 4.80, score: 91, status: 'READY', regime: 'Bullish' },
  { id: 'bot-004', index: 4, symbol: 'BNBUSDT', name: 'AI Momentum G1 #004', strategy: 'Mean Reversion', price: 590.1, change24h: 1.10, score: 79, status: 'READY', regime: 'Ranging' },
  { id: 'bot-005', index: 5, symbol: 'AVAXUSDT', name: 'AI Momentum G1 #005', strategy: 'Breakout', price: 28.4, change24h: 5.40, score: 84, status: 'READY', regime: 'Bullish' },
  { id: 'bot-006', index: 6, symbol: 'XRPUSDT', name: 'AI Momentum G1 #006', strategy: 'AI Momentum', price: 0.582, change24h: -1.20, score: 68, status: 'ACTIVE_POSITION', currentPosition: 'SHORT 8x (PnL: -$14.2)', regime: 'Bearish' },
  { id: 'bot-007', index: 7, symbol: 'NEARUSDT', name: 'AI Momentum G1 #007', strategy: 'AI Momentum', price: 4.82, change24h: 3.75, score: 77, status: 'READY', regime: 'Bullish' },
  { id: 'bot-008', index: 8, symbol: 'SUIUSDT', name: 'AI Momentum G1 #008', strategy: 'Breakout', price: 1.85, change24h: 7.20, score: 89, status: 'READY', regime: 'Bullish' },
  { id: 'bot-009', index: 9, symbol: 'LINKUSDT', name: 'AI Momentum G1 #009', strategy: 'AI Momentum', price: 12.4, change24h: 2.30, score: 80, status: 'READY', regime: 'Bullish' },
  { id: 'bot-010', index: 10, symbol: 'FETUSDT', name: 'AI Momentum G1 #010', strategy: 'AI Momentum', price: 1.34, change24h: 4.10, score: 83, status: 'READY', regime: 'Bullish' },
  { id: 'bot-011', index: 11, symbol: 'RENDERUSDT', name: 'AI Momentum G1 #011', strategy: 'AI Momentum', price: 5.65, change24h: 1.80, score: 78, status: 'READY', regime: 'Bullish' },
  { id: 'bot-012', index: 12, symbol: 'INJUSDT', name: 'AI Momentum G1 #012', strategy: 'Breakout', price: 22.8, change24h: 3.90, score: 81, status: 'READY', regime: 'Bullish' },
  { id: 'bot-013', index: 13, symbol: 'TONUSDT', name: 'AI Momentum G1 #013', strategy: 'AI Momentum', price: 5.25, change24h: 2.60, score: 80, status: 'READY', regime: 'Bullish' },
  { id: 'bot-014', index: 14, symbol: 'APTUSDT', name: 'AI Momentum G1 #014', strategy: 'Mean Reversion', price: 8.9, change24h: 0.90, score: 75, status: 'READY', regime: 'Ranging' },
  { id: 'bot-015', index: 15, symbol: 'DOGEUSDT', name: 'AI Momentum G1 #015', strategy: 'AI Momentum', price: 0.124, change24h: -0.80, score: 65, status: 'PAUSED', regime: 'High Volatility' },
  { id: 'bot-016', index: 16, symbol: 'PEPEUSDT', name: 'AI Momentum G1 #016', strategy: 'AI Momentum', price: 0.0000089, change24h: 1.40, score: 72, status: 'PAUSED', regime: 'High Volatility' },
  { id: 'bot-017', index: 17, symbol: 'ADAUSDT', name: 'AI Momentum G1 #017', strategy: 'Grid ML', price: 0.352, change24h: 0.50, score: 0, status: 'STOPPED', regime: 'Ranging' },
  { id: 'bot-018', index: 18, symbol: 'SHIBUSDT', name: 'AI Momentum G1 #018', strategy: 'Grid ML', price: 0.0000174, change24h: 0.20, score: 0, status: 'STOPPED', regime: 'Ranging' },
  { id: 'bot-019', index: 19, symbol: 'ARBUSDT', name: 'AI Momentum G1 #019', strategy: 'AI Momentum', price: 0.54, change24h: 1.90, score: 74, status: 'READY', regime: 'Bullish' },
  { id: 'bot-020', index: 20, symbol: 'OPUSDT', name: 'AI Momentum G1 #020', strategy: 'AI Momentum', price: 1.42, change24h: 2.80, score: 76, status: 'READY', regime: 'Bullish' },
];

export const ManualTradeView: React.FC = () => {
  // Main Tab: 'single' (Tek Coin) vs 'batch' (Botlara Toplu İşlem)
  const [activeTab, setActiveTab] = useState<'batch' | 'single'>('batch');

  // --- BATCH TRADING STATE ---
  const [selectedAccount, setSelectedAccount] = useState<string>('binance-test');
  const [batchSide, setBatchSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [botMargin, setBotMargin] = useState<number>(100);
  const [batchLeverage, setBatchLeverage] = useState<number>(5);
  const [batchSlPercent, setBatchSlPercent] = useState<number>(10);
  const [batchTpPercent, setBatchTpPercent] = useState<number>(2);

  // Selected Coins / Bots (Set of Bot IDs)
  const [selectedBotIds, setSelectedBotIds] = useState<Set<string>>(
    () => new Set(['bot-001', 'bot-002', 'bot-003', 'bot-004', 'bot-005', 'bot-007', 'bot-008', 'bot-009', 'bot-010', 'bot-011', 'bot-012', 'bot-013'])
  );

  // Filter state for coin list
  const [coinFilter, setCoinFilter] = useState<'ALL' | 'READY_ONLY' | 'HIGH_SCORE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal / Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionProgress, setExecutionProgress] = useState<number>(0);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [showSuccessBanner, setShowSuccessBanner] = useState<boolean>(false);

  // --- SINGLE COIN STATE ---
  const [singleSymbol, setSingleSymbol] = useState<string>('BTCUSDT');
  const [singleSide, setSingleSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [singleOrderType, setSingleOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP_MARKET'>('MARKET');
  const [singlePrice, setSinglePrice] = useState<string>('63840.50');
  const [singleAmountUSDT, setSingleAmountUSDT] = useState<string>('500');
  const [singleLeverage, setSingleLeverage] = useState<number>(10);
  const [singleTpPercent, setSingleTpPercent] = useState<string>('3.5');
  const [singleSlPercent, setSingleSlPercent] = useState<string>('1.5');
  const [singleSubmitted, setSingleSubmitted] = useState<boolean>(false);

  // Available Balance simulation
  const availableBalanceUSDT = 10248.50;

  // Filtered bots list
  const filteredBots = useMemo(() => {
    return INITIAL_BOTS_DATA.filter((bot) => {
      if (coinFilter === 'READY_ONLY' && bot.status !== 'READY') return false;
      if (coinFilter === 'HIGH_SCORE' && bot.score < 80) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return bot.symbol.toLowerCase().includes(q) || bot.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [coinFilter, searchQuery]);

  // Eligible Bots for campaign (those with status 'READY')
  const eligibleBots = useMemo(() => {
    return INITIAL_BOTS_DATA.filter((b) => b.status === 'READY');
  }, []);

  // Toggle single bot selection
  const handleToggleBot = (botId: string) => {
    const next = new Set(selectedBotIds);
    if (next.has(botId)) {
      next.delete(botId);
    } else {
      next.add(botId);
    }
    setSelectedBotIds(next);
  };

  // Select all eligible
  const handleSelectAllEligible = () => {
    const next = new Set(eligibleBots.map((b) => b.id));
    setSelectedBotIds(next);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedBotIds(new Set());
  };

  // Calculations for batch
  const selectedCount = selectedBotIds.size;
  const totalRequiredMargin = selectedCount * botMargin;
  const totalNotionalValue = totalRequiredMargin * batchLeverage;
  const estimatedTpGain = totalNotionalValue * (batchTpPercent / 100);
  const estimatedSlLoss = totalNotionalValue * (batchSlPercent / 100);
  const hasEnoughBalance = totalRequiredMargin <= availableBalanceUSDT;

  // Execute Batch Orders
  const handleExecuteBatchCampaign = () => {
    setIsPreviewOpen(false);
    setIsExecuting(true);
    setExecutionProgress(0);
    setExecutionLog([]);

    const selectedBotsList = INITIAL_BOTS_DATA.filter((b) => selectedBotIds.has(b.id));
    let step = 0;
    const interval = setInterval(() => {
      if (step < selectedBotsList.length) {
        const currentBot = selectedBotsList[step];
        const logMsg = `✓ [${currentBot.symbol}] ${currentBot.name} -> ${batchSide} ${batchLeverage}x (${botMargin} USDT) Market emri iletildi · SL: %${batchSlPercent} TP: %${batchTpPercent}`;
        setExecutionLog((prev) => [...prev, logMsg]);
        step++;
        setExecutionProgress(Math.round((step / selectedBotsList.length) * 100));
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsExecuting(false);
          setShowSuccessBanner(true);
          setTimeout(() => setShowSuccessBanner(false), 5000);
        }, 600);
      }
    }, 200);
  };

  // Single Order Submit
  const handleSingleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSingleSubmitted(true);
    setTimeout(() => setSingleSubmitted(false), 4000);
  };

  const parsedSinglePrice = parseFloat(singlePrice) || 63840;
  const parsedSingleAmount = parseFloat(singleAmountUSDT) || 0;
  const singleMarginRequired = (parsedSingleAmount / singleLeverage).toFixed(2);
  const singleCoinAmount = (parsedSingleAmount / parsedSinglePrice).toFixed(4);

  return (
    <div id="manual-trade-view" className="w-full space-y-5 animate-in fade-in duration-200 pb-20">
      {/* 1. TOP HEADER (TRADING BOT / FAZ 3) */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#f0b90b]/40 flex items-center justify-center text-[#f0b90b] shadow-[0_0_20px_rgba(240,185,11,0.25)] flex-shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-[#f0b90b] tracking-wider uppercase">
                  TRADİNG BOT / FAZ 3
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#02c076] animate-pulse" />
                  GO TRADING ENGINE AKTİF
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Manuel Testnet İşlemi
              </h1>
              <p className="text-xs text-[#848e9c] mt-0.5">
                Manuel yeni girişler USDC vadeli paritelerinde açılır; USDT sermayesi botlara ayrılmış kalır. Emri önce inceleyin, ardından açıkça onaylayın.
              </p>
            </div>
          </div>

          {/* Quick Account Telemetry */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 bg-[#0b0e11] rounded-xl border border-[#2b3139] text-right">
              <div className="text-[10px] text-[#848e9c]">Kullanılabilir Bakiye</div>
              <div className="text-sm font-bold text-[#02c076] font-['JetBrains_Mono',monospace]">
                ${availableBalanceUSDT.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
              </div>
            </div>
            <div className="px-3.5 py-2 bg-[#0b0e11] rounded-xl border border-[#2b3139] text-right">
              <div className="text-[10px] text-[#848e9c]">Eğitilmiş Bot Filosu</div>
              <div className="text-sm font-bold text-[#f0b90b] font-['JetBrains_Mono',monospace]">
                20 Bot (1. Nesil)
              </div>
            </div>
          </div>
        </div>

        {/* 2. SUB-TAB SWITCHER (Tek Coin vs Botlara Toplu İşlem) */}
        <div className="flex gap-3 pt-2 border-t border-[#2b3139]">
          <button
            id="tab-single-coin"
            onClick={() => setActiveTab('single')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'single'
                ? 'bg-[#f0b90b] text-[#0b0e11] shadow-[0_0_15px_rgba(240,185,11,0.3)]'
                : 'bg-[#0b0e11] text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139]'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Tek Coin Manuel İşlem</span>
          </button>

          <button
            id="tab-batch-bots"
            onClick={() => setActiveTab('batch')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'batch'
                ? 'bg-[#f0b90b] text-[#0b0e11] shadow-[0_0_15px_rgba(240,185,11,0.3)]'
                : 'bg-[#0b0e11] text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139]'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Botlara Toplu İşlem</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-black/30 font-extrabold">20 BOT</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {showSuccessBanner && (
        <div className="p-4 bg-[#02c076]/15 border border-[#02c076]/40 rounded-2xl text-[#02c076] text-xs font-bold flex items-center gap-3 shadow-xl animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-extrabold text-sm block">Toplu Emir Kampanyası Başarıyla İletildi!</span>
            <span>Seçili botlar piyasa fiyatından pozisyonları açtı. Stop-Loss (%{batchSlPercent}) ve Take-Profit (%{batchTpPercent}) emirleri borsaya kaydedildi.</span>
          </div>
        </div>
      )}

      {/* Execution Progress Overlay */}
      {isExecuting && (
        <div className="bg-[#1e2329] border border-[#00d2ff]/40 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 border-2 border-[#00d2ff] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-bold text-[#eaecef]">
                Go Trading Engine: Toplu Market Emirleri İletiliyor...
              </span>
            </div>
            <span className="text-xs font-bold text-[#00d2ff] font-['JetBrains_Mono',monospace]">
              %{executionProgress}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-[#0b0e11] rounded-full overflow-hidden border border-[#2b3139]">
            <div
              className="h-full bg-gradient-to-r from-[#00d2ff] to-[#02c076] transition-all duration-200"
              style={{ width: `${executionProgress}%` }}
            />
          </div>

          {/* Realtime execution log terminal */}
          <div className="bg-[#0b0e11] rounded-xl p-3 max-h-40 overflow-y-auto space-y-1 font-['JetBrains_Mono',monospace] text-[11px] text-[#848e9c] border border-[#2b3139]">
            {executionLog.map((log, idx) => (
              <div key={idx} className="text-[#02c076] animate-in fade-in duration-100">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW A: BOTLARA TOPLU İŞLEM (BATCH ORDER CAMPAIGN)       */}
      {/* ======================================================== */}
      {activeTab === 'batch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT 5 COLS: PARAMETERS & ENGINE SETTINGS */}
          <div className="lg:col-span-5 bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 flex flex-col justify-between">
            <div className="space-y-5">
              {/* Box Title */}
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#2b3139]">
                <div className="w-8 h-8 rounded-lg bg-[#0b0e11] border border-[#f0b90b]/30 flex items-center justify-center text-[#f0b90b]">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#eaecef]">
                    Botlara toplu manuel işlem
                  </h2>
                  <p className="text-[11px] text-[#848e9c]">
                    Yönü siz belirlersiniz; her botun emri yine risk, bakiye, Binance onayı ve pozisyon doğrulamasından geçer. Girişten sonra bot TP/SL yönetimini devralır.
                  </p>
                </div>
              </div>

              {/* Form Grid */}
              <div className="space-y-4">
                {/* 1. Binance TESTNET Hesabı */}
                <div>
                  <label className="block text-xs font-semibold text-[#848e9c] mb-1.5">
                    Binance TESTNET hesabı
                  </label>
                  <select
                    id="batch-account-select"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none transition-colors"
                  >
                    <option value="binance-test">Binance Test · BINANCE TESTNET · GO</option>
                    <option value="binance-live">Binance Live · BINANCE LIVE (Futures)</option>
                    <option value="bybit-main">Bybit Unified · BYBIT MAINNET</option>
                  </select>
                </div>

                {/* 2. Yön: LONG / SHORT */}
                <div>
                  <label className="block text-xs font-semibold text-[#848e9c] mb-1.5">
                    Yön
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      id="btn-batch-long"
                      onClick={() => setBatchSide('LONG')}
                      className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                        batchSide === 'LONG'
                          ? 'bg-[#02c076]/20 border-[#02c076] text-[#02c076] shadow-[0_0_15px_rgba(2,192,118,0.25)]'
                          : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>LONG</span>
                    </button>

                    <button
                      type="button"
                      id="btn-batch-short"
                      onClick={() => setBatchSide('SHORT')}
                      className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                        batchSide === 'SHORT'
                          ? 'bg-[#f84960]/20 border-[#f84960] text-[#f84960] shadow-[0_0_15px_rgba(248,73,96,0.25)]'
                          : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c] hover:text-[#eaecef]'
                      }`}
                    >
                      <ArrowDownRight className="w-4 h-4" />
                      <span>SHORT</span>
                    </button>
                  </div>
                </div>

                {/* 3. Bot Başına Başlangıç Teminatı (USDT) & Kaldıraç */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#848e9c] mb-1.5">
                      Bot başına başlangıç teminatı (USDT)
                    </label>
                    <input
                      id="field-bot-margin"
                      type="number"
                      value={botMargin}
                      onChange={(e) => setBotMargin(Math.max(10, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-xs font-bold font-['JetBrains_Mono',monospace] focus:outline-none"
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      {[50, 100, 200, 500].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setBotMargin(val)}
                          className="px-2 py-0.5 bg-[#0b0e11] hover:bg-[#2b3139] border border-[#2b3139] rounded text-[10px] font-bold text-[#848e9c] hover:text-[#eaecef]"
                        >
                          ${val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#848e9c] mb-1.5">
                      Kaldıraç · 5x-20x
                    </label>
                    <input
                      id="field-batch-leverage"
                      type="number"
                      min="1"
                      max="20"
                      value={batchLeverage}
                      onChange={(e) => setBatchLeverage(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f0b90b] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-xs font-bold font-['JetBrains_Mono',monospace] focus:outline-none"
                    />
                    <div className="flex gap-1.5 mt-1.5">
                      {[5, 10, 15, 20].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setBatchLeverage(val)}
                          className="px-2 py-0.5 bg-[#0b0e11] hover:bg-[#2b3139] border border-[#2b3139] rounded text-[10px] font-bold text-[#848e9c] hover:text-[#eaecef]"
                        >
                          {val}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Stop-loss (%) & Net Kâr Hedefi (%) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#f84960] mb-1.5">
                      Stop-loss fiyat hareketi (%)
                    </label>
                    <input
                      id="field-batch-sl"
                      type="number"
                      step="0.5"
                      value={batchSlPercent}
                      onChange={(e) => setBatchSlPercent(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#f84960] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-xs font-bold font-['JetBrains_Mono',monospace] focus:outline-none"
                    />
                    <span className="text-[10px] text-[#848e9c] mt-0.5 block">Borsada otomatik SL emri</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#02c076] mb-1.5">
                      Net kâr hedefi fiyat hareketi (%)
                    </label>
                    <input
                      id="field-batch-tp"
                      type="number"
                      step="0.5"
                      value={batchTpPercent}
                      onChange={(e) => setBatchTpPercent(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#02c076] text-[#eaecef] rounded-xl px-3.5 py-2.5 text-xs font-bold font-['JetBrains_Mono',monospace] focus:outline-none"
                    />
                    <span className="text-[10px] text-[#848e9c] mt-0.5 block">Borsada otomatik TP emri</span>
                  </div>
                </div>

                {/* 5. Warning & Engine Rules Card */}
                <div className="p-3.5 bg-[#0b0e11] rounded-xl border border-[#2b3139] text-xs text-[#848e9c] leading-relaxed">
                  Mevcut pozisyonu olan, durdurulmuş veya bekleyen talimatı bulunan botlar güvenli biçimde atlanır. Manuel pozisyon kapanana kadar o botta otomatik yeni giriş yapılmaz; pozisyon yönetimi ve TP/SL çalışmaya devam eder.
                </div>
              </div>
            </div>

            {/* Campaign Metrics Summary Bar */}
            <div className="pt-4 border-t border-[#2b3139] space-y-2.5 text-xs font-['JetBrains_Mono',monospace]">
              <div className="flex justify-between">
                <span className="text-[#848e9c]">Seçili Uygun Bot:</span>
                <span className="text-[#eaecef] font-bold">{selectedCount} Bot</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#848e9c]">Toplam Teminat Gideri:</span>
                <span className="text-[#f0b90b] font-bold">${totalRequiredMargin.toLocaleString()} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#848e9c]">Toplam Kaldıraçlı Hacim:</span>
                <span className="text-[#00d2ff] font-bold">${totalNotionalValue.toLocaleString()} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#848e9c]">Tahmini Kâr (TP %{batchTpPercent}):</span>
                <span className="text-[#02c076] font-bold">+${estimatedTpGain.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#848e9c]">Maksimum Risk (SL %{batchSlPercent}):</span>
                <span className="text-[#f84960] font-bold">-${estimatedSlLoss.toFixed(2)} USDT</span>
              </div>
            </div>
          </div>

          {/* RIGHT 7 COLS: COIN SELECTION LIST & LAUNCH */}
          <div className="lg:col-span-7 bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header & Subtitle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2b3139]">
                <div>
                  <h2 className="text-base font-bold text-[#eaecef]">
                    İşleme alınacak coinler
                  </h2>
                  <p className="text-xs text-[#848e9c] mt-0.5">
                    Kullanılabilir bakiye: <strong className="text-[#02c076] font-mono">${availableBalanceUSDT.toLocaleString()} USDT</strong> · {selectedCount}/{eligibleBots.length} uygun coin seçili
                  </p>
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-select-all-eligible"
                    onClick={handleSelectAllEligible}
                    className="px-3 py-1.5 bg-[#0b0e11] hover:bg-[#2b3139] border border-[#2b3139] rounded-xl text-xs font-bold text-[#eaecef] transition-colors flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-[#02c076]" />
                    <span>Tüm uygun coinleri seç</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-2.5 py-1.5 bg-[#0b0e11] hover:bg-[#2b3139] border border-[#2b3139] rounded-xl text-xs font-medium text-[#848e9c] hover:text-[#eaecef] transition-colors"
                  >
                    Temizle
                  </button>
                </div>
              </div>

              {/* Search & Filter bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    placeholder="Coin veya bot ara (BTC, SOL, AI Momentum...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl pl-3.5 pr-3 py-2 text-xs text-[#eaecef] placeholder-[#848e9c] focus:outline-none focus:border-[#f0b90b]"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  {(['ALL', 'READY_ONLY', 'HIGH_SCORE'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCoinFilter(f)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                        coinFilter === f
                          ? 'bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30'
                          : 'bg-[#0b0e11] text-[#848e9c] border border-[#2b3139] hover:text-[#eaecef]'
                      }`}
                    >
                      {f === 'ALL' ? 'Tümü (20)' : f === 'READY_ONLY' ? 'Sadece Boştakiler' : 'Skor 80+'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot / Coin Selection Cards List */}
              <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-[#2b3139]">
                {filteredBots.map((bot) => {
                  const isSelected = selectedBotIds.has(bot.id);
                  const isEligible = bot.status === 'READY';

                  return (
                    <div
                      key={bot.id}
                      onClick={() => isEligible && handleToggleBot(bot.id)}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        !isEligible
                          ? 'bg-[#0b0e11]/50 border-[#2b3139]/40 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#f0b90b]/10 border-[#f0b90b]/60 shadow-[0_0_12px_rgba(240,185,11,0.15)] cursor-pointer'
                          : 'bg-[#0b0e11] border-[#2b3139] hover:border-[#848e9c] cursor-pointer'
                      }`}
                    >
                      {/* Left: Checkbox & Coin Info */}
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-[#f0b90b]" />
                          ) : (
                            <Square className="w-5 h-5 text-[#848e9c]" />
                          )}
                        </div>

                        <div className="w-8 h-8 rounded-lg bg-[#1e2329] border border-[#2b3139] flex items-center justify-center flex-shrink-0">
                          {getCoinIcon(bot.symbol, 18)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#eaecef] font-['JetBrains_Mono',monospace]">
                              {bot.symbol}
                            </span>
                            <span className="text-[11px] font-bold text-[#848e9c]">
                              ${bot.price < 1 ? bot.price.toFixed(4) : bot.price.toLocaleString()}
                            </span>
                            <span
                              className={`text-[10px] font-bold font-mono ${
                                bot.change24h >= 0 ? 'text-[#02c076]' : 'text-[#f84960]'
                              }`}
                            >
                              {bot.change24h >= 0 ? '+' : ''}
                              {bot.change24h}%
                            </span>
                          </div>
                          <div className="text-[10px] text-[#848e9c] flex items-center gap-1.5 mt-0.5">
                            <span>{bot.name}</span>
                            <span>·</span>
                            <span>{bot.strategy}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Bot Status & Score */}
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          {bot.status === 'READY' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">
                              Hazır / Boşta
                            </span>
                          ) : bot.status === 'ACTIVE_POSITION' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30">
                              {bot.currentPosition}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f84960]/15 text-[#f84960] border border-[#f84960]/30">
                              Durduruldu
                            </span>
                          )}
                          <div className="text-[10px] text-[#848e9c] font-mono mt-0.5">
                            Kota: ${botMargin} USDT × {batchLeverage}x
                          </div>
                        </div>

                        <div className="w-9 h-9 rounded-lg bg-[#1e2329] border border-[#2b3139] flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-[9px] text-[#848e9c] leading-none">SCORE</span>
                          <span className="text-xs font-bold text-[#00d2ff] font-mono leading-none mt-0.5">
                            {bot.score}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="pt-4 border-t border-[#2b3139] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-[#848e9c]">
                {selectedCount > 0 ? (
                  <span>
                    <strong className="text-[#eaecef] font-bold">{selectedCount}</strong> bot için toplam <strong className="text-[#f0b90b] font-bold">${totalRequiredMargin} USDT</strong> teminat ayrılacak.
                  </span>
                ) : (
                  <span className="text-[#f84960]">Lütfen işleme dahil etmek için en az bir bot seçin.</span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  id="btn-preview-campaign"
                  onClick={() => setIsPreviewOpen(true)}
                  disabled={selectedCount === 0 || !hasEnoughBalance || isExecuting}
                  className="px-5 py-2.5 bg-[#f0b90b]/15 hover:bg-[#f0b90b]/25 border border-[#f0b90b]/40 text-[#f0b90b] text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Kampanyayı Önizle</span>
                </button>

                <button
                  type="button"
                  id="btn-launch-batch-campaign"
                  onClick={handleExecuteBatchCampaign}
                  disabled={selectedCount === 0 || !hasEnoughBalance || isExecuting}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                    batchSide === 'LONG'
                      ? 'bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] shadow-[0_0_20px_rgba(2,192,118,0.4)]'
                      : 'bg-[#f84960] hover:bg-[#f84960]/90 text-white shadow-[0_0_20px_rgba(248,73,96,0.4)]'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {batchSide} Kampanyasını Başlat ({selectedCount} Bot)
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW B: TEK COIN MANUEL İŞLEM (SINGLE TERMINAL)          */}
      {/* ======================================================== */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 2 Cols: Order Form & Settings */}
          <div className="lg:col-span-2 bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            {singleSubmitted && (
              <div className="p-3.5 bg-[#02c076]/15 border border-[#02c076]/40 rounded-xl text-[#02c076] text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Emir başarıyla Binance Testnet motoruna iletildi! Pozisyonlar sekmesinden anlık takip edebilirsiniz.</span>
              </div>
            )}

            {/* Pair Selector & Side Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-[#2b3139]">
              {/* Symbol Switcher */}
              <div className="flex items-center gap-2">
                <select
                  value={singleSymbol}
                  onChange={(e) => setSingleSymbol(e.target.value)}
                  className="bg-[#0b0e11] border border-[#2b3139] text-[#eaecef] text-sm font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-[#f0b90b]"
                >
                  <option value="BTCUSDT">BTCUSDT (Bitcoin)</option>
                  <option value="ETHUSDT">ETHUSDT (Ethereum)</option>
                  <option value="SOLUSDT">SOLUSDT (Solana)</option>
                  <option value="XRPUSDT">XRPUSDT (Ripple)</option>
                  <option value="BNBUSDT">BNBUSDT (BNB)</option>
                  <option value="AVAXUSDT">AVAXUSDT (Avalanche)</option>
                </select>
                <span className="text-xs font-bold text-[#02c076] font-['JetBrains_Mono',monospace]">
                  $63,840.50 (+3.24%)
                </span>
              </div>

              {/* LONG / SHORT Toggle */}
              <div className="flex items-center bg-[#0b0e11] p-1 rounded-xl border border-[#2b3139]">
                <button
                  type="button"
                  onClick={() => setSingleSide('LONG')}
                  className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    singleSide === 'LONG'
                      ? 'bg-[#02c076] text-[#0b0e11] shadow-[0_0_12px_rgba(2,192,118,0.4)]'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>LONG (Alış)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSingleSide('SHORT')}
                  className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    singleSide === 'SHORT'
                      ? 'bg-[#f84960] text-white shadow-[0_0_12px_rgba(248,73,96,0.4)]'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>SHORT (Satış)</span>
                </button>
              </div>
            </div>

            {/* Order Type Tabs */}
            <div className="flex gap-2">
              {(['MARKET', 'LIMIT', 'STOP_MARKET'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSingleOrderType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    singleOrderType === t
                      ? 'bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/40'
                      : 'bg-[#0b0e11] text-[#848e9c] border border-[#2b3139] hover:text-[#eaecef]'
                  }`}
                >
                  {t === 'MARKET' ? 'Piyasa (Market)' : t === 'LIMIT' ? 'Limit Emir' : 'Stop Limit'}
                </button>
              ))}
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSingleOrderSubmit} className="space-y-4 text-xs">
              {singleOrderType !== 'MARKET' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#848e9c] uppercase mb-1">
                    Emir Fiyatı (USDT)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={singlePrice}
                    onChange={(e) => setSinglePrice(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-[#eaecef] font-['JetBrains_Mono',monospace] text-sm focus:outline-none focus:border-[#f0b90b]"
                  />
                </div>
              )}

              {/* Position Size (USDT) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-[#848e9c] uppercase">Pozisyon Büyüklüğü (USDT)</label>
                  <span className="text-[#848e9c] font-['JetBrains_Mono',monospace]">≈ {singleCoinAmount} {singleSymbol.replace('USDT', '')}</span>
                </div>
                <input
                  type="number"
                  value={singleAmountUSDT}
                  onChange={(e) => setSingleAmountUSDT(e.target.value)}
                  className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-[#eaecef] font-['JetBrains_Mono',monospace] text-sm focus:outline-none focus:border-[#f0b90b]"
                />

                {/* Quick % buttons */}
                <div className="flex gap-2 mt-2">
                  {[100, 250, 500, 1000, 2500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSingleAmountUSDT(val.toString())}
                      className="flex-1 py-1 bg-[#0b0e11] hover:bg-[#2b3139] border border-[#2b3139] rounded-lg text-[10px] font-bold text-[#848e9c] hover:text-[#eaecef] font-['JetBrains_Mono',monospace]"
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Leverage Slider */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-[#848e9c] uppercase">Kaldıraç Çarpanı</label>
                  <span className="text-[#00d2ff] font-bold font-['JetBrains_Mono',monospace] text-sm">
                    {singleLeverage}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={singleLeverage}
                  onChange={(e) => setSingleLeverage(Number(e.target.value))}
                  className="w-full accent-[#00d2ff] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#848e9c] font-['JetBrains_Mono',monospace] mt-1">
                  <span>1x</span>
                  <span>10x</span>
                  <span>20x</span>
                  <span>35x</span>
                  <span>50x Max</span>
                </div>
              </div>

              {/* Take Profit & Stop Loss */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#02c076] uppercase mb-1">
                    Kâr Al (TP %{singleTpPercent})
                  </label>
                  <div className="p-2.5 bg-[#0b0e11] rounded-xl border border-[#2b3139] font-['JetBrains_Mono',monospace]">
                    <span className="text-[10px] text-[#848e9c] block">Tetik Fiyatı</span>
                    <span className="text-xs font-bold text-[#02c076]">
                      ${singleSide === 'LONG'
                        ? (parsedSinglePrice * (1 + (parseFloat(singleTpPercent) || 0) / 100)).toFixed(2)
                        : (parsedSinglePrice * (1 - (parseFloat(singleTpPercent) || 0) / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#f84960] uppercase mb-1">
                    Stop Loss (SL %{singleSlPercent})
                  </label>
                  <div className="p-2.5 bg-[#0b0e11] rounded-xl border border-[#2b3139] font-['JetBrains_Mono',monospace]">
                    <span className="text-[10px] text-[#848e9c] block">Tetik Fiyatı</span>
                    <span className="text-xs font-bold text-[#f84960]">
                      ${singleSide === 'LONG'
                        ? (parsedSinglePrice * (1 - (parseFloat(singleSlPercent) || 0) / 100)).toFixed(2)
                        : (parsedSinglePrice * (1 + (parseFloat(singleSlPercent) || 0) / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg mt-4 ${
                  singleSide === 'LONG'
                    ? 'bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] shadow-[0_0_20px_rgba(2,192,118,0.4)]'
                    : 'bg-[#f84960] hover:bg-[#f84960]/90 text-white shadow-[0_0_20px_rgba(248,73,96,0.4)]'
                }`}
              >
                {singleSide === 'LONG' ? `LONG ${singleSymbol} Aç (${singleLeverage}x)` : `SHORT ${singleSymbol} Aç (${singleLeverage}x)`}
              </button>
            </form>
          </div>

          {/* Right Col: Order Summary & Live Risk Calculator */}
          <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold text-[#eaecef] uppercase tracking-wider pb-3 border-b border-[#2b3139] mb-4">
                Emir & Marjin Önizlemesi
              </h3>

              <div className="space-y-3 text-xs font-['JetBrains_Mono',monospace]">
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">İşlem Yönü:</span>
                  <span className={`font-bold ${singleSide === 'LONG' ? 'text-[#02c076]' : 'text-[#f84960]'}`}>
                    {singleSide} {singleLeverage}x
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Giriş Fiyatı:</span>
                  <span className="text-[#eaecef] font-bold">${parsedSinglePrice.toLocaleString()}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Toplam Değer:</span>
                  <span className="text-[#eaecef] font-bold">${parsedSingleAmount.toLocaleString()} USDT</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Gerekli Teminat (Marjin):</span>
                  <span className="text-[#00d2ff] font-bold">${singleMarginRequired} USDT</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Tahmini Likidasyon:</span>
                  <span className="text-[#f84960] font-bold">
                    ${singleSide === 'LONG' ? (parsedSinglePrice * 0.91).toFixed(2) : (parsedSinglePrice * 1.09).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Tahmini Kâr (TP):</span>
                  <span className="text-[#02c076] font-bold">+${((parsedSingleAmount * (parseFloat(singleTpPercent) || 0)) / 100).toFixed(2)} USDT</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Tahmini Risk (SL):</span>
                  <span className="text-[#f84960] font-bold">-${((parsedSingleAmount * (parseFloat(singleSlPercent) || 0)) / 100).toFixed(2)} USDT</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#0b0e11] rounded-xl border border-[#2b3139] text-[11px] text-[#848e9c]">
              <span className="text-[#f0b90b] font-bold block mb-1">🛡️ Akıllı Risk Filtresi:</span>
              Manuel açılan pozisyonlar da genel hesap risk limitlerine tabidir. Günlük max drawdown aşıldığında sistem otomatik stop uygular.
            </div>
          </div>
        </div>
      )}

      {/* 3. BATCH CAMPAIGN PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2b3139]">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#f0b90b]" />
                <h3 className="text-base font-bold text-[#eaecef]">
                  Toplu Manuel Emir Kampanyası Önizlemesi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-[#848e9c] hover:text-[#eaecef] p-1 rounded-lg hover:bg-[#0b0e11]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campaign Key Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0b0e11] p-3 rounded-xl border border-[#2b3139]">
                <div className="text-[10px] text-[#848e9c]">İşlem Yönü</div>
                <div className={`text-sm font-bold ${batchSide === 'LONG' ? 'text-[#02c076]' : 'text-[#f84960]'}`}>
                  {batchSide} {batchLeverage}x
                </div>
              </div>

              <div className="bg-[#0b0e11] p-3 rounded-xl border border-[#2b3139]">
                <div className="text-[10px] text-[#848e9c]">Seçili Bot Sayısı</div>
                <div className="text-sm font-bold text-[#eaecef] font-mono">
                  {selectedCount} Bot
                </div>
              </div>

              <div className="bg-[#0b0e11] p-3 rounded-xl border border-[#2b3139]">
                <div className="text-[10px] text-[#848e9c]">Toplam Teminat</div>
                <div className="text-sm font-bold text-[#f0b90b] font-mono">
                  ${totalRequiredMargin} USDT
                </div>
              </div>

              <div className="bg-[#0b0e11] p-3 rounded-xl border border-[#2b3139]">
                <div className="text-[10px] text-[#848e9c]">Kaldıraçlı Notional</div>
                <div className="text-sm font-bold text-[#00d2ff] font-mono">
                  ${totalNotionalValue} USDT
                </div>
              </div>
            </div>

            {/* Selected Bots Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#848e9c] uppercase">Emir Gönderilecek Coinler:</div>
              <div className="max-h-48 overflow-y-auto bg-[#0b0e11] rounded-xl border border-[#2b3139] p-2 space-y-1.5 font-['JetBrains_Mono',monospace] text-xs">
                {INITIAL_BOTS_DATA.filter((b) => selectedBotIds.has(b.id)).map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-1.5 rounded bg-[#1e2329]/50">
                    <div className="flex items-center gap-2">
                      {getCoinIcon(b.symbol, 14)}
                      <span className="font-bold text-[#eaecef]">{b.symbol}</span>
                      <span className="text-[10px] text-[#848e9c]">({b.name})</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-[#848e9c]">${b.price}</span>
                      <span className="text-[#f0b90b] font-bold">${botMargin} USDT</span>
                      <span className="text-[#02c076]">TP +%{batchTpPercent}</span>
                      <span className="text-[#f84960]">SL -%{batchSlPercent}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Safety Verification */}
            <div className="p-3 bg-[#0b0e11] rounded-xl border border-[#2b3139] text-xs text-[#848e9c] flex items-start gap-2">
              <Info className="w-4 h-4 text-[#f0b90b] flex-shrink-0 mt-0.5" />
              <span>
                Emirler piyasa (MARKET) emri olarak Binance Testnet motoruna sırayla iletilecektir. Pozisyon açıldığında algoritmik bot TP/SL yönetimini devralacaktır.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2b3139]">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-[#0b0e11] hover:bg-[#2b3139] text-[#eaecef] text-xs font-bold rounded-xl border border-[#2b3139] transition-all"
              >
                Vazgeç
              </button>

              <button
                type="button"
                id="btn-confirm-launch-campaign"
                onClick={handleExecuteBatchCampaign}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 ${
                  batchSide === 'LONG'
                    ? 'bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] shadow-[0_0_15px_rgba(2,192,118,0.4)]'
                    : 'bg-[#f84960] hover:bg-[#f84960]/90 text-white shadow-[0_0_15px_rgba(248,73,96,0.4)]'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Onayla ve Kampanyayı Başlat</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
