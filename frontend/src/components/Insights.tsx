import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Eye, ChevronRight } from 'lucide-react';
import { ARTICLES } from '../constants';
import { cn } from '../lib/utils';

export default function Insights() {
  const categories = ['All', 'Analysis', 'Education', 'News', 'Security'];

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Search & Filter */}
      <section className="space-y-6">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="text-outline" size={20} />
          </div>
          <input
            className="w-full bg-surface-high border-none rounded-full py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60 text-on-surface"
            placeholder="Search insights..."
            type="text"
          />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat, index) => (
            <button
              key={cat}
              className={cn(
                "px-6 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all",
                index === 0 ? "bg-secondary text-background" : "bg-surface-high text-on-surface-variant hover:bg-surface-highest hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Featured Article */}
      <Link to={`/insights/${ARTICLES[0].id}`} className="block">
        <article className="relative group cursor-pointer overflow-hidden rounded-[32px] border border-outline/5">
          <div className="aspect-[16/9] w-full relative">
            <img
              className="absolute inset-0 w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
              src={ARTICLES[0].image}
              alt={ARTICLES[0].title}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
            <div className="absolute bottom-0 p-8 space-y-4">
              <div className="flex gap-2">
                <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest">#{ARTICLES[0].category}</span>
                <span className="bg-surface-high/40 backdrop-blur-md text-white px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest">{ARTICLES[0].readTime}</span>
              </div>
              <h2 className="font-headline text-3xl font-extrabold leading-tight tracking-tight text-white">{ARTICLES[0].title}</h2>
              <p className="text-on-surface-variant text-base line-clamp-2 opacity-90">{ARTICLES[0].excerpt}</p>
            </div>
          </div>
        </article>
      </Link>

      {/* List Section */}
      <section className="space-y-8">
        <div className="flex justify-between items-end">
          <h3 className="font-headline text-xl font-bold text-primary">Latest Perspectives</h3>
          <span className="text-[10px] text-outline font-bold uppercase tracking-widest">Scroll for more</span>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {ARTICLES.map((article) => (
            <Link key={article.id} to={`/insights/${article.id}`}>
              <motion.article
                whileHover={{ x: 4 }}
                className="flex gap-6 p-4 rounded-[24px] bg-surface-high/30 hover:bg-surface-high transition-colors group cursor-pointer border border-outline/5"
              >
                <div className="w-32 h-32 shrink-0 rounded-2xl overflow-hidden">
                  <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src={article.image} alt={article.title} />
                </div>
                <div className="flex flex-col justify-between py-1 flex-1">
                  <div className="space-y-2">
                    <span className="text-secondary font-bold text-[10px] uppercase tracking-widest">{article.category} • {article.date}</span>
                    <h4 className="font-headline text-xl font-bold leading-snug group-hover:text-primary transition-colors text-white">{article.title}</h4>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Eye size={14} />
                      <span className="text-[10px] font-bold tracking-tight">{article.views} reads</span>
                    </div>
                    <ChevronRight size={18} className="text-outline group-hover:text-white transition-colors" />
                  </div>
                </div>
              </motion.article>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
