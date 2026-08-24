import { CheckCircle2, CircleHelp, History, ShieldCheck, Trophy, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../services/apiClient';
import { aiTradingApi, recordNumber, type AutonomousBot, type AutonomousLifecycle, type ChampionCandidate, type LiveEligibilityStatus } from '../../services/aiTradingService';
import { AITradingPage, EmptyState, ErrorState, formatDate, formatPercent, MetricCard, ModeBadge, RefreshButton, StatusBadge } from './AITradingUI';

const columns: Array<{ title: string; statuses: AutonomousLifecycle[]; tone: 'neutral' | 'warning' | 'safe' | 'danger'; help: string }> = [
  { title: 'Candidate', statuses: ['DRAFT', 'CANDIDATE', 'PAPER', 'TESTING'], tone: 'neutral', help: 'Kanıt toplama aşamasındaki botlar. Tüm kapıları geçen PAPER botları sıralamaya girer; uygun ilk 20 içindeki bot Challenger olabilir.' },
  { title: 'Challenger', statuses: ['CHALLENGER'], tone: 'warning', help: 'İlk uygun seçim turunu geçen botlar. Koşulları koruyup sonraki seçimde ilk 10 içinde kalırlarsa Champion olabilirler.' },
  { title: 'Champion', statuses: ['CHAMPION'], tone: 'safe', help: 'Kanıt kapılarını iki aşamada geçip üst sıralarda kalan botlar. Bu statü gerçek emir yetkisi vermez.' },
  { title: 'Live Eligible', statuses: ['LIVE_ELIGIBLE'], tone: 'danger', help: 'Champion ve SHADOW kanıtlarını geçen, manual incelemeye hazır botlar. LIVE hâlâ otomatik açılmaz.' },
];

export default function AITradingChampions() {
  const [bots, setBots] = useState<AutonomousBot[]>([]); const [history, setHistory] = useState<ChampionCandidate[]>([]);
  const [eligibility, setEligibility] = useState<LiveEligibilityStatus[]>([]); const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [botRows, candidateRows, liveRows] = await Promise.all([aiTradingApi.bots(), aiTradingApi.champions(), aiTradingApi.liveEligibility()]); setBots(botRows); setHistory(candidateRows); setEligibility(liveRows.data); } catch (reason) { setError(getApiErrorMessage(reason, 'Champion verileri alınamadı.')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const latest = useMemo(() => { const map = new Map<string, ChampionCandidate>(); for (const item of history) if (!map.has(item.tradingBotId)) map.set(item.tradingBotId, item); return map; }, [history]);
  const promotionBots = useMemo(() => bots.filter((bot) => !(bot.mode === 'DEMO' && ['DRAFT', 'CANDIDATE', 'PAPER', 'TESTING'].includes(bot.lifecycleStatus))), [bots]);

  async function review(bot: AutonomousBot, decision: 'APPROVE' | 'REJECT') {
    const note = notes[bot.id]?.trim() ?? '';
    if (note.length < 3) { setError('Manual review için en az 3 karakterlik not girin.'); return; }
    const message = decision === 'APPROVE'
      ? `${bot.name} için manual review onayı audit ledger'a yazılsın mı? Bu işlem LIVE trading açmaz ve emir göndermez.`
      : `${bot.name} Live Eligible durumundan güvenli PAUSED durumuna alınsın mı?`;
    if (!window.confirm(message)) return;
    setBusyId(bot.id); setError(''); setNotice('');
    try { await aiTradingApi.promotionReview(bot.id, decision, note); setNotice(decision === 'APPROVE' ? 'Onay kaydedildi: APPROVED_PENDING_ACTIVATION. Live trading kapalı kaldı.' : 'Bot güvenli biçimde reddedildi ve duraklatıldı.'); await load(); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Promotion review tamamlanamadı.')); }
    finally { setBusyId(''); }
  }

  return <AITradingPage title="Champions & Challengers" description="Lifecycle seviyelerini, promotion kanıtlarını ve Live Eligible önündeki engelleri inceleyin. Champion olmak otomatik live aktivasyonu sağlamaz." icon={Trophy} action={<RefreshButton onClick={() => void load()} busy={loading} />}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{columns.map((column) => <MetricCard key={column.title} label={column.title} value={promotionBots.filter((bot) => column.statuses.includes(bot.lifecycleStatus)).length} help={column.help} tone={column.tone} />)}</div>
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-on-surface-variant"><strong className="text-primary">200 ne demek?</strong> Bu bir sıra numarası değil, varsayılan minimum <strong className="text-white">kapanmış PAPER trade</strong> eşiğidir. Challenger için ayrıca en az 7 gün PAPER kanıtı, PF ≥ 1,20, Score ≥ 60, en az 3 rejim, drawdown ≤ %20 ve değerlendirme anında açık PAPER pozisyon olmaması gerekir. Uygun botlar Score ve PF ile sıralanır; ilk 20 Challenger havuzuna, sonraki uygun seçimde ilk 10 Champion seviyesine ilerler.</div>
    <div className="rounded-2xl border border-error/25 bg-error/5 p-4 text-sm leading-6 text-on-surface-variant"><strong className="text-error">LIVE aktivasyonu mevcut değil.</strong> Manual approval yalnız audit kaydı üretir; exchange emri veya canlı çalışma başlatmaz.</div>
    {error && <ErrorState message={error} />}{notice && <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4 text-sm text-secondary">{notice}</div>}
    {loading ? <div className="h-72 animate-pulse rounded-[24px] bg-surface" /> : <div className="grid gap-4 xl:grid-cols-4">{columns.map((column) => { const rows = promotionBots.filter((bot) => column.statuses.includes(bot.lifecycleStatus)); return <section key={column.title} className="rounded-[24px] border border-outline/10 bg-surface p-4"><div className="flex items-center justify-between"><h2 className="font-headline font-black text-white">{column.title}</h2><StatusBadge tone={column.tone}>{rows.length}</StatusBadge></div><div className="mt-4 space-y-3">{rows.length === 0 ? <p className="rounded-xl border border-dashed border-outline/20 p-4 text-xs text-on-surface-variant">Bu lifecycle seviyesinde bot yok.</p> : rows.map((bot) => { const live = eligibility.find((item) => item.id === bot.id); return <ChampionCard key={bot.id} bot={bot} evidence={promotionEvidence(bot, latest.get(bot.id), live)} eligibility={live} note={notes[bot.id] ?? ''} setNote={(note) => setNotes((value) => ({ ...value, [bot.id]: note }))} busy={busyId === bot.id} onReview={(decision) => void review(bot, decision)} />; })}</div></section>; })}</div>}
    <section className="overflow-hidden rounded-[24px] border border-outline/10 bg-surface"><div className="flex items-center gap-3 border-b border-outline/10 p-5"><History className="text-primary" /><div><h2 className="font-headline font-black text-white">Promotion history</h2><p className="text-xs text-on-surface-variant">Champion evaluation kayıtları</p></div></div>{history.length === 0 ? <div className="p-5"><EmptyState title="Promotion geçmişi yok" description="Backend henüz Champion evaluation kaydı üretmedi." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-surface-high text-xs uppercase text-outline"><tr><th className="p-4">Bot</th><th className="p-4">Karar</th><th className="p-4">Score</th><th className="p-4">Hedef</th><th className="p-4">Failed gates</th><th className="p-4">Tarih</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-t border-outline/10"><td className="p-4 font-bold text-white">{item.tradingBot.name}</td><td className="p-4"><StatusBadge tone={item.promotedAt ? 'safe' : failedGates(item.evidence).length ? 'danger' : 'neutral'}>{item.status}</StatusBadge></td><td className="p-4">{item.score === null ? '—' : Number(item.score).toFixed(2)}</td><td className="p-4">{recordText(item.evidence, 'target') ?? item.tradingBot.lifecycleStatus}</td><td className="p-4 text-xs text-error">{failedGates(item.evidence).join(', ') || '—'}</td><td className="p-4 text-xs text-outline">{formatDate(item.evaluatedAt)}</td></tr>)}</tbody></table></div>}</section>
  </AITradingPage>;
}

function ChampionCard({ bot, evidence, eligibility, note, setNote, busy, onReview }: { bot: AutonomousBot; evidence: unknown; eligibility?: LiveEligibilityStatus; note: string; setNote: (value: string) => void; busy: boolean; onReview: (decision: 'APPROVE' | 'REJECT') => void }) {
  const gates = failedGates(evidence); const isEligible = bot.lifecycleStatus === 'LIVE_ELIGIBLE';
  return <article className={`rounded-2xl border p-4 ${isEligible ? 'border-error/25 bg-error/5' : 'border-outline/10 bg-surface-high'}`}><ModeBadge mode={bot.mode} /><h3 className="mt-3 font-bold text-white">{bot.name}</h3><p className="mt-1 text-xs text-on-surface-variant">{bot.strategyVersion?.strategy.family ?? 'Strategy yok'}</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Evidence label="Score" value={metric(evidence, ['score'])} help={metricHelp.Score} /><Evidence label="Paper süre" value={suffix(metric(evidence, ['paperDurationDays']), ' gün')} help={metricHelp['Paper süre']} /><Evidence label="Trade" value={metric(evidence, ['totalTrades', 'paperTrades'])} help={metricHelp.Trade} /><Evidence label="Regime" value={metric(evidence, ['regimeCoverage'])} help={metricHelp.Regime} /><Evidence label="PF" value={metric(evidence, ['profitFactor'])} help={metricHelp.PF} /><Evidence label="Drawdown" value={ratio(evidence, 'maxDrawdown')} help={metricHelp.Drawdown} /></div><div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-outline">Eligibility blockers</p>{gates.length ? <div className="mt-2 flex flex-wrap gap-1">{gates.map((gate) => <ExplainedGate key={gate} gate={gate} />)}</div> : <p className="mt-2 text-xs text-on-surface-variant">{isEligible ? 'Kanıt kapıları geçti; manual approval bekliyor.' : eligibility ? 'Son Champion kanıtında blocker yok.' : 'Live eligibility evaluation kanıtı mevcut değil.'}</p>}</div><div className="mt-4 rounded-xl border border-outline/10 bg-background/30 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-primary">Bot özeti</p><p className="mt-2 text-xs leading-5 text-on-surface-variant">{botSummary(gates, isEligible, Boolean(eligibility))}</p></div>{isEligible && <div className="mt-4 border-t border-error/15 pt-4"><label className="text-xs font-bold text-on-surface-variant">Manual review notu<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-outline/15 bg-background/50 p-3 text-sm text-white" placeholder="Onay/red gerekçesi" /></label><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => onReview('REJECT')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-error/15 px-3 py-2 text-xs font-black text-error"><XCircle size={15} /> Reddet</button><button type="button" disabled={busy} onClick={() => onReview('APPROVE')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-black text-background"><CheckCircle2 size={15} /> Review onayı</button></div><p className="mt-2 text-[10px] leading-4 text-outline">Review onayı LIVE aktivasyonu yapmaz.</p></div>}</article>;
}
function Evidence({ label, value, help }: { label: string; value: string; help: string }) { return <div tabIndex={0} title={help} className="group/evidence relative rounded-lg bg-background/35 p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"><div className="flex items-center justify-between gap-2"><p className="text-outline">{label}</p><CircleHelp aria-hidden="true" className="text-outline transition-colors group-hover/evidence:text-primary" size={13} /></div><p className="mt-1 font-bold text-white">{value}</p><div role="tooltip" className="pointer-events-none absolute left-0 right-0 top-[calc(100%+6px)] z-[80] rounded-lg border border-primary/25 bg-background p-2 text-[11px] font-medium leading-4 text-on-surface-variant opacity-0 shadow-2xl transition-opacity group-hover/evidence:opacity-100 group-focus-within/evidence:opacity-100">{help}</div></div>; }
function ExplainedGate({ gate }: { gate: string }) { const help = gateHelp[gate] ?? 'Bu etiket, promotion değerlendirmesinde geçilemeyen bir güvenlik veya kanıt kapısını gösterir.'; return <span tabIndex={0} title={help} className="group/gate relative outline-none"><StatusBadge tone="danger">{gate}</StatusBadge><span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-[90] w-64 rounded-lg border border-error/25 bg-background p-2 text-[11px] font-medium normal-case leading-4 tracking-normal text-on-surface-variant opacity-0 shadow-2xl transition-opacity group-hover/gate:opacity-100 group-focus-within/gate:opacity-100">{help}</span></span>; }

const metricHelp: Record<string, string> = {
  Score: 'Risk ayarlı birleşik Bot Score. Kâr, istikrar ve risk kanıtlarını özetler; Challenger varsayılan alt sınırı 60 ve yüksek değer daha iyidir.',
  'Paper süre': 'İlk PAPER işlem ile son işlem arasındaki kanıt süresi. Sunucu çalışma süresi değildir; Challenger varsayılan alt sınırı 7 gündür.',
  Trade: 'Kapanmış PAPER trade sayısıdır. Kararlar ve yalnız giriş fill kayıtları bu sayıya dahil değildir; varsayılan alt sınır 200 kapanmış işlemdir.',
  Regime: 'Botun işlem kanıtı ürettiği farklı piyasa rejimi sayısıdır. Varsayılan olarak en az 3 farklı rejim gerekir.',
  PF: 'Profit Factor: brüt kazanç / mutlak brüt zarar. 1 üzeri toplam kâr üstünlüğünü, varsayılan 1,20 eşiği yeterli marjı ifade eder.',
  Drawdown: 'Sermayenin tepe değerinden gördüğü en büyük düşüştür. Düşük daha iyidir; varsayılan üst sınır %20’dir.',
};

const gateHelp: Record<string, string> = {
  MIN_TRADES: 'Bot henüz gereken 200 kapanmış PAPER trade kanıtına ulaşmadı. Karar veya giriş fill sayısı bu eşiğin yerine geçmez.',
  MIN_PAPER_TRADES: 'Live eligibility için gereken minimum kapanmış PAPER trade sayısı tamamlanmadı.',
  MIN_PAPER_DURATION: 'İlk ve son PAPER işlem arasındaki kanıt süresi varsayılan 7 günün altında.',
  MIN_PROFIT_FACTOR: 'Profit Factor 1,20 altında veya henüz hesaplanacak yeterli kapanmış kazanç/zarar yok.',
  MAX_DRAWDOWN: 'Botun maksimum tepe-dip kaybı izin verilen %20 üst sınırını aşıyor.',
  MIN_BOT_SCORE: 'Risk ayarlı Bot Score varsayılan 60 eşiğinin altında veya score kanıtı eksik.',
  MIN_RISK_ADJUSTED_SCORE: 'Live eligibility için risk ayarlı score varsayılan 60 eşiğini geçmedi.',
  MIN_REGIME_COVERAGE: 'Bot en az 3 farklı piyasa rejiminde kapanmış işlem kanıtı üretmedi.',
  OPEN_PAPER_POSITION: 'Değerlendirme anında açık PAPER pozisyon var. Gerçekleşmemiş PnL ile promotion yapılmaması için pozisyonun normal kurallarla kapanması beklenir.',
  CHAMPION_REQUIRED: 'Bot önce Champion lifecycle seviyesine ulaşmalıdır.',
  SHADOW_MODE_REQUIRED: 'Live uygunluğu için botun gerçek emir vermeden canlı piyasayı izleyen SHADOW modunda olması gerekir.',
  MIN_SHADOW_DURATION: 'SHADOW gözlem süresi varsayılan 7 günün altında.',
  MIN_SHADOW_CLOSE_TRADES: 'SHADOW ortamında gereken minimum 20 kapanış simülasyonu tamamlanmadı.',
  MIN_SHADOW_PROFIT_FACTOR: 'SHADOW Profit Factor varsayılan 1,00 eşiğini geçmedi.',
  MAX_SHADOW_DRAWDOWN: 'SHADOW maksimum drawdown izin verilen %20 sınırını aştı.',
  RECENT_CRITICAL_RISK_VIOLATION: 'Son 168 saatte kritik risk reddi kaydı var; live uygunluğu güvenli biçimde engelleniyor.',
};

function botSummary(gates: string[], isEligible: boolean, hasEligibility: boolean) {
  if (isEligible) return 'Tüm otomatik kanıt kapıları geçildi. Bot yalnız manual review bekliyor; bu durum LIVE işlemi otomatik başlatmaz.';
  if (gates.length === 0) return hasEligibility ? 'Son değerlendirmede blocker görünmüyor. Lifecycle geçişi bir sonraki seçim turu ve sıralama sonucuna bağlıdır.' : 'Henüz değerlendirme kanıtı yok. Bot PAPER işlemleri kapattıkça metrikler oluşacak ve promotion worker yeniden değerlendirecektir.';
  const evidence = gates.filter((gate) => ['MIN_TRADES', 'MIN_PAPER_TRADES', 'MIN_PAPER_DURATION', 'MIN_REGIME_COVERAGE'].includes(gate)).length;
  const performance = gates.filter((gate) => ['MIN_PROFIT_FACTOR', 'MAX_DRAWDOWN', 'MIN_BOT_SCORE', 'MIN_RISK_ADJUSTED_SCORE'].includes(gate)).length;
  const operational = gates.length - evidence - performance;
  const parts = [`${gates.length} engel nedeniyle bot şu anda ilerleyemez.`];
  if (evidence) parts.push(`${evidence} tanesi daha fazla ve daha çeşitli kapanmış PAPER kanıtı gerektiriyor.`);
  if (performance) parts.push(`${performance} tanesi performans/risk kalitesinin eşiğin altında olduğunu gösteriyor.`);
  if (operational) parts.push(`${operational} tanesi açık pozisyon, SHADOW veya güvenlik koşuluyla ilgili.`);
  return parts.join(' ');
}
function metric(value: unknown, keys: string[]) { const number = recordNumber(value, keys); return number === null ? '—' : number.toLocaleString('tr-TR', { maximumFractionDigits: 2 }); }
function suffix(value: string, suffixValue: string) { return value === '—' ? value : `${value}${suffixValue}`; }
function ratio(value: unknown, key: string) { return formatPercent(recordNumber(value, [key])); }
function failedGates(value: unknown) { if (!value || typeof value !== 'object' || Array.isArray(value)) return []; const candidate = (value as Record<string, unknown>).failedGates; return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === 'string') : []; }
function recordText(value: unknown, key: string) { if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const candidate = (value as Record<string, unknown>)[key]; return typeof candidate === 'string' ? candidate : null; }
function promotionEvidence(bot: AutonomousBot, candidate?: ChampionCandidate, live?: LiveEligibilityStatus) {
  const candidateRecord = candidate?.evidence && typeof candidate.evidence === 'object' && !Array.isArray(candidate.evidence) ? candidate.evidence as Record<string, unknown> : {};
  const liveRecord = live?.evidence && typeof live.evidence === 'object' && !Array.isArray(live.evidence) ? live.evidence as Record<string, unknown> : {};
  return { ...candidateRecord, ...bot.promotionEvidence, ...liveRecord, score: live?.latestCandidate?.score ?? bot.promotionEvidence?.score ?? candidate?.score ?? null };
}
