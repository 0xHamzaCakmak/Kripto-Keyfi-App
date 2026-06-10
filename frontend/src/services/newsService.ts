import { NewsArticle } from '../types';

export const NEWS_CATEGORIES = [
  'Tümü',
  'Bitcoin',
  'Ethereum',
  'Altcoin',
  'DeFi',
  'Web3',
  'Borsa Haberleri',
  'Regülasyon',
  'Güvenlik',
  'Analiz',
  'Eğitim',
  'NFT',
  'Yapay Zeka'
];

export const NEWS_TAGS = [
  'Bitcoin',
  'Ethereum',
  'ETF',
  'DeFi',
  'Layer-2',
  'Binance',
  'Coinbase',
  'SEC',
  'Hack',
  'Rug Pull',
  'Airdrop',
  'Solana',
  'XRP',
  'Tokenomics',
  'Web3',
  'AI'
];

export const MOCK_NEWS: NewsArticle[] = [
  {
    id: 'n1',
    slug: 'bitcoin-etf-girisleri-piyasada-yeni-beklenti-olusturdu',
    title: 'Bitcoin ETF Girişleri Piyasada Yeni Beklenti Oluşturdu',
    excerpt: 'Spot Bitcoin ETF ürünlerine gelen yeni girişler, piyasa katılımcılarının risk iştahında toparlanma sinyali olarak yorumlanıyor.',
    coverImage: 'https://picsum.photos/seed/news-bitcoin-etf/1200/720',
    category: 'Bitcoin',
    tags: ['Bitcoin', 'ETF', 'SEC'],
    authorName: 'Ece Arslan',
    authorAvatar: 'https://i.pravatar.cc/150?u=news-ece',
    sourceName: 'Kripto Keyfi Haber',
    sourceUrl: 'https://kriptokeyfi.local/news/bitcoin-etf',
    publishedAt: '10 Haziran 2026, 09:20',
    updatedAt: '10 Haziran 2026, 10:05',
    readingTime: '4 dk',
    viewCount: '42.8K',
    isFeatured: true,
    isBreaking: true,
    isEditorPick: true,
    content: [
      {
        id: 'etf-girisleri',
        heading: 'ETF Girişleri Yeniden Hızlandı',
        body: 'Piyasa verilerine göre spot Bitcoin ETF ürünlerinde son işlem gününde net girişler arttı. Analistler bu hareketi kurumsal talebin yeniden güçlenmesiyle ilişkilendiriyor.'
      },
      {
        id: 'piyasa-etkisi',
        heading: 'Piyasa Etkisi',
        body: 'Bitcoin fiyatındaki yatay seyre rağmen ETF tarafındaki girişler, orta vadeli beklentilerde iyimserliğin korunduğunu gösteriyor. Kısa vadede volatilite beklentisi ise yüksek kalmaya devam ediyor.'
      },
      {
        id: 'izlenecek-seviyeler',
        heading: 'İzlenecek Seviyeler',
        body: 'Uzmanlara göre yatırımcılar hacim, fon akışı ve vadeli piyasa fonlama oranlarını birlikte izlemeli. Tek başına ETF verisi yön tayini için yeterli görülmüyor.'
      }
    ],
    comments: [
      {
        id: 'nc1',
        username: 'AlphaSeeker',
        avatar: 'https://i.pravatar.cc/150?u=news-comment-alpha',
        date: 'Bugün',
        content: 'ETF akışları fiyatlamadan önce takip edilmesi gereken en önemli veri oldu.',
        likes: 21
      }
    ]
  },
  {
    id: 'n2',
    slug: 'ethereum-layer-2-aglarinda-islem-hacmi-artiyor',
    title: 'Ethereum Layer-2 Ağlarında İşlem Hacmi Artıyor',
    excerpt: 'Ethereum ölçekleme ağlarında günlük işlem sayısı yükselirken, düşük ücretler kullanıcı aktivitesini destekliyor.',
    coverImage: 'https://picsum.photos/seed/news-ethereum-l2/1200/720',
    category: 'Ethereum',
    tags: ['Ethereum', 'Layer-2', 'Web3'],
    authorName: 'Mert Kaya',
    authorAvatar: 'https://i.pravatar.cc/150?u=news-mert',
    sourceName: 'Kripto Keyfi Research',
    sourceUrl: 'https://kriptokeyfi.local/news/ethereum-l2',
    publishedAt: '10 Haziran 2026, 08:10',
    updatedAt: '10 Haziran 2026, 08:40',
    readingTime: '5 dk',
    viewCount: '31.4K',
    isFeatured: true,
    isBreaking: true,
    isEditorPick: false,
    content: [
      { id: 'hacim', heading: 'İşlem Hacmi Yükseldi', body: 'Layer-2 ağlarında işlem sayısı ve aktif adres sayısı haftalık bazda artış gösterdi. Kullanıcılar düşük maliyetli transfer ve DeFi işlemlerine yöneliyor.' },
      { id: 'l2-rekabeti', heading: 'L2 Rekabeti', body: 'Arbitrum, Base ve Optimism ekosistemlerinde uygulama çeşitliliği artarken likidite rekabeti de hızlanıyor.' }
    ],
    comments: []
  },
  {
    id: 'n3',
    slug: 'defi-protokollerinde-guvenlik-riskleri-yeniden-gundemde',
    title: 'DeFi Protokollerinde Güvenlik Riskleri Yeniden Gündemde',
    excerpt: 'Son saldırıların ardından izin yönetimi, oracle güvenliği ve köprü riskleri yeniden tartışılıyor.',
    coverImage: 'https://picsum.photos/seed/news-defi-security/1200/720',
    category: 'Güvenlik',
    tags: ['DeFi', 'Hack', 'Rug Pull'],
    authorName: 'Selin Demir',
    authorAvatar: 'https://i.pravatar.cc/150?u=news-selin',
    sourceName: 'Security Desk',
    sourceUrl: 'https://kriptokeyfi.local/news/defi-security',
    publishedAt: '9 Haziran 2026, 21:30',
    updatedAt: '9 Haziran 2026, 22:10',
    readingTime: '6 dk',
    viewCount: '27.9K',
    isFeatured: false,
    isBreaking: true,
    isEditorPick: true,
    content: [
      { id: 'riskler', heading: 'Risk Başlıkları', body: 'DeFi protokollerinde en sık görülen açıklar arasında hatalı izin kontrolleri, oracle manipülasyonu ve köprü kontratları yer alıyor.' },
      { id: 'kullanici-onlemleri', heading: 'Kullanıcı Önlemleri', body: 'Kullanıcıların token izinlerini düzenli temizlemesi, denetlenmemiş protokollerde düşük bakiye kullanması ve sahte kampanyalara dikkat etmesi öneriliyor.' }
    ],
    comments: []
  },
  {
    id: 'n4',
    slug: 'sec-karari-sonrasi-kripto-piyasasinda-volatilite-artti',
    title: 'SEC Kararı Sonrası Kripto Piyasasında Volatilite Arttı',
    excerpt: 'Regülasyon cephesinden gelen açıklamalar, vadeli piyasalarda hızlı pozisyon değişimlerine neden oldu.',
    coverImage: 'https://picsum.photos/seed/news-sec-regulation/1200/720',
    category: 'Regülasyon',
    tags: ['SEC', 'Bitcoin', 'Ethereum'],
    authorName: 'Can Öz',
    authorAvatar: 'https://i.pravatar.cc/150?u=news-can',
    sourceName: 'Market Pulse',
    sourceUrl: 'https://kriptokeyfi.local/news/sec-volatility',
    publishedAt: '9 Haziran 2026, 18:15',
    updatedAt: '9 Haziran 2026, 19:05',
    readingTime: '4 dk',
    viewCount: '19.6K',
    isFeatured: true,
    isBreaking: false,
    isEditorPick: false,
    content: [
      { id: 'karar', heading: 'Karar ve İlk Tepki', body: 'SEC tarafından yapılan açıklama sonrası piyasa ilk dakikalarda sert dalgalandı. Likidasyon verileri kısa vadeli kaldıraç kullanımının yüksek olduğunu gösterdi.' },
      { id: 'beklenti', heading: 'Beklentiler', body: 'Analistler düzenleyici belirsizliklerin kısa vadede fiyatlamalara etki etmeye devam edebileceğini belirtiyor.' }
    ],
    comments: []
  },
  {
    id: 'n5',
    slug: 'buyuk-borsadan-yeni-altcoin-listeleme-duyurusu',
    title: 'Büyük Borsadan Yeni Altcoin Listeleme Duyurusu',
    excerpt: 'Yeni listeleme duyurusu sonrası ilgili tokenlarda hacim artışı görülürken, yatırımcılar volatiliteye karşı uyarıldı.',
    coverImage: 'https://picsum.photos/seed/news-exchange-listing/1200/720',
    category: 'Borsa Haberleri',
    tags: ['Binance', 'Coinbase', 'Altcoin'],
    authorName: 'Deniz Sancar',
    authorAvatar: 'https://i.pravatar.cc/150?u=news-deniz',
    sourceName: 'Exchange Watch',
    sourceUrl: 'https://kriptokeyfi.local/news/altcoin-listing',
    publishedAt: '9 Haziran 2026, 14:00',
    updatedAt: '9 Haziran 2026, 14:20',
    readingTime: '3 dk',
    viewCount: '22.2K',
    isFeatured: false,
    isBreaking: true,
    isEditorPick: false,
    content: [
      { id: 'listeleme', heading: 'Listeleme Duyurusu', body: 'Borsa, yeni işlem çiftlerini kademeli olarak açacağını duyurdu. İlk saatlerde emir defteri derinliğinin sınırlı olabileceği belirtildi.' },
      { id: 'risk', heading: 'Volatilite Uyarısı', body: 'Listeleme dönemlerinde spread ve ani fiyat hareketleri artabileceği için risk yönetimi önem taşıyor.' }
    ],
    comments: []
  },
  {
    id: 'n6',
    slug: 'web3-oyun-projelerinde-yeni-fonlama-dalgasi',
    title: 'Web3 Oyun Projelerinde Yeni Fonlama Dalgası',
    excerpt: 'Altyapı, oyun içi ekonomi ve kullanıcı sahipliği odağındaki projelere yatırım ilgisi yeniden canlanıyor.',
    coverImage: 'https://picsum.photos/seed/news-web3-gaming/1200/720',
    category: 'Web3',
    tags: ['Web3', 'NFT', 'Tokenomics'],
    authorName: 'Bora Yıldız',
    authorAvatar: 'https://i.pravatar.cc/150?u=news-bora',
    sourceName: 'Web3 Radar',
    sourceUrl: 'https://kriptokeyfi.local/news/web3-gaming',
    publishedAt: '8 Haziran 2026, 11:45',
    updatedAt: '8 Haziran 2026, 12:05',
    readingTime: '5 dk',
    viewCount: '13.8K',
    isFeatured: false,
    isBreaking: false,
    isEditorPick: true,
    content: [
      { id: 'fonlama', heading: 'Fonlama İlgisi', body: 'Yeni yatırım turları özellikle oyun altyapısı, cüzdan deneyimi ve zincir üstü varlık sahipliği üzerine yoğunlaşıyor.' },
      { id: 'trend', heading: 'Yeni Trend', body: 'Projeler artık yalnızca NFT satışına değil sürdürülebilir oyun ekonomisine odaklanıyor.' }
    ],
    comments: []
  },
  {
    id: 'n7',
    slug: 'cuzdan-guvenligi-phishing-saldirilari-neden-artiyor',
    title: 'Cüzdan Güvenliği: Phishing Saldırıları Neden Artıyor?',
    excerpt: 'Airdrop sezonu, sahte bağlantılar ve imza tuzakları kullanıcı güvenliğini yeniden gündeme taşıdı.',
    coverImage: 'https://picsum.photos/seed/news-wallet-phishing/1200/720',
    category: 'Güvenlik',
    tags: ['Phishing', 'Airdrop', 'Hack'],
    authorName: 'Selin Demir',
    authorAvatar: 'https://i.pravatar.cc/150?u=news-selin',
    sourceName: 'Security Desk',
    sourceUrl: 'https://kriptokeyfi.local/news/wallet-phishing',
    publishedAt: '8 Haziran 2026, 09:10',
    updatedAt: '8 Haziran 2026, 09:55',
    readingTime: '6 dk',
    viewCount: '35.5K',
    isFeatured: false,
    isBreaking: false,
    isEditorPick: true,
    content: [
      { id: 'neden-artiyor', heading: 'Saldırılar Neden Artıyor?', body: 'Airdrop ve yeni proje kampanyaları kullanıcıları hızlı işlem yapmaya ittiği için sahte siteler daha kolay yayılıyor.' },
      { id: 'korunma', heading: 'Korunma Yolları', body: 'Alan adı kontrolü, işlem simülasyonu ve ayrı deneme cüzdanı kullanımı temel güvenlik adımları arasında yer alıyor.' }
    ],
    comments: []
  },
  {
    id: 'n8',
    slug: 'ai-tokenlari-yeni-hacim-dalgasi-yakaladi',
    title: 'AI Tokenları Yeni Hacim Dalgası Yakaladı',
    excerpt: 'Yapay zeka temalı kripto varlıklarında hacim artışı görülürken, yatırımcılar tokenomics kalitesine odaklanıyor.',
    coverImage: 'https://picsum.photos/seed/news-ai-tokens/1200/720',
    category: 'Yapay Zeka',
    tags: ['AI', 'Tokenomics', 'Altcoin'],
    authorName: 'Ece Arslan',
    authorAvatar: 'https://i.pravatar.cc/150?u=news-ece',
    sourceName: 'Kripto Keyfi Haber',
    sourceUrl: 'https://kriptokeyfi.local/news/ai-tokens',
    publishedAt: '7 Haziran 2026, 16:25',
    updatedAt: '7 Haziran 2026, 16:40',
    readingTime: '4 dk',
    viewCount: '16.1K',
    isFeatured: false,
    isBreaking: false,
    isEditorPick: false,
    content: [
      { id: 'hacim', heading: 'Hacim Artışı', body: 'AI temalı tokenlarda günlük hacimler yükseldi. Piyasa ilgisi özellikle gerçek ürün kullanımına sahip projelerde yoğunlaşıyor.' },
      { id: 'riskler', heading: 'Riskler', body: 'Uzmanlar yalnızca tema bazlı yükselişlerin sürdürülebilir olmadığını, token ekonomisi ve gelir modelinin incelenmesi gerektiğini belirtiyor.' }
    ],
    comments: []
  }
];

export function getLatestNews() {
  return MOCK_NEWS;
}

export function getFeaturedNews() {
  return MOCK_NEWS.filter((news) => news.isFeatured);
}

export function getNewsBySlug(slug: string) {
  return MOCK_NEWS.find((news) => news.slug === slug || news.id === slug || news.id === `n${slug}`);
}

export function getNewsByCategory(category: string) {
  return category === 'Tümü' ? MOCK_NEWS : MOCK_NEWS.filter((news) => news.category === category);
}

export function searchNews(query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return MOCK_NEWS;

  return MOCK_NEWS.filter((news) => [
    news.title,
    news.excerpt,
    news.category,
    news.authorName,
    news.sourceName,
    ...news.tags
  ].some((field) => field.toLowerCase().includes(term)));
}

export function getTrendingNews() {
  return [...MOCK_NEWS].sort((a, b) => Number.parseFloat(b.viewCount) - Number.parseFloat(a.viewCount)).slice(0, 5);
}
