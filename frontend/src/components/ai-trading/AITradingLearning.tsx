import { BrainCircuit, FlaskConical, Lightbulb, Target } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../services/apiClient';
import { aiTradingApi, type ResearchHypothesis, type TeacherEvaluation } from '../../services/aiTradingService';
import { AITradingPage, EmptyState, ErrorState, formatDate, formatPercent, MetricCard, RefreshButton, StatusBadge } from './AITradingUI';

export function AITradingTeacher() {
  const [rows, setRows] = useState<TeacherEvaluation[]>([]); const [severity, setSeverity] = useState('ALL');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setRows(await aiTradingApi.teacherEvaluations(500)); } catch (reason) { setError(getApiErrorMessage(reason, 'Teacher değerlendirmeleri alınamadı.')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => rows.filter((row) => severity === 'ALL' || row.severity === severity), [rows, severity]);
  return <AITradingPage title="Teacher" description="Bot ve strategy performansından üretilen açıklanabilir öneriler. Teacher kodu, live risk limitlerini veya execution davranışını değiştiremez." icon={BrainCircuit} action={<RefreshButton onClick={() => void load()} busy={loading} />}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Evaluation" value={rows.length} /><MetricCard label="High severity" value={rows.filter((row) => row.severity === 'HIGH').length} tone="danger" /><MetricCard label="Ortalama confidence" value={formatPercent(average(rows.map((row) => row.confidence)))} /><MetricCard label="Applied changes" value="0" detail="Recommendation-only contract" tone="safe" /></div>
    <div className="rounded-2xl border border-tertiary/25 bg-tertiary/5 p-4"><StatusBadge tone="warning">AI ÖNERİSİ · UYGULANMADI</StatusBadge><p className="mt-3 text-sm leading-6 text-on-surface-variant">Bu sayfadaki içerikler analiz çıktısıdır. Sistem değişikliği, mutation veya live ayar uygulaması değildir.</p></div>
    {error && <ErrorState message={error} />}
    <label className="block max-w-xs text-xs font-bold text-on-surface-variant">Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline/15 bg-surface p-3 text-white"><option>ALL</option><option>INFO</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></label>
    {loading ? <div className="h-72 animate-pulse rounded-[24px] bg-surface" /> : visible.length === 0 ? <EmptyState title="Teacher kaydı yok" description="Seçilen filtre için backend evaluation kaydı sağlamıyor." /> : <div className="grid gap-4 xl:grid-cols-2">{visible.map((row) => <TeacherCard key={row.id} row={row} />)}</div>}
  </AITradingPage>;
}

export function AITradingResearcher() {
  const [rows, setRows] = useState<ResearchHypothesis[]>([]); const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setRows(await aiTradingApi.researchHypotheses(500)); } catch (reason) { setError(getApiErrorMessage(reason, 'Researcher hipotezleri alınamadı.')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => rows.filter((row) => status === 'ALL' || row.status === status), [rows, status]);
  return <AITradingPage title="Researcher" description="Performans kanıtından üretilen test edilebilir strategy hipotezleri. Her çıktı candidate-only değerlendirme içindir." icon={FlaskConical} action={<RefreshButton onClick={() => void load()} busy={loading} />}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Hypothesis" value={rows.length} /><MetricCard label="Draft" value={rows.filter((row) => row.status === 'DRAFT').length} /><MetricCard label="Accepted for review" value={rows.filter((row) => row.status === 'ACCEPTED').length} tone="warning" /><MetricCard label="Live changes" value="0" detail="Candidate-only contract" tone="safe" /></div>
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><StatusBadge tone="warning">AI HİPOTEZİ · CANDIDATE ONLY</StatusBadge><p className="mt-3 text-sm leading-6 text-on-surface-variant">Accepted durumu bile yalnız araştırma kabulüdür; otomatik uygulanmış strategy veya live deployment anlamına gelmez.</p></div>
    {error && <ErrorState message={error} />}
    <label className="block max-w-xs text-xs font-bold text-on-surface-variant">Candidate status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline/15 bg-surface p-3 text-white"><option>ALL</option><option>DRAFT</option><option>REVIEWED</option><option>ACCEPTED</option><option>REJECTED</option></select></label>
    {loading ? <div className="h-72 animate-pulse rounded-[24px] bg-surface" /> : visible.length === 0 ? <EmptyState title="Researcher kaydı yok" description="Seçilen filtre için backend hypothesis kaydı sağlamıyor." /> : <div className="grid gap-4 xl:grid-cols-2">{visible.map((row) => <ResearchCard key={row.id} row={row} />)}</div>}
  </AITradingPage>;
}

function TeacherCard({ row }: { row: TeacherEvaluation }) {
  const target = row.tradingBot?.name ?? (row.strategy ? `${row.strategy.name} · ${row.strategy.family}` : 'Target bilinmiyor');
  return <article className="rounded-[24px] border border-outline/10 bg-surface p-5"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={severityTone(row.severity)}>{row.severity}</StatusBadge><StatusBadge tone="warning">SUGGESTION · NOT APPLIED</StatusBadge><span className="ml-auto text-xs text-outline">{formatDate(row.createdAt)}</span></div><div className="mt-4 flex items-center gap-2"><Target className="text-primary" size={17} /><h2 className="font-headline font-black text-white">{target}</h2></div><p className="mt-3 text-sm leading-6 text-on-surface-variant">{row.observation}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Evidence title="Metric evidence" value={row.metricEvidence} /><Evidence title="Recommendation" value={row.recommendedAction} /></div><div className="mt-4 flex items-center justify-between text-xs"><span className="text-outline">Analyzer: {row.analyzer}</span><span className="font-black text-primary">Confidence {formatPercent(row.confidence)}</span></div></article>;
}
function ResearchCard({ row }: { row: ResearchHypothesis }) {
  return <article className="rounded-[24px] border border-outline/10 bg-surface p-5"><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={row.status === 'REJECTED' ? 'danger' : row.status === 'ACCEPTED' ? 'warning' : 'neutral'}>{row.status}</StatusBadge><StatusBadge tone="warning">HYPOTHESIS · NOT APPLIED</StatusBadge><span className="ml-auto text-xs text-outline">{formatDate(row.createdAt)}</span></div><div className="mt-4 flex items-center gap-2"><Lightbulb className="text-primary" size={18} /><h2 className="font-headline font-black text-white">{row.targetStrategyFamily}</h2></div><p className="mt-3 text-sm leading-6 text-on-surface-variant">{row.hypothesis}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Evidence title="Evidence" value={row.evidence} /><Evidence title="Suggested change" value={row.suggestedChange} /></div><div className="mt-4 flex items-center justify-between text-xs"><span className="text-outline">Provider: {row.provider}</span><span className="font-black text-primary">Confidence {formatPercent(row.confidence)}</span></div><p className="mt-3 rounded-xl bg-background/40 p-3 text-xs font-bold text-secondary">System applied: HAYIR · Candidate created: backend kaydı yoksa HAYIR</p></article>;
}
function Evidence({ title, value }: { title: string; value: unknown }) { return <div className="rounded-xl bg-surface-high p-3"><p className="text-[10px] font-black uppercase tracking-wider text-outline">{title}</p><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-on-surface-variant">{json(value)}</pre></div>; }
function json(value: unknown) { if (value === null || value === undefined) return '—'; try { return JSON.stringify(value, null, 2); } catch { return 'Gösterilemeyen evidence'; } }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function severityTone(value: TeacherEvaluation['severity']): 'neutral' | 'warning' | 'danger' { return value === 'HIGH' ? 'danger' : value === 'MEDIUM' ? 'warning' : 'neutral'; }
