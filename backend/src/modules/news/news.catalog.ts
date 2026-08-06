import { NewsIntegrationType, type Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';

const termsCheckedAt = new Date('2026-08-06T00:00:00.000Z');

const catalog: Prisma.NewsSourceCreateInput[] = [
  {
    name: 'CoinTürk', slug: 'coin-turk', websiteUrl: 'https://coin-turk.com/', feedUrl: 'https://coin-turk.com/feed', integrationType: NewsIntegrationType.RSS,
    language: 'tr', category: 'kripto', isActive: true, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: true, attributionRequired: true,
    termsUrl: 'https://coin-turk.com/', lastTermsCheckedAt: termsCheckedAt, fetchIntervalMinutes: 10, priority: 1,
  },
  {
    name: 'BTCHaber', slug: 'btc-haber', websiteUrl: 'https://www.btchaber.com/', feedUrl: 'https://www.btchaber.com/feed/', integrationType: NewsIntegrationType.RSS,
    language: 'tr', category: 'kripto', isActive: true, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: true, attributionRequired: true,
    termsUrl: 'https://www.btchaber.com/', lastTermsCheckedAt: termsCheckedAt, fetchIntervalMinutes: 10, priority: 2,
  },
  {
    name: 'Kripto Para Haber', slug: 'kripto-para-haber', websiteUrl: 'https://kriptoparahaber.com/', feedUrl: 'https://kriptoparahaber.com/feed/', integrationType: NewsIntegrationType.RSS,
    language: 'tr', category: 'kripto', isActive: true, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: true, attributionRequired: true,
    termsUrl: 'https://kriptoparahaber.com/', lastTermsCheckedAt: termsCheckedAt, fetchIntervalMinutes: 10, priority: 3,
  },
  {
    name: 'CoinDesk', slug: 'coindesk', websiteUrl: 'https://www.coindesk.com/', feedUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/', integrationType: NewsIntegrationType.RSS,
    language: 'en', category: 'global', isActive: true, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: true, attributionRequired: true,
    termsUrl: 'https://www.coindesk.com/coindesk-news/2021/09/17/coindesk-rss', lastTermsCheckedAt: termsCheckedAt, fetchIntervalMinutes: 10, priority: 4,
  },
  {
    name: 'Ethereum Foundation Blog', slug: 'ethereum-foundation', websiteUrl: 'https://blog.ethereum.org/', feedUrl: 'https://blog.ethereum.org/en/feed.xml', integrationType: NewsIntegrationType.RSS,
    language: 'en', category: 'ethereum', isActive: false, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: false, attributionRequired: true,
    termsUrl: 'https://ethereum.org/terms-of-use/', lastTermsCheckedAt: termsCheckedAt, fetchIntervalMinutes: 30, priority: 10,
  },
  {
    name: 'U.S. CFTC', slug: 'cftc', websiteUrl: 'https://www.cftc.gov/', feedUrl: 'https://www.cftc.gov/RSS/RSSGP/rssgp.xml', integrationType: NewsIntegrationType.RSS,
    language: 'en', category: 'regulasyon', isActive: true, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: false, attributionRequired: true,
    termsUrl: 'https://www.cftc.gov/WebPolicy/index.htm', lastTermsCheckedAt: termsCheckedAt, fetchIntervalMinutes: 60, priority: 20,
    apiConfig: { includeKeywords: ['crypto', 'cryptocurrency', 'digital asset', 'bitcoin', 'ethereum', 'blockchain', 'token', 'stablecoin', 'virtual currency', 'decentralized finance'] },
  },
  {
    name: 'U.S. SEC', slug: 'sec', websiteUrl: 'https://www.sec.gov/', feedUrl: 'https://www.sec.gov/news/pressreleases.rss', integrationType: NewsIntegrationType.RSS,
    language: 'en', category: 'regulasyon', isActive: true, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: false, attributionRequired: true,
    termsUrl: 'https://www.sec.gov/about/rss-feeds', lastTermsCheckedAt: termsCheckedAt, fetchIntervalMinutes: 60, priority: 30,
    apiConfig: { includeKeywords: ['crypto', 'cryptocurrency', 'digital asset', 'bitcoin', 'ethereum', 'blockchain', 'token', 'stablecoin', 'virtual currency', 'decentralized finance'] },
  },
  {
    name: 'CryptoPanic', slug: 'cryptopanic', websiteUrl: 'https://cryptopanic.com/', integrationType: NewsIntegrationType.API,
    language: 'en', category: 'kripto', isActive: false, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: false, attributionRequired: true,
    termsUrl: 'https://cryptopanic.com/developers/api/', lastTermsCheckedAt: termsCheckedAt, fetchIntervalMinutes: 15, priority: 40,
    apiConfig: { requiresApiToken: true, publicMode: true },
  },
];

export async function ensureDefaultNewsCatalog() {
  for (const source of catalog) {
    const catalogMetadata = Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'isActive' && key !== 'autoPublish'));
    await prisma.newsSource.upsert({
      where: { slug: source.slug },
      create: source,
      // Preserve the administrator's active/auto-publish choices on restarts.
      update: catalogMetadata as Prisma.NewsSourceUpdateInput,
    });
  }
}
