import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Code,
  ExternalLink,
  FileCode,
  Github,
  Globe,
  Heart,
  Menu,
  Rocket,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Twitter,
  Wallet,
  X,
  Zap
} from 'lucide-react';
import { CreatedToken, EcosystemProject, EcosystemTool, TokenomicsAllocation } from '../types';
import { cn } from '../lib/utils';
import { getEcosystemProjects, getEcosystemTools } from '../services/ecosystemService';
import { getWhaleFeed } from '../services/whaleService';
import { analyzeWallet } from '../services/walletIntelligenceService';
import { scanTokenContract } from '../services/securityScannerService';
import {
  buildSolidityPreview,
  defaultTokenomics,
  defaultVesting,
  formatMockAddress,
  getRecentTokens,
  saveCreatedToken
} from '../services/tokenLaunchpadService';

type EcosystemTab = 'discover' | 'build' | 'monitor' | 'security';
type CommunityAction = 'trusted' | 'using' | 'suspicious' | 'scam';

const tabItems: Array<{ id: EcosystemTab; label: string; desc: string }> = [
  { id: 'discover', label: 'Discover', desc: 'Project discovery' },
  { id: 'build', label: 'Build', desc: 'Launchpad and dev tools' },
  { id: 'monitor', label: 'Monitor', desc: 'On-chain intelligence' },
  { id: 'security', label: 'Security', desc: 'Risk and audit tools' }
];

const sidebarGroups = [
  {
    title: 'Discover',
    tab: 'discover' as EcosystemTab,
    items: ['All Ecosystems', 'DeFi', 'NFT Marketplace', 'Tools & Infrastructure', 'Web3 Social', 'AI & Data', 'Gaming', 'DAO', 'Launchpads']
  },
  {
    title: 'Build',
    tab: 'build' as EcosystemTab,
    items: ['Token Launchpad', 'Contract Generator', 'ABI Decoder', 'Gas Estimator', 'Contract Verifier']
  },
  {
    title: 'Monitor',
    tab: 'monitor' as EcosystemTab,
    items: ['Wallet Intelligence', 'Whale Tracker', 'New Tokens', 'Bridge Activity', 'Stablecoin Flows']
  },
  {
    title: 'Security',
    tab: 'security' as EcosystemTab,
    items: ['Rug Pull Scanner', 'Smart Contract Audit', 'Honeypot Checker', 'Permission Checker']
  }
];

const networks = ['All', 'Ethereum', 'Arbitrum', 'Base', 'Solana', 'Polygon', 'BNB Chain'];
const statuses = ['All', 'Active', 'Beta', 'Testnet', 'Risky'];
const riskLevels = ['All', 'Low', 'Medium', 'High'];

const launchNetworks = [
  { name: 'Ethereum', icon: 'ETH', gas: '24 gwei', kind: 'Mainnet', supported: true },
  { name: 'Arbitrum', icon: 'ARB', gas: '0.08 gwei', kind: 'Mainnet', supported: true },
  { name: 'Base', icon: 'BASE', gas: '0.04 gwei', kind: 'Mainnet', supported: true },
  { name: 'Polygon', icon: 'POL', gas: '52 gwei', kind: 'Mainnet', supported: true },
  { name: 'BNB Chain', icon: 'BNB', gas: '3 gwei', kind: 'Mainnet', supported: true },
  { name: 'Sepolia Testnet', icon: 'SEP', gas: '1 gwei', kind: 'Testnet', supported: true },
  { name: 'Solana', icon: 'SOL', gas: 'Coming Soon', kind: 'Mainnet', supported: false }
];

const featureOptions = [
  { name: 'Mintable', desc: 'Owner can mint new supply after deployment.', risk: 'medium' },
  { name: 'Burnable', desc: 'Token holders can burn tokens.', risk: 'low' },
  { name: 'Pausable', desc: 'Transfers can be paused in emergencies.', risk: 'medium' },
  { name: 'Ownable', desc: 'Owner permission model with admin controls.', risk: 'medium' },
  { name: 'Permit', desc: 'Gasless approvals with EIP-2612 style flow.', risk: 'low' },
  { name: 'Capped Supply', desc: 'Hard supply ceiling for mintable tokens.', risk: 'low' },
  { name: 'Tax / Fee', desc: 'Advanced / dikkatli kullan.', risk: 'high' }
];

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface p-10 text-center">
      <p className="font-headline text-xl font-bold text-white">{label}</p>
      <p className="mt-2 text-sm text-on-surface-variant">Filtreleri degistirerek tekrar deneyin.</p>
    </div>
  );
}

function getRiskLevel(score: number) {
  if (score < 30) return 'Low';
  if (score < 65) return 'Medium';
  return 'High';
}

function useCommunityVotes(projectSlug: string) {
  const key = `kripto-keyfi-project-votes-${projectSlug}`;
  const [votes, setVotes] = useState<Record<CommunityAction, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{"trusted":0,"using":0,"suspicious":0,"scam":0}');
    } catch {
      return { trusted: 0, using: 0, suspicious: 0, scam: 0 };
    }
  });

  function vote(action: CommunityAction) {
    setVotes((current) => {
      const next = { ...current, [action]: current[action] + 1 };
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }

  return { votes, vote };
}

function EcosystemTabs({ activeTab, setActiveTab }: { activeTab: EcosystemTab; setActiveTab: (tab: EcosystemTab) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {tabItems.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            'rounded-2xl border p-4 text-left transition-all',
            activeTab === tab.id ? 'border-primary/30 bg-primary/10' : 'border-outline/5 bg-surface hover:bg-surface-high'
          )}
        >
          <p className={cn('font-headline text-lg font-bold', activeTab === tab.id ? 'text-primary' : 'text-white')}>{tab.label}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{tab.desc}</p>
        </button>
      ))}
    </div>
  );
}

function EcosystemSidebar({
  activeTab,
  setActiveTab,
  category,
  setCategory,
  open,
  setOpen
}: {
  activeTab: EcosystemTab;
  setActiveTab: (tab: EcosystemTab) => void;
  category: string;
  setCategory: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <aside className={cn(
      'bg-background/95 md:bg-transparent',
      'md:block md:w-72 md:shrink-0',
      open ? 'fixed inset-y-0 left-0 z-50 w-[min(86vw,340px)] p-4' : 'hidden'
    )}>
      <div className="sticky top-28 space-y-6 rounded-[28px] border border-outline/5 bg-surface p-5 md:top-32">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-xl font-extrabold text-white">Web3 Tools</h2>
          <button type="button" onClick={() => setOpen(false)} className="md:hidden text-on-surface-variant"><X size={18} /></button>
        </div>
        <div className="space-y-6">
          {sidebarGroups.map((group) => (
            <section key={group.title}>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{group.title}</h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = activeTab === group.tab && (group.tab !== 'discover' || item === category);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setActiveTab(group.tab);
                        if (group.tab === 'discover') setCategory(item);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition-all',
                        active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-high hover:text-white'
                      )}
                    >
                      <span>{item}</span>
                      {active && <ChevronRight size={15} />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}

function EcosystemSearch({
  query,
  setQuery,
  network,
  setNetwork,
  status,
  setStatus,
  risk,
  setRisk,
  auditedOnly,
  setAuditedOnly
}: {
  query: string;
  setQuery: (value: string) => void;
  network: string;
  setNetwork: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  risk: string;
  setRisk: (value: string) => void;
  auditedOnly: boolean;
  setAuditedOnly: (value: boolean) => void;
}) {
  return (
    <section className="rounded-[28px] border border-outline/5 bg-surface p-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-full border-none bg-surface-high py-4 pl-12 pr-5 text-sm text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/25"
          placeholder="Proje, kategori, ag veya arac ara..."
          type="search"
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <SelectFilter label="Network" value={network} setValue={setNetwork} options={networks} />
        <SelectFilter label="Status" value={status} setValue={setStatus} options={statuses} />
        <SelectFilter label="Risk" value={risk} setValue={setRisk} options={riskLevels} />
        <label className="flex items-center justify-between rounded-xl bg-surface-high px-4 py-3 text-sm text-on-surface">
          <span>Audit var</span>
          <input type="checkbox" checked={auditedOnly} onChange={(event) => setAuditedOnly(event.target.checked)} />
        </label>
      </div>
    </section>
  );
}

function SelectFilter({ label, value, setValue, options }: { label: string; value: string; setValue: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      <select value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/25">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ProjectCard({ project, onDetails }: { project: EcosystemProject; onDetails: (project: EcosystemProject) => void }) {
  const riskLevel = getRiskLevel(project.riskScore);

  return (
    <article className="group rounded-[24px] border border-outline/5 bg-surface p-6 transition-all hover:-translate-y-1 hover:bg-surface-high">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={project.logo} alt={project.name} className="h-14 w-14 rounded-2xl object-cover" />
          <div>
            <h3 className="font-headline text-xl font-bold text-white group-hover:text-primary">{project.name}</h3>
            <p className="text-xs text-on-surface-variant">{project.category}</p>
          </div>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <p className="mb-5 line-clamp-2 text-sm leading-6 text-on-surface-variant">{project.description}</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {project.networks.map((network) => <span key={network} className="rounded-lg bg-surface-highest px-2 py-1 text-[10px] font-bold text-white">{network}</span>)}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Metric label="TVL" value={project.tvl} />
        <Metric label="Users" value={project.users} />
        <Metric label="Audit" value={project.auditStatus} />
        <Metric label="Risk" value={`${project.riskScore} / ${riskLevel}`} tone={riskLevel === 'High' ? 'error' : riskLevel === 'Medium' ? 'primary' : 'secondary'} />
      </div>
      <div className="mb-5 flex items-center justify-between rounded-2xl bg-surface-high/50 p-3">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-white"><Star size={15} className="text-secondary" /> {project.communityRating}</span>
        <span className="text-xs text-on-surface-variant">Community rating</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={project.website} target="_blank" rel="noreferrer" className="rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-on-surface hover:text-primary"><Globe size={14} /></a>
        <a href={project.twitter} target="_blank" rel="noreferrer" className="rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-on-surface hover:text-primary"><Twitter size={14} /></a>
        <a href={project.github} target="_blank" rel="noreferrer" className="rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-on-surface hover:text-primary"><Github size={14} /></a>
        <button type="button" onClick={() => onDetails(project)} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-background">
          Detay <ChevronRight size={14} />
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'primary' | 'secondary' | 'error' }) {
  return (
    <div className="rounded-2xl bg-surface-high/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className={cn('mt-1 text-sm font-bold text-white', tone === 'primary' && 'text-primary', tone === 'secondary' && 'text-secondary', tone === 'error' && 'text-error')}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: EcosystemProject['status'] }) {
  return (
    <span className={cn(
      'rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
      status === 'Active' && 'border-secondary/20 bg-secondary/10 text-secondary',
      status === 'Beta' && 'border-primary/20 bg-primary/10 text-primary',
      status === 'Testnet' && 'border-tertiary/20 bg-tertiary/10 text-tertiary',
      status === 'Risky' && 'border-error/20 bg-error/10 text-error'
    )}>
      {status}
    </span>
  );
}

function ProjectDetailModal({ project, onClose }: { project: EcosystemProject; onClose: () => void }) {
  const { votes, vote } = useCommunityVotes(project.slug);
  const [favorite, setFavorite] = useState(() => localStorage.getItem(`kripto-keyfi-project-fav-${project.slug}`) === '1');

  function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    localStorage.setItem(`kripto-keyfi-project-fav-${project.slug}`, next ? '1' : '0');
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4 backdrop-blur">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-outline/10 bg-surface p-6 shadow-2xl no-scrollbar">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={project.logo} alt={project.name} className="h-16 w-16 rounded-2xl object-cover" />
            <div>
              <h2 className="font-headline text-3xl font-extrabold text-white">{project.name}</h2>
              <p className="text-sm text-on-surface-variant">{project.category} / {project.networks.join(', ')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-surface-high p-2 text-on-surface-variant hover:text-white"><X size={18} /></button>
        </div>

        <p className="text-base leading-8 text-on-surface-variant">{project.description}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <Metric label="TVL" value={project.tvl} />
          <Metric label="Users" value={project.users} />
          <Metric label="Audit" value={project.auditStatus} />
          <Metric label="Risk Score" value={`${project.riskScore}`} tone={getRiskLevel(project.riskScore) === 'High' ? 'error' : 'secondary'} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-[24px] bg-surface-high/40 p-5">
            <h3 className="font-headline text-xl font-bold text-white">Community Verified</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['trusted', 'Guvenilir', ShieldCheck],
                ['using', 'Kullaniyorum', CheckCircle2],
                ['suspicious', 'Supheli', AlertTriangle],
                ['scam', 'Scam bildir', ShieldAlert]
              ].map(([action, label, Icon]) => (
                <button key={String(action)} type="button" onClick={() => vote(action as CommunityAction)} className="flex items-center justify-between rounded-2xl bg-surface p-4 text-left hover:bg-surface-high">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-white"><Icon size={16} className="text-primary" /> {String(label)}</span>
                  <span className="text-xs font-bold text-primary">{votes[action as CommunityAction]}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="space-y-3">
            <button type="button" onClick={toggleFavorite} className={cn('flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold', favorite ? 'bg-error/10 text-error' : 'bg-surface-high text-primary')}>
              <Heart size={16} fill={favorite ? 'currentColor' : 'none'} /> Favorilere ekle
            </button>
            <button type="button" onClick={() => vote('using')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary/10 px-4 py-3 text-sm font-bold text-secondary">
              <CheckCircle2 size={16} /> Kullaniyorum
            </button>
            <button type="button" onClick={() => vote('scam')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-error/10 px-4 py-3 text-sm font-bold text-error">
              <ShieldAlert size={16} /> Scam bildir
            </button>
            <div className="flex gap-2">
              <a href={project.website} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-surface-high px-4 py-3 text-center text-sm font-bold text-on-surface hover:text-primary">Website</a>
              <a href={project.github} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-surface-high px-4 py-3 text-center text-sm font-bold text-on-surface hover:text-primary">GitHub</a>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[24px] bg-surface-high/40 p-5">
          <h3 className="font-headline text-xl font-bold text-white">Kullanici yorumlari</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-sm font-bold text-white">AlphaSeeker</p>
              <p className="mt-1 text-sm text-on-surface-variant">TVL ve audit bilgisi guven veriyor, yine de owner yetkileri kontrol edilmeli.</p>
            </div>
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-sm font-bold text-white">SecOpsTR</p>
              <p className="mt-1 text-sm text-on-surface-variant">Risk skoru dusuk projelerde bile permission checker kullanmadan fon baglamayin.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DiscoverSection({ category, setCategory }: { category: string; setCategory: (value: string) => void }) {
  const projects = getEcosystemProjects();
  const [query, setQuery] = useState('');
  const [network, setNetwork] = useState('All');
  const [status, setStatus] = useState('All');
  const [risk, setRisk] = useState('All');
  const [auditedOnly, setAuditedOnly] = useState(false);
  const [selectedProject, setSelectedProject] = useState<EcosystemProject | null>(null);

  const filtered = useMemo(() => projects.filter((project) => {
    const text = `${project.name} ${project.description} ${project.category} ${project.networks.join(' ')}`.toLowerCase();
    const categoryMatch = category === 'All Ecosystems' || project.category === category;
    const networkMatch = network === 'All' || project.networks.includes(network);
    const statusMatch = status === 'All' || project.status === status;
    const riskMatch = risk === 'All' || getRiskLevel(project.riskScore) === risk;
    const auditMatch = !auditedOnly || project.auditStatus === 'Audited';
    return text.includes(query.toLowerCase()) && categoryMatch && networkMatch && statusMatch && riskMatch && auditMatch;
  }), [projects, query, category, network, status, risk, auditedOnly]);

  return (
    <div className="space-y-6">
      <header className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Web3 Araç Merkezi</p>
        <h1 className="mt-3 font-headline text-4xl font-extrabold text-white">Discover Ecosystem</h1>
        <p className="mt-3 max-w-3xl text-on-surface-variant">Web3 projelerini TVL, audit, network ve community rating sinyalleriyle keşfet.</p>
      </header>
      <EcosystemSearch query={query} setQuery={setQuery} network={network} setNetwork={setNetwork} status={status} setStatus={setStatus} risk={risk} setRisk={setRisk} auditedOnly={auditedOnly} setAuditedOnly={setAuditedOnly} />
      <div className="flex flex-wrap gap-2">
        {sidebarGroups[0].items.map((item) => (
          <button key={item} type="button" onClick={() => setCategory(item)} className={cn('rounded-full px-4 py-2 text-xs font-bold', category === item ? 'bg-secondary text-background' : 'bg-surface-high text-on-surface-variant hover:text-white')}>
            {item}
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((project) => <ProjectCard key={project.slug} project={project} onDetails={setSelectedProject} />)}
        </div>
      ) : <EmptyState label="Proje bulunamadi" />}
      {selectedProject && <ProjectDetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />}
    </div>
  );
}

function ToolCard({ tool }: { tool: EcosystemTool }) {
  const Icon = tool.icon === 'Rocket' ? Rocket : tool.icon === 'Code' ? Code : tool.icon === 'FileCode' ? FileCode : tool.icon === 'Zap' ? Zap : tool.icon === 'BadgeCheck' ? BadgeCheck : tool.icon === 'Wallet' ? Wallet : tool.icon === 'Activity' ? Activity : ShieldAlert;

  return (
    <Link to={tool.route} className="group rounded-[24px] border border-outline/5 bg-surface p-6 transition-all hover:-translate-y-1 hover:bg-surface-high">
      <div className="mb-5 flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon size={20} /></span>
        <span className={cn('rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest', tool.status === 'Active' ? 'bg-secondary/10 text-secondary' : 'bg-surface-highest text-on-surface-variant')}>{tool.status}</span>
      </div>
      <h3 className="font-headline text-xl font-bold text-white group-hover:text-primary">{tool.name}</h3>
      <p className="mt-3 text-sm leading-6 text-on-surface-variant">{tool.description}</p>
    </Link>
  );
}

type LaunchpadForm = {
  network: string;
  name: string;
  symbol: string;
  supply: string;
  decimals: string;
  description: string;
  website: string;
  features: string[];
  tokenomics: TokenomicsAllocation;
  vesting: typeof defaultVesting;
};

const defaultLaunchpadForm: LaunchpadForm = {
  network: 'Ethereum',
  name: '',
  symbol: '',
  supply: '1000000',
  decimals: '18',
  description: '',
  website: '',
  features: ['Burnable', 'Ownable'],
  tokenomics: defaultTokenomics,
  vesting: defaultVesting
};

function TokenLaunchpad() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<LaunchpadForm>(defaultLaunchpadForm);
  const [recentTokens, setRecentTokens] = useState<CreatedToken[]>([]);
  const [walletConnected, setWalletConnected] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => setRecentTokens(getRecentTokens()), []);

  const tokenomicsTotal = Object.values(form.tokenomics).reduce((sum, value) => sum + value, 0);
  const selectedNetwork = launchNetworks.find((network) => network.name === form.network);
  const codePreview = buildSolidityPreview(form.name, form.symbol, form.features);

  function updateTokenomics(key: keyof TokenomicsAllocation, value: number) {
    setForm((current) => ({ ...current, tokenomics: { ...current.tokenomics, [key]: value } }));
  }

  function createToken(status: CreatedToken['status']) {
    const token: CreatedToken = {
      id: crypto.randomUUID(),
      name: form.name || 'Untitled Token',
      symbol: form.symbol || 'TKN',
      network: form.network,
      supply: form.supply,
      decimals: form.decimals,
      features: form.features,
      tokenomics: form.tokenomics,
      vesting: form.vesting,
      createdAt: new Date().toLocaleString('tr-TR'),
      contractAddress: formatMockAddress(`${form.network}-${form.symbol}-${Date.now()}`),
      status
    };
    setRecentTokens(saveCreatedToken(token));
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[1fr_360px]">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-6">
        <LaunchpadStepper step={step} setStep={setStep} />
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-headline text-2xl font-bold text-white">Network</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {launchNetworks.map((network) => (
                <button
                  key={network.name}
                  type="button"
                  disabled={!network.supported}
                  onClick={() => network.supported && setForm((current) => ({ ...current, network: network.name }))}
                  className={cn('rounded-2xl border p-5 text-left transition-all', form.network === network.name ? 'border-primary/40 bg-primary/10' : 'border-outline/5 bg-surface-high/50 hover:bg-surface-high', !network.supported && 'cursor-not-allowed opacity-50')}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-highest text-xs font-black text-white">{network.icon}</span>
                    <span className="rounded-lg bg-surface-highest px-2 py-1 text-[10px] font-bold text-on-surface-variant">{network.kind}</span>
                  </div>
                  <h3 className="font-headline text-lg font-bold text-white">{network.name}</h3>
                  <p className="mt-1 text-xs text-on-surface-variant">Avg gas: {network.gas}</p>
                  <p className="mt-3 text-xs font-bold text-primary">{network.supported ? 'Supported' : 'Coming Soon'}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <h2 className="font-headline text-2xl font-bold text-white">Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Token Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Kripto Keyfi Token" />
                <Input label="Symbol" value={form.symbol} onChange={(value) => setForm((current) => ({ ...current, symbol: value.toUpperCase() }))} placeholder="KEYFI" />
                <Input label="Total Supply" value={form.supply} onChange={(value) => setForm((current) => ({ ...current, supply: value }))} />
                <Input label="Decimals" value={form.decimals} onChange={(value) => setForm((current) => ({ ...current, decimals: value }))} />
                <Input label="Website optional" value={form.website} onChange={(value) => setForm((current) => ({ ...current, website: value }))} placeholder="https://..." />
                <div className="rounded-2xl border border-dashed border-outline/30 bg-surface-high/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Logo upload mock</p>
                  <p className="mt-2 text-sm text-on-surface-variant">Dosya secimi backend storage entegrasyonu ile eklenecek.</p>
                </div>
              </div>
              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Token description</span>
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="h-28 w-full resize-none rounded-2xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/25" />
              </label>
            </div>
            <TokenPreview form={form} selectedNetwork={selectedNetwork?.name || form.network} />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h2 className="font-headline text-2xl font-bold text-white">Options</h2>
              <p className="mt-2 text-sm text-on-surface-variant">OpenZeppelin tabanli guvenli sablon uzerinden ERC20 ozellikleri sec.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {featureOptions.map((feature) => {
                const active = form.features.includes(feature.name);
                return (
                  <button key={feature.name} type="button" onClick={() => setForm((current) => ({ ...current, features: active ? current.features.filter((item) => item !== feature.name) : [...current.features, feature.name] }))} className={cn('rounded-2xl border p-4 text-left transition-all', active ? 'border-primary/30 bg-primary/10' : 'border-outline/5 bg-surface-high/50 hover:bg-surface-high')}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-white">{feature.name}</p>
                      <span className={cn('rounded-lg px-2 py-1 text-[10px] font-bold uppercase', feature.risk === 'high' ? 'bg-error/10 text-error' : feature.risk === 'medium' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary')}>{feature.risk}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-on-surface-variant">{feature.desc}</p>
                  </button>
                );
              })}
            </div>
            <TokenomicsBuilder tokenomics={form.tokenomics} updateTokenomics={updateTokenomics} total={tokenomicsTotal} />
            <VestingBuilder form={form} setForm={setForm} />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="font-headline text-2xl font-bold text-white">Deploy Summary</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Metric label="Network" value={form.network} />
              <Metric label="Token" value={`${form.name || 'Untitled'} (${form.symbol || 'TKN'})`} />
              <Metric label="Supply" value={form.supply} />
              <Metric label="Decimals" value={form.decimals} />
              <Metric label="Features" value={form.features.join(', ') || 'None'} />
              <Metric label="Tokenomics" value={`${tokenomicsTotal}%`} tone={tokenomicsTotal === 100 ? 'secondary' : 'error'} />
            </div>
            {!walletConnected && <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">Wallet bagli degil. Gercek deploy icin wallet bagla akisi gerekir.</div>}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setShowCode((value) => !value)} className="rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary">Contract kodunu goruntule</button>
              <button type="button" onClick={() => setWalletConnected(true)} className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary">Wallet bagla</button>
              <button type="button" onClick={() => createToken('Testnet Ready')} className="rounded-xl bg-secondary px-4 py-3 text-sm font-bold text-background">Testnet'e deploy et</button>
              <button type="button" onClick={() => createToken('Draft')} className="rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface">Mainnet deploy hazirligi</button>
            </div>
            {showCode && <ContractCodePreview code={codePreview} />}
          </div>
        )}
        <div className="mt-8 flex items-center justify-between border-t border-outline/5 pt-6">
          <button type="button" onClick={() => setStep((value) => Math.max(1, value - 1))} className={cn('rounded-xl bg-surface-high px-5 py-3 text-sm font-bold text-on-surface', step === 1 && 'invisible')}>Back</button>
          <button type="button" onClick={() => setStep((value) => Math.min(4, value + 1))} className={cn('rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background', step === 4 && 'invisible')}>Continue</button>
        </div>
      </section>
      <aside className="space-y-6">
        <SecurityChecksPanel form={form} tokenomicsTotal={tokenomicsTotal} />
        <RecentTokens tokens={recentTokens} />
      </aside>
    </div>
  );
}

function LaunchpadStepper({ step, setStep }: { step: number; setStep: (step: number) => void }) {
  return (
    <div className="mb-8 grid gap-3 md:grid-cols-4">
      {['Network', 'Details', 'Options', 'Deploy'].map((label, index) => (
        <button key={label} type="button" onClick={() => setStep(index + 1)} className={cn('rounded-2xl border p-4 text-left', step === index + 1 ? 'border-primary/30 bg-primary/10' : 'border-outline/5 bg-surface-high/40')}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Step {index + 1}</p>
          <p className="font-headline text-lg font-bold text-white">{label}</p>
        </button>
      ))}
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/25" />
    </label>
  );
}

function TokenPreview({ form, selectedNetwork }: { form: LaunchpadForm; selectedNetwork: string }) {
  return (
    <aside className="rounded-[24px] border border-outline/5 bg-surface-high/50 p-6">
      <h3 className="font-headline text-xl font-bold text-white">Token Preview</h3>
      <div className="mt-5 space-y-3">
        <Metric label="Token adi" value={form.name || 'Untitled Token'} />
        <Metric label="Sembol" value={form.symbol || 'TKN'} />
        <Metric label="Supply" value={form.supply} />
        <Metric label="Decimals" value={form.decimals} />
        <Metric label="Network" value={selectedNetwork} />
      </div>
      <p className="mt-5 text-sm leading-6 text-on-surface-variant">{form.description || 'Token aciklamasi burada canli guncellenir.'}</p>
    </aside>
  );
}

function TokenomicsBuilder({ tokenomics, updateTokenomics, total }: { tokenomics: TokenomicsAllocation; updateTokenomics: (key: keyof TokenomicsAllocation, value: number) => void; total: number }) {
  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface-high/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-headline text-xl font-bold text-white">Tokenomics</h3>
        <span className={cn('rounded-lg px-3 py-1 text-xs font-bold', total === 100 ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error')}>Toplam {total}%</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.entries(tokenomics) as Array<[keyof TokenomicsAllocation, number]>).map(([key, value]) => (
          <label key={key} className="space-y-2">
            <span className="text-xs font-bold text-on-surface-variant">{key}</span>
            <input type="number" min={0} max={100} value={value} onChange={(event) => updateTokenomics(key, Number(event.target.value))} className="w-full rounded-xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface" />
          </label>
        ))}
      </div>
      {total !== 100 && <p className="mt-4 text-sm font-bold text-error">Tokenomics toplami 100 olmali.</p>}
    </section>
  );
}

function VestingBuilder({ form, setForm }: { form: LaunchpadForm; setForm: Dispatch<SetStateAction<LaunchpadForm>> }) {
  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface-high/40 p-5">
      <h3 className="font-headline text-xl font-bold text-white">Vesting</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <Input label="Cliff" value={form.vesting.cliff} onChange={(value) => setForm((current) => ({ ...current, vesting: { ...current.vesting, cliff: value } }))} />
        <Input label="Vesting suresi" value={form.vesting.duration} onChange={(value) => setForm((current) => ({ ...current, vesting: { ...current.vesting, duration: value } }))} />
        <Input label="Baslangic" value={form.vesting.startDate} onChange={(value) => setForm((current) => ({ ...current, vesting: { ...current.vesting, startDate: value } }))} />
        <label className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Kilitli oran</span>
          <input type="number" value={form.vesting.lockedPercent} onChange={(event) => setForm((current) => ({ ...current, vesting: { ...current.vesting, lockedPercent: Number(event.target.value) } }))} className="w-full rounded-2xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface" />
        </label>
      </div>
    </section>
  );
}

function SecurityChecksPanel({ form, tokenomicsTotal }: { form: LaunchpadForm; tokenomicsTotal: number }) {
  const checks = [
    { label: 'ERC20 uyumlulugu', ok: true },
    { label: 'Supply validasyonu', ok: /^\d+$/.test(form.supply.replaceAll(',', '')) },
    { label: 'Network secimi', ok: Boolean(form.network) },
    { label: 'Owner yetkileri uyarisi', ok: !form.features.includes('Ownable') },
    { label: 'Mint riski', ok: !form.features.includes('Mintable') },
    { label: 'Tax/Fee yuksek risk', ok: !form.features.includes('Tax / Fee') },
    { label: 'Tokenomics 100 kontrolu', ok: tokenomicsTotal === 100 },
    { label: 'Vesting onerisi', ok: form.vesting.lockedPercent >= 20 }
  ];

  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface p-5">
      <h3 className="mb-4 font-headline text-xl font-bold text-white">Security Checks</h3>
      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-3 text-sm text-on-surface-variant">
            {check.ok ? <CheckCircle2 size={16} className="text-secondary" /> : <AlertTriangle size={16} className="text-error" />}
            {check.label}
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentTokens({ tokens }: { tokens: CreatedToken[] }) {
  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface p-5">
      <h3 className="mb-4 font-headline text-xl font-bold text-white">Recent Tokens</h3>
      {tokens.length ? (
        <div className="space-y-3">
          {tokens.map((token) => (
            <div key={token.id} className="rounded-2xl bg-surface-high/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{token.name}</p>
                  <p className="text-xs text-primary">{token.symbol} / {token.network}</p>
                </div>
                <span className="rounded-lg bg-secondary/10 px-2 py-1 text-[10px] font-bold text-secondary">{token.status}</span>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">Supply {token.supply} / {token.createdAt}</p>
              <p className="mt-2 break-all font-mono text-[10px] text-on-surface-variant">{token.contractAddress}</p>
              <a href={`https://explorer.example/address/${token.contractAddress}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold text-primary">Explorer link mock</a>
            </div>
          ))}
        </div>
      ) : <EmptyState label="Recent token yok" />}
    </section>
  );
}

function ContractCodePreview({ code }: { code: string }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-2xl border border-outline/10 bg-background p-5 text-sm text-secondary no-scrollbar">
      <code>{code}</code>
    </pre>
  );
}

function BuildTools() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-5 font-headline text-2xl font-extrabold text-white">Build Tools</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {getEcosystemTools('Build').map((tool) => <ToolCard key={tool.id} tool={tool} />)}
        </div>
      </section>
      <TokenLaunchpad />
    </div>
  );
}

function MonitorDashboard() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<ReturnType<typeof analyzeWallet>>(null);
  const whales = getWhaleFeed();

  return (
    <div className="space-y-6">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        {getEcosystemTools('Monitor').map((tool) => <ToolCard key={tool.id} tool={tool} />)}
        <div className="rounded-[24px] border border-outline/5 bg-surface p-6 md:col-span-2">
          <h2 className="font-headline text-2xl font-bold text-white">Wallet Intelligence</h2>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input value={address} onChange={(event) => setAddress(event.target.value)} className="flex-1 rounded-xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface" placeholder="0x ile baslayan wallet adresi" />
            <button type="button" onClick={() => setResult(analyzeWallet(address))} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Analiz et</button>
          </div>
          {address && !/^0x[a-fA-F0-9]{40}$/.test(address) && <p className="mt-3 text-sm text-error">Wallet adresi gecersiz.</p>}
          {result && (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Metric label="Ilk islem" value={result.firstTransaction} />
              <Metric label="Toplam islem" value={result.totalTransactions} />
              <Metric label="Risk" value={`${result.riskScore}/100`} tone="secondary" />
              <Metric label="Aktif aglar" value={result.activeNetworks.join(', ')} />
              <Metric label="DeFi" value={result.defiActivity} />
              <Metric label="NFT" value={result.nftActivity} />
            </div>
          )}
        </div>
      </section>
      <section className="rounded-[24px] border border-outline/5 bg-surface p-6">
        <h2 className="font-headline text-2xl font-bold text-white">Whale Tracker</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {whales.map((whale) => (
            <div key={whale.id} className="rounded-2xl bg-surface-high/50 p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-white">{whale.amount}</p>
                <span className={cn('rounded-lg px-2 py-1 text-[10px] font-bold', whale.importance === 'Yüksek' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary')}>{whale.importance}</span>
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">{whale.type} / {whale.network} / {whale.time}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SecurityDashboard() {
  const [address, setAddress] = useState('');
  const [report, setReport] = useState<ReturnType<typeof scanTokenContract>>(null);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {getEcosystemTools('Security').map((tool) => <ToolCard key={tool.id} tool={tool} />)}
      </section>
      <section className="rounded-[32px] border border-outline/5 bg-surface p-6">
        <h2 className="font-headline text-2xl font-bold text-white">Rug Pull Scanner</h2>
        <p className="mt-2 text-sm text-on-surface-variant">Mock rapor: owner yetkisi, mint, blacklist, liquidity ve honeypot sinyallerini kontrol eder.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input value={address} onChange={(event) => setAddress(event.target.value)} className="flex-1 rounded-xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface" placeholder="Token contract adresi" />
          <button type="button" onClick={() => setReport(scanTokenContract(address))} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Tara</button>
        </div>
        {address && !/^0x[a-fA-F0-9]{40}$/.test(address) && <p className="mt-3 text-sm text-error">Contract adresi gecersiz.</p>}
        {report && (
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Metric label="Owner yetkisi" value={report.ownerPrivilege} />
            <Metric label="Mint fonksiyonu" value={report.mintFunction} tone={report.mintFunction === 'Detected' ? 'error' : 'secondary'} />
            <Metric label="Blacklist" value={report.blacklistFunction} />
            <Metric label="Liquidity" value={report.liquidityStatus} />
            <Metric label="Honeypot" value={report.honeypotRisk} tone="secondary" />
            <Metric label="Risk skoru" value={`${report.riskScore}/100`} tone="primary" />
          </div>
        )}
      </section>
      <ContentRecommendations />
    </div>
  );
}

function ContentRecommendations() {
  const items = [
    { title: 'ERC20 nedir?', to: '/academy/articles/solidity-baslangic-erc20' },
    { title: 'Tokenomics nasil tasarlanir?', to: '/academy/tag/Tokenomics' },
    { title: 'Rug pull nasil anlasilir?', to: '/blog/cuzdan-guvenligi-phishing-saldirilari-neden-artiyor' },
    { title: 'Wallet guvenligi nedir?', to: '/academy/articles/wallet-security-phishing' }
  ];

  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface p-6">
      <h2 className="font-headline text-2xl font-bold text-white">Onerilen Icerikler</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {items.map((item) => (
          <Link key={item.title} to={item.to} className="rounded-2xl bg-surface-high/50 p-4 text-sm font-bold text-primary hover:bg-surface-high">
            {item.title}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Ecosystem() {
  const params = useParams();
  const navigate = useNavigate();
  const routeSection = params.section;
  const initialTab: EcosystemTab = routeSection === 'launchpad'
    ? 'build'
    : routeSection && ['discover', 'build', 'monitor', 'security'].includes(routeSection)
      ? routeSection as EcosystemTab
      : 'discover';
  const [activeTab, setActiveTabState] = useState<EcosystemTab>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [category, setCategory] = useState('All Ecosystems');

  useEffect(() => {
    if (routeSection === 'launchpad') {
      setActiveTabState('build');
    } else if (routeSection && ['discover', 'build', 'monitor', 'security'].includes(routeSection)) {
      setActiveTabState(routeSection as EcosystemTab);
    }
  }, [routeSection]);

  function setActiveTab(tab: EcosystemTab) {
    setActiveTabState(tab);
    navigate(tab === 'discover' ? '/ecosystem' : `/ecosystem/${tab}`, { replace: false });
  }

  return (
    <div className="space-y-6">
      {sidebarOpen && <button type="button" aria-label="Close ecosystem sidebar" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden" />}
      <div className="flex items-center justify-between gap-4 md:hidden">
        <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface">
          <Menu size={18} /> Tools Menu
        </button>
      </div>
      <div className="flex gap-8">
        <EcosystemSidebar activeTab={activeTab} setActiveTab={setActiveTab} category={category} setCategory={setCategory} open={sidebarOpen} setOpen={setSidebarOpen} />
        <main className="min-w-0 flex-1 space-y-6">
          <EcosystemTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          {activeTab === 'discover' && <DiscoverSection category={category} setCategory={setCategory} />}
          {activeTab === 'build' && <BuildTools />}
          {activeTab === 'monitor' && <MonitorDashboard />}
          {activeTab === 'security' && <SecurityDashboard />}
          {activeTab !== 'security' && <ContentRecommendations />}
        </main>
      </div>
    </div>
  );
}
