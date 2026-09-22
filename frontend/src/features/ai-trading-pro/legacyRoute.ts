const legacyTabs: Record<string, string> = {
  bots: 'my-bots',
  guide: 'bot-guide',
  'bots/guide': 'bot-guide',
  manual: 'manual-trade',
  exchanges: 'exchange-accounts',
  accounts: 'exchange-accounts',
  orders: 'orders',
  positions: 'positions',
  grid: 'grid-bot',
  'profit-loss': 'pnl',
  risk: 'risk',
  system: 'system',
};

export function legacyTradingTarget(pathname: string) {
  const legacyPath = pathname.replace(/^\/admin\/trading\/?/, '');
  return `/admin/trading/ai-pro?tab=${legacyTabs[legacyPath] ?? 'ai-trading'}`;
}
