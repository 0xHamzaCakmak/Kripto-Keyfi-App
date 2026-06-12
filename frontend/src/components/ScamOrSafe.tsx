import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Code2, History, LockKeyhole, ShieldAlert, ShieldCheck, Target, Trophy, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  difficultyOptions,
  getDifficultyLabel,
  getMainRiskLabel,
  getNextScenario,
  getRiskLevelLabel,
  getSavedDifficulty,
  getScamHistory,
  getScamStats,
  mainRiskOptions,
  needsMainRisk,
  riskLevelOptions,
  saveScamHistory,
  saveScamStats,
  saveSelectedDifficulty,
  ScamDifficulty,
  ScamGuessResult,
  ScamHistoryItem,
  ScamMainRisk,
  ScamRiskLevel,
  ScamScenario,
  ScamStats,
  submitScamGuess
} from '../services/scamOrSafeService';

function GameDisclaimer() {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/10 p-4 text-sm leading-6 text-on-surface">
      <ShieldAlert className="mt-0.5 shrink-0 text-primary" size={18} />
      <p>Bu oyun eğitim ve eğlence amaçlıdır. Gerçek yatırım tavsiyesi veya finansal karar aracı değildir.</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl bg-surface-high/50 p-5 text-sm text-on-surface-variant">{label}</div>;
}

function DifficultySelector({
  selectedDifficulty,
  disabled,
  onSelect
}: {
  selectedDifficulty: ScamDifficulty;
  disabled: boolean;
  onSelect: (difficulty: ScamDifficulty) => void;
}) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Zorluk Seviyesi</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {difficultyOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.value)}
            className={cn(
              'min-h-[118px] rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60',
              selectedDifficulty === option.value
                ? 'border-primary bg-primary/10 shadow-[0_0_22px_rgba(141,172,255,0.10)]'
                : 'border-outline/10 bg-surface-high/50 hover:border-primary/30'
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="font-headline text-lg font-black text-white">{option.label}</span>
              <span className="rounded-lg bg-surface-highest px-2 py-1 text-[10px] font-bold text-primary">+{option.bonus}</span>
            </div>
            <p className="text-xs leading-5 text-on-surface-variant">{option.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function fieldValue(value: boolean | string) {
  if (typeof value === 'boolean') return value ? 'Var' : 'Yok';
  return value;
}

function ContractCodeSnippet({ code }: { code?: string }) {
  if (!code) return null;

  return (
    <div className="rounded-2xl border border-outline/10 bg-background/70 p-4">
      <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
        <Code2 size={14} />
        Contract Snippet
      </p>
      <pre className="max-w-full overflow-x-auto whitespace-pre rounded-xl bg-[#050a16] p-4 text-xs leading-6 text-on-surface">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ScamScenarioCard({ scenario }: { scenario: ScamScenario }) {
  const fields = [
    ['Network', scenario.network],
    ['Proje yaşı', scenario.projectAge],
    ['Holder', scenario.holders],
    ['Likidite', scenario.liquidity],
    ['Likidite kilidi', scenario.liquidityLocked],
    ['Kilit süresi', scenario.liquidityLockDuration],
    ['Audit', scenario.auditStatus],
    ['Audit sağlayıcı', scenario.auditProvider],
    ['Owner renounced', scenario.ownerRenounced],
    ['Mint açık', scenario.mintEnabled],
    ['Blacklist', scenario.blacklistEnabled],
    ['Honeypot', scenario.honeypotRisk],
    ['Buy tax', scenario.buyTax],
    ['Sell tax', scenario.sellTax],
    ['Top holder', scenario.topHoldersPercent],
    ['Verified', scenario.contractVerified],
    ['Website', scenario.websiteStatus],
    ['Sosyal', scenario.socialStatus]
  ];

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-primary/20 bg-surface p-6 shadow-[0_0_42px_rgba(141,172,255,0.08)] md:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-error" />
      <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-background/60 text-primary">
            <LockKeyhole size={30} />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">{getDifficultyLabel(scenario.difficulty)}</p>
            <h2 className="font-headline text-3xl font-black text-white">{scenario.projectName}</h2>
            <p className="mt-1 text-sm font-bold text-on-surface-variant">{scenario.title} / {scenario.tokenSymbol}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-surface-high/60 p-4 lg:text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Risk Sinyali</p>
          <p className="mt-1 font-headline text-2xl font-black text-white">{scenario.riskSignals.length}</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label as string} className="rounded-2xl bg-surface-high/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label as string}</p>
            <p className="mt-2 text-sm font-bold text-white">{fieldValue(value as boolean | string)}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-2xl border border-outline/10 bg-background/30 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Gösterilen Risk Sinyalleri</p>
        <div className="flex flex-wrap gap-2">
          {scenario.riskSignals.map((signal) => (
            <span key={signal} className="rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-on-surface">
              {signal}
            </span>
          ))}
        </div>
      </div>

      <ContractCodeSnippet code={scenario.codeSnippet} />
    </section>
  );
}

function riskToneClass(tone: 'safe' | 'warn' | 'danger', selected: boolean) {
  if (!selected) return 'border-outline/10 bg-surface-high/60 text-on-surface-variant hover:border-primary/30 hover:text-white';
  if (tone === 'safe') return 'border-secondary/30 bg-secondary/10 text-secondary';
  if (tone === 'warn') return 'border-[#ffbf47]/30 bg-[#ffbf47]/10 text-[#ffbf47]';
  return 'border-error/30 bg-error/10 text-error';
}

function RiskLevelOptions({
  selected,
  disabled,
  onSelect
}: {
  selected: ScamRiskLevel | null;
  disabled: boolean;
  onSelect: (riskLevel: ScamRiskLevel) => void;
}) {
  const iconMap = {
    safe: ShieldCheck,
    warn: AlertTriangle,
    danger: ShieldAlert
  };

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Risk Seviyesi Tahmini</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {riskLevelOptions.map((option) => {
          const Icon = iconMap[option.tone];
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option.value)}
              className={cn('flex min-h-[78px] items-center gap-3 rounded-2xl border p-4 text-left text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-60', riskToneClass(option.tone, selected === option.value))}
            >
              <Icon size={20} />
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MainRiskOptions({
  selected,
  disabled,
  onSelect
}: {
  selected: ScamMainRisk | null;
  disabled: boolean;
  onSelect: (mainRisk: ScamMainRisk) => void;
}) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">En Büyük Risk Sinyali</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {mainRiskOptions.map((option) => (
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

function LearningNoteBox({ note }: { note: string }) {
  return (
    <div className="rounded-2xl bg-surface-high/50 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Bu senaryodan ne öğrenmelisin?</p>
      <p className="text-sm leading-6 text-on-surface-variant">{note}</p>
    </div>
  );
}

function ScamResultPanel({
  scenario,
  selectedRiskLevel,
  selectedMainRisk,
  result,
  onNext
}: {
  scenario: ScamScenario;
  selectedRiskLevel: ScamRiskLevel;
  selectedMainRisk: ScamMainRisk | null;
  result: ScamGuessResult;
  onNext: () => void;
}) {
  const isFullCorrect = result.riskCorrect && result.mainRiskCorrect;

  return (
    <section className={cn('rounded-[28px] border p-6', isFullCorrect ? 'border-secondary/25 bg-secondary/10' : 'border-primary/20 bg-surface')}>
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          {isFullCorrect ? <CheckCircle2 className="text-secondary" size={26} /> : <XCircle className="text-primary" size={26} />}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sonuç</p>
            <h3 className="font-headline text-2xl font-black text-white">{isFullCorrect ? 'Doğru Analiz' : 'Cevap Gösterildi'}</h3>
          </div>
        </div>
        <div className="rounded-2xl bg-background/40 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Sanal Puan</p>
          <p className="font-headline text-3xl font-black text-white">+{result.points}</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={cn('rounded-2xl p-4', result.riskCorrect ? 'bg-secondary/10' : 'bg-error/10')}>
          <p className="mb-2 text-xs font-bold text-on-surface-variant">Risk seviyesi</p>
          <p className="text-sm text-on-surface">Senin cevabın: <span className="font-bold text-white">{getRiskLevelLabel(selectedRiskLevel)}</span></p>
          <p className="mt-1 text-sm text-on-surface">Doğru cevap: <span className="font-bold text-white">{getRiskLevelLabel(scenario.correctRiskLevel)}</span></p>
        </div>
        <div className={cn('rounded-2xl p-4', result.mainRiskCorrect ? 'bg-secondary/10' : 'bg-error/10')}>
          <p className="mb-2 text-xs font-bold text-on-surface-variant">Ana risk sebebi</p>
          <p className="text-sm text-on-surface">Senin cevabın: <span className="font-bold text-white">{selectedMainRisk ? getMainRiskLabel(selectedMainRisk) : 'Seçilmedi'}</span></p>
          <p className="mt-1 text-sm text-on-surface">Doğru cevap: <span className="font-bold text-white">{getMainRiskLabel(scenario.correctMainRisk)}</span></p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-background/40 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Neden?</p>
          <p className="text-sm leading-6 text-on-surface">{scenario.explanation}</p>
        </div>
        <LearningNoteBox note={scenario.learningNote} />
      </div>

      <button type="button" onClick={onNext} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background transition-all hover:shadow-[0_0_24px_rgba(141,172,255,0.24)]">
        Sonraki Senaryo
        <ArrowRight size={16} />
      </button>
    </section>
  );
}

function ScamScorePanel({ stats }: { stats: ScamStats }) {
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

function ScamHistory({ history }: { history: ScamHistoryItem[] }) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <History className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Son Cevaplar</h2>
      </div>
      {!history.length ? (
        <EmptyState label="Henüz cevap yok. İlk senaryoyu analiz ettiğinde burada görünecek." />
      ) : (
        <div className="space-y-3">
          {history.slice(0, 10).map((item) => (
            <div key={item.id} className="rounded-2xl bg-surface-high/50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-bold text-white">{item.projectName} / {item.tokenSymbol}</span>
                <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-black text-primary">+{item.points}</span>
              </div>
              <p className="text-xs leading-5 text-on-surface-variant">Risk: {getRiskLevelLabel(item.selectedRiskLevel)} / {getRiskLevelLabel(item.correctRiskLevel)}</p>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">Ana risk: {item.selectedMainRisk ? getMainRiskLabel(item.selectedMainRisk) : '-'} / {getMainRiskLabel(item.correctMainRisk)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RiskGlossary() {
  const items = [
    ['Mint yetkisi nedir?', 'Yeni token basma yetkisidir. Kontrolsüzse arz riski oluşturabilir.'],
    ['Liquidity lock nedir?', 'Likiditenin belirli süre çekilememesi için kilitlenmesidir.'],
    ['Owner renounced nedir?', 'Kontrat sahibinin bazı yönetim yetkilerini bırakmasıdır.'],
    ['Honeypot nedir?', 'Alım mümkünken satışın engellenebildiği riskli token davranışıdır.'],
    ['Blacklist fonksiyonu nedir?', 'Belirli adreslerin işlem yapmasını engelleyebilen listedir.'],
    ['High tax nedir?', 'Alım veya satışta aşırı yüksek kesinti uygulanmasıdır.'],
    ['Holder concentration nedir?', 'Arzın büyük kısmının az sayıda adreste toplanmasıdır.'],
    ['Verified contract nedir?', 'Kontrat kaynak kodunun explorer üzerinde doğrulanmış olmasıdır.'],
    ['Audit nedir?', 'Kontratın bağımsız güvenlik incelemesinden geçmesidir.'],
    ['Proxy contract nedir?', 'Kontrat mantığının sonradan değiştirilebildiği mimaridir.']
  ];

  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <BookOpen className="text-primary" size={22} />
        <h2 className="font-headline text-xl font-bold text-white">Risk Sözlüğü</h2>
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

export default function ScamOrSafePage() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<ScamDifficulty>(() => getSavedDifficulty());
  const [currentScenario, setCurrentScenario] = useState<ScamScenario>(() => getNextScenario(getSavedDifficulty()));
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<ScamRiskLevel | null>(null);
  const [selectedMainRisk, setSelectedMainRisk] = useState<ScamMainRisk | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [result, setResult] = useState<ScamGuessResult | null>(null);
  const [stats, setStats] = useState<ScamStats>(() => getScamStats());
  const [history, setHistory] = useState<ScamHistoryItem[]>(() => getScamHistory());
  const shouldAskMainRisk = needsMainRisk(selectedDifficulty);
  const canSubmit = Boolean(selectedRiskLevel && (!shouldAskMainRisk || selectedMainRisk) && !isAnswered);

  const statusText = useMemo(() => {
    if (isAnswered) return 'Cevap gösterildi';
    if (!selectedRiskLevel) return 'Risk seviyesi bekleniyor';
    if (shouldAskMainRisk && !selectedMainRisk) return 'Ana risk seçimi gerekli';
    return 'Cevabı gösterebilirsin';
  }, [isAnswered, selectedMainRisk, selectedRiskLevel, shouldAskMainRisk]);

  function handleDifficultyChange(difficulty: ScamDifficulty) {
    setSelectedDifficulty(difficulty);
    saveSelectedDifficulty(difficulty);
    setCurrentScenario(getNextScenario(difficulty, currentScenario.id));
    setSelectedRiskLevel(null);
    setSelectedMainRisk(null);
    setIsAnswered(false);
    setResult(null);
  }

  function handleSubmit() {
    if (!selectedRiskLevel || !canSubmit) return;
    const nextResult = submitScamGuess(currentScenario, selectedRiskLevel, selectedMainRisk);
    const historyItem: ScamHistoryItem = {
      id: `${Date.now()}`,
      scenarioId: currentScenario.id,
      projectName: currentScenario.projectName,
      tokenSymbol: currentScenario.tokenSymbol,
      difficulty: currentScenario.difficulty,
      selectedRiskLevel,
      correctRiskLevel: currentScenario.correctRiskLevel,
      selectedMainRisk,
      correctMainRisk: currentScenario.correctMainRisk,
      points: nextResult.points,
      createdAt: new Date().toISOString()
    };

    setResult(nextResult);
    setIsAnswered(true);
    setStats((current) => saveScamStats(current, nextResult));
    setHistory(saveScamHistory(historyItem));
  }

  function handleNext() {
    setCurrentScenario(getNextScenario(selectedDifficulty, currentScenario.id));
    setSelectedRiskLevel(null);
    setSelectedMainRisk(null);
    setIsAnswered(false);
    setResult(null);
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 space-y-6 xl:col-span-8">
        <div className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Kripto Keyfi Games</p>
              <h1 className="font-headline text-4xl font-extrabold text-white md:text-5xl">Scam mı Değil mi?</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant md:text-base">
                Token, proje ve smart contract risk sinyallerini incele. Güvenilir mi, riskli mi yoksa yüksek scam riski mi tahmin et.
              </p>
            </div>
            <Link to="/games" className="inline-flex w-fit items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary hover:bg-surface-highest">
              Games
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Seviye</p>
              <p className="mt-2 font-headline text-xl font-black text-white">{getDifficultyLabel(selectedDifficulty)}</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Senaryo</p>
              <p className="mt-2 font-headline text-xl font-black text-white">{currentScenario.tokenSymbol}</p>
            </div>
            <div className="rounded-2xl bg-surface-high/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Durum</p>
              <p className="mt-2 flex items-center gap-2 font-headline text-xl font-black text-white"><Target size={20} /> {statusText}</p>
            </div>
          </div>
        </div>

        <GameDisclaimer />
        <DifficultySelector selectedDifficulty={selectedDifficulty} disabled={isAnswered} onSelect={handleDifficultyChange} />
        <ScamScenarioCard scenario={currentScenario} />
        <RiskLevelOptions selected={selectedRiskLevel} disabled={isAnswered} onSelect={setSelectedRiskLevel} />
        {shouldAskMainRisk && <MainRiskOptions selected={selectedMainRisk} disabled={isAnswered} onSelect={setSelectedMainRisk} />}

        {!isAnswered && (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-black text-background transition-all hover:shadow-[0_0_24px_rgba(141,172,255,0.24)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cevabı Göster
            <ShieldAlert size={18} />
          </button>
        )}

        {isAnswered && result && selectedRiskLevel && (
          <ScamResultPanel
            scenario={currentScenario}
            selectedRiskLevel={selectedRiskLevel}
            selectedMainRisk={selectedMainRisk}
            result={result}
            onNext={handleNext}
          />
        )}
      </section>

      <aside className="col-span-12 space-y-6 xl:col-span-4">
        <ScamScorePanel stats={stats} />
        <ScamHistory history={history} />
        <RiskGlossary />
      </aside>
    </div>
  );
}
