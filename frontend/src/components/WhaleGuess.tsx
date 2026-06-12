import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  History,
  Minus,
  RadioTower,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  flowTypeOptions,
  getFlowTypeLabel,
  getMockWhaleScenario,
  getNextWhaleScenario,
  getSentimentLabel,
  getWhaleGuessHistory,
  getWhaleGuessStats,
  saveWhaleGuessHistory,
  saveWhaleGuessStats,
  sentimentOptions,
  shortenAddress,
  submitWhaleGuess,
  WhaleFlowType,
  WhaleGuessHistoryItem,
  WhaleGuessResult,
  WhaleGuessStats,
  WhaleScenario,
  WhaleSentiment
} from '../services/whaleGuessService';

const disclaimerText = 'Bu oyun eğitim ve eğlence amaçlıdır. Gerçek yatırım tavsiyesi, trade sinyali veya finansal kazanç sistemi değildir.';

function GameDisclaimer() {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/10 p-4 text-sm leading-6 text-on-surface">
      <ShieldAlert className="mt-0.5 shrink-0 text-primary" size={18} />
      <p>{disclaimerText}</p>
    </div>
  );
}

function severityClass(severity: WhaleScenario['severity']) {
  if (severity === 'Critical') return 'bg-error/10 text-error border-error/20';
  if (severity === 'High') return 'bg-secondary/10 text-secondary border-secondary/20';
  return 'bg-primary/10 text-primary border-primary/20';
}

function assetClass(asset: string) {
  if (asset === 'BTC') return 'bg-[#f7931a] text-background';
  if (asset === 'ETH') return 'bg-[#627eea] text-white';
  if (asset === 'USDT') return 'bg-[#26a17b] text-background';
  if (asset === 'USDC') return 'bg-[#2775ca] text-white';
  if (asset === 'SOL') return 'bg-secondary text-background';
  return 'bg-primary text-background';
}

function WhaleTransferCard({ scenario }: { scenario: WhaleScenario }) {
  const details = [
    ['Ağ', scenario.network],
    ['Kaynak', scenario.fromLabel],
    ['Hedef', scenario.toLabel],
    ['Tx Hash', shortenAddress(scenario.txHash)],
    ['Zaman', scenario.timestamp]
  ];

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-primary/20 bg-surface p-6 shadow-[0_0_42px_rgba(141,172,255,0.08)] md:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-tertiary" />
      <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-background/60 text-3xl">
            🐋
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-xl px-3 py-1 text-xs font-black', assetClass(scenario.asset))}>{scenario.asset}</span>
              <span className={cn('rounded-xl border px-3 py-1 text-xs font-bold', severityClass(scenario.severity))}>{scenario.severity}</span>
            </div>
            <h2 className="font-headline text-3xl font-black text-white">{scenario.amount}</h2>
            <p className="mt-1 text-sm font-bold text-on-surface-variant">{scenario.assetName} transferi</p>
          </div>
        </div>
        <div className="rounded-2xl bg-surface-high/60 p-4 lg:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">USD Değer</p>
          <p className="mt-1 font-headline text-2xl font-black text-white">{scenario.amountUsd}</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface-high/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
            <p className="mt-2 truncate text-sm font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-outline/10 bg-background/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Kaynak Adres</p>
          <p className="mt-2 break-all font-mono text-xs text-on-surface">{shortenAddress(scenario.fromAddress)}</p>
        </div>
        <div className="rounded-2xl border border-outline/10 bg-background/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Hedef Adres</p>
          <p className="mt-2 break-all font-mono text-xs text-on-surface">{shortenAddress(scenario.toAddress)}</p>
        </div>
      </div>

      <button type="button" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-highest">
        Explorer'da Görüntüle
        <ExternalLink size={16} />
      </button>
    </section>
  );
}

function SentimentOptions({
  selected,
  disabled,
  onSelect
}: {
  selected: WhaleSentiment | null;
  disabled: boolean;
  onSelect: (sentiment: WhaleSentiment) => void;
}) {
  const iconMap = { TrendingUp, TrendingDown, Minus };

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Piyasa Etkisi Tahmini</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {sentimentOptions.map((option) => {
          const Icon = iconMap[option.icon as keyof typeof iconMap];
          const isSelected = selected === option.value;
          const colorClass = option.value === 'bullish'
            ? 'border-secondary/25 bg-secondary/10 text-secondary'
            : option.value === 'bearish'
              ? 'border-error/25 bg-error/10 text-error'
              : 'border-primary/25 bg-primary/10 text-primary';

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option.value)}
              className={cn(
                'flex min-h-[96px] flex-col items-start justify-center rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60',
                isSelected ? colorClass : 'border-outline/10 bg-surface-high/60 text-on-surface-variant hover:border-primary/30 hover:text-white'
              )}
            >
              <span className="mb-2 flex items-center gap-2 text-base font-black">
                <Icon size={18} />
                {option.label}
              </span>
              <span className="text-xs font-medium leading-5">{option.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FlowTypeOptions({
  selected,
  disabled,
  onSelect
}: {
  selected: WhaleFlowType | null;
  disabled: boolean;
  onSelect: (flowType: WhaleFlowType) => void;
}) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Transfer Tipi Tahmini</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {flowTypeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className={cn(
              'min-h-[54px] rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60',
              selected === option.value
                ? 'border-primary bg-primary text-background'
                : 'border-outline/10 bg-surface-high/60 text-on-surface-variant hover:border-primary/30 hover:text-white'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function GuessResultPanel({
  scenario,
  selectedSentiment,
  selectedFlowType,
  result,
  onNext
}: {
  scenario: WhaleScenario;
  selectedSentiment: WhaleSentiment;
  selectedFlowType: WhaleFlowType;
  result: WhaleGuessResult;
  onNext: () => void;
}) {
  return (
    <section className={cn('rounded-[28px] border p-6', result.isPerfect ? 'border-secondary/25 bg-secondary/10' : 'border-primary/20 bg-surface')}>
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          {result.isPerfect ? <CheckCircle2 className="text-secondary" size={26} /> : <XCircle className="text-primary" size={26} />}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sonuç</p>
            <h3 className="font-headline text-2xl font-black text-white">{result.isPerfect ? 'Tam İsabet' : 'Cevap Gösterildi'}</h3>
          </div>
        </div>
        <div className="rounded-2xl bg-background/40 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Kazanılan Puan</p>
          <p className="font-headline text-3xl font-black text-white">+{result.points}</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={cn('rounded-2xl p-4', result.sentimentCorrect ? 'bg-secondary/10' : 'bg-error/10')}>
          <p className="mb-2 text-xs font-bold text-on-surface-variant">Piyasa etkisi</p>
          <p className="text-sm text-on-surface">Senin seçimin: <span className="font-bold text-white">{getSentimentLabel(selectedSentiment)}</span></p>
          <p className="mt-1 text-sm text-on-surface">Doğru cevap: <span className="font-bold text-white">{getSentimentLabel(scenario.correctSentiment)}</span></p>
        </div>
        <div className={cn('rounded-2xl p-4', result.flowTypeCorrect ? 'bg-secondary/10' : 'bg-error/10')}>
          <p className="mb-2 text-xs font-bold text-on-surface-variant">Transfer tipi</p>
          <p className="text-sm text-on-surface">Senin seçimin: <span className="font-bold text-white">{getFlowTypeLabel(selectedFlowType)}</span></p>
          <p className="mt-1 text-sm text-on-surface">Doğru cevap: <span className="font-bold text-white">{getFlowTypeLabel(scenario.correctFlowType)}</span></p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-background/40 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Neden?</p>
          <p className="text-sm leading-6 text-on-surface">{scenario.explanation}</p>
        </div>
        <div className="rounded-2xl bg-surface-high/50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Öğrenme Notu</p>
          <p className="text-sm leading-6 text-on-surface-variant">{scenario.learningNote}</p>
        </div>
      </div>

      <button type="button" onClick={onNext} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background transition-all hover:shadow-[0_0_24px_rgba(141,172,255,0.24)]">
        Sonraki Whale
        <ArrowRight size={16} />
      </button>
    </section>
  );
}

function WhaleScorePanel({ stats }: { stats: WhaleGuessStats }) {
  const successRate = stats.totalAttempts ? Math.round((stats.correctAttempts / stats.totalAttempts) * 100) : 0;
  const rows = [
    ['Toplam Puan', stats.totalScore],
    ['Toplam Deneme', stats.totalAttempts],
    ['Doğru Tahmin', stats.correctAttempts],
    ['Başarı Oranı', `%${successRate}`],
    ['En İyi Seri', stats.bestStreak],
    ['Mevcut Seri', stats.currentStreak]
  ];

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <Trophy className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Skor</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface-high/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
            <p className="mt-2 font-headline text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl bg-surface-high/50 p-5 text-sm text-on-surface-variant">
      {label}
    </div>
  );
}

function WhaleGuessHistory({ history }: { history: WhaleGuessHistoryItem[] }) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <History className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Son Tahminlerim</h2>
      </div>
      {!history.length ? (
        <EmptyState label="Henüz tahmin yok. İlk whale senaryosunu cevapladığında burada görünecek." />
      ) : (
        <div className="space-y-3">
          {history.slice(0, 10).map((item) => (
            <div key={item.id} className="rounded-2xl bg-surface-high/50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-bold text-white">{item.amount} {item.asset}</span>
                <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-black text-primary">+{item.points}</span>
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs leading-5 text-on-surface-variant">
                <span>Sentiment: {getSentimentLabel(item.selectedSentiment)} / {getSentimentLabel(item.correctSentiment)}</span>
                <span>Tip: {getFlowTypeLabel(item.selectedFlowType)} / {getFlowTypeLabel(item.correctFlowType)}</span>
                <span>{new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WhaleEducationPanel() {
  const notes = [
    'Exchange inflow: Borsaya giriş, potansiyel satış baskısı olabilir.',
    'Exchange outflow: Borsadan çıkış, elde tutma eğilimi olabilir.',
    'Wallet to wallet: Tek başına net sinyal üretmeyebilir.',
    'Bridge: Ağlar arası likidite hareketidir.',
    'Staking: Uzun vadeli kilitleme davranışı olabilir.',
    'Mint/Burn: Stablecoin arz değişimi veya token arz hareketi olabilir.'
  ];

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <BookOpen className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Whale hareketleri nasıl okunur?</h2>
      </div>
      <div className="space-y-3">
        {notes.map((note) => (
          <p key={note} className="rounded-2xl bg-surface-high/50 p-3 text-sm leading-6 text-on-surface-variant">{note}</p>
        ))}
      </div>
    </section>
  );
}

function FlowTypeGlossary() {
  const [isOpen, setIsOpen] = useState(false);
  const items = [
    ['Exchange Inflow nedir?', 'Bir varlığın kişisel veya bilinmeyen cüzdandan borsaya taşınmasıdır. Genellikle potansiyel satış hazırlığı olarak izlenir.'],
    ['Exchange Outflow nedir?', 'Varlığın borsadan kişisel veya cold wallet tarafına çıkmasıdır. Elde tutma eğilimi olabilir.'],
    ['Bridge nedir?', 'Varlıkların bir ağdan başka bir ağa taşınmasını sağlayan akıştır.'],
    ['Staking nedir?', 'Varlıkların ağ güvenliği veya getiri mekanizması için kontratta kilitlenmesidir.'],
    ['Mint/Burn nedir?', 'Token arzının oluşturulması veya dolaşımdan çıkarılmasıdır.'],
    ['Cold Wallet nedir?', 'Genellikle uzun vadeli saklama için kullanılan, borsa dışı cüzdan tipidir.']
  ];

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-4 text-left">
        <span className="font-headline text-xl font-bold text-white">Transfer Tipi Sözlüğü</span>
        {isOpen ? <ChevronUp className="text-primary" size={20} /> : <ChevronDown className="text-primary" size={20} />}
      </button>
      {isOpen && (
        <div className="mt-5 space-y-3">
          {items.map(([title, body]) => (
            <div key={title} className="rounded-2xl bg-surface-high/50 p-4">
              <p className="font-bold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function WhaleGuessPage() {
  const [currentScenario, setCurrentScenario] = useState<WhaleScenario>(() => getMockWhaleScenario());
  const [selectedSentiment, setSelectedSentiment] = useState<WhaleSentiment | null>(null);
  const [selectedFlowType, setSelectedFlowType] = useState<WhaleFlowType | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [result, setResult] = useState<WhaleGuessResult | null>(null);
  const [stats, setStats] = useState<WhaleGuessStats>(() => getWhaleGuessStats());
  const [history, setHistory] = useState<WhaleGuessHistoryItem[]>(() => getWhaleGuessHistory());
  const [loading, setLoading] = useState(false);
  const canSubmit = Boolean(selectedSentiment && selectedFlowType && !isAnswered);

  const statusText = useMemo(() => {
    if (isAnswered) return 'Cevap gösterildi';
    if (!selectedSentiment && !selectedFlowType) return 'Tahmin bekleniyor';
    if (!selectedSentiment || !selectedFlowType) return 'Bir seçim daha gerekli';
    return 'Cevabı gösterebilirsin';
  }, [isAnswered, selectedFlowType, selectedSentiment]);

  function handleSubmit() {
    if (!selectedSentiment || !selectedFlowType || isAnswered) return;

    const nextResult = submitWhaleGuess(currentScenario, selectedSentiment, selectedFlowType);
    const nextHistoryItem: WhaleGuessHistoryItem = {
      id: `${Date.now()}`,
      scenarioId: currentScenario.id,
      asset: currentScenario.asset,
      amount: currentScenario.amount,
      selectedSentiment,
      correctSentiment: currentScenario.correctSentiment,
      selectedFlowType,
      correctFlowType: currentScenario.correctFlowType,
      points: nextResult.points,
      createdAt: new Date().toISOString()
    };

    setResult(nextResult);
    setIsAnswered(true);
    setStats((current) => saveWhaleGuessStats(current, nextResult));
    setHistory(saveWhaleGuessHistory(nextHistoryItem));
  }

  function handleNext() {
    setLoading(true);
    const nextScenario = getNextWhaleScenario(currentScenario.id);
    setCurrentScenario(nextScenario);
    setSelectedSentiment(null);
    setSelectedFlowType(null);
    setIsAnswered(false);
    setResult(null);
    window.setTimeout(() => setLoading(false), 180);
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 space-y-6 xl:col-span-8">
        <div className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Kripto Keyfi Games</p>
              <h1 className="font-headline text-4xl font-extrabold text-white md:text-5xl">Whale Guess</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant md:text-base">
                Büyük cüzdan hareketlerini incele, hareketin piyasa etkisini tahmin et ve on-chain okuryazarlığını geliştir.
              </p>
            </div>
            <Link to="/games" className="inline-flex w-fit items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary hover:bg-surface-highest">
              Games
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Durum</p>
              <p className="mt-2 flex items-center gap-2 font-headline text-xl font-black text-white"><Target size={20} /> {statusText}</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Senaryo</p>
              <p className="mt-2 flex items-center gap-2 font-headline text-xl font-black text-white"><RadioTower size={20} /> {currentScenario.severity}</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Zaman</p>
              <p className="mt-2 flex items-center gap-2 font-headline text-xl font-black text-white"><Clock3 size={20} /> {currentScenario.timestamp}</p>
            </div>
          </div>
        </div>

        <GameDisclaimer />
        <WhaleTransferCard scenario={currentScenario} />

        {loading ? (
          <div className="rounded-[28px] border border-outline/5 bg-surface p-8 text-center text-sm font-bold text-primary">
            Yeni whale senaryosu hazırlanıyor...
          </div>
        ) : (
          <>
            <SentimentOptions selected={selectedSentiment} disabled={isAnswered} onSelect={setSelectedSentiment} />
            <FlowTypeOptions selected={selectedFlowType} disabled={isAnswered} onSelect={setSelectedFlowType} />
          </>
        )}

        {!isAnswered && (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-black text-background transition-all hover:shadow-[0_0_24px_rgba(141,172,255,0.24)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cevabı Göster
            <Activity size={18} />
          </button>
        )}

        {isAnswered && result && selectedSentiment && selectedFlowType && (
          <GuessResultPanel
            scenario={currentScenario}
            selectedSentiment={selectedSentiment}
            selectedFlowType={selectedFlowType}
            result={result}
            onNext={handleNext}
          />
        )}
      </section>

      <aside className="col-span-12 space-y-6 xl:col-span-4">
        <WhaleScorePanel stats={stats} />
        <WhaleGuessHistory history={history} />
        <WhaleEducationPanel />
        <FlowTypeGlossary />
      </aside>
    </div>
  );
}
