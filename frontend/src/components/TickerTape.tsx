import React, { useEffect, useState } from 'react';
import { ASSETS } from '../constants';
import { cn } from '../lib/utils';
import { Asset } from '../types';

const TICKER_ASSETS: Asset[] = [
  ASSETS.find((asset) => asset.id === 'btc') ?? {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  ASSETS.find((asset) => asset.id === 'eth') ?? {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'bnb',
    name: 'BNB',
    symbol: 'BNB',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'xrp',
    name: 'XRP',
    symbol: 'XRP',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  ASSETS.find((asset) => asset.id === 'sol') ?? {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'tron',
    name: 'TRON',
    symbol: 'TRON',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'doge',
    name: 'Dogecoin',
    symbol: 'DOGE',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'ada',
    name: 'Cardano',
    symbol: 'ADA',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'ton',
    name: 'Toncoin',
    symbol: 'TON',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'avax',
    name: 'Avalanche',
    symbol: 'AVAX',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'xaut',
    name: 'Tether Gold',
    symbol: 'XAUT',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
  {
    id: 'arb',
    name: 'Arbitrum',
    symbol: 'ARB',
    price: 0,
    change24h: 0,
    balance: 0,
    value: 0,
    icon: '',
  },
];

const COINGECKO_IDS_BY_ASSET_ID: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  bnb: 'binancecoin',
  xrp: 'ripple',
  sol: 'solana',
  tron: 'tron',
  doge: 'dogecoin',
  ada: 'cardano',
  ton: 'the-open-network',
  avax: 'avalanche-2',
  xaut: 'tether-gold',
  arb: 'arbitrum',
};

type CoinGeckoPriceResponse = Record<string, {
  usd?: number;
  usd_24h_change?: number;
}>;

function formatPrice(price: number) {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: price >= 1000 ? 0 : 2,
    maximumFractionDigits: price >= 1000 ? 0 : 2,
  });
}

function formatChange(change: number) {
  const formatted = change.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${change >= 0 ? '+' : ''}${formatted}%`;
}

export default function TickerTape() {
  const [assets, setAssets] = useState<Asset[]>(TICKER_ASSETS);

  useEffect(() => {
    let isMounted = true;

    async function fetchLivePrices() {
      const ids = Object.values(COINGECKO_IDS_BY_ASSET_ID).join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      );

      if (!response.ok) {
        throw new Error(`CoinGecko price request failed: ${response.status}`);
      }

      const livePrices = await response.json() as CoinGeckoPriceResponse;

      if (!isMounted) {
        return;
      }

      setAssets((currentAssets) => currentAssets.map((asset) => {
        const coinGeckoId = COINGECKO_IDS_BY_ASSET_ID[asset.id];
        const livePrice = coinGeckoId ? livePrices[coinGeckoId] : undefined;

        if (!livePrice?.usd) {
          return asset;
        }

        return {
          ...asset,
          price: livePrice.usd,
          change24h: livePrice.usd_24h_change ?? asset.change24h,
        };
      }));
    }

    fetchLivePrices().catch((error) => {
      console.error(error);
    });

    const intervalId = window.setInterval(() => {
      fetchLivePrices().catch((error) => {
        console.error(error);
      });
    }, 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <footer className="fixed bottom-0 w-full bg-surface-container-lowest py-2 px-8 z-50 border-t border-outline/10 overflow-hidden">
      <div className="flex items-center gap-12 animate-marquee">
        {[...assets, ...assets].map((asset, index) => (
          <div key={`${asset.id}-${index}`} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">{asset.symbol}/USD</span>
            <span className="text-white font-bold text-xs">${formatPrice(asset.price)}</span>
            <span className={cn(
              "text-[10px] font-bold",
              asset.change24h >= 0 ? "text-secondary" : "text-error"
            )}>
              {formatChange(asset.change24h)}
            </span>
          </div>
        ))}
      </div>
    </footer>
  );
}
