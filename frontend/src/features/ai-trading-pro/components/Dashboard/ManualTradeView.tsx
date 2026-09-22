import { ManualBatchPanel } from './ManualBatchPanel';
import React, { useEffect, useState, useMemo } from 'react';
import { getCoinIcon } from '../CoinIcons';
import { getApiErrorMessage } from '../../../../services/apiClient';
import { confirmManualOrder, getManualSymbolPrice, getManualTradingSymbols, previewManualOrder, type ManualOrderPreview, type ManualTradingSymbol } from '../../services/backendDashboard';
import {
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Layers,
  X,
  Coins
} from 'lucide-react';

export const ManualTradeView: React.FC<{ accountId: string | null; accountName?: string; accountType?: string }> = ({ accountId, accountName, accountType }) => {
  // Main Tab: 'single' (Tek Coin) vs 'batch' (Toplu Manuel İşlem)
  const [activeTab, setActiveTab] = useState<'batch' | 'single'>('single');

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
  const [singleSymbols, setSingleSymbols] = useState<ManualTradingSymbol[]>([]);
  const [singleMarkPrice, setSingleMarkPrice] = useState<string>('');
  const [singleLoading, setSingleLoading] = useState<boolean>(false);
  const [singleWorking, setSingleWorking] = useState<boolean>(false);
  const [singleError, setSingleError] = useState<string>('');
  const [singlePreview, setSinglePreview] = useState<ManualOrderPreview | null>(null);
  const selectedSingleRule = useMemo(() => singleSymbols.find((item) => item.symbol === singleSymbol), [singleSymbols, singleSymbol]);

  useEffect(() => {
    if (!accountId || accountType === 'SPOT') {
      setSingleSymbols([]); setSingleMarkPrice(''); setSinglePreview(null);
      return;
    }
    let active = true;
    setSingleLoading(true); setSingleError(''); setSinglePreview(null);
    getManualTradingSymbols(accountId).then((symbols) => {
      if (!active) return;
      setSingleSymbols(symbols);
      setSingleSymbol((current) => symbols.some((item) => item.symbol === current) ? current : (symbols[0]?.symbol ?? ''));
    }).catch((error) => {
      if (active) setSingleError(getApiErrorMessage(error, 'Vadeli parite listesi alınamadı.'));
    }).finally(() => { if (active) setSingleLoading(false); });
    return () => { active = false; };
  }, [accountId, accountType]);

  useEffect(() => {
    if (!accountId || !singleSymbol || accountType === 'SPOT') { setSingleMarkPrice(''); return; }
    let active = true;
    setSingleMarkPrice(''); setSingleError('');
    getManualSymbolPrice(accountId, singleSymbol).then((result) => {
      if (!active) return;
      setSingleMarkPrice(result.markPrice);
      setSinglePrice(result.markPrice);
    }).catch((error) => {
      if (active) setSingleError(getApiErrorMessage(error, 'Güncel fiyat alınamadı.'));
    });
    return () => { active = false; };
  }, [accountId, accountType, singleSymbol]);

  useEffect(() => { setSinglePreview(null); }, [singleSymbol, singleSide, singleOrderType, singlePrice, singleAmountUSDT, singleLeverage]);
  useEffect(() => {
    if (selectedSingleRule) setSingleLeverage((current) => Math.min(current, selectedSingleRule.maxLeverage, 50));
  }, [selectedSingleRule]);

  // Single Order Submit
  const handleSingleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || accountType === 'SPOT') { setSingleError('Tek coin manuel işlem için vadeli işlem hesabı seçin.'); return; }
    const rule = singleSymbols.find((item) => item.symbol === singleSymbol);
    const basisPrice = singleOrderType === 'MARKET' ? singleMarkPrice : singlePrice;
    if (!rule || !basisPrice) { setSingleError('Parite kuralı veya güncel fiyat hazır değil.'); return; }
    const quantity = quantityForNotional(singleAmountUSDT, basisPrice, rule.stepSize);
    if (!quantity || Number(quantity) < Number(rule.minQuantity)) {
      setSingleError(`Pozisyon büyüklüğü en az ${rule.minQuantity} ${rule.baseAsset} karşılığı olmalıdır.`); return;
    }
    setSingleWorking(true); setSingleError(''); setSingleSubmitted(false);
    try {
      setSinglePreview(await previewManualOrder({
        exchangeAccountId: accountId, symbol: singleSymbol, side: singleSide === 'LONG' ? 'BUY' : 'SELL', type: singleOrderType,
        quantity, ...(singleOrderType === 'LIMIT' ? { price: singlePrice } : {}),
        ...(singleOrderType === 'STOP_MARKET' ? { stopPrice: singlePrice } : {}),
        leverage: singleLeverage, marginMode: 'ISOLATED', reduceOnly: false,
      }));
    } catch (error) { setSingleError(getApiErrorMessage(error, 'Emir önizlemesi oluşturulamadı.')); }
    finally { setSingleWorking(false); }
  };

  const handleSingleOrderConfirm = async () => {
    if (!singlePreview) return;
    setSingleWorking(true); setSingleError('');
    try {
      await confirmManualOrder(singlePreview.id);
      setSinglePreview(null); setSingleSubmitted(true);
      setTimeout(() => setSingleSubmitted(false), 5000);
    } catch (error) { setSingleError(getApiErrorMessage(error, 'Emir borsaya gönderilemedi.')); }
    finally { setSingleWorking(false); }
  };

  const parsedSinglePrice = parseFloat(singleOrderType === 'MARKET' ? singleMarkPrice : singlePrice) || 0;
  const parsedSingleAmount = parseFloat(singleAmountUSDT) || 0;
  const singleMarginRequired = (parsedSingleAmount / singleLeverage).toFixed(2);
  const singleCoinAmount = parsedSinglePrice > 0 ? (parsedSingleAmount / parsedSinglePrice).toFixed(4) : '0.0000';

  return (
    <div id="manual-trade-view" className="w-full space-y-5 animate-in fade-in duration-200 pb-20">
      {/* 1. TOP HEADER */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#f0b90b]/40 flex items-center justify-center text-[#f0b90b] shadow-[0_0_20px_rgba(240,185,11,0.25)] flex-shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-[#f0b90b] tracking-wider uppercase">
                  MANUEL İŞLEM
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#02c076] animate-pulse" />
                  TESTNET
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Manuel Testnet İşlemi
              </h1>
              <p className="text-xs text-[#848e9c] mt-0.5">
                Seçili API hesabındaki vadeli paritelerde manuel işlem açın. Emri önce inceleyin, ardından açıkça onaylayın.
              </p>
            </div>
          </div>

          <span className="text-xs text-[#848e9c]">{accountName ?? 'Hesap seçin'}</span>
        </div>

        {/* 2. SUB-TAB SWITCHER */}
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
            id="tab-batch-manual"
            onClick={() => setActiveTab('batch')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'batch'
                ? 'bg-[#f0b90b] text-[#0b0e11] shadow-[0_0_15px_rgba(240,185,11,0.3)]'
                : 'bg-[#0b0e11] text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Toplu Manuel İşlem</span>
          </button>
        </div>
      </div>

      {activeTab === 'batch' && (accountId && accountType !== 'SPOT' ? <ManualBatchPanel key={accountId} accountId={accountId} accountName={accountName}/> : <p className="text-[#848e9c]">Toplu işlem için vadeli hesap seçin.</p>)}

      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 2 Cols: Order Form & Settings */}
          <div className="lg:col-span-2 bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
            {singleSubmitted && (
              <div className="p-3.5 bg-[#02c076]/15 border border-[#02c076]/40 rounded-xl text-[#02c076] text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Emir başarıyla {accountName ?? 'seçili borsa'} hesabına iletildi! Pozisyonlar sekmesinden anlık takip edebilirsiniz.</span>
              </div>
            )}
            {singleError && (
              <div className="p-3.5 bg-[#f84960]/15 border border-[#f84960]/40 rounded-xl text-[#f84960] text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{singleError}</span>
              </div>
            )}
            {!accountId && <div className="p-3.5 bg-[#f0b90b]/10 border border-[#f0b90b]/30 rounded-xl text-[#f0b90b] text-xs font-bold">Üst bölümden işlem yapılacak API hesabını seçin.</div>}
            {accountType === 'SPOT' && <div className="p-3.5 bg-[#f0b90b]/10 border border-[#f0b90b]/30 rounded-xl text-[#f0b90b] text-xs font-bold">Tek coin manuel işlem yalnızca Futures hesabında kullanılabilir.</div>}

            {/* Pair Selector & Side Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-[#2b3139]">
              {/* Symbol Switcher */}
              <div className="flex items-center gap-2">
                <select
                  value={singleSymbol}
                  onChange={(e) => setSingleSymbol(e.target.value)}
                  disabled={singleLoading || !accountId || accountType === 'SPOT'}
                  className="bg-[#0b0e11] border border-[#2b3139] text-[#eaecef] text-sm font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-[#f0b90b]"
                >
                  {singleLoading && <option value="">Pariteler yükleniyor…</option>}
                  {!singleLoading && singleSymbols.length === 0 && <option value="">Parite bulunamadı</option>}
                  {singleSymbols.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} ({item.baseAsset})</option>)}
                </select>
                <span className="text-xs font-bold text-[#02c076] font-['JetBrains_Mono',monospace]">
                  {singleMarkPrice ? `$${formatPrice(singleMarkPrice)}` : 'Fiyat bekleniyor…'}
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
                  {t === 'MARKET' ? 'Piyasa (Market)' : t === 'LIMIT' ? 'Limit Emir' : 'Stop Market'}
                </button>
              ))}
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSingleOrderSubmit} className="space-y-4 text-xs">
              {singleOrderType !== 'MARKET' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#848e9c] uppercase mb-1">
                    {singleOrderType === 'LIMIT' ? 'Emir Fiyatı' : 'Tetikleme Fiyatı'} ({singleSymbols.find((item) => item.symbol === singleSymbol)?.quoteAsset ?? 'USDT'})
                  </label>
                  <input
                    type="number"
                    step={selectedSingleRule?.tickSize ?? 'any'}
                    min="0"
                    value={singlePrice}
                    onChange={(e) => setSinglePrice(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-[#eaecef] font-['JetBrains_Mono',monospace] text-sm focus:outline-none focus:border-[#f0b90b]"
                  />
                </div>
              )}

              {/* Position Size (USDT) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-[#848e9c] uppercase">Pozisyon Büyüklüğü ({selectedSingleRule?.quoteAsset ?? 'USDT'})</label>
                  <span className="text-[#848e9c] font-['JetBrains_Mono',monospace]">≈ {singleCoinAmount} {selectedSingleRule?.baseAsset ?? singleSymbol}</span>
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
                  max={Math.min(50, selectedSingleRule?.maxLeverage ?? 50)}
                  value={singleLeverage}
                  onChange={(e) => setSingleLeverage(Number(e.target.value))}
                  className="w-full accent-[#00d2ff] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#848e9c] font-['JetBrains_Mono',monospace] mt-1">
                  <span>1x</span>
                  <span>10x</span>
                  <span>20x</span>
                  <span>35x</span>
                  <span>{Math.min(50, selectedSingleRule?.maxLeverage ?? 50)}x Max</span>
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
                disabled={singleWorking || singleLoading || !accountId || accountType === 'SPOT' || !singleSymbol || !singleMarkPrice}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg mt-4 ${
                  singleSide === 'LONG'
                    ? 'bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] shadow-[0_0_20px_rgba(2,192,118,0.4)]'
                    : 'bg-[#f84960] hover:bg-[#f84960]/90 text-white shadow-[0_0_20px_rgba(248,73,96,0.4)]'
                }`}
              >
                {singleWorking ? 'Önizleme hazırlanıyor…' : `Emri Önizle · ${singleSide} ${singleSymbol} (${singleLeverage}x)`}
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
                  <span className="text-[#eaecef] font-bold">${parsedSingleAmount.toLocaleString()} {selectedSingleRule?.quoteAsset ?? 'USDT'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Gerekli Teminat (Marjin):</span>
                  <span className="text-[#00d2ff] font-bold">${singleMarginRequired} {selectedSingleRule?.quoteAsset ?? 'USDT'}</span>
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

      {singlePreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#2b3139]">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#f0b90b]" />
                <div><h3 className="text-base font-bold text-[#eaecef]">Tek Coin Emir Önizlemesi</h3><p className="text-[10px] text-[#848e9c] mt-0.5">{accountName ?? 'Seçili hesap'} · emir henüz gönderilmedi</p></div>
              </div>
              <button type="button" disabled={singleWorking} onClick={() => setSinglePreview(null)} className="text-[#848e9c] hover:text-[#eaecef] p-1 rounded-lg hover:bg-[#0b0e11]"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-['JetBrains_Mono',monospace]">
              <PreviewValue label="Parite" value={singlePreview.symbol} />
              <PreviewValue label="Yön" value={`${singlePreview.side === 'BUY' ? 'LONG' : 'SHORT'} ${singlePreview.leverage}x`} tone={singlePreview.side === 'BUY' ? 'buy' : 'sell'} />
              <PreviewValue label="Emir tipi" value={singlePreview.type} />
              <PreviewValue label="Miktar" value={singlePreview.quantity} />
              <PreviewValue label={singlePreview.type === 'MARKET' ? 'Mark fiyatı' : singlePreview.type === 'LIMIT' ? 'Limit fiyatı' : 'Tetikleme fiyatı'} value={`$${formatPrice(singlePreview.price ?? singlePreview.stopPrice ?? singlePreview.markPrice)}`} />
              <PreviewValue label="Toplam değer" value={`$${formatPrice(singlePreview.estimatedNotional)} ${selectedSingleRule?.quoteAsset ?? 'USDT'}`} />
              <PreviewValue label="Margin modu" value={singlePreview.marginMode} />
              <PreviewValue label="Tahmini teminat" value={`$${formatPrice(singlePreview.estimatedInitialMargin)} USDT`} />
              <PreviewValue label="Kâr al tetik" value={`$${(Number(singlePreview.price ?? singlePreview.stopPrice ?? singlePreview.markPrice) * (singlePreview.side === 'BUY' ? 1 + Number(singleTpPercent) / 100 : 1 - Number(singleTpPercent) / 100)).toFixed(2)}`} tone="buy" />
              <PreviewValue label="Stop loss tetik" value={`$${(Number(singlePreview.price ?? singlePreview.stopPrice ?? singlePreview.markPrice) * (singlePreview.side === 'BUY' ? 1 - Number(singleSlPercent) / 100 : 1 + Number(singleSlPercent) / 100)).toFixed(2)}`} tone="sell" />
            </div>
            <div className="rounded-xl border border-[#f0b90b]/30 bg-[#f0b90b]/10 p-3 text-[11px] leading-5 text-[#f0b90b]">
              Bu onay giriş emrini borsaya gönderir. Sağdaki TP/SL değerleri risk hesabıdır; bu işlem ayrıca otomatik TP/SL emri oluşturmaz.
            </div>
            <div className="flex gap-3">
              <button type="button" disabled={singleWorking} onClick={() => setSinglePreview(null)} className="flex-1 py-3 rounded-xl border border-[#2b3139] text-[#eaecef] text-xs font-bold hover:bg-[#0b0e11]">Geri dön</button>
              <button type="button" disabled={singleWorking} onClick={() => void handleSingleOrderConfirm()} className={`flex-1 py-3 rounded-xl text-xs font-bold disabled:opacity-50 ${singlePreview.side === 'BUY' ? 'bg-[#02c076] text-[#0b0e11]' : 'bg-[#f84960] text-white'}`}>{singleWorking ? 'Gönderiliyor…' : 'Tamam · Emri Gönder'}</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

function quantityForNotional(notionalText: string, priceText: string, stepText: string) {
  const notional = Number(notionalText); const price = Number(priceText); const step = Number(stepText);
  if (!Number.isFinite(notional) || !Number.isFinite(price) || !Number.isFinite(step) || notional <= 0 || price <= 0 || step <= 0) return '';
  const precision = Math.min(18, (stepText.split('.')[1] ?? '').replace(/0+$/, '').length);
  const steps = Math.floor((notional / price + step * 1e-9) / step);
  if (steps < 1) return '';
  return (steps * step).toFixed(precision).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function formatPrice(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const maximumFractionDigits = number >= 1 ? 4 : 8;
  return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits });
}

function PreviewValue({ label, value, tone }: { label: string; value: string; tone?: 'buy' | 'sell' }) {
  return <div className="rounded-xl border border-[#2b3139] bg-[#0b0e11] p-3">
    <div className="text-[10px] text-[#848e9c]">{label}</div>
    <div className={`mt-1 font-bold ${tone === 'buy' ? 'text-[#02c076]' : tone === 'sell' ? 'text-[#f84960]' : 'text-[#eaecef]'}`}>{value}</div>
  </div>;
}
