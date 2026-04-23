import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Download,
  ArrowLeftRight,
  Send,
  History,
  Wallet,
  FileText
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ASSETS } from '../constants';
import { cn } from '../lib/utils';

const data = [
  { name: '00:00', value: 120000 },
  { name: '04:00', value: 125000 },
  { name: '08:00', value: 122000 },
  { name: '12:00', value: 135000 },
  { name: '16:00', value: 130000 },
  { name: '20:00', value: 142854 },
];

const pieData = [
  { name: 'Bitcoin', value: 70, color: '#8dacff' },
  { name: 'Ethereum', value: 25, color: '#00ffa3' },
  { name: 'Solana', value: 5, color: '#ac89ff' },
];

export default function Dashboard() {
  return (
    <div className="space-y-10">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline font-extrabold text-5xl mb-2 text-white">Portfolio Overview</h1>
          <p className="text-on-surface-variant">Tracking 12 assets across 3 networks.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-surface-high hover:bg-surface-highest text-on-surface px-5 py-2.5 rounded-xl font-headline font-semibold text-sm transition-all flex items-center gap-2">
            <RefreshCw size={18} />
            Sync Exchange
          </button>
          <button className="bg-surface-high hover:bg-surface-highest text-on-surface px-5 py-2.5 rounded-xl font-headline font-semibold text-sm transition-all flex items-center gap-2">
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {/* Allocation Card */}
          <div className="bg-surface p-8 rounded-[24px] border border-outline/5">
            <h3 className="font-headline font-bold text-lg mb-8 text-white">Allocation</h3>
            <div className="relative w-48 h-48 mx-auto mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Total Value</span>
                <span className="text-2xl font-headline font-extrabold text-white">$142.8k</span>
              </div>
            </div>
            <div className="space-y-4">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-on-surface-variant">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface p-8 rounded-[24px] border border-outline/5">
            <h3 className="font-headline font-bold text-lg mb-6 text-white">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: ArrowLeftRight, label: 'Swap' },
                { icon: Send, label: 'Send' },
                { icon: Wallet, label: 'Stake' },
                { icon: History, label: 'History' },
              ].map((action) => (
                <button key={action.label} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-surface-high hover:bg-surface-highest transition-all group">
                  <action.icon className="text-primary group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-headline font-medium text-on-surface">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          {/* Main Chart Card */}
          <div className="bg-surface p-8 rounded-[24px] border border-outline/5 relative overflow-hidden">
            <div className="flex justify-between items-start mb-8">
              <div>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Portfolio Performance</span>
                <div className="flex items-baseline gap-3 mt-1">
                  <h2 className="text-4xl font-headline font-extrabold text-white">$142,854.32</h2>
                  <div className="flex items-center gap-1 text-secondary font-bold text-sm">
                    <TrendingUp size={14} />
                    +12.4%
                  </div>
                </div>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ffa3" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00ffa3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#00ffa3" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141f38', border: 'none', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#00ffa3' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Assets Table */}
          <div className="bg-surface rounded-[24px] border border-outline/5 overflow-hidden">
            <div className="p-8 pb-4 flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg text-white">Assets</h3>
              <button className="text-primary font-headline text-sm font-semibold hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">
                    <th className="px-8 py-4">Asset</th>
                    <th className="px-4 py-4 text-right">Price</th>
                    <th className="px-4 py-4 text-right">24h Change</th>
                    <th className="px-8 py-4 text-right">Balance / Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/5">
                  {ASSETS.map((asset) => (
                    <tr key={asset.id} className="hover:bg-surface-high transition-colors cursor-pointer group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-surface-highest flex items-center justify-center overflow-hidden">
                            <img src={asset.icon} alt={asset.name} className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="font-headline font-bold text-white">{asset.name}</div>
                            <div className="text-xs text-on-surface-variant">{asset.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-right font-headline font-medium text-sm text-white">
                        ${asset.price.toLocaleString()}
                      </td>
                      <td className="px-4 py-6 text-right">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-xs font-bold",
                          asset.change24h >= 0 ? "bg-secondary/10 text-secondary" : "bg-error/10 text-error"
                        )}>
                          {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="font-headline font-bold text-white">{asset.balance} {asset.symbol}</div>
                        <div className="text-xs text-on-surface-variant">${asset.value.toLocaleString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {/* Performance Card */}
          <div className="bg-surface p-8 rounded-[24px] border border-outline/5">
            <h3 className="font-headline font-bold text-lg mb-6 text-white">Performance</h3>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Total Profit/Loss</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-headline font-extrabold text-secondary">+$24,500</span>
                  <span className="text-sm font-bold text-secondary-dim">(+21.4%)</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">24h Gain</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-headline font-bold text-secondary">+$1,280</span>
                </div>
              </div>
              <div className="pt-4 space-y-2">
                <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden">
                  <div className="h-full bg-secondary w-2/3"></div>
                </div>
                <p className="text-[11px] text-on-surface-variant">You are outperforming 78% of active trackers.</p>
              </div>
            </div>
          </div>

          {/* Tax Reports */}
          <div className="bg-surface-high p-8 rounded-[24px] border border-outline/5">
            <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2 text-white">
              <FileText className="text-primary" size={20} />
              Tax Reports
            </h3>
            <p className="text-sm text-on-surface-variant mb-6">Generate ready-to-file crypto tax reports for the 2023 financial year.</p>
            <button className="w-full py-3 rounded-xl border border-primary text-primary font-headline font-bold text-sm hover:bg-primary/5 transition-all">
              Generate Report
            </button>
          </div>

          {/* Pro Insight */}
          <div className="relative group rounded-[24px] overflow-hidden h-[200px] flex flex-col justify-end p-6 cursor-pointer">
            <img 
              src="https://picsum.photos/seed/insight/400/300" 
              alt="Insight" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
            <div className="relative z-10">
              <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">Pro Insight</span>
              <h4 className="font-headline font-bold text-white text-base leading-tight">Learn how to optimize Gas Fees on Ethereum Mainnet</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
