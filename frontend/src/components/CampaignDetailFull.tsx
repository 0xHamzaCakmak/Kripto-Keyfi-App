import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, BarChart3, CircleDollarSign, Copy, Link2, Target, UserPlus, Users } from 'lucide-react';
import { demoKOLs, type KOL } from '../services/kolService';
import { workspaceApi, workspaceError, type Campaign, type CampaignKOL } from '../services/kolWorkspaceService';

const demoTotals = { spend: 7000, impressions: 767000, clicks: 16470, registrations: 2556, kyc: 778, deposits: 362, revenue: 17230, roi: 146.14, roas: 2.46 };

export default function CampaignDetailFull() {
  const { id = '' } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [matches, setMatches] = useState<Array<{ kol: KOL; matchScore: number; factors: Record<string, number> }>>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const demo = id.startsWith('demo-');

  useEffect(() => {
    if (demo) {
      setCampaign({ id, companyId: 'demo-company', name: 'Q3 Exchange Acquisition', project: 'Demo Exchange', goal: 'Registration', budget: 10000, currency: 'USD', countryTargets: ['Türkiye'], languageTargets: ['TR'], categories: ['Trading', 'Bitcoin'], startDate: '2026-08-01', endDate: '2026-09-30', status: 'ACTIVE', kpi: 'KYC', influencers: [] });
      setMatches(demoKOLs.map((kol, index) => ({ kol, matchScore: 94 - index * 8, factors: { country: 100, language: 100, category: 90 - index * 10, trust: kol.scores[0].trust, risk: 100 - kol.scores[0].risk } })));
      setAnalytics({ totals: demoTotals, influencers: [] });
      setLoading(false);
      return;
    }
    void Promise.all([workspaceApi.campaign(id), workspaceApi.matches(id), workspaceApi.analytics(id)])
      .then(([campaignData, matchData, analyticsData]) => { setCampaign(campaignData); setMatches(matchData); setAnalytics(analyticsData); })
      .catch((cause) => setError(workspaceError(cause, 'Kampanya verileri alınamadı.')))
      .finally(() => setLoading(false));
  }, [id, demo]);

  if (loading) return <div className="h-96 animate-pulse rounded-3xl bg-surface" />;
  if (!campaign) return <div className="rounded-3xl border border-error/20 bg-error/5 p-8 text-error">{error || 'Kampanya bulunamadı.'}</div>;
  const totals = analytics?.totals;

  function assigned(item: CampaignKOL) {
    setCampaign((current) => current ? { ...current, influencers: [...(current.influencers || []), item] } : current);
    setAssignOpen(false);
  }

  return <div className="space-y-6">
    <Link to="/company/campaigns" className="inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant"><ArrowLeft size={16}/> Kampanyalar</Link>
    {demo && <div className="rounded-xl border border-primary/20 bg-primary/8 p-3 text-sm text-tertiary">Geliştirme demosu: bütçe ve dönüşüm verileri gerçek değildir.</div>}
    <section className="rounded-[30px] border border-outline/10 bg-surface p-6">
      <div className="flex flex-col justify-between gap-5 md:flex-row">
        <div><span className="rounded-full bg-secondary/10 px-2 py-1 text-[10px] font-black text-secondary">{campaign.status}</span><h1 className="mt-4 font-headline text-3xl font-black text-white">{campaign.name}</h1><p className="mt-2 text-sm text-on-surface-variant">{campaign.project} · {campaign.goal} · KPI: {campaign.kpi}</p></div>
        <div className="flex items-start gap-2"><select value={campaign.status} onChange={(event) => { const status = event.target.value; if (demo) return setCampaign({ ...campaign, status }); void workspaceApi.setCampaignStatus(id, status).then(setCampaign); }} className="input w-40"><option>DRAFT</option><option>PLANNED</option><option>ACTIVE</option><option>PAUSED</option><option>COMPLETED</option><option>CANCELLED</option></select><button onClick={() => setAssignOpen(true)} className="rounded-xl bg-primary px-4 py-3 text-sm font-black text-background"><UserPlus size={16} className="mr-2 inline"/>KOL ata</button></div>
      </div>
    </section>
    {totals && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Kpi icon={Users} label="Registrations" value={Number(totals.registrations).toLocaleString()}/><Kpi icon={BadgeCheck} label="KYC / Deposit" value={`${Number(totals.kyc).toLocaleString()} / ${Number(totals.deposits).toLocaleString()}`}/><Kpi icon={CircleDollarSign} label="Revenue" value={`$${Number(totals.revenue).toLocaleString()}`}/><Kpi icon={BarChart3} label="ROI / ROAS" value={`${Number(totals.roi || 0).toFixed(0)}% · ${Number(totals.roas || 0).toFixed(2)}x`}/></div>}
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <section className="rounded-[26px] border border-outline/10 bg-surface p-5"><h2 className="font-headline text-xl font-black text-white">KOL performansı ve tracking</h2>{campaign.influencers?.length ? <div className="mt-4 space-y-3">{campaign.influencers.map((item) => <div key={item.id} className="rounded-xl bg-surface-high p-4"><div className="flex justify-between"><div><p className="font-black text-white">{item.kol.displayName}</p><p className="text-xs text-on-surface-variant">{item.deliverable} · {item.currency} {Number(item.agreedPrice).toLocaleString()}</p></div><span className="text-xs font-bold text-secondary">{item.status}</span></div>{item.trackingLinks.map((link) => <div key={link.id} className="mt-3 flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2 text-xs"><Link2 size={13} className="text-primary"/><code className="min-w-0 flex-1 truncate">/r/{link.code}</code><button onClick={() => void navigator.clipboard.writeText(`${location.origin}/r/${link.code}`)} aria-label="Tracking linkini kopyala"><Copy size={14}/></button></div>)}</div>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-outline/20 p-8 text-center text-sm text-on-surface-variant">Henüz KOL atanmadı.</p>}</section>
      <section className="rounded-[26px] border border-outline/10 bg-surface p-5"><div className="flex items-center gap-2"><Target className="text-primary"/><h2 className="font-headline text-xl font-black text-white">Campaign Match</h2></div><p className="mt-2 text-xs text-on-surface-variant">Genel KOL Score’dan bağımsız uygunluk skoru.</p><div className="mt-4 space-y-3">{matches.slice(0, 6).map((match) => <div key={match.kol.id} className="rounded-xl bg-surface-high p-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 font-black text-primary">{match.kol.displayName.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{match.kol.displayName}</p><p className="text-[10px] text-on-surface-variant">KOL Score {match.kol.scores[0]?.overall}</p></div><p className="text-xl font-black text-secondary">{match.matchScore}</p></div><div className="mt-3 grid grid-cols-3 gap-1 text-[9px] text-on-surface-variant"><span>Ülke {match.factors.country}</span><span>Kategori {Math.round(match.factors.category)}</span><span>Güven {Math.round(match.factors.trust)}</span></div></div>)}</div></section>
    </div>
    {assignOpen && <AssignModal campaignId={id} matches={matches} demo={demo} onClose={() => setAssignOpen(false)} onAssigned={assigned}/>} 
  </div>;
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) { return <div className="rounded-2xl border border-outline/10 bg-surface p-5"><Icon className="text-primary"/><p className="mt-4 font-headline text-2xl font-black text-white">{value}</p><p className="mt-1 text-xs text-on-surface-variant">{label}</p></div>; }

function AssignModal({ campaignId, matches, demo, onClose, onAssigned }: { campaignId: string; matches: Array<{kol: KOL}>; demo: boolean; onClose: () => void; onAssigned: (item: CampaignKOL) => void }) {
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const kol = matches.find((item) => item.kol.id === form.get('kolId'))?.kol;
    const input = { kolId: String(form.get('kolId')), agreedPrice: Number(form.get('agreedPrice')), currency: String(form.get('currency')), deliverable: String(form.get('deliverable')), destinationUrl: String(form.get('destinationUrl')) };
    try { if (demo) return onAssigned({ id: `demo-${Date.now()}`, ...input, status: 'INVITED', kol: kol!, trackingLinks: [{ id: 'demo-link', code: 'demo-q3-kol', destinationUrl: input.destinationUrl, isActive: true }] }); onAssigned(await workspaceApi.assignKOL(campaignId, input)); } catch (cause) { setError(workspaceError(cause)); }
  }
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-background/85 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-xl space-y-4 rounded-[28px] border border-outline/15 bg-surface p-6"><div className="flex justify-between"><h2 className="font-headline text-xl font-black text-white">KOL ata ve tracking oluştur</h2><button type="button" onClick={onClose} className="text-xs text-on-surface-variant">Kapat</button></div><select required name="kolId" className="input">{matches.map((item) => <option key={item.kol.id} value={item.kol.id}>{item.kol.displayName}</option>)}</select><div className="grid gap-3 md:grid-cols-2"><input required name="agreedPrice" type="number" min="0" className="input" placeholder="Anlaşılan ücret"/><input required name="currency" defaultValue="USD" className="input"/><select name="deliverable" className="input"><option>X post</option><option>X thread</option><option>YouTube video</option><option>Telegram post</option><option>Telegram AMA</option></select><input required name="destinationUrl" type="url" className="input" placeholder="https://hedef-url"/></div>{error && <p className="text-sm text-error">{error}</p>}<button className="w-full rounded-xl bg-primary px-5 py-3 font-black text-background">Ata ve link üret</button></form></div>;
}

