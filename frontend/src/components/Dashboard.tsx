import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Download, ExternalLink, FileText, History, MessageSquare, RefreshCw, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';
import { getConnectedWallets, getSavedContent, getUserActivity, getUserPortfolio, getWatchlist } from '../services/portfolioService';
import { getAuthState } from '../services/authService';

const tabs = ['Portfolio', 'Watchlist', 'Saved Content', 'Activity', 'Wallets', 'Reports'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('Portfolio');
  const auth = getAuthState();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 rounded-[32px] border border-outline/5 bg-surface p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Personal Center</p>
          <h1 className="mt-3 font-headline text-5xl font-extrabold text-white">My Assets</h1>
          <p className="mt-2 text-on-surface-variant">Portföyünü, kayıtlı içeriklerini, cüzdanlarını ve platform aktivitelerini yönet.</p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-5 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest"><RefreshCw size={18} /> Sync</button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-5 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest"><Download size={18} /> Export</button>
        </div>
      </section>

      {auth && !auth.isWalletConnected && (
        <section className="rounded-[24px] border border-primary/15 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-headline text-lg font-bold text-white">Cüzdan bağlamak zorunlu değildir</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Portföy takibi ve Web3 araçları için önerilir. İstersen şimdilik sayfayı görüntülemeye devam edebilirsin.</p>
            </div>
            <Link to="/connect-wallet" className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background">Cüzdan Bağla</Link>
          </div>
        </section>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {tabs.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn('shrink-0 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider', activeTab === tab ? 'bg-secondary text-background' : 'bg-surface-high text-on-surface-variant hover:text-white')}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Portfolio' && <PortfolioTab />}
      {activeTab === 'Watchlist' && <WatchlistTab />}
      {activeTab === 'Saved Content' && <SavedContentTab />}
      {activeTab === 'Activity' && <ActivityTab />}
      {activeTab === 'Wallets' && <WalletsTab />}
      {activeTab === 'Reports' && <ReportsTab />}
    </div>
  );
}

function PortfolioTab() {
  const portfolio = getUserPortfolio();

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-3 space-y-6">
        <div className="rounded-[24px] border border-outline/5 bg-surface p-6">
          <h3 className="mb-6 font-headline text-lg font-bold text-white">Allocation</h3>
          <div className="relative mx-auto mb-6 h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={portfolio.allocation} cx="50%" cy="50%" innerRadius={58} outerRadius={78} paddingAngle={5} dataKey="value">
                  {portfolio.allocation.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Value</span>
              <span className="font-headline text-2xl font-extrabold text-white">{portfolio.totalValue}</span>
            </div>
          </div>
          <div className="space-y-3">
            {portfolio.allocation.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">{item.name}</span>
                <span className="font-bold text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
        <QuickActions />
      </div>
      <div className="col-span-12 lg:col-span-6 space-y-6">
        <div className="rounded-[24px] border border-outline/5 bg-surface p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Portfolio Performance</p>
          <div className="mt-1 flex items-baseline gap-3">
            <h2 className="font-headline text-4xl font-extrabold text-white">{portfolio.totalValue}</h2>
            <span className="font-bold text-secondary">{portfolio.change24h}</span>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolio.chart}>
                <defs>
                  <linearGradient id="portfolioValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ffa3" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ffa3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#00ffa3" strokeWidth={3} fill="url(#portfolioValue)" />
                <Tooltip contentStyle={{ backgroundColor: '#141f38', border: 'none', borderRadius: '12px', color: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <AssetsTable />
      </div>
      <div className="col-span-12 lg:col-span-3 space-y-6">
        <div className="rounded-[24px] border border-outline/5 bg-surface p-6">
          <h3 className="mb-5 font-headline text-lg font-bold text-white">Performance</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Profit/Loss</p>
          <p className="mt-1 font-headline text-3xl font-extrabold text-secondary">{portfolio.profitLoss}</p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-surface-highest"><div className="h-full w-2/3 bg-secondary" /></div>
          <p className="mt-3 text-xs text-on-surface-variant">You are outperforming 78% of active trackers.</p>
        </div>
        <ReportsCard />
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface p-6">
      <h3 className="mb-5 font-headline text-lg font-bold text-white">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {['Swap', 'Send', 'Stake', 'History'].map((item) => <button key={item} className="rounded-2xl bg-surface-high p-4 text-xs font-bold text-on-surface hover:bg-surface-highest">{item}</button>)}
      </div>
    </div>
  );
}

function AssetsTable() {
  const assets = getUserPortfolio().assets;
  return (
    <div className="overflow-hidden rounded-[24px] border border-outline/5 bg-surface">
      <div className="flex items-center justify-between p-6">
        <h3 className="font-headline text-lg font-bold text-white">Assets</h3>
        <button className="text-sm font-bold text-primary">View All</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <tr><th className="px-6 py-3">Asset</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">24h</th><th className="px-6 py-3 text-right">Value</th></tr>
          </thead>
          <tbody className="divide-y divide-outline/5">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-surface-high">
                <td className="px-6 py-5"><div className="flex items-center gap-3"><img src={asset.icon} alt={asset.name} className="h-9 w-9 rounded-full bg-surface-highest p-1" /><div><p className="font-bold text-white">{asset.name}</p><p className="text-xs text-on-surface-variant">{asset.symbol}</p></div></div></td>
                <td className="px-4 py-5 text-right text-sm font-bold text-white">${asset.price.toLocaleString()}</td>
                <td className={cn('px-4 py-5 text-right text-sm font-bold', asset.change24h >= 0 ? 'text-secondary' : 'text-error')}>{asset.change24h >= 0 ? '+' : ''}{asset.change24h}%</td>
                <td className="px-6 py-5 text-right"><p className="font-bold text-white">${asset.value.toLocaleString()}</p><p className="text-xs text-on-surface-variant">{asset.balance} {asset.symbol}</p></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WatchlistTab() {
  return <CardGrid title="Watchlist">{getWatchlist().map((asset) => <AssetMiniCard key={asset.id} asset={asset} />)}</CardGrid>;
}

function AssetMiniCard({ asset }: { asset: ReturnType<typeof getWatchlist>[number] }) {
  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface p-5">
      <div className="flex items-center gap-3"><img src={asset.icon} alt={asset.name} className="h-10 w-10 rounded-full" /><div><p className="font-bold text-white">{asset.name}</p><p className="text-xs text-on-surface-variant">{asset.note}</p></div></div>
      <div className="mt-4 flex items-center justify-between"><span className="font-headline text-xl font-bold text-white">${asset.price.toLocaleString()}</span><span className={cn('text-sm font-bold', asset.change24h >= 0 ? 'text-secondary' : 'text-error')}>{asset.change24h}%</span></div>
    </div>
  );
}

function SavedContentTab() {
  const saved = getSavedContent();
  const items = [
    ...saved.news.map((item) => ({ title: item.title, meta: `Haber / ${item.category}`, to: `/blog/${item.slug}` })),
    ...saved.academy.map((item) => ({ title: item.title, meta: `Akademi / ${item.category}`, to: `/academy/articles/${item.slug}` })),
    ...saved.videos.map((item) => ({ title: item.title, meta: `Video / ${item.category}`, to: `/videos/${item.id}` })),
    ...saved.projects.map((item) => ({ title: item.name, meta: `Ecosystem / ${item.category}`, to: '/ecosystem' }))
  ];
  return <CardGrid title="Saved Content">{items.map((item) => <SavedItem key={`${item.meta}-${item.title}`} item={item} />)}</CardGrid>;
}

function SavedItem({ item }: { item: { title: string; meta: string; to: string } }) {
  return <Link to={item.to} className="rounded-[24px] border border-outline/5 bg-surface p-5 hover:bg-surface-high"><p className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.meta}</p><h3 className="mt-2 font-headline text-lg font-bold text-white">{item.title}</h3></Link>;
}

function ActivityTab() {
  return <div className="rounded-[24px] border border-outline/5 bg-surface p-6"><h2 className="mb-5 font-headline text-2xl font-bold text-white">Activity</h2><div className="space-y-3">{getUserActivity().map((activity) => <div key={activity.id} className="flex items-center gap-3 rounded-2xl bg-surface-high/50 p-4"><History size={18} className="text-primary" /><div><p className="font-bold text-white">{activity.text}</p><p className="text-xs text-on-surface-variant">{activity.type} / {activity.date}</p></div></div>)}</div></div>;
}

function WalletsTab() {
  return <CardGrid title="Wallets">{getConnectedWallets().map((wallet) => <div key={wallet.id} className="rounded-[24px] border border-outline/5 bg-surface p-5"><div className="mb-4 flex items-center gap-3"><Wallet className="text-primary" size={20} /><div><p className="font-bold text-white">{wallet.label}</p><p className="text-xs text-on-surface-variant">{wallet.network} / {wallet.status}</p></div></div><p className="break-all font-mono text-xs text-on-surface-variant">{wallet.address}</p><div className="mt-4 flex gap-2"><button className="rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-primary">Kopyala</button><a href={`https://etherscan.io/address/${wallet.address}`} target="_blank" rel="noreferrer" className="rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-primary">Explorer</a><button className="rounded-xl bg-error/10 px-3 py-2 text-xs font-bold text-error">Disconnect mock</button></div></div>)}</CardGrid>;
}

function ReportsTab() {
  return <CardGrid title="Reports">{['Tax Reports', 'Portfolio Export CSV', 'Activity Export', 'Wallet Summary'].map((report) => <div key={report} className="rounded-[24px] border border-outline/5 bg-surface p-5"><FileText className="mb-4 text-primary" size={22} /><h3 className="font-headline text-xl font-bold text-white">{report}</h3><p className="mt-2 text-sm text-on-surface-variant">Mock export hazır. Backend bağlandığında gerçek rapor üretilecek.</p><button className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-background">Generate</button></div>)}</CardGrid>;
}

function ReportsCard() {
  return <div className="rounded-[24px] border border-outline/5 bg-surface p-6"><h3 className="mb-3 flex items-center gap-2 font-headline text-lg font-bold text-white"><FileText className="text-primary" size={20} /> Tax Reports</h3><p className="mb-5 text-sm text-on-surface-variant">Generate ready-to-file crypto tax reports.</p><button className="w-full rounded-xl border border-primary py-3 text-sm font-bold text-primary">Generate Report</button></div>;
}

function CardGrid({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-5"><h2 className="font-headline text-2xl font-extrabold text-white">{title}</h2><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{children}</div></section>;
}
