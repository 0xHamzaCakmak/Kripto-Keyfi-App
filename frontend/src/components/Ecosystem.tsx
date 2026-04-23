import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ChevronRight,
  Rocket,
  ArrowRight,
  ChevronLeft
} from 'lucide-react';
import { PROJECTS } from '../constants';
import { cn } from '../lib/utils';

export default function Ecosystem() {
  const categories = [
    { name: 'DeFi', count: 24 },
    { name: 'NFT Marketplace', count: 12 },
    { name: 'Tools & Infrastructure', count: 8 },
    { name: 'Web3 Social', count: 15 },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-12">
      <aside className="w-full md:w-72 shrink-0">
        <div className="sticky top-32 space-y-10">
          <section>
            <h3 className="font-headline font-extrabold text-white text-xl mb-6 tracking-tight">Categories</h3>
            <div className="flex flex-col gap-2">
              <button className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 text-primary group transition-all">
                <span className="font-medium">All Ecosystems</span>
                <ChevronRight size={16} />
              </button>
              {categories.map((cat) => (
                <button key={cat.name} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-all">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-xs bg-surface-highest px-2 py-0.5 rounded-md font-bold">{cat.count}</span>
                </button>
              ))}
              <Link
                to="/ecosystem/launchpad"
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-high text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-all border border-outline/10"
              >
                <span className="font-medium flex items-center gap-2">
                  <Rocket size={16} className="text-primary" />
                  Token Launchpad
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">New</span>
              </Link>
            </div>
          </section>

          <section>
            <h3 className="font-headline font-extrabold text-white text-xl mb-6 tracking-tight">Status</h3>
            <div className="space-y-4 px-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="w-5 h-5 rounded border border-outline flex items-center justify-center group-hover:border-primary transition-colors">
                  <div className="w-2.5 h-2.5 bg-primary rounded-sm"></div>
                </div>
                <span className="text-sm font-medium text-on-surface-variant">Active Projects</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="w-5 h-5 rounded border border-outline flex items-center justify-center group-hover:border-primary transition-colors"></div>
                <span className="text-sm font-medium text-on-surface-variant">Beta Access</span>
              </label>
            </div>
          </section>

          <div className="rounded-2xl p-6 bg-surface-high relative overflow-hidden group border border-outline/5">
            <div className="relative z-10">
              <h4 className="font-headline font-bold text-white mb-2">Submit Project</h4>
              <p className="text-xs text-on-surface-variant mb-4">Want your project featured on Kripto Keyfi?</p>
              <button className="text-xs font-bold text-primary flex items-center gap-1 hover:gap-2 transition-all">
                LEARN MORE <ArrowRight size={14} />
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Rocket size={80} />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="mb-12">
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-white mb-4">Explore Ecosystem</h1>
          <div className="flex items-center gap-4 text-on-surface-variant text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              1,248 Active Projects
            </span>
            <span className="w-1 h-1 rounded-full bg-outline"></span>
            <span>Updated 2 hours ago</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {PROJECTS.map((project) => (
            <motion.div
              key={project.id}
              whileHover={{ y: -4 }}
              className="group relative bg-surface p-8 rounded-3xl border border-outline/5 overflow-hidden transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="flex justify-between items-start mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-surface-high flex items-center justify-center overflow-hidden border border-outline/10">
                    <img src={project.icon} alt={project.name} className="w-10 h-10 object-cover" />
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest border",
                    project.status === 'ACTIVE' ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-primary/10 text-primary border-primary/20"
                  )}>
                    {project.status}
                  </span>
                </div>
                <h3 className="font-headline text-xl font-bold text-white mb-3">{project.name}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-8 line-clamp-2">{project.description}</p>
                <div className="flex items-center justify-between pt-6 border-t border-outline/5">
                  <div className="flex -space-x-2">
                    {project.chains.map((chain) => (
                      <div key={chain} className="w-6 h-6 rounded-full bg-surface-highest border-2 border-surface flex items-center justify-center text-[8px] font-bold text-white">
                        {chain}
                      </div>
                    ))}
                  </div>
                  <button className="group/btn flex items-center gap-2 text-primary font-bold text-sm tracking-tight transition-all">
                    View Details
                    <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 flex items-center justify-center gap-2">
          <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-high text-on-surface-variant hover:text-white transition-all">
            <ChevronLeft size={16} />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-background font-bold text-sm">1</button>
          <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-high text-on-surface-variant hover:text-white transition-all font-medium text-sm">2</button>
          <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-high text-on-surface-variant hover:text-white transition-all font-medium text-sm">3</button>
          <span className="text-outline px-2">...</span>
          <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-high text-on-surface-variant hover:text-white transition-all font-medium text-sm">12</button>
          <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-high text-on-surface-variant hover:text-white transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
