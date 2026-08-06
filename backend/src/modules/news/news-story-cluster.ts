import { createHash } from 'node:crypto';

const entities = new Set(['bitcoin','btc','ethereum','eth','xrp','ripple','solana','sol','dogecoin','doge','bnb','binance','coinbase','etf','defi','web3','nft','sec','cftc','tether','usdt','usdc','stablecoin','airdrop']);

export function storyClusterKey(title: string) {
  const tokens = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').match(/[a-z0-9]+/g) ?? [];
  const anchors = [...new Set(tokens.filter((token) => entities.has(token) || /^\d+(?:\.\d+)?$/.test(token)))].sort();
  if (anchors.length < 2) return null;
  return createHash('sha256').update(anchors.join('|')).digest('hex').slice(0,40);
}
