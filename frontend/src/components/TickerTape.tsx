import React from 'react';
import { ASSETS } from '../constants';
import { cn } from '../lib/utils';

export default function TickerTape() {
  return (
    <footer className="fixed bottom-0 w-full bg-surface-container-lowest py-2 px-8 z-50 border-t border-outline/10 overflow-hidden">
      <div className="flex items-center gap-12 animate-marquee">
        {[...ASSETS, ...ASSETS].map((asset, index) => (
          <div key={`${asset.id}-${index}`} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">{asset.symbol}/USD</span>
            <span className="text-white font-bold text-xs">${asset.price.toLocaleString()}</span>
            <span className={cn(
              "text-[10px] font-bold",
              asset.change24h >= 0 ? "text-secondary" : "text-error"
            )}>
              {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
            </span>
          </div>
        ))}
      </div>
    </footer>
  );
}
