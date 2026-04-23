import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, CheckCircle, MessageSquare, Edit } from 'lucide-react';
import { ARTICLES } from '../constants';

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const article = ARTICLES.find(a => a.id === id) || ARTICLES[0];

  return (
    <div className="max-w-3xl mx-auto pb-32">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-primary font-bold mb-8 hover:opacity-80 transition-opacity"
      >
        <ArrowLeft size={18} />
        Back to Insights
      </button>

      {/* Hero Image */}
      <div className="relative w-full aspect-video rounded-[32px] overflow-hidden mb-10">
        <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
      </div>

      {/* Meta */}
      <div className="inline-flex items-center px-3 py-1 bg-secondary/10 text-secondary text-xs font-bold uppercase tracking-widest rounded-md mb-6">
        {article.category}
      </div>
      <h1 className="font-headline text-4xl font-extrabold text-white leading-tight tracking-tight mb-8">
        {article.title}
      </h1>

      {/* Author Card */}
      <div className="flex items-center justify-between mb-12 p-6 bg-surface-high rounded-2xl border border-outline/5">
        <div className="flex items-center gap-4">
          <img src={article.author.avatar} alt={article.author.name} className="w-12 h-12 rounded-full border-2 border-primary/20" />
          <div>
            <p className="text-white font-bold text-base">{article.author.name}</p>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-wider font-bold">{article.author.role}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-on-surface-variant text-[10px] uppercase tracking-wider font-bold">Published</p>
          <p className="text-white font-medium text-sm">{article.date}</p>
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-invert max-w-none space-y-6 text-on-surface-variant leading-relaxed text-lg">
        <p className="first-letter:text-5xl first-letter:font-headline first-letter:font-black first-letter:text-primary first-letter:mr-3 first-letter:float-left">
          {article.excerpt}
        </p>
        <p>
          As the decentralized finance ecosystem continues to mature, we are witnessing a fundamental shift in how capital flows through secondary markets. The traditional barriers between institutional vaults and retail liquidity pools are dissolving into a unified, high-frequency environment.
        </p>
        <div className="bg-surface-high p-8 rounded-2xl border-l-4 border-primary my-10">
          <p className="text-white font-headline font-bold italic text-xl leading-snug">
            "Financial fluidity is not just about the speed of transactions, but the permanence of the architecture that supports them."
          </p>
        </div>
        <p>
          The recent uptick in trading volume across layer-2 solutions suggests that the "Digital Vault" philosophy is being adopted by a broader demographic. Security is no longer a luxury; it is the prerequisite for participation.
        </p>
        <h3 className="font-headline text-2xl font-bold text-white pt-6">Key Performance Indicators</h3>
        <ul className="space-y-4">
          <li className="flex items-start gap-3">
            <CheckCircle className="text-secondary mt-1" size={18} />
            <span>Institutional TVL (Total Value Locked) has seen a 14% month-over-month increase.</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="text-secondary mt-1" size={18} />
            <span>Gas fee optimization on Ethereum mainnet reached a 6-month efficiency peak.</span>
          </li>
        </ul>
      </div>

      {/* Action Bar */}
      <div className="mt-16 flex flex-col gap-6">
        <button className="w-full hero-gradient text-background font-bold py-4 rounded-full flex items-center justify-center gap-2 shadow-[0px_20px_40px_rgba(0,0,0,0.4)] hover:opacity-90 transition-opacity">
          <Share2 size={18} />
          SHARE THIS INSIGHT
        </button>
      </div>

      {/* Article Chat */}
      <section className="mt-20 bg-surface-high/30 rounded-[32px] p-8 border border-outline/5">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <MessageSquare className="text-primary" size={24} />
            <h4 className="font-headline font-bold text-xl text-white uppercase tracking-tight">Article Chat</h4>
          </div>
          <span className="bg-primary/20 px-3 py-1 rounded-full text-xs font-bold text-primary">12 Active</span>
        </div>
        
        <div className="space-y-4">
          <div className="bg-surface-high p-6 rounded-2xl">
            <div className="flex gap-3 items-center mb-3">
              <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-xs font-bold text-white">JD</div>
              <span className="text-sm font-bold text-white">JamesDillon.eth</span>
              <span className="text-[10px] text-on-surface-variant font-medium ml-auto">2m ago</span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">The point about Layer-2 liquidity is spot on. Arbitrum is eating the volume lately.</p>
          </div>
        </div>

        <button className="w-full mt-8 bg-surface-highest p-4 rounded-xl flex items-center gap-3 text-on-surface-variant hover:text-white transition-colors">
          <Edit size={18} />
          <span className="text-sm font-medium">Join the discussion...</span>
        </button>
      </section>
    </div>
  );
}
