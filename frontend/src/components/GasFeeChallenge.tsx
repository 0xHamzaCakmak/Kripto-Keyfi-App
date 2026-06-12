import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, BookOpen, CheckCircle2, Clock3, Fuel, Gauge, History, Layers, RadioTower, ShieldAlert, Target, Trophy, XCircle, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  gasDifficultyOptions,
  gasModeOptions,
  GasAnswerResult,
  GasDifficulty,
  GasHistoryItem,
  GasMode,
  GasScenario,
  GasStats,
  getDifficultyLabel,
  getGasFeeHistory,
  getGasFeeStats,
  getModeLabel,
  getNextGasScenario,
  getSavedGasDifficulty,
  getSavedGasMode,
  saveGasDifficulty,
  saveGasFeeHistory,
  saveGasFeeStats,
  saveGasMode,
  submitGasFeeAnswer
} from '../services/gasFeeChallengeService';

function GameDisclaimer() {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/10 p-4 text-sm leading-6 text-on-surface">
      <ShieldAlert className="mt-0.5 shrink-0 text-primary" size={18} />
      <p>Bu oyun eğitim ve eğlence amaçlıdır. Gerçek işlem, yatırım tavsiyesi veya finansal kazanç sistemi değildir.</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl bg-surface-high/50 p-5 text-sm text-on-surface-variant">{label}</div>;
}

function GasModeSelector({
  selectedMode,
  disabled,
  onSelect
}: {
  selectedMode: GasMode;
  disabled: boolean;
  onSelect: (mode: GasMode) => void;
}) {
  const iconMap = {
    gas_direction: Gauge,
    transaction_cost: Fuel,
    cheapest_network: Target,
    layer2_compare: Layers
  };

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Oyun Modu</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {gasModeOptions.map((option) => {
          const Icon = iconMap[option.value];
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option.value)}
              className={cn(
                'min-h-[132px] rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60',
                selectedMode === option.value
                  ? 'border-primary bg-primary/10 shadow-[0_0_22px_rgba(141,172,255,0.10)]'
                  : 'border-outline/10 bg-surface-high/50 hover:border-primary/30'
              )}
            >
              <Icon className="mb-4 text-primary" size={22} />
              <p className="font-headline text-lg font-black text-white">{option.label}</p>
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">{option.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GasDifficultySelector({
  selectedDifficulty,
  disabled,
  onSelect
}: {
  selectedDifficulty: GasDifficulty;
  disabled: boolean;
  onSelect: (difficulty: GasDifficulty) => void;
}) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Zorluk</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {gasDifficultyOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className={cn(
              'min-h-[96px] rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60',
              selectedDifficulty === option.value
                ? 'border-primary bg-primary text-background'
                : 'border-outline/10 bg-surface-high/60 text-on-surface-variant hover:border-primary/30 hover:text-white'
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-headline text-lg font-black">{option.label}</span>
              <span className={cn('rounded-lg px-2 py-1 text-[10px] font-bold', selectedDifficulty === option.value ? 'bg-background/15' : 'bg-primary/10 text-primary')}>+{option.bonus}</span>
            </div>
            <p className="text-xs leading-5">{option.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function GasComparisonTable({ scenario }: { scenario: GasScenario }) {
  if (!scenario.comparisonTable?.length) return null;

  return (
    <div className="rounded-2xl border border-outline/10 bg-background/30 p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Ağ Ücret Karşılaştırması</p>
      <div className="space-y-2">
        {scenario.comparisonTable.map((row) => (
          <div key={row.network} className="grid grid-cols-1 gap-2 rounded-xl bg-surface-high/60 p-3 text-sm md:grid-cols-[110px_90px_110px_1fr]">
            <span className="font-bold text-white">{row.network}</span>
            <span className="text-on-surface-variant">{row.gasGwei}</span>
            <span className="font-bold text-primary">{row.estimatedCostUsd}</span>
            <span className="text-on-surface-variant">{row.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GasScenarioCard({ scenario }: { scenario: GasScenario }) {
  const metrics = [
    ['Network', scenario.network, RadioTower],
    ['İşlem türü', scenario.transactionType, Activity],
    ['Current Gas', scenario.currentGasGwei, Gauge],
    ['Pending Tx', scenario.pendingTx, Clock3],
    ['Ağ durumu', scenario.networkStatus, Zap],
    ['Gas Limit', scenario.gasLimit, Fuel],
    ['Tahmini Maliyet', scenario.estimatedCostUsd, Target]
  ];

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-primary/20 bg-surface p-6 shadow-[0_0_42px_rgba(141,172,255,0.08)] md:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-tertiary" />
      <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-background/60 text-primary">
            <Fuel size={31} />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">{getModeLabel(scenario.mode)} / {getDifficultyLabel(scenario.difficulty)}</p>
            <h2 className="font-headline text-3xl font-black text-white">{scenario.title}</h2>
            <p className="mt-1 text-sm font-bold text-on-surface-variant">{scenario.question}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-surface-high/60 p-4 lg:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Yaklaşık</p>
          <p className="mt-1 font-headline text-2xl font-black text-white">{scenario.estimatedCostUsd}</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <div key={label as string} className="rounded-2xl bg-surface-high/50 p-4">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <Icon size={14} />
              {label as string}
            </p>
            <p className="mt-2 break-words text-sm font-bold text-white">{value as string}</p>
          </div>
        ))}
      </div>

      <GasComparisonTable scenario={scenario} />
    </section>
  );
}

function GasAnswerOptions({
  scenario,
  selectedAnswer,
  disabled,
  onSelect
}: {
  scenario: GasScenario;
  selectedAnswer: string | null;
  disabled: boolean;
  onSelect: (answer: string) => void;
}) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Cevap Seçenekleri</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {scenario.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option)}
            className={cn(
              'min-h-[58px] rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60',
              selectedAnswer === option
                ? 'border-primary bg-primary text-background'
                : 'border-outline/10 bg-surface-high/60 text-on-surface-variant hover:border-primary/30 hover:text-white'
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}

function GasLearningNote({ note }: { note: string }) {
  return (
    <div className="rounded-2xl bg-surface-high/50 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Öğrenme Notu</p>
      <p className="text-sm leading-6 text-on-surface-variant">{note}</p>
    </div>
  );
}

function GasResultPanel({
  scenario,
  selectedAnswer,
  result,
  onNext
}: {
  scenario: GasScenario;
  selectedAnswer: string;
  result: GasAnswerResult;
  onNext: () => void;
}) {
  return (
    <section className={cn('rounded-[28px] border p-6', result.isCorrect ? 'border-secondary/25 bg-secondary/10' : 'border-primary/20 bg-surface')}>
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          {result.isCorrect ? <CheckCircle2 className="text-secondary" size={26} /> : <XCircle className="text-primary" size={26} />}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sonuç</p>
            <h3 className="font-headline text-2xl font-black text-white">{result.isCorrect ? 'Doğru Cevap' : 'Cevap Gösterildi'}</h3>
          </div>
        </div>
        <div className="rounded-2xl bg-background/40 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sanal Puan</p>
          <p className="font-headline text-3xl font-black text-white">+{result.points}</p>
          {result.streakBonus > 0 && <p className="mt-1 text-xs font-bold text-secondary">Seri bonusu +{result.streakBonus}</p>}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={cn('rounded-2xl p-4', result.isCorrect ? 'bg-secondary/10' : 'bg-error/10')}>
          <p className="mb-2 text-xs font-bold text-on-surface-variant">Senin cevabın</p>
          <p className="text-sm font-bold text-white">{selectedAnswer}</p>
        </div>
        <div className="rounded-2xl bg-background/40 p-4">
          <p className="mb-2 text-xs font-bold text-on-surface-variant">Doğru cevap</p>
          <p className="text-sm font-bold text-white">{scenario.correctAnswer}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-background/40 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Neden?</p>
          <p className="text-sm leading-6 text-on-surface">{scenario.explanation}</p>
        </div>
        <GasLearningNote note={scenario.learningNote} />
      </div>

      <button type="button" onClick={onNext} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background transition-all hover:shadow-[0_0_24px_rgba(141,172,255,0.24)]">
        Sonraki Senaryo
        <ArrowRight size={16} />
      </button>
    </section>
  );
}

function GasScorePanel({ stats }: { stats: GasStats }) {
  const successRate = stats.totalAttempts ? Math.round((stats.correctAnswers / stats.totalAttempts) * 100) : 0;
  const rows = [
    ['Toplam Puan', stats.totalScore],
    ['Toplam Deneme', stats.totalAttempts],
    ['Doğru Cevap', stats.correctAnswers],
    ['Başarı Oranı', `%${successRate}`],
    ['Mevcut Seri', stats.currentStreak],
    ['En İyi Seri', stats.bestStreak]
  ];

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <Trophy className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Skor</h2>
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

function GasHistory({ history }: { history: GasHistoryItem[] }) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <History className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Son Cevaplar</h2>
      </div>
      {!history.length ? (
        <EmptyState label="Henüz cevap yok. İlk gas senaryosunu çözünce burada görünecek." />
      ) : (
        <div className="space-y-3">
          {history.slice(0, 10).map((item) => (
            <div key={item.id} className="rounded-2xl bg-surface-high/50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-bold text-white">{item.title}</span>
                <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-black text-primary">+{item.points}</span>
              </div>
              <p className="text-xs leading-5 text-on-surface-variant">{getModeLabel(item.mode)} / {getDifficultyLabel(item.difficulty)}</p>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">Cevap: {item.selectedAnswer} / {item.correctAnswer}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GasGlossary() {
  const items = [
    ['Gas', 'Blockchain üzerinde işlem yürütmek için gereken hesaplama birimi.'],
    ['Gwei', 'Ethereum gas fiyatını ifade etmek için kullanılan küçük ETH birimi.'],
    ['Gas Limit', 'İşlemin kullanabileceği maksimum gas miktarı.'],
    ['Base Fee', 'EIP-1559 sonrası bloklara göre ayarlanan temel ücret.'],
    ['Priority Fee', 'İşlemin daha hızlı dahil edilmesi için verilen bahşiş benzeri ücret.'],
    ['Pending Transaction', 'Henüz bloğa dahil edilmemiş bekleyen işlem.'],
    ['Network Congestion', 'Ağdaki işlem talebinin artmasıyla oluşan yoğunluk.'],
    ['Layer-2', 'Ana ağ güvenliğinden yararlanarak daha düşük maliyet hedefleyen ölçekleme ağı.'],
    ['Rollup', 'Çok sayıda işlemi paketleyip L1’e veri gönderen L2 yaklaşımı.'],
    ['Bridge', 'Varlıkları ağlar arasında taşımaya yarayan protokol.'],
    ['Contract Deploy', 'Yeni smart contract yayınlama işlemi.'],
    ['Swap', 'Bir tokenı başka bir tokenla değiştirme işlemi.'],
    ['Approve', 'Bir kontrata token harcama izni verme işlemi.']
  ];

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <BookOpen className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Gas Sözlüğü</h2>
      </div>
      <div className="space-y-3">
        {items.map(([title, body]) => (
          <div key={title} className="rounded-2xl bg-surface-high/50 p-4">
            <p className="font-bold text-white">{title}</p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function GasFeeChallengePage() {
  const [selectedMode, setSelectedMode] = useState<GasMode>(() => getSavedGasMode());
  const [selectedDifficulty, setSelectedDifficulty] = useState<GasDifficulty>(() => getSavedGasDifficulty());
  const [currentScenario, setCurrentScenario] = useState<GasScenario>(() => getNextGasScenario(getSavedGasMode(), getSavedGasDifficulty()));
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [result, setResult] = useState<GasAnswerResult | null>(null);
  const [stats, setStats] = useState<GasStats>(() => getGasFeeStats());
  const [history, setHistory] = useState<GasHistoryItem[]>(() => getGasFeeHistory());

  const statusText = useMemo(() => {
    if (isAnswered) return 'Cevap gösterildi';
    if (!selectedAnswer) return 'Cevap bekleniyor';
    return 'Cevabı gösterebilirsin';
  }, [isAnswered, selectedAnswer]);

  function resetScenario(mode: GasMode, difficulty: GasDifficulty, currentId?: string) {
    setCurrentScenario(getNextGasScenario(mode, difficulty, currentId));
    setSelectedAnswer(null);
    setIsAnswered(false);
    setResult(null);
  }

  function handleModeChange(mode: GasMode) {
    setSelectedMode(mode);
    saveGasMode(mode);
    resetScenario(mode, selectedDifficulty, currentScenario.id);
  }

  function handleDifficultyChange(difficulty: GasDifficulty) {
    setSelectedDifficulty(difficulty);
    saveGasDifficulty(difficulty);
    resetScenario(selectedMode, difficulty, currentScenario.id);
  }

  function handleSubmit() {
    if (!selectedAnswer || isAnswered) return;
    const nextResult = submitGasFeeAnswer(currentScenario, selectedAnswer, stats.currentStreak);
    const historyItem: GasHistoryItem = {
      id: `${Date.now()}`,
      scenarioId: currentScenario.id,
      mode: currentScenario.mode,
      difficulty: currentScenario.difficulty,
      title: currentScenario.title,
      selectedAnswer,
      correctAnswer: currentScenario.correctAnswer,
      points: nextResult.points,
      createdAt: new Date().toISOString()
    };

    setResult(nextResult);
    setIsAnswered(true);
    setStats((current) => saveGasFeeStats(current, nextResult));
    setHistory(saveGasFeeHistory(historyItem));
  }

  function handleNext() {
    resetScenario(selectedMode, selectedDifficulty, currentScenario.id);
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 space-y-6 xl:col-span-8">
        <div className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Kripto Keyfi Games</p>
              <h1 className="font-headline text-4xl font-extrabold text-white md:text-5xl">Gas Fee Challenge</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant md:text-base">
                Ethereum, Layer-2 ve farklı ağlarda işlem ücretlerini tahmin et. Gas, Gwei ve ağ yoğunluğunu eğlenerek öğren.
              </p>
            </div>
            <Link to="/games" className="inline-flex w-fit items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary hover:bg-surface-highest">
              Games
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Mod</p>
              <p className="mt-2 font-headline text-xl font-black text-white">{getModeLabel(selectedMode)}</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Zorluk</p>
              <p className="mt-2 font-headline text-xl font-black text-white">{getDifficultyLabel(selectedDifficulty)}</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Durum</p>
              <p className="mt-2 flex items-center gap-2 font-headline text-xl font-black text-white"><Target size={20} /> {statusText}</p>
            </div>
          </div>
        </div>

        <GameDisclaimer />
        <GasModeSelector selectedMode={selectedMode} disabled={isAnswered} onSelect={handleModeChange} />
        <GasDifficultySelector selectedDifficulty={selectedDifficulty} disabled={isAnswered} onSelect={handleDifficultyChange} />
        <GasScenarioCard scenario={currentScenario} />
        <GasAnswerOptions scenario={currentScenario} selectedAnswer={selectedAnswer} disabled={isAnswered} onSelect={setSelectedAnswer} />

        {!isAnswered && (
          <button
            type="button"
            disabled={!selectedAnswer}
            onClick={handleSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-black text-background transition-all hover:shadow-[0_0_24px_rgba(141,172,255,0.24)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cevabı Göster
            <Gauge size={18} />
          </button>
        )}

        {isAnswered && result && selectedAnswer && (
          <GasResultPanel scenario={currentScenario} selectedAnswer={selectedAnswer} result={result} onNext={handleNext} />
        )}
      </section>

      <aside className="col-span-12 space-y-6 xl:col-span-4">
        <GasScorePanel stats={stats} />
        <GasHistory history={history} />
        <GasGlossary />
      </aside>
    </div>
  );
}
