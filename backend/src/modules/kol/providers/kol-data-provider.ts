import { env } from '../../../config/env.js';

export type KOLProviderKey = 'okx-onchainos' | 'sorsa' | 'growing3' | 'bitmart-x-insight';
export type KOLProviderMode = 'server_api' | 'editor_assisted' | 'research_only';

export interface KOLProviderDescriptor {
  key: KOLProviderKey;
  name: string;
  mode: KOLProviderMode;
  configured: boolean;
  capabilities: string[];
  purpose: string;
  officialUrl: string;
  limitation: string;
}

export function getKOLDataSources(): KOLProviderDescriptor[] {
  const okxConfigured = Boolean(env.OKX_ONCHAIN_API_KEY && env.OKX_ONCHAIN_SECRET_KEY && env.OKX_ONCHAIN_PASSPHRASE);
  return [
    {
      key: 'okx-onchainos',
      name: 'OKX OnchainOS',
      mode: 'server_api',
      configured: okxConfigured,
      capabilities: ['Token bazlı KOL keşfi', 'Takipçi', 'Etkileşim', 'Bahsedilme', 'Gösterim', 'İlk paylaşım bağlantısı'],
      purpose: 'Belirli zincir ve token için en etkili KOL adaylarını keşfetmek.',
      officialUrl: 'https://web3.okx.com/tr/onchainos/dev-docs/market/market-social-vibe-top-kols',
      limitation: 'Token adresi gerektirir; genel ülke kataloğunun tek başına kaynağı değildir.',
    },
    {
      key: 'sorsa',
      name: 'Sorsa API',
      mode: 'server_api',
      configured: Boolean(env.SORSA_API_KEY),
      capabilities: ['X profil bilgisi', 'Tweet arama', 'Etkileşim', 'Takipçi analizi', 'Sorsa Score'],
      purpose: 'Aday KOL profillerini ve herkese açık X etkileşim sinyallerini zenginleştirmek.',
      officialUrl: 'https://docs.sorsa.io/api-reference-guide',
      limitation: 'Üçüncü taraf skorları KriptoKeyfi puanına doğrudan kopyalanmaz; yalnızca kaynak sinyali olur.',
    },
    {
      key: 'growing3',
      name: 'Growing3',
      mode: 'editor_assisted',
      configured: false,
      capabilities: ['Profil özeti', 'Kitle büyüklüğü', 'Etkileşim oranı', 'Anahtar kelimeler'],
      purpose: 'Editörün X profilini incelerken aday doğrulamasını hızlandırmak.',
      officialUrl: 'https://growing3.ai/product/influencer_insight_browser_extension',
      limitation: 'Doğrulanmış genel sunucu API dokümanı bulunmadığından otomatik crawler olarak kullanılmaz.',
    },
    {
      key: 'bitmart-x-insight',
      name: 'BitMart X Insight',
      mode: 'research_only',
      configured: false,
      capabilities: ['KOL görüş takibi', 'Sosyal duygu', 'Piyasa reaksiyonu', 'Tweet analizi'],
      purpose: 'Duygu ve fikir birliği sonuçlarını ürün araştırmasında karşılaştırmak.',
      officialUrl: 'https://www.bitmart.com/en-US/ai/xinsight/landing',
      limitation: 'Belgelenmiş genel veri API erişimi teyit edilmeden üretim ingestion kaynağı sayılmaz.',
    },
  ];
}
