import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, BookOpen, Clock3, ExternalLink, History, LucideIcon, Play, RefreshCcw, ShieldAlert, Target, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  finishTransferVolumeGame,
  formatTransferAmount,
  generateMockTransfer,
  getLatestTransfers,
  getSupportedAssets,
  getTransferVolumeHistory,
  getTransferVolumeStats,
  MockTransfer,
  saveTransferVolumeHistory,
  saveTransferVolumeStats,
  shortenAddress,
  startTransferVolumeGame,
  TransferAsset,
  TransferVolumeGameState,
  TransferVolumeResult,
  TransferVolumeStats
} from '../services/transferVolumeGameService';

const durations = [
  { label: '1 dakika', seconds: 60 },
  { label: '3 dakika', seconds: 180 },
  { label: '5 dakika', seconds: 300 }
];

function GameDisclaimer() {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/10 p-4 text-sm leading-6 text-on-surface">
      <ShieldAlert className="mt-0.5 shrink-0 text-primary" size={18} />
      <p>Bu oyun eğitim ve eğlence amaçlıdır. Gerçek yatırım tavsiyesi veya finansal kazanç sistemi değildir.</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl bg-surface-high/50 p-5 text-sm text-on-surface-variant">{label}</div>;
}

function AssetSelector({
  assets,
  selectedAsset,
  disabled,
  onSelect
}: {
  assets: TransferAsset[];
  selectedAsset: TransferAsset;
  disabled: boolean;
  onSelect: (asset: TransferAsset) => void;
}) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Coin / Ağ Seçimi</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            disabled={disabled || !asset.supported}
            onClick={() => onSelect(asset)}
            className={cn(
              'min-h-[132px] rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60',
              selectedAsset.id === asset.id
                ? 'border-primary bg-primary/10 shadow-[0_0_22px_rgba(141,172,255,0.10)]'
                : 'border-outline/10 bg-surface-high/50 hover:border-primary/30'
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-primary text-xs font-black text-background">{asset.icon}</span>
              <span className={cn('rounded-lg px-2 py-1 text-[10px] font-bold', asset.supported ? 'bg-secondary/10 text-secondary' : 'bg-surface-highest text-on-surface-variant')}>
                {asset.supported ? 'Destekli' : 'Yakında'}
              </span>
            </div>
            <p className="font-headline text-lg font-black text-white">{asset.network}</p>
            <p className="mt-1 text-sm font-bold text-on-surface-variant">{asset.asset}</p>
            <p className="mt-3 text-xs leading-5 text-on-surface-variant">{asset.activityLabel}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function DurationSelector({
  selectedDuration,
  disabled,
  onSelect
}: {
  selectedDuration: number;
  disabled: boolean;
  onSelect: (duration: number) => void;
}) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Süre Seçimi</p>
      <div className="grid grid-cols-3 gap-3">
        {durations.map((duration) => (
          <button
            key={duration.seconds}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(duration.seconds)}
            className={cn(
              'h-14 rounded-2xl border text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-60',
              selectedDuration === duration.seconds
                ? 'border-primary bg-primary text-background'
                : 'border-outline/10 bg-surface-high/60 text-on-surface-variant hover:border-primary/30 hover:text-white'
            )}
          >
            {duration.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function PredictionInput({
  selectedAsset,
  predictionAmount,
  disabled,
  onChange,
  onStart
}: {
  selectedAsset: TransferAsset;
  predictionAmount: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onStart: () => void;
}) {
  const canStart = Number(predictionAmount) > 0 && !disabled;

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Tahmin Girişi</p>
      <label className="text-sm font-bold text-white" htmlFor="prediction">
        Bu sürede toplam kaç {selectedAsset.asset} transfer edilir?
      </label>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
        <div className="flex overflow-hidden rounded-2xl border border-outline/10 bg-background/40">
          <input
            id="prediction"
            type="number"
            min="0"
            step="0.0001"
            disabled={disabled}
            value={predictionAmount}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Örn. 1250"
            className="min-w-0 flex-1 bg-transparent px-4 py-4 text-base font-bold text-white outline-none placeholder:text-on-surface-variant disabled:cursor-not-allowed"
          />
          <span className="flex min-w-20 items-center justify-center bg-surface-high px-4 text-sm font-black text-primary">{selectedAsset.asset}</span>
        </div>
        <button
          type="button"
          disabled={!canStart}
          onClick={onStart}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-background transition-all hover:shadow-[0_0_24px_rgba(141,172,255,0.24)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Play size={17} />
          Oyunu Başlat
        </button>
      </div>
    </section>
  );
}

function TransferVolumeDashboard({
  selectedAsset,
  countdown,
  isGameRunning,
  totalVolume,
  transferCount,
  largestTransfer
}: {
  selectedAsset: TransferAsset;
  countdown: number;
  isGameRunning: boolean;
  totalVolume: number;
  transferCount: number;
  largestTransfer: number;
}) {
  const averageTransfer = transferCount ? totalVolume / transferCount : 0;
  const cards: Array<[string, string | number, LucideIcon]> = [
    ['Geri Sayım', `${countdown}s`, Clock3],
    ['Toplam Hacim', formatTransferAmount(totalVolume, selectedAsset.asset), BarChart3],
    ['Transfer Sayısı', transferCount, Activity],
    ['Ortalama Transfer', formatTransferAmount(averageTransfer, selectedAsset.asset), Target],
    ['En Büyük Transfer', formatTransferAmount(largestTransfer, selectedAsset.asset), Trophy]
  ];

  return (
    <section className={cn('rounded-[28px] border p-6', isGameRunning ? 'border-secondary/20 bg-secondary/5' : 'border-outline/5 bg-surface')}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Canlı Hacim Paneli</p>
          <h2 className="mt-2 font-headline text-2xl font-black text-white">{selectedAsset.network} / {selectedAsset.asset}</h2>
        </div>
        <span className={cn('rounded-xl px-3 py-2 text-xs font-black', isGameRunning ? 'bg-secondary/10 text-secondary' : 'bg-surface-high text-on-surface-variant')}>
          {isGameRunning ? 'Canlı' : 'Hazır'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, Icon]) => (
          <div key={label as string} className="rounded-2xl bg-surface-high/50 p-4">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <Icon size={14} />
              {label as string}
            </p>
            <p className="mt-2 break-words font-headline text-xl font-black text-white">{value as string | number}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TransferRow({ transfer }: { transfer: MockTransfer }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl bg-surface-high/50 p-4 text-sm md:grid-cols-[1fr_1fr_1fr_120px_90px_42px] md:items-center">
      <span className="font-mono text-xs font-bold text-primary">Tx: {shortenAddress(transfer.txHash)}</span>
      <span className="truncate text-on-surface-variant">From: <span className="font-bold text-white">{shortenAddress(transfer.from)}</span></span>
      <span className="truncate text-on-surface-variant">To: <span className="font-bold text-white">{shortenAddress(transfer.to)}</span></span>
      <span className="font-bold text-white">{formatTransferAmount(transfer.amount, transfer.asset)}</span>
      <span className="text-xs font-bold text-on-surface-variant">{transfer.timeLabel}</span>
      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ExternalLink size={15} />
      </button>
    </div>
  );
}

function LiveTransferFeed({ transfers }: { transfers: MockTransfer[] }) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Explorer Feed</p>
          <h2 className="mt-2 font-headline text-2xl font-black text-white">Son Transferler</h2>
        </div>
        <span className="rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-on-surface-variant">Son 10</span>
      </div>
      {!transfers.length ? (
        <EmptyState label="Bu ağ için transfer feed'i hazırlanıyor." />
      ) : (
        <div className="space-y-3">
          {transfers.slice(0, 10).map((transfer) => <TransferRow key={transfer.id} transfer={transfer} />)}
        </div>
      )}
    </section>
  );
}

function VolumeResultPanel({
  result,
  onReplay,
  onChangeAsset
}: {
  result: TransferVolumeResult;
  onReplay: () => void;
  onChangeAsset: () => void;
}) {
  const statusClass = result.status === 'Başarılı'
    ? 'border-secondary/25 bg-secondary/10'
    : result.status === 'Yaklaştın'
      ? 'border-primary/25 bg-primary/10'
      : 'border-error/25 bg-error/10';

  const rows = [
    ['Tahminin', formatTransferAmount(result.predictionAmount, result.asset)],
    ['Gerçekleşen Hacim', formatTransferAmount(result.actualVolume, result.asset)],
    ['Fark', formatTransferAmount(result.difference, result.asset)],
    ['Sapma', `%${result.percentageError}`],
    ['Transfer Sayısı', result.transferCount],
    ['En Büyük Transfer', formatTransferAmount(result.largestTransfer, result.asset)]
  ];

  return (
    <section className={cn('rounded-[28px] border p-6', statusClass)}>
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sonuç</p>
          <h2 className="mt-1 font-headline text-3xl font-black text-white">{result.status}</h2>
        </div>
        <div className="rounded-2xl bg-background/40 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sanal Puan</p>
          <p className="font-headline text-3xl font-black text-white">+{result.points}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label as string} className="rounded-2xl bg-background/35 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label as string}</p>
            <p className="mt-2 font-headline text-xl font-black text-white">{value as string | number}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={onReplay} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-background">
          <RefreshCcw size={16} />
          Tekrar Oyna
        </button>
        <button type="button" onClick={onChangeAsset} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-surface-high px-4 text-sm font-bold text-primary hover:bg-surface-highest">
          Coin Değiştir
        </button>
      </div>
    </section>
  );
}

function TransferVolumeStatsPanel({ stats }: { stats: TransferVolumeStats }) {
  const successRate = stats.totalAttempts ? Math.round((stats.successfulAttempts / stats.totalAttempts) * 100) : 0;
  const rows = [
    ['Toplam Puan', stats.totalScore],
    ['Toplam Deneme', stats.totalAttempts],
    ['Başarı Oranı', `%${successRate}`],
    ['En İyi Tahmin', stats.bestPredictionError === null ? '-' : `%${stats.bestPredictionError}`]
  ];

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <Trophy className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Skor Özeti</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div key={label as string} className="rounded-2xl bg-surface-high/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label as string}</p>
            <p className="mt-2 font-headline text-2xl font-black text-white">{value as string | number}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TransferVolumeHistoryPanel({ history }: { history: TransferVolumeResult[] }) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <History className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Son Oyunlar</h2>
      </div>
      {!history.length ? (
        <EmptyState label="Henüz tamamlanan oyun yok." />
      ) : (
        <div className="space-y-3">
          {history.slice(0, 10).map((item) => (
            <div key={item.id} className="rounded-2xl bg-surface-high/50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-bold text-white">{item.network} / {item.asset}</span>
                <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-black text-primary">+{item.points}</span>
              </div>
              <p className="text-xs leading-5 text-on-surface-variant">
                Tahmin {formatTransferAmount(item.predictionAmount, item.asset)} / Gerçek {formatTransferAmount(item.actualVolume, item.asset)}
              </p>
              <p className="mt-1 text-xs font-bold text-on-surface-variant">{item.status} / %{item.percentageError}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EducationNotes() {
  const notes = [
    ['Transfer hacmi nedir?', 'Belirli sürede ağda taşınan toplam coin miktarını ifade eder.'],
    ['Transfer sayısı ile hacim farklıdır.', 'Az sayıda işlem çok büyük hacim oluşturabilir, çok sayıda işlem düşük hacimde kalabilir.'],
    ['Whale transferleri hacmi neden etkiler?', 'Büyük cüzdan hareketleri kısa sürede toplam hacmi ciddi şekilde artırabilir.'],
    ['Gas fee nedir?', 'Bir ağda işlem yapmak için ödenen işlem ücretidir. Ağ yoğunlaştıkça artabilir.']
  ];

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <BookOpen className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Eğitim Notları</h2>
      </div>
      <div className="space-y-3">
        {notes.map(([title, body]) => (
          <div key={title} className="rounded-2xl bg-surface-high/50 p-4">
            <p className="font-bold text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TransferVolumeGuessPage() {
  const assets = useMemo(() => getSupportedAssets(), []);
  const [selectedAsset, setSelectedAsset] = useState<TransferAsset>(assets[0]);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [predictionAmount, setPredictionAmount] = useState('');
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [transferFeed, setTransferFeed] = useState<MockTransfer[]>(() => getLatestTransfers(assets[0], 6));
  const [gameState, setGameState] = useState<TransferVolumeGameState | null>(null);
  const [result, setResult] = useState<TransferVolumeResult | null>(null);
  const [stats, setStats] = useState<TransferVolumeStats>(() => getTransferVolumeStats());
  const [history, setHistory] = useState<TransferVolumeResult[]>(() => getTransferVolumeHistory());
  const gameStateRef = useRef<TransferVolumeGameState | null>(null);

  useEffect(() => {
    if (isGameRunning) return;
    setTransferFeed(getLatestTransfers(selectedAsset, 6));
  }, [isGameRunning, selectedAsset]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (!isGameRunning || !gameState) return;

    const timerId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
      const nextCountdown = Math.max(gameState.durationSeconds - elapsed, 0);
      setCountdown(nextCountdown);

      if (nextCountdown <= 0) {
        const finalState = gameStateRef.current;
        if (!finalState) return;
        const nextResult = finishTransferVolumeGame(finalState);
        setResult(nextResult);
        setHistory(saveTransferVolumeHistory(nextResult));
        setStats((current) => saveTransferVolumeStats(current, nextResult));
        setIsGameRunning(false);
        window.clearInterval(timerId);
      }
    }, 250);

    return () => window.clearInterval(timerId);
  }, [gameState, isGameRunning]);

  useEffect(() => {
    if (!isGameRunning || !gameState) return;

    let timeoutId: number | undefined;

    const scheduleTransfer = () => {
      timeoutId = window.setTimeout(() => {
        const transfer = generateMockTransfer(selectedAsset);
        setTransferFeed((current) => [transfer, ...current].slice(0, 10));
        setGameState((current) => {
          if (!current) return current;
          return {
            ...current,
            transfers: [transfer, ...current.transfers],
            totalVolume: Number((current.totalVolume + transfer.amount).toFixed(4)),
            transferCount: current.transferCount + 1,
            largestTransfer: Math.max(current.largestTransfer, transfer.amount)
          };
        });
        scheduleTransfer();
      }, Math.floor(1000 + Math.random() * 3000));
    };

    scheduleTransfer();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [gameState, isGameRunning, selectedAsset]);

  const totalVolume = gameState?.totalVolume ?? 0;
  const transferCount = gameState?.transferCount ?? 0;
  const largestTransfer = gameState?.largestTransfer ?? 0;

  function startGame() {
    const prediction = Number(predictionAmount);
    if (!selectedAsset || !Number.isFinite(prediction) || prediction <= 0 || isGameRunning) return;

    const nextGameState = startTransferVolumeGame({
      selectedAsset,
      durationSeconds: selectedDuration,
      predictionAmount: prediction
    });

    setResult(null);
    setCountdown(selectedDuration);
    setTransferFeed([]);
    setGameState(nextGameState);
    setIsGameRunning(true);
  }

  function replayGame() {
    setPredictionAmount('');
    setResult(null);
    setCountdown(selectedDuration);
    setGameState(null);
    setTransferFeed(getLatestTransfers(selectedAsset, 6));
  }

  function changeAsset() {
    replayGame();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 space-y-6 xl:col-span-8">
        <div className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Kripto Keyfi Games</p>
              <h1 className="font-headline text-4xl font-extrabold text-white md:text-5xl">Transfer Volume Guess</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant md:text-base">
                Seçtiğin ağda 1-3 dakika içinde ne kadar coin transfer edileceğini tahmin et ve on-chain aktiviteyi canlı takip et.
              </p>
            </div>
            <Link to="/games" className="inline-flex w-fit items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary hover:bg-surface-highest">
              Games
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Seçili Ağ</p>
              <p className="mt-2 font-headline text-xl font-black text-white">{selectedAsset.network}</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Coin</p>
              <p className="mt-2 font-headline text-xl font-black text-white">{selectedAsset.asset}</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Durum</p>
              <p className="mt-2 font-headline text-xl font-black text-white">{isGameRunning ? 'Oyun aktif' : result ? 'Sonuç hazır' : 'Tahmin bekleniyor'}</p>
            </div>
          </div>
        </div>

        <GameDisclaimer />
        <AssetSelector assets={assets} selectedAsset={selectedAsset} disabled={isGameRunning} onSelect={setSelectedAsset} />
        <DurationSelector selectedDuration={selectedDuration} disabled={isGameRunning} onSelect={(duration) => {
          setSelectedDuration(duration);
          setCountdown(duration);
        }} />
        <PredictionInput selectedAsset={selectedAsset} predictionAmount={predictionAmount} disabled={isGameRunning} onChange={setPredictionAmount} onStart={startGame} />
        <TransferVolumeDashboard selectedAsset={selectedAsset} countdown={countdown} isGameRunning={isGameRunning} totalVolume={totalVolume} transferCount={transferCount} largestTransfer={largestTransfer} />

        {result && <VolumeResultPanel result={result} onReplay={replayGame} onChangeAsset={changeAsset} />}

        <LiveTransferFeed transfers={transferFeed} />
      </section>

      <aside className="col-span-12 space-y-6 xl:col-span-4">
        <TransferVolumeStatsPanel stats={stats} />
        <TransferVolumeHistoryPanel history={history} />
        <EducationNotes />
      </aside>
    </div>
  );
}
