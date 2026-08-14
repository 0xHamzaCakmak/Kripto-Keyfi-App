type CampaignEvent = { eventType: string; value?: number | null };

export function calculateCampaignAnalytics(spend: number, events: CampaignEvent[]) {
  const count = (type: string) => events.filter((event) => event.eventType === type).length;
  const impressions = count('IMPRESSION');
  const clicks = count('CLICK');
  const registrations = count('REGISTRATION');
  const kyc = count('KYC');
  const deposits = count('DEPOSIT');
  const revenue = events.reduce((sum, event) => sum + (['DEPOSIT', 'PURCHASE', 'SUBSCRIPTION'].includes(event.eventType) ? Number(event.value || 0) : 0), 0);
  const safeDivide = (value: number, divisor: number) => divisor > 0 ? value / divisor : null;
  return {
    spend, impressions, clicks, registrations, kyc, deposits, revenue,
    cpm: safeDivide(spend * 1000, impressions),
    cpc: safeDivide(spend, clicks),
    costPerRegistration: safeDivide(spend, registrations),
    costPerKyc: safeDivide(spend, kyc),
    costPerDeposit: safeDivide(spend, deposits),
    conversionRate: clicks ? (deposits / clicks) * 100 : null,
    roi: spend ? ((revenue - spend) / spend) * 100 : null,
    roas: spend ? revenue / spend : null,
  };
}

