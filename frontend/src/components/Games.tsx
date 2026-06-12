import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Brain, Clock3, Filter, Gamepad2, Gauge, History, LockKeyhole, RadioTower, ShieldAlert, ShieldCheck, TrendingDown, TrendingUp, Trophy, WalletCards } from 'lucide-react';
import { cn } from '../lib/utils';
import { createInitialAssetPriceState, formatUsd, getFallbackAssetPrice, getLiveAssetPrice, getNextAssetPriceState, PriceAssetId, PricePoint, retargetAssetPriceState } from '../services/priceService';
import { GameCatalogItem, GameFilter, gameCategories, gamesCatalog } from '../services/gameService';
import { getAuthState } from '../services/authService';
import {
  getScoreSummary,
  loadPredictionHistory,
  PredictionDirection,
  PredictionHistoryItem,
  resolvePrediction,
  savePredictionHistory
} from '../services/upDownGameService';

const GAME_DURATION = 30;
const CHART_POINT_INTERVAL_MS = 260;

type ActivePrediction = {
  direction: PredictionDirection;
  entryPrice: number;
  startedAt: number;
};

const UP_DOWN_ASSETS: Record<PriceAssetId, {
  symbol: 'BTC' | 'ETH';
  name: 'Bitcoin' | 'Ethereum';
  title: string;
  route: string;
  historyKey: string;
}> = {
  btc: {
    symbol: 'BTC',
    name: 'Bitcoin',
    title: 'Bitcoin Up / Down',
    route: '/games/up-down',
    historyKey: 'btc'
  },
  eth: {
    symbol: 'ETH',
    name: 'Ethereum',
    title: 'Ethereum Up / Down',
    route: '/games/eth-up-down',
    historyKey: 'eth'
  }
};

function useAssetPriceStream(assetId: PriceAssetId = 'btc') {
  const [priceState, setPriceState] = useState(() => createInitialAssetPriceState(assetId, getFallbackAssetPrice(assetId)));
  const [isLoadingLivePrice, setIsLoadingLivePrice] = useState(true);
  const [liveAssetPrice, setLiveAssetPrice] = useState<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const hasLoadedLivePrice = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let animationFrameId: number | undefined;
    let lastFrameTime = performance.now();
    let pointAccumulator = 0;

    async function syncLiveAnchor() {
      try {
        const livePrice = await getLiveAssetPrice(assetId);
        if (!isMounted) return;
        setLiveAssetPrice(livePrice);
        setPriceState((current) => {
          if (!hasLoadedLivePrice.current) {
            hasLoadedLivePrice.current = true;
            return createInitialAssetPriceState(assetId, livePrice);
          }
          return retargetAssetPriceState(current, livePrice);
        });
        setIsLoadingLivePrice(false);
      } catch (error) {
        console.error(error);
        if (isMounted) setIsLoadingLivePrice(false);
      }
    }

    const tick = (frameTime: number) => {
      if (!isMounted) return;
      const elapsed = Math.min(frameTime - lastFrameTime, 80);
      lastFrameTime = frameTime;
      pointAccumulator += elapsed;

      if (pointAccumulator >= CHART_POINT_INTERVAL_MS) {
        const stepCount = Math.floor(pointAccumulator / CHART_POINT_INTERVAL_MS);
        pointAccumulator %= CHART_POINT_INTERVAL_MS;
        setPriceState((current) => {
          let next = current;
          for (let index = 0; index < stepCount; index += 1) {
            next = getNextAssetPriceState(next, 0.55);
          }
          return next;
        });
      }

      setScrollProgress(pointAccumulator / CHART_POINT_INTERVAL_MS);
      animationFrameId = window.requestAnimationFrame(tick);
    };

    syncLiveAnchor();
    animationFrameId = window.requestAnimationFrame(tick);
    const anchorTimer = window.setInterval(syncLiveAnchor, 60000);

    return () => {
      isMounted = false;
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      window.clearInterval(anchorTimer);
    };
  }, [assetId]);

  return { ...priceState, isLoadingLivePrice, liveAssetPrice, scrollProgress };
}

function useBtcPriceStream() {
  return useAssetPriceStream('btc');
}

function getChartScale(points: PricePoint[], extraPrices: number[] = []) {
  const prices = [...points.map((point) => point.price), ...extraPrices].filter(Number.isFinite);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const rawRange = Math.max(maxPrice - minPrice, 1);
  const padding = Math.max(rawRange * 0.18, rawRange < 20 ? 3 : 8);

  return {
    minPrice: minPrice - padding,
    maxPrice: maxPrice + padding,
    range: rawRange + padding * 2
  };
}

function getPriceY(price: number, scale: ReturnType<typeof getChartScale>, height: number, padding = 10) {
  return padding + ((scale.maxPrice - price) / scale.range) * (height - padding * 2);
}

function buildSmoothPath(points: PricePoint[], width: number, height: number, scale: ReturnType<typeof getChartScale>, axisWidth: number, padding = 10, scrollProgress = 0) {
  if (points.length < 2) return '';

  const chartWidth = width - axisWidth;
  const stepWidth = chartWidth / (points.length - 1);
  const coordinates = points.map((point, index) => ({
    x: index * stepWidth - scrollProgress * stepWidth,
    y: getPriceY(point.price, scale, height, padding)
  }));

  return coordinates.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const previous = coordinates[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} Q ${controlX.toFixed(2)} ${previous.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, '');
}

function getPriceTickStep(range: number) {
  if (range < 20) return 2;
  if (range <= 100) return 5;
  if (range <= 300) return 10;
  return 25;
}

function getPriceTicks(scale: ReturnType<typeof getChartScale>) {
  const step = getPriceTickStep(scale.range);
  const first = Math.ceil(scale.minPrice / step) * step;
  const ticks: number[] = [];

  for (let tick = first; tick <= scale.maxPrice; tick += step) {
    ticks.push(tick);
  }

  if (ticks.length <= 7) return ticks;
  const skip = Math.ceil(ticks.length / 7);
  return ticks.filter((_, index) => index % skip === 0).slice(0, 7);
}

function formatAxisPrice(price: number) {
  return price.toLocaleString('en-US', {
    maximumFractionDigits: 0
  });
}

function getLineColor(currentPrice: number, previousPrice: number, activePrediction?: ActivePrediction | null) {
  if (activePrediction) {
    const isWinning = activePrediction.direction === 'UP'
      ? currentPrice > activePrediction.entryPrice
      : currentPrice < activePrediction.entryPrice;
    return isWinning ? '#00ffa3' : '#ff716c';
  }

  if (currentPrice > previousPrice) return '#00ffa3';
  if (currentPrice < previousPrice) return '#ff716c';
  return '#8dacff';
}

function UpDownChart({
  points,
  currentPrice,
  activePrediction,
  compact = false,
  scrollProgress = 0
}: {
  points: PricePoint[];
  currentPrice: number;
  activePrediction?: ActivePrediction | null;
  compact?: boolean;
  scrollProgress?: number;
}) {
  const width = 640;
  const height = compact ? 170 : 360;
  const axisWidth = compact ? 54 : 78;
  const chartWidth = width - axisWidth;
  const padding = compact ? 14 : 24;
  const previousPrice = points[points.length - 2]?.price ?? currentPrice;
  const lineColor = getLineColor(currentPrice, previousPrice, activePrediction);
  const scale = getChartScale(points, activePrediction ? [activePrediction.entryPrice, currentPrice] : [currentPrice]);
  const ticks = getPriceTicks(scale);
  const path = buildSmoothPath(points, width, height, scale, axisWidth, padding, scrollProgress);
  const lastPriceY = getPriceY(currentPrice, scale, height, padding);
  const stepWidth = chartWidth / Math.max(points.length - 1, 1);
  const lastPointX = Math.max(0, chartWidth - scrollProgress * stepWidth - 2);
  const entryY = activePrediction ? getPriceY(activePrediction.entryPrice, scale, height, padding) : null;
  const labelX = chartWidth + (compact ? 3 : 7);
  const labelWidth = compact ? 50 : 68;
  const liveLabelY = Math.min(height - 28, Math.max(8, lastPriceY - 13));
  const entryLabelY = entryY === null ? null : Math.min(height - 28, Math.max(8, entryY - 13));

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-outline/10 bg-background/50", compact ? "h-[180px]" : "h-[380px]")}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={compact ? 'miniChartFill' : 'gameChartFill'} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={chartWidth} height={height} fill="#060e20" fillOpacity="0.28" />
        {ticks.map((tick) => (
          <line key={tick} x1="0" x2={chartWidth} y1={getPriceY(tick, scale, height, padding)} y2={getPriceY(tick, scale, height, padding)} stroke="#6d758c" strokeOpacity="0.11" />
        ))}
        <line x1={chartWidth} x2={chartWidth} y1="0" y2={height} stroke="#6d758c" strokeOpacity="0.18" />
        {ticks.map((tick) => (
          <text key={`label-${tick}`} x={chartWidth + 8} y={getPriceY(tick, scale, height, padding) + 4} fill="#a3aac4" fontSize={compact ? 10 : 12} fontWeight="700">
            {formatAxisPrice(tick)}
          </text>
        ))}
        <line x1="0" x2={chartWidth} y1={lastPriceY} y2={lastPriceY} stroke={lineColor} strokeOpacity="0.36" strokeWidth="1" />
        {entryY !== null && (
          <>
            <line x1="0" x2={chartWidth} y1={entryY} y2={entryY} stroke="#dee5ff" strokeOpacity="0.48" strokeDasharray="7 7" />
            <rect x={compact ? chartWidth - 92 : chartWidth - 126} y={entryLabelY!} width={compact ? 88 : 120} height="25" rx="7" fill="#192540" stroke="#dee5ff" strokeOpacity="0.26" />
            <text x={compact ? chartWidth - 86 : chartWidth - 118} y={entryLabelY! + 16} fill="#dee5ff" fontSize={compact ? 10 : 12} fontWeight="800">
              Entry: {formatUsd(activePrediction!.entryPrice)}
            </text>
          </>
        )}
        <path d={`${path} L ${chartWidth} ${height} L 0 ${height} Z`} fill={`url(#${compact ? 'miniChartFill' : 'gameChartFill'})`} />
        <path d={path} fill="none" stroke={lineColor} strokeWidth={compact ? 2 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPointX} cy={lastPriceY} r={compact ? 4 : 5} fill={lineColor} />
        <rect x={labelX} y={liveLabelY} width={labelWidth} height="26" rx="7" fill={lineColor} />
        <text x={labelX + 6} y={liveLabelY + 17} fill="#060e20" fontSize={compact ? 10 : 12} fontWeight="900">
          {compact ? `$${Math.round(currentPrice).toLocaleString('en-US')}` : formatUsd(currentPrice)}
        </text>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/70 to-transparent" />
    </div>
  );
}

export function RiskDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex gap-2 rounded-2xl border border-outline/10 bg-surface-high/50 text-on-surface-variant", compact ? "p-3 text-xs" : "p-4 text-sm")}>
      <ShieldAlert className="mt-0.5 shrink-0 text-primary" size={compact ? 15 : 18} />
      <p>Bu oyun eğlence amaçlıdır. Gerçek yatırım işlemi veya finansal tavsiye değildir.</p>
    </div>
  );
}

export function HomeUpDownWidget() {
  const { currentPrice, pricePoints, isLoadingLivePrice, liveAssetPrice, scrollProgress } = useBtcPriceStream();
  const previousPrice = pricePoints[pricePoints.length - 2]?.price ?? currentPrice;
  const isUp = currentPrice >= previousPrice;
  const displayedBtcPrice = liveAssetPrice ?? currentPrice;

  return (
    <Link to="/games/up-down" className="group block rounded-[24px] border border-outline/5 bg-surface p-6 transition-all hover:border-primary/30 hover:shadow-[0_0_28px_rgba(141,172,255,0.12)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">Kripto Keyfi Games</p>
          <h2 className="font-headline text-xl font-bold text-white">Bitcoin Up / Down</h2>
          <p className="mt-2 text-sm text-on-surface-variant">30 saniyelik fiyat tahmin oyununa katıl.</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold", isUp ? "bg-secondary/10 text-secondary" : "bg-error/10 text-error")}>
          {isUp ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          {isUp ? 'UP' : 'DOWN'}
        </span>
      </div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Anlık BTC</p>
          <p className="font-headline text-3xl font-black text-white">{formatUsd(displayedBtcPrice)}</p>
          {isLoadingLivePrice && <p className="mt-1 text-[11px] font-bold text-primary">Canlı fiyat yükleniyor</p>}
        </div>
        <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background transition-transform group-hover:translate-x-1">
          Eğlenceye Katıl
          <ArrowRight size={16} />
        </span>
      </div>
      <UpDownChart points={pricePoints} currentPrice={currentPrice} compact scrollProgress={scrollProgress} />
      <p className="mt-3 text-xs font-medium text-on-surface-variant">Eğlence amaçlıdır.</p>
    </Link>
  );
}

function LegacyGameCard({ game }: { game: (typeof gamesCatalog)[number] }) {
  const active = game.status === 'active';
  const content = (
    <article className={cn("h-full rounded-[24px] border p-6 transition-all", active ? "border-primary/20 bg-surface hover:border-primary/50" : "border-outline/5 bg-surface/70 opacity-75")}>
      <div className="mb-6 flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Gamepad2 size={22} />
        </span>
        <span className={cn("rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest", active ? "bg-secondary/10 text-secondary" : "bg-surface-highest text-on-surface-variant")}>
          {game.status}
        </span>
      </div>
      <h2 className="font-headline text-xl font-bold text-white">{game.title}</h2>
      <p className="mt-3 min-h-[48px] text-sm leading-6 text-on-surface-variant">{game.description}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary">
        {active ? 'Oyuna Git' : 'Hazırlanıyor'}
        {active && <ArrowRight size={16} />}
      </div>
    </article>
  );

  return active && game.route ? <Link to={game.route}>{content}</Link> : content;
}

function LegacyGamesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8 md:p-10">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Kripto Keyfi Games</p>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <h1 className="font-headline text-4xl font-extrabold text-white md:text-5xl">Eğlence Merkezi</h1>
            <p className="mt-4 text-base leading-8 text-on-surface-variant">
              Kripto temalı tahmin oyunları, quizler ve sanal puan deneyimleri. Gerçek trade veya finansal kazanç sistemi değildir.
            </p>
          </div>
          <Link to="/games/up-down" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">
            Bitcoin Up / Down
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {gamesCatalog.map((game) => <LegacyGameCard key={game.id} game={game} />)}
      </section>
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span className="rounded-lg bg-surface-highest px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
      Yakında
    </span>
  );
}

function GameIcon({ game }: { game: GameCatalogItem }) {
  const iconMap = {
    trend: TrendingUp,
    wallet: WalletCards,
    activity: Activity,
    gauge: Gauge,
    sentiment: RadioTower,
    brain: Brain,
    shield: ShieldCheck,
    lock: LockKeyhole,
    flow: RadioTower
  };
  const Icon = iconMap[game.icon as keyof typeof iconMap] ?? Gamepad2;

  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
      <Icon size={22} />
    </span>
  );
}

function GameStats() {
  const activeCount = gamesCatalog.filter((game) => game.status === 'active').length;
  const comingSoonCount = gamesCatalog.filter((game) => game.status === 'coming_soon').length;
  const stats = [
    ['Aktif oyun', activeCount],
    ['Yakında', comingSoonCount],
    ['Toplam deneme', '1.2k'],
    ['Sanal puan sistemi', 'Yakında']
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-outline/5 bg-surface-high/60 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
          <p className="mt-2 font-headline text-2xl font-black text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

function GameDisclaimer() {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/10 p-4 text-sm leading-6 text-on-surface">
      <ShieldAlert className="mt-0.5 shrink-0 text-primary" size={18} />
      <p>Bu oyunlar eğlence ve eğitim amaçlıdır. Gerçek trade, bahis veya finansal kazanç sistemi değildir.</p>
    </div>
  );
}

function GamesHero() {
  return (
    <section className="rounded-[32px] border border-outline/5 bg-surface p-8 md:p-10">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Kripto Keyfi Games</p>
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <h1 className="font-headline text-4xl font-extrabold text-white md:text-5xl">Eğlence Merkezi</h1>
          <p className="mt-4 text-base leading-8 text-on-surface-variant">
            Kripto temalı tahmin oyunları, on-chain görevler, güvenlik senaryoları ve sanal puanlı quizler için kapsamlı oyun merkezi.
          </p>
        </div>
        <Link to="/games/up-down" className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">
          Bitcoin Up / Down
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="mt-8 space-y-4">
        <GameStats />
        <GameDisclaimer />
      </div>
    </section>
  );
}

function GameCategoryFilters({
  activeFilter,
  onFilterChange
}: {
  activeFilter: GameFilter;
  onFilterChange: (filter: GameFilter) => void;
}) {
  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
        <Filter size={14} />
        Kategoriler
      </div>
      <div className="flex flex-wrap gap-2">
        {gameCategories.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => onFilterChange(filter)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-bold transition-all",
              activeFilter === filter
                ? "border-primary bg-primary text-background"
                : "border-outline/10 bg-surface-high text-on-surface-variant hover:border-primary/30 hover:text-white"
            )}
          >
            {filter}
          </button>
        ))}
      </div>
    </section>
  );
}

function ActiveGameCard({ game }: { game: GameCatalogItem }) {
  const assetId = game.assetId ?? 'btc';
  const asset = UP_DOWN_ASSETS[assetId];
  const { currentPrice, pricePoints, isLoadingLivePrice, liveAssetPrice, scrollProgress } = useAssetPriceStream(assetId);
  const displayedAssetPrice = liveAssetPrice ?? currentPrice;

  return (
    <article className="relative overflow-hidden rounded-[28px] border border-primary/25 bg-surface p-6 shadow-[0_0_40px_rgba(141,172,255,0.08)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-tertiary" />
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <GameIcon game={game} />
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-secondary">Aktif oyun</p>
            <h2 className="font-headline text-2xl font-black text-white">{game.title}</h2>
          </div>
        </div>
        <span className="rounded-lg bg-secondary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
          Aktif
        </span>
      </div>
      <p className="min-h-[48px] text-sm leading-6 text-on-surface-variant">{game.description}</p>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Anlık {asset.symbol}</p>
          <p className="font-headline text-2xl font-black text-white">{formatUsd(displayedAssetPrice)}</p>
          {isLoadingLivePrice && <p className="mt-1 text-[11px] font-bold text-primary">Canlı fiyat yükleniyor</p>}
        </div>
        <span className="rounded-xl bg-secondary/10 px-3 py-2 text-xs font-bold text-secondary">{game.category}</span>
      </div>
      <div className="mt-5">
        <UpDownChart points={pricePoints} currentPrice={currentPrice} compact scrollProgress={scrollProgress} />
      </div>
      <Link to={game.route ?? '/games/up-down'} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background transition-all hover:shadow-[0_0_24px_rgba(141,172,255,0.24)]">
        Oyuna Git
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}

function CenterGameCard({
  game,
  onComingSoon
}: {
  game: GameCatalogItem;
  onComingSoon: (game: GameCatalogItem) => void;
}) {
  if (game.status === 'active' && game.hasMiniChart) {
    return <ActiveGameCard game={game} />;
  }

  if (game.status === 'active') {
    return (
      <Link to={game.route ?? '/games'} className="block h-full">
        <article className="flex h-full flex-col rounded-[24px] border border-primary/20 bg-surface p-6 transition-all hover:border-primary/50 hover:shadow-[0_0_28px_rgba(141,172,255,0.10)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <GameIcon game={game} />
            <span className="rounded-lg bg-secondary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
              Aktif
            </span>
          </div>
          <div className="flex-1">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">{game.category}</p>
            <h2 className="font-headline text-xl font-bold text-white">{game.title}</h2>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">{game.description}</p>
            <p className="mt-4 rounded-2xl border border-outline/10 bg-surface-high/60 p-4 text-xs leading-5 text-on-surface-variant">
              {game.longDescription}
            </p>
          </div>
          <span className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background transition-all">
            Oyuna Git
            <ArrowRight size={16} />
          </span>
        </article>
      </Link>
    );
  }

  return (
    <article className="flex h-full flex-col rounded-[24px] border border-outline/5 bg-surface p-6 transition-all hover:border-outline/20">
      <div className="mb-6 flex items-start justify-between gap-4">
        <GameIcon game={game} />
        <ComingSoonBadge />
      </div>
      <div className="flex-1">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">{game.category}</p>
        <h2 className="font-headline text-xl font-bold text-white">{game.title}</h2>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">{game.description}</p>
        {game.id === 'transfer-volume-guess' && (
          <p className="mt-4 rounded-2xl border border-outline/10 bg-surface-high/60 p-4 text-xs leading-5 text-on-surface-variant">
            {game.longDescription}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onComingSoon(game)}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-highest hover:text-white"
      >
        Hazırlanıyor
      </button>
    </article>
  );
}

function filterGames(filter: GameFilter) {
  if (filter === 'Tümü') return gamesCatalog;
  if (filter === 'Aktif') return gamesCatalog.filter((game) => game.status === 'active');
  if (filter === 'Yakında') return gamesCatalog.filter((game) => game.status === 'coming_soon');
  return gamesCatalog.filter((game) => game.category === filter);
}

export default function GamesPage() {
  const [activeFilter, setActiveFilter] = useState<GameFilter>('Tümü');
  const [comingSoonMessage, setComingSoonMessage] = useState('');
  const filteredGames = filterGames(activeFilter);

  function handleComingSoon(game: GameCatalogItem) {
    setComingSoonMessage(`${game.title} yakında aktif olacak. Route hazırlığı: ${game.route}`);
  }

  return (
    <div className="space-y-8">
      <GamesHero />
      <GameCategoryFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      {comingSoonMessage && (
        <div className="rounded-2xl border border-primary/15 bg-primary/10 p-4 text-sm font-bold text-on-surface">
          {comingSoonMessage}
        </div>
      )}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredGames.map((game) => (
          <CenterGameCard key={game.id} game={game} onComingSoon={handleComingSoon} />
        ))}
      </section>
    </div>
  );
}

function PredictionControls({
  disabled,
  onPick
}: {
  disabled: boolean;
  onPick: (direction: PredictionDirection) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick('UP')}
        className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl bg-secondary px-5 text-base font-black text-background transition-all hover:shadow-[0_0_24px_rgba(0,255,163,0.18)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <TrendingUp size={22} />
        UP
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick('DOWN')}
        className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl bg-error px-5 text-base font-black text-background transition-all hover:shadow-[0_0_24px_rgba(255,113,108,0.18)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <TrendingDown size={22} />
        DOWN
      </button>
    </div>
  );
}

function PredictionHistory({ history }: { history: PredictionHistoryItem[] }) {
  if (!history.length) {
    return (
      <div className="rounded-2xl bg-surface-high/50 p-5 text-sm text-on-surface-variant">
        Henüz tahmin yok. İlk sonucu burada göreceksin.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.slice(0, 8).map((item) => (
        <div key={item.id} className="rounded-2xl bg-surface-high/50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={cn("rounded-lg px-2 py-1 text-xs font-black", item.direction === 'UP' ? "bg-secondary/10 text-secondary" : "bg-error/10 text-error")}>{item.direction}</span>
            <span className={cn("text-xs font-bold", item.result === 'Başarılı' ? "text-secondary" : item.result === 'Başarısız' ? "text-error" : "text-primary")}>{item.result}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
            <span>Entry: {formatUsd(item.entryPrice)}</span>
            <span>Sonuç: {formatUsd(item.resultPrice)}</span>
            <span>Süre: {item.duration}s</span>
            <span>{new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreSummary({ history }: { history: PredictionHistoryItem[] }) {
  const score = getScoreSummary(history);

  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        ['Bugünkü Puan', score.dailyScore],
        ['Başarı Serisi', score.streak],
        ['Toplam Deneme', score.totalAttempts],
        ['Başarı Oranı', `%${score.successRate}`]
      ].map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-surface-high/50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
          <p className="mt-2 font-headline text-2xl font-black text-white">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function UpDownGamePage({ assetId = 'btc' }: { assetId?: PriceAssetId }) {
  const asset = UP_DOWN_ASSETS[assetId];
  const { currentPrice, pricePoints, isLoadingLivePrice, scrollProgress } = useAssetPriceStream(assetId);
  const [activePrediction, setActivePrediction] = useState<ActivePrediction | null>(null);
  const [countdown, setCountdown] = useState(GAME_DURATION);
  const [lastResult, setLastResult] = useState<PredictionHistoryItem | null>(null);
  const [history, setHistory] = useState<PredictionHistoryItem[]>(() => loadPredictionHistory(asset.historyKey));
  const authUser = getAuthState();

  useEffect(() => {
    if (!activePrediction) return;

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - activePrediction.startedAt) / 1000);
      setCountdown(Math.max(GAME_DURATION - elapsed, 0));
    }, 250);

    return () => window.clearInterval(timer);
  }, [activePrediction]);

  useEffect(() => {
    if (!activePrediction || countdown > 0) return;

    const result = resolvePrediction(activePrediction.direction, activePrediction.entryPrice, currentPrice);
    const item: PredictionHistoryItem = {
      id: `${Date.now()}`,
      direction: activePrediction.direction,
      entryPrice: activePrediction.entryPrice,
      resultPrice: currentPrice,
      duration: GAME_DURATION,
      result,
      createdAt: new Date().toISOString()
    };
    setHistory(savePredictionHistory(item, asset.historyKey));
    setLastResult(item);
    setActivePrediction(null);
    setCountdown(GAME_DURATION);
  }, [activePrediction, asset.historyKey, countdown, currentPrice]);

  const statusText = useMemo(() => {
    if (!activePrediction) return 'Tahmin bekleniyor';
    return `${activePrediction.direction} seçildi`;
  }, [activePrediction]);

  function startPrediction(direction: PredictionDirection) {
    if (activePrediction) return;
    setLastResult(null);
    setActivePrediction({
      direction,
      entryPrice: currentPrice,
      startedAt: Date.now()
    });
    setCountdown(GAME_DURATION);
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 space-y-6 xl:col-span-8">
        <div className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">{asset.title}</p>
              <h1 className="font-headline text-3xl font-extrabold text-white md:text-5xl">{asset.title} Tahmin Oyunu</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant md:text-base">
                30 saniye içinde fiyatın yukarı mı aşağı mı gideceğini tahmin et.
              </p>
            </div>
            <Link to="/games" className="inline-flex w-fit items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary hover:bg-surface-highest">
              Games
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Anlık {asset.symbol}</p>
              <p className="mt-2 font-headline text-3xl font-black text-white">{formatUsd(currentPrice)}</p>
              {isLoadingLivePrice && <p className="mt-1 text-[11px] font-bold text-primary">Canlı fiyat yükleniyor</p>}
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sayaç</p>
              <p className="mt-2 flex items-center gap-2 font-headline text-3xl font-black text-white"><Clock3 size={24} /> {countdown}s</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Durum</p>
              <p className="mt-2 font-headline text-2xl font-black text-white">{statusText}</p>
            </div>
          </div>

          <UpDownChart points={pricePoints} currentPrice={currentPrice} activePrediction={activePrediction} scrollProgress={scrollProgress} />

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <PredictionControls disabled={Boolean(activePrediction)} onPick={startPrediction} />
              {activePrediction && (
                <div className="rounded-2xl bg-surface-high/50 p-4 text-sm text-on-surface-variant">
                  <span className="font-bold text-white">{activePrediction.direction} seçildi.</span> Başlangıç fiyatı {formatUsd(activePrediction.entryPrice)}. Süre bitene kadar yeni seçim yapılamaz.
                </div>
              )}
              {lastResult && (
                <div className={cn("rounded-2xl border p-4", lastResult.result === 'Başarılı' ? "border-secondary/20 bg-secondary/10" : lastResult.result === 'Başarısız' ? "border-error/20 bg-error/10" : "border-primary/20 bg-primary/10")}>
                  <p className="font-headline text-xl font-black text-white">{lastResult.result}</p>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Entry {formatUsd(lastResult.entryPrice)} / Sonuç {formatUsd(lastResult.resultPrice)}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <RiskDisclaimer />
              <div className="rounded-2xl bg-surface-high/50 p-4 text-sm text-on-surface-variant">
                {authUser ? 'Sonuçlar ileride hesabına kaydedilecek.' : 'Sonuçlarını kalıcı kaydetmek için giriş yap.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="col-span-12 space-y-6 xl:col-span-4">
        <div className="rounded-[32px] border border-outline/5 bg-surface p-6">
          <div className="mb-5 flex items-center gap-3">
            <Trophy className="text-primary" size={22} />
            <h2 className="font-headline text-xl font-bold text-white">Sanal Puan</h2>
          </div>
          <ScoreSummary history={history} />
        </div>
        <div className="rounded-[32px] border border-outline/5 bg-surface p-6">
          <div className="mb-5 flex items-center gap-3">
            <History className="text-primary" size={22} />
            <h2 className="font-headline text-xl font-bold text-white">Son Tahminlerim</h2>
          </div>
          <PredictionHistory history={history} />
        </div>
      </aside>
    </div>
  );
}
