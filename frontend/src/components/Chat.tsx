import React from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  Bell, 
  Globe, 
  Bitcoin, 
  Zap, 
  Rocket, 
  Users, 
  Settings,
  Star,
  MoreVertical,
  PlusCircle,
  Smile,
  Image as ImageIcon,
  Paperclip,
  Code,
  Send,
  MessageSquare
} from 'lucide-react';
import { MESSAGES } from '../constants';
import { cn } from '../lib/utils';

export default function Chat() {
  const rooms = [
    { name: 'Global Stream', icon: Globe, active: true, online: 1204 },
    { name: 'BTC Bull Pen', icon: Bitcoin },
    { name: 'ETH Alpha', icon: Zap },
    { name: 'New Projects', icon: Rocket, count: 12 },
  ];

  const groups = [
    { name: 'Whale Keyfi', initial: 'WK' },
    { name: 'DeFi Level 1', initial: 'D1' },
  ];

  const activeUsers = [
    { name: 'Admin_Kripto', role: 'Moderator', avatar: 'https://i.pravatar.cc/150?u=admin', online: true },
    { name: 'BullRun2024', role: 'Trading Pro', avatar: 'https://i.pravatar.cc/150?u=bull', online: true },
    { name: 'SatoshiDaughter', role: 'Whale', avatar: 'https://i.pravatar.cc/150?u=satoshi', online: true },
    { name: 'MarginCall', role: 'Idle', avatar: 'https://i.pravatar.cc/150?u=margin', online: false },
    { name: 'Ether_Lover', role: 'Staker', avatar: 'https://i.pravatar.cc/150?u=ether', online: true },
  ];

  return (
    <div className="h-[calc(100vh-160px)] flex overflow-hidden bg-surface rounded-[32px] border border-outline/5">
      {/* Left Sidebar */}
      <aside className="w-72 bg-surface-high/30 flex flex-col pt-6 border-r border-outline/5">
        <div className="px-6 mb-8">
          <h2 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Chat Rooms</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-1 no-scrollbar">
          {rooms.map((room) => (
            <button 
              key={room.name}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
                room.active ? "bg-surface-high text-primary border-l-4 border-primary" : "text-on-surface-variant hover:bg-surface-high hover:text-white"
              )}
            >
              <room.icon size={18} />
              <span className="font-semibold text-sm">{room.name}</span>
              {room.online && <div className="ml-auto w-2 h-2 rounded-full bg-secondary"></div>}
              {room.count && <span className="ml-auto bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full">{room.count}</span>}
            </button>
          ))}
          <div className="pt-8 px-3">
            <h2 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Your Groups</h2>
            {groups.map((group) => (
              <button key={group.name} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-on-surface-variant hover:bg-surface-high transition-all">
                <div className="w-8 h-8 rounded-lg bg-surface-highest flex items-center justify-center font-bold text-xs">{group.initial}</div>
                <span className="font-medium text-sm">{group.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 bg-surface-high/50 m-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src="https://i.pravatar.cc/150?u=me" alt="Me" className="w-10 h-10 rounded-full" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-secondary border-2 border-surface-high rounded-full"></div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">KriptoPilot</p>
              <p className="text-[10px] text-on-surface-variant">Active Trading</p>
            </div>
            <button className="ml-auto text-on-surface-variant hover:text-white">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <section className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 bg-surface-high/10 border-b border-outline/5">
          <div className="flex items-center gap-4">
            <Globe className="text-primary" size={20} />
            <div>
              <h1 className="text-sm font-bold text-white">Global Stream</h1>
              <p className="text-[10px] text-secondary font-medium">1,204 members online</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-on-surface-variant">
            <button className="hover:text-white transition-colors"><Bell size={18} /></button>
            <button className="hover:text-white transition-colors"><Star size={18} /></button>
            <button className="hover:text-white transition-colors"><MoreVertical size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          {MESSAGES.map((msg) => (
            <div key={msg.id} className="flex items-start gap-4">
              <img src={msg.user.avatar} alt={msg.user.name} className="w-10 h-10 rounded-xl" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-bold", msg.user.color === 'primary' ? 'text-primary' : msg.user.color === 'tertiary' ? 'text-tertiary' : 'text-secondary')}>
                    {msg.user.name}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-medium">{msg.timestamp}</span>
                </div>
                <p className="text-sm leading-relaxed text-on-surface/90">{msg.content}</p>
                {msg.type === 'code' && (
                  <div className="mt-3 bg-surface-highest p-4 rounded-xl font-mono text-xs text-secondary-dim border-l-2 border-secondary overflow-x-auto">
                    <code>{msg.code}</code>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 py-2 opacity-50">
            <div className="flex-1 h-px bg-outline/30"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Market Alert: $SOL hit all-time high</span>
            <div className="flex-1 h-px bg-outline/30"></div>
          </div>
        </div>

        <footer className="p-6">
          <div className="relative bg-surface-highest rounded-2xl p-3 flex flex-col gap-3 shadow-2xl">
            <textarea 
              className="bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-variant/50 resize-none h-12 w-full no-scrollbar" 
              placeholder="Message Global Stream... (Use $ for coins)"
            ></textarea>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-variant">
                  <PlusCircle size={18} />
                </button>
                <div className="w-px h-4 bg-outline/30 mx-1"></div>
                <button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-variant">
                  <Smile size={18} />
                </button>
                <button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-variant">
                  <ImageIcon size={18} />
                </button>
                <button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-variant">
                  <Paperclip size={18} />
                </button>
                <button className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-variant">
                  <Code size={18} />
                </button>
              </div>
              <button className="bg-gradient-to-br from-primary to-primary-dim text-background px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-[0_0_20px_rgba(141,172,255,0.4)] transition-all">
                Send <Send size={14} />
              </button>
            </div>
          </div>
        </footer>
      </section>

      {/* Right Sidebar */}
      <aside className="w-80 bg-surface-high/30 flex flex-col border-l border-outline/5">
        <div className="p-6">
          <h2 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">Market Highlights</h2>
          <div className="space-y-4">
            <div className="bg-surface-high p-4 rounded-2xl relative overflow-hidden group border border-outline/5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-white">Top Gainer (1h)</span>
                <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">+12.4%</span>
              </div>
              <p className="text-sm font-bold font-headline mb-2 text-white">$AVAX</p>
              <div className="w-full h-1 bg-surface-highest rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-secondary"></div>
              </div>
            </div>
            <div className="bg-surface-high p-4 rounded-2xl border border-outline/5">
              <p className="text-[10px] text-on-surface-variant font-bold uppercase mb-2">Trending Keywords</p>
              <div className="flex flex-wrap gap-2">
                {['#Halving', '#L2Summer', '#SolanaSzn', '#EIP4844'].map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-1 bg-surface-highest rounded-lg text-primary font-medium">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-6 pt-0 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Active Users (42)</h2>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-2">
            {activeUsers.map((user) => (
              <div key={user.name} className="flex items-center gap-3 group cursor-pointer">
                <div className="relative">
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-lg" />
                  {user.online && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-secondary border-2 border-surface rounded-full"></div>}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">{user.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{user.role}</p>
                </div>
                <MessageSquare size={14} className="text-on-surface-variant" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
