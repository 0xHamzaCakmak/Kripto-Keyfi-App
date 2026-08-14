export type KOLCountry = { name: string; code: string; region: string };

// Launch order is a product-research priority, not a ranking of people or countries.
export const KOL_COUNTRIES: KOLCountry[] = [
  { name: 'Türkiye', code: 'TR', region: 'Öncelikli pazar' },
  { name: 'Hindistan', code: 'IN', region: 'Asya' },
  { name: 'ABD', code: 'US', region: 'Kuzey Amerika' },
  { name: 'Pakistan', code: 'PK', region: 'Asya' },
  { name: 'Vietnam', code: 'VN', region: 'Güneydoğu Asya' },
  { name: 'Brezilya', code: 'BR', region: 'Latin Amerika' },
  { name: 'Nijerya', code: 'NG', region: 'Afrika' },
  { name: 'Endonezya', code: 'ID', region: 'Güneydoğu Asya' },
  { name: 'Filipinler', code: 'PH', region: 'Güneydoğu Asya' },
  { name: 'Rusya', code: 'RU', region: 'Avrasya' },
  { name: 'Meksika', code: 'MX', region: 'Latin Amerika' },
  { name: 'Birleşik Krallık', code: 'GB', region: 'Avrupa' },
  { name: 'Etiyopya', code: 'ET', region: 'Afrika' },
  { name: 'Bangladeş', code: 'BD', region: 'Asya' },
  { name: 'Güney Kore', code: 'KR', region: 'Asya' },
  { name: 'Yemen', code: 'YE', region: 'Orta Doğu' },
  { name: 'Japonya', code: 'JP', region: 'Asya' },
  { name: 'Arjantin', code: 'AR', region: 'Latin Amerika' },
  { name: 'Almanya', code: 'DE', region: 'Avrupa' },
  { name: 'Birleşik Arap Emirlikleri', code: 'AE', region: 'Orta Doğu' },
];

export type KOLResearchCandidate = {
  name: string;
  account: string | null;
  country: 'Türkiye';
  notes: string;
  status: 'Araştırma kuyruğunda';
};

// User-provided discovery list. These records intentionally contain no score,
// verification badge, follower count, pricing, or performance claim.
export const TURKEY_KOL_RESEARCH_CANDIDATES: KOLResearchCandidate[] = [
  { name: 'Selcoin', account: '@Selcoin', country: 'Türkiye', notes: "En eski hesaplardan; kullanıcının notuna göre 2010'dan beri aktif.", status: 'Araştırma kuyruğunda' },
  { name: 'Kemal Hiçyılmaz', account: 'Crypto Kemal', country: 'Türkiye', notes: 'NFT ve genel piyasa analizleri.', status: 'Araştırma kuyruğunda' },
  { name: 'Enes Turan', account: 'Paradator', country: 'Türkiye', notes: 'Altcoin sepeti stratejisi ve canlı yayınlar.', status: 'Araştırma kuyruğunda' },
  { name: 'Kripto Emre', account: '@kriptoemre', country: 'Türkiye', notes: 'Sektörün eski isimlerinden; mining içerikleri.', status: 'Araştırma kuyruğunda' },
  { name: 'Efe Bulduk', account: 'TheBullduck', country: 'Türkiye', notes: 'Genç kuşak; TV programlarında da yer alıyor.', status: 'Araştırma kuyruğunda' },
  { name: 'KriptoLevent', account: null, country: 'Türkiye', notes: 'Piyasa yorumları ve canlı yayınlar.', status: 'Araştırma kuyruğunda' },
  { name: 'Elit Türk', account: 'Turkelit', country: 'Türkiye', notes: 'Altın/döviz kökenli; kripto içeriklerine geçiş.', status: 'Araştırma kuyruğunda' },
  { name: 'Uray', account: 'Vuca Borsa', country: 'Türkiye', notes: 'Teknik analiz eğitimleri.', status: 'Araştırma kuyruğunda' },
  { name: 'Kıvanç Özbilgiç', account: null, country: 'Türkiye', notes: 'Algoritmik trade odaklı.', status: 'Araştırma kuyruğunda' },
  { name: 'Kerim Kalender', account: 'Eagles Union', country: 'Türkiye', notes: 'Global piyasa haberleri.', status: 'Araştırma kuyruğunda' },
  { name: 'Üstad Splinter', account: 'KoinSaati kurucusu', country: 'Türkiye', notes: 'Blockchain ekosistemi ve danışmanlık.', status: 'Araştırma kuyruğunda' },
  { name: 'Kripto Teknik', account: 'Ekip hesabı', country: 'Türkiye', notes: 'Teknik analiz, destek ve direnç seviyeleri.', status: 'Araştırma kuyruğunda' },
  { name: 'Kripto Messi', account: null, country: 'Türkiye', notes: 'Altcoin al-sat ve “gem” araştırmaları.', status: 'Araştırma kuyruğunda' },
  { name: 'Stevedabitcoin', account: null, country: 'Türkiye', notes: 'Genel piyasa takibi.', status: 'Araştırma kuyruğunda' },
];

