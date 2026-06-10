import { Asset, Project, Article, Message, Video, AcademyArticle, AcademySeries, GlossaryTerm } from './types';

export const ASSETS: Asset[] = [
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    price: 64281.0,
    change24h: 2.45,
    balance: 1.54,
    value: 98992.74,
    icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    price: 3421.12,
    change24h: -0.82,
    balance: 10.25,
    value: 35066.48,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
  },
  {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    price: 145.67,
    change24h: 5.12,
    balance: 60.0,
    value: 8740.2,
    icon: 'https://cryptologos.cc/logos/solana-sol-logo.png'
  }
];

export const PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Nebula DEX',
    description: 'The next generation decentralized exchange for cross-chain liquidity mining and yield farming.',
    category: 'DeFi',
    status: 'ACTIVE',
    chains: ['ETH', 'SOL'],
    icon: 'https://picsum.photos/seed/nebula/100/100'
  },
  {
    id: '2',
    name: 'Titan Protocol',
    description: 'Under-collateralized lending primitives for institutional grade capital markets on Web3.',
    category: 'DeFi',
    status: 'BETA',
    chains: ['BASE'],
    icon: 'https://picsum.photos/seed/titan/100/100'
  },
  {
    id: '3',
    name: 'Zenith NFT',
    description: 'Curated digital art marketplace focusing on generative artists and 1-of-1 masterworks.',
    category: 'NFT Marketplace',
    status: 'ACTIVE',
    chains: ['ETH', 'ARB'],
    icon: 'https://picsum.photos/seed/zenith/100/100'
  },
  {
    id: '4',
    name: 'Oracle Guard',
    description: 'Real-time security analytics and threat detection for smart contract developers.',
    category: 'Tools & Infrastructure',
    status: 'ACTIVE',
    chains: ['ALL'],
    icon: 'https://picsum.photos/seed/oracle/100/100'
  },
  {
    id: '5',
    name: 'Vaultify',
    description: 'Multi-signature hardware wallet integration with social recovery and inheritance features.',
    category: 'Tools & Infrastructure',
    status: 'ACTIVE',
    chains: ['BTC', 'ETH'],
    icon: 'https://picsum.photos/seed/vaultify/100/100'
  },
  {
    id: '6',
    name: 'EtherSync',
    description: 'Sub-second state synchronization for decentralized applications on Ethereum Layer 2s.',
    category: 'Tools & Infrastructure',
    status: 'BETA',
    chains: ['OP', 'ZK'],
    icon: 'https://picsum.photos/seed/ethersync/100/100'
  }
];

export const ARTICLES: Article[] = [
  {
    id: '1',
    title: 'The Liquidity Surge: What Q4 Means for DeFi protocols',
    excerpt: 'Deep dive into the institutional inflows reshaping decentralized finance landscapes this quarter.',
    category: 'Market',
    readTime: '5 min read',
    date: 'Oct 24, 2024',
    author: {
      name: 'Marcus Vane',
      role: 'Chief Strategist',
      avatar: 'https://i.pravatar.cc/150?u=marcus'
    },
    image: 'https://picsum.photos/seed/liquidity/800/600',
    views: '142k'
  },
  {
    id: '2',
    title: 'Bitcoin Halving: 100 Days Out',
    excerpt: 'Analyzing the historical patterns and what to expect from the upcoming halving event.',
    category: 'Analysis',
    readTime: '8 min read',
    date: 'Oct 22, 2024',
    author: {
      name: 'Sarah Chen',
      role: 'Senior Analyst',
      avatar: 'https://i.pravatar.cc/150?u=sarah'
    },
    image: 'https://picsum.photos/seed/bitcoin/800/600',
    views: '89k'
  }
];

export const MESSAGES: Message[] = [
  {
    id: '1',
    user: {
      name: 'AlphaSeeker',
      avatar: 'https://i.pravatar.cc/150?u=alpha',
      color: 'primary'
    },
    content: 'Did anyone see the whale movement on $BTC just now? Massive inflow to exchanges. Might see a temporary dip before another leg up.',
    timestamp: '10:42 AM',
    type: 'text'
  },
  {
    id: '2',
    user: {
      name: 'DevLord',
      avatar: 'https://i.pravatar.cc/150?u=dev',
      color: 'tertiary'
    },
    content: 'Updating the liquidity bot logic for the new $ETH pair:',
    timestamp: '10:45 AM',
    type: 'code',
    code: 'function calculateHedgeRatio(price, volatility) {\n  return (price * volatility) / Math.sqrt(2 * Math.PI);\n}'
  },
  {
    id: '3',
    user: {
      name: 'CryptoQueen',
      avatar: 'https://i.pravatar.cc/150?u=queen',
      color: 'secondary'
    },
    content: 'Bullish on $ETH following the mainnet upgrade. Staking yields are looking great right now.',
    timestamp: '10:48 AM',
    type: 'text'
  }
];

export const VIDEO_CATEGORIES = [
  'Tümü',
  'Haber',
  'Teknik Analiz',
  'Eğitim',
  'Web3',
  'Blockchain',
  'Smart Contract',
  'Güvenlik',
  'DeFi',
  'Airdrop',
  'Shorts'
];

export const VIDEOS: Video[] = [
  {
    id: 'eth-etf-2026',
    youtubeVideoId: 'dQw4w9WgXcQ',
    title: 'Ethereum ETF Etkisi: Kurumsal Para Web3 Piyasasını Nasıl Değiştirir?',
    description: 'Ethereum ETF gelişmeleri, kurumsal yatırımcı ilgisi ve 2026 piyasa beklentileri üzerinden DeFi ve Layer 2 ekosisteminin olası yönünü inceliyoruz. Video; risk yönetimi, likidite akışı ve yatırımcı davranışı üzerine pratik çıkarımlar içerir.',
    thumbnailUrl: 'https://picsum.photos/seed/eth-etf-video/900/520',
    duration: '18:42',
    channelName: 'Kripto Keyfi Research',
    channelSlug: 'kripto-keyfi-research',
    channelAvatar: 'https://i.pravatar.cc/150?u=kk-research',
    channelVerified: true,
    channelDescription: 'Kripto piyasaları, zincir üstü veri ve Web3 trendleri için araştırma odaklı yayınlar.',
    channelBanner: 'https://picsum.photos/seed/kk-research-banner/1200/360',
    channelSubscribers: '128K',
    publishedAt: '2 saat önce',
    viewCount: '42.8K',
    category: 'Haber',
    tags: ['Ethereum', 'ETF', 'Kurumsal Yatırım', 'DeFi'],
    isShort: false,
    isTrending: true,
    aiSummary: 'Bu videoda Ethereum ETF gelişmeleri, kurumsal yatırımcı ilgisi ve piyasa beklentileri ele alınıyor.',
    aiTopics: ['Ethereum ETF etkisi', 'Kurumsal yatırımcı ilgisi', '2026 piyasa beklentileri'],
    aiTimestamps: [
      { time: '00:45', label: 'ETF nedir?' },
      { time: '05:22', label: 'BlackRock etkisi' },
      { time: '12:10', label: 'Ethereum beklentileri' }
    ],
    comments: [
      {
        id: 'c1',
        username: 'AlphaSeeker',
        avatar: 'https://i.pravatar.cc/150?u=alpha-comment',
        date: 'Bugün',
        content: 'ETF tarafındaki likidite etkisini sade anlatmışsınız. Özellikle L2 bölümünü faydalı buldum.',
        likes: 18
      }
    ]
  },
  {
    id: 'btc-range-analysis',
    youtubeVideoId: 'ysz5S6PUM-U',
    title: 'Bitcoin Teknik Analiz: Kritik Range, Likidite Bölgeleri ve Haftalık Senaryo',
    description: 'BTC için kısa ve orta vadeli seviyeleri, likidite havuzlarını ve invalidasyon noktalarını değerlendiriyoruz.',
    thumbnailUrl: 'https://picsum.photos/seed/btc-range-video/900/520',
    duration: '24:09',
    channelName: 'Market Pulse TR',
    channelSlug: 'market-pulse-tr',
    channelAvatar: 'https://i.pravatar.cc/150?u=market-pulse',
    channelVerified: true,
    channelDescription: 'Bitcoin, altcoin ve makro piyasa analizlerini günlük olarak paylaşan bağımsız yayın kanalı.',
    channelBanner: 'https://picsum.photos/seed/market-pulse-banner/1200/360',
    channelSubscribers: '86K',
    publishedAt: '5 saat önce',
    viewCount: '31.2K',
    category: 'Teknik Analiz',
    tags: ['Bitcoin', 'Teknik Analiz', 'Likidite'],
    isShort: false,
    isTrending: true,
    aiSummary: 'Bitcoin fiyatının yatay bant içindeki davranışı, hacim ve likidite seviyeleriyle birlikte değerlendiriliyor.',
    aiTopics: ['Kritik destek direnç', 'Likidite haritası', 'Haftalık risk planı'],
    aiTimestamps: [
      { time: '01:15', label: 'Haftalık görünüm' },
      { time: '08:40', label: 'Likidite bölgeleri' },
      { time: '17:05', label: 'İşlem planı' }
    ],
    comments: []
  },
  {
    id: 'smart-contract-security',
    youtubeVideoId: 'jNQXAC9IVRw',
    title: 'Smart Contract Güvenliği: Reentrancy, Access Control ve Audit Checklist',
    description: 'Solidity geliştiricileri için temel güvenlik açıkları, audit öncesi kontrol listesi ve gerçek dünya örnekleri.',
    thumbnailUrl: 'https://picsum.photos/seed/smart-contract-video/900/520',
    duration: '36:18',
    channelName: 'Build3 Academy',
    channelSlug: 'build3-academy',
    channelAvatar: 'https://i.pravatar.cc/150?u=build3',
    channelVerified: true,
    channelDescription: 'Web3 yazılım, Solidity, güvenlik ve ürün geliştirme eğitimleri.',
    channelBanner: 'https://picsum.photos/seed/build3-banner/1200/360',
    channelSubscribers: '54K',
    publishedAt: 'Dün',
    viewCount: '18.7K',
    category: 'Smart Contract',
    tags: ['Solidity', 'Audit', 'Security', 'Web3 Dev'],
    isShort: false,
    isTrending: true,
    aiSummary: 'Smart contract güvenliği için en sık görülen hata sınıfları ve audit öncesi pratik kontroller anlatılıyor.',
    aiTopics: ['Reentrancy', 'Access control', 'Audit checklist'],
    aiTimestamps: [
      { time: '02:30', label: 'Tehdit modeli' },
      { time: '11:18', label: 'Reentrancy örneği' },
      { time: '25:44', label: 'Audit listesi' }
    ],
    comments: [
      {
        id: 'c2',
        username: 'DevLord',
        avatar: 'https://i.pravatar.cc/150?u=dev-comment',
        date: 'Dün',
        content: 'Access control kısmı junior geliştiriciler için çok değerli olmuş.',
        likes: 9
      }
    ]
  },
  {
    id: 'airdrop-checklist',
    youtubeVideoId: 'aqz-KE-bpKQ',
    title: 'Airdrop Avcılığı İçin 7 Dakikalık Güvenli Cüzdan Rutini',
    description: 'Airdrop kampanyalarında cüzdan güvenliğini korumak için kısa, uygulanabilir bir kontrol rutini.',
    thumbnailUrl: 'https://picsum.photos/seed/airdrop-short/600/900',
    duration: '00:58',
    channelName: 'Airdrop Radar',
    channelSlug: 'airdrop-radar',
    channelAvatar: 'https://i.pravatar.cc/150?u=airdrop',
    channelVerified: false,
    channelDescription: 'Airdrop fırsatları, güvenlik uyarıları ve görev rehberleri.',
    channelBanner: 'https://picsum.photos/seed/airdrop-banner/1200/360',
    channelSubscribers: '41K',
    publishedAt: '1 gün önce',
    viewCount: '96.4K',
    category: 'Airdrop',
    tags: ['Airdrop', 'Wallet', 'Security'],
    isShort: true,
    isTrending: true,
    aiSummary: 'Airdrop katılımlarında ayrı cüzdan kullanımı, izin kontrolü ve sahte bağlantı riskleri özetleniyor.',
    aiTopics: ['Ayrı cüzdan', 'Token approval kontrolü', 'Phishing riskleri'],
    aiTimestamps: [
      { time: '00:08', label: 'Cüzdan ayrımı' },
      { time: '00:26', label: 'İzinleri kontrol et' },
      { time: '00:43', label: 'Link güvenliği' }
    ],
    comments: []
  },
  {
    id: 'defi-yield-basics',
    youtubeVideoId: 'ScMzIvxBSi4',
    title: 'DeFi Yield Rehberi: APR, APY ve Riskleri Doğru Okumak',
    description: 'DeFi protokollerinde getiri oranlarını yorumlama, sürdürülebilirlik sinyalleri ve temel risk başlıkları.',
    thumbnailUrl: 'https://picsum.photos/seed/defi-yield-video/900/520',
    duration: '21:37',
    channelName: 'DeFi Level 1',
    channelSlug: 'defi-level-1',
    channelAvatar: 'https://i.pravatar.cc/150?u=defi-l1',
    channelVerified: true,
    channelDescription: 'DeFi protokolleri, yield stratejileri ve risk okuryazarlığı için uygulamalı içerikler.',
    channelBanner: 'https://picsum.photos/seed/defi-banner/1200/360',
    channelSubscribers: '73K',
    publishedAt: '3 gün önce',
    viewCount: '22.1K',
    category: 'DeFi',
    tags: ['DeFi', 'Yield', 'APR', 'APY'],
    isShort: false,
    isTrending: false,
    aiSummary: 'APR ve APY farkı, protokol riskleri ve sürdürülebilir yield kaynakları örneklerle açıklanıyor.',
    aiTopics: ['APR ve APY', 'Protokol riski', 'Likidite riski'],
    aiTimestamps: [
      { time: '03:04', label: 'APR/APY farkı' },
      { time: '10:38', label: 'Risk metrikleri' },
      { time: '18:02', label: 'Strateji örneği' }
    ],
    comments: []
  },
  {
    id: 'web3-product-design',
    youtubeVideoId: 'M7lc1UVf-VE',
    title: 'Web3 Ürün Tasarımı: Cüzdan Bağlama Deneyimini Basitleştirmek',
    description: 'Kullanıcıların Web3 uygulamalarında en sık takıldığı cüzdan, imza ve işlem onayı akışlarını sadeleştirme yöntemleri.',
    thumbnailUrl: 'https://picsum.photos/seed/web3-product-video/900/520',
    duration: '14:55',
    channelName: 'Product Chain',
    channelSlug: 'product-chain',
    channelAvatar: 'https://i.pravatar.cc/150?u=product-chain',
    channelVerified: false,
    channelDescription: 'Web3 ürün yönetimi, kullanıcı deneyimi ve büyüme taktikleri.',
    channelBanner: 'https://picsum.photos/seed/product-chain-banner/1200/360',
    channelSubscribers: '19K',
    publishedAt: '4 gün önce',
    viewCount: '9.8K',
    category: 'Web3',
    tags: ['UX', 'Wallet', 'Web3', 'Product'],
    isShort: false,
    isTrending: false,
    aiSummary: 'Web3 kullanıcı deneyiminde cüzdan bağlantısı, imza açıklamaları ve onboarding adımları ele alınıyor.',
    aiTopics: ['Cüzdan onboarding', 'İmza ekranları', 'Kullanıcı güveni'],
    aiTimestamps: [
      { time: '01:50', label: 'İlk temas' },
      { time: '06:12', label: 'İmza metinleri' },
      { time: '11:36', label: 'Onboarding örneği' }
    ],
    comments: []
  }
];

export const ACADEMY_CATEGORIES = [
  'Tümü',
  'Kripto Temelleri',
  'Blockchain',
  'Web3',
  'Ethereum',
  'Solidity',
  'Smart Contract',
  'DeFi',
  'Layer-2',
  'Airdrop',
  'Siber Güvenlik',
  'On-Chain Analiz',
  'Yapay Zeka',
  'Yazılım Geliştirme',
  'Kariyer',
  'Akademik Çalışmalar'
];

export const ACADEMY_TAGS = [
  'Bitcoin',
  'Ethereum',
  'Solidity',
  'ERC-20',
  'ERC-721',
  'ERC-4337',
  'Account Abstraction',
  'Layer-2',
  'Rollup',
  'DeFi',
  'NFT',
  'Wallet Security',
  'Smart Contract Audit',
  'Phishing',
  'Airdrop',
  'Dune Analytics',
  'The Graph',
  'Tokenomics',
  'DAO',
  'AI',
  'Backend',
  'API'
];

export const ACADEMY_ARTICLES: AcademyArticle[] = [
  {
    id: 'a1',
    slug: 'blockchain-temelleri-nedir',
    title: 'Blockchain Temelleri: Blok, Hash ve Konsensüs Nasıl Çalışır?',
    subtitle: 'Kripto dünyasına sağlam bir başlangıç için blok zinciri mimarisini sade örneklerle öğren.',
    excerpt: 'Blok, hash, node, madencilik ve konsensüs kavramlarını teknik detaya boğulmadan açıklayan başlangıç rehberi.',
    coverImage: 'https://picsum.photos/seed/academy-blockchain/1200/720',
    category: 'Blockchain',
    tags: ['Bitcoin', 'Blockchain', 'Tokenomics'],
    authorName: 'Ece Arslan',
    authorAvatar: 'https://i.pravatar.cc/150?u=ece-academy',
    authorBio: 'Blockchain okuryazarlığı ve ürün stratejisi üzerine içerikler hazırlayan araştırmacı.',
    publishedAt: '10 Haziran 2026',
    updatedAt: '10 Haziran 2026',
    readingTime: '9 dk',
    viewCount: '18.4K',
    commentCount: 2,
    level: 'Başlangıç',
    contentType: 'Rehber',
    isFeatured: true,
    isPopular: true,
    seriesId: 'blockchain-temelleri',
    aiSummary: 'Blockchain mimarisinin temel parçaları, güven modeli ve konsensüs yapısı başlangıç seviyesinde özetleniyor.',
    aiKeyPoints: ['Bloklar veriyi sıralı tutar', 'Hash değişmezlik sağlar', 'Konsensüs ağın ortak karar mekanizmasıdır', 'Node ağı doğrular', 'Ekonomi güvenliği destekler'],
    aiWhoShouldRead: ['Kriptoya yeni başlayanlar', 'Ürün yöneticileri', 'Teknik olmayan yatırımcılar'],
    aiLearningOutcomes: ['Blockchain bileşenlerini ayırt etme', 'Konsensüs mantığını anlama', 'Temel riskleri okuma'],
    relatedConcepts: ['Blockchain', 'Gas Fee', 'Wallet'],
    content: [
      { id: 'blok-nedir', heading: 'Blok Nedir?', body: 'Blok, işlemlerin belirli kurallara göre paketlenmiş halidir. Her blok kendinden önceki bloğa referans vererek zincirin devamlılığını sağlar.' },
      { id: 'hash-mantigi', heading: 'Hash Mantığı', body: 'Hash, verinin kısa ve benzersiz bir parmak izidir. Veri değiştiğinde hash de değişir; bu yüzden zincirdeki oynama girişimleri hızlıca fark edilir.', kind: 'info' },
      { id: 'konsensus', heading: 'Konsensüs', body: 'Konsensüs, dağınık ağdaki katılımcıların hangi işlem geçmişinin geçerli olduğuna karar vermesidir. Proof of Work ve Proof of Stake bu yaklaşımın iki farklı örneğidir.' },
      { id: 'kod-ornegi', heading: 'Basit Hash Örneği', body: "const blockHash = sha256(previousHash + JSON.stringify(transactions));\nconsole.log(blockHash);", kind: 'code' }
    ],
    comments: [
      { id: 'ac1', username: 'KriptoPilot', avatar: 'https://i.pravatar.cc/150?u=academy-comment-1', date: 'Bugün', content: 'Hash ve blok ilişkisini bu kadar sade görmek iyi oldu.', likes: 12 },
      { id: 'ac2', username: 'NodeRunner', avatar: 'https://i.pravatar.cc/150?u=academy-comment-2', date: 'Dün', content: 'Konsensüs kısmına PoS örneği eklenirse daha da iyi olur.', likes: 6 }
    ]
  },
  {
    id: 'a2',
    slug: 'solidity-baslangic-erc20',
    title: 'Solidity Başlangıç: ERC-20 Token Mantığını Anlamak',
    subtitle: 'Token kontratlarının temel fonksiyonlarını ve güvenli geliştirme alışkanlıklarını öğren.',
    excerpt: 'ERC-20 standardı, allowance yapısı, transfer fonksiyonları ve test yaklaşımı için uygulamalı giriş.',
    coverImage: 'https://picsum.photos/seed/academy-solidity/1200/720',
    category: 'Solidity',
    tags: ['Solidity', 'ERC-20', 'Smart Contract Audit', 'Backend'],
    authorName: 'Mert Kaya',
    authorAvatar: 'https://i.pravatar.cc/150?u=mert-solidity',
    authorBio: 'Solidity geliştiricisi ve akıllı kontrat güvenliği eğitmeni.',
    publishedAt: '8 Haziran 2026',
    updatedAt: '9 Haziran 2026',
    readingTime: '14 dk',
    viewCount: '11.9K',
    commentCount: 1,
    level: 'Başlangıç',
    contentType: 'Eğitim Serisi',
    isFeatured: true,
    isPopular: false,
    seriesId: 'solidity-baslangic',
    aiSummary: 'ERC-20 standardının temel fonksiyonları, izin mekanizması ve güvenli geliştirme kontrolleri anlatılıyor.',
    aiKeyPoints: ['ERC-20 ortak arayüzdür', 'Allowance riskleri dikkat ister', 'Testler kontrat davranışını korur', 'Event takibi önemlidir', 'Audit öncesi checklist gerekir'],
    aiWhoShouldRead: ['Solidity öğrenenler', 'Backend geliştiricileri', 'Token çıkaracak ekipler'],
    aiLearningOutcomes: ['ERC-20 fonksiyonlarını okuma', 'Allowance riskini anlama', 'Basit test planı oluşturma'],
    relatedConcepts: ['Smart Contract', 'Tokenomics', 'Wallet'],
    content: [
      { id: 'erc20-nedir', heading: 'ERC-20 Nedir?', body: 'ERC-20, Ethereum üzerinde fungible tokenların ortak davranışını tanımlayan standarttır.' },
      { id: 'allowance', heading: 'Allowance ve Approve', body: 'Approve işlemleri kullanıcı adına harcama yetkisi verir. Sınırsız izinler kötü niyetli kontratlarda ciddi varlık kaybına yol açabilir.', kind: 'warning' },
      { id: 'solidity-code', heading: 'Minimal Arayüz', body: "interface IERC20 {\n  function transfer(address to, uint256 amount) external returns (bool);\n  function balanceOf(address account) external view returns (uint256);\n}", kind: 'code' }
    ],
    comments: [
      { id: 'ac3', username: 'DevLord', avatar: 'https://i.pravatar.cc/150?u=academy-comment-3', date: '2 gün önce', content: 'Approve riskleri bölümü çok işime yaradı.', likes: 15 }
    ]
  },
  {
    id: 'a3',
    slug: 'wallet-security-phishing',
    title: 'Wallet Security: Phishing Saldırılarını Erken Fark Etmek',
    subtitle: 'Cüzdan güvenliği, seed phrase hijyeni ve sahte dApp uyarı işaretleri.',
    excerpt: 'Kullanıcıların en sık düştüğü phishing tuzaklarını pratik kontrol listeleriyle ele alıyoruz.',
    coverImage: 'https://picsum.photos/seed/academy-security/1200/720',
    category: 'Siber Güvenlik',
    tags: ['Wallet Security', 'Phishing', 'Airdrop'],
    authorName: 'Selin Demir',
    authorAvatar: 'https://i.pravatar.cc/150?u=selin-security',
    authorBio: 'Web3 güvenlik farkındalığı ve kullanıcı koruma süreçleri üzerine çalışır.',
    publishedAt: '6 Haziran 2026',
    updatedAt: '7 Haziran 2026',
    readingTime: '7 dk',
    viewCount: '24.3K',
    commentCount: 0,
    level: 'Başlangıç',
    contentType: 'Güvenlik Uyarısı',
    isFeatured: true,
    isPopular: true,
    aiSummary: 'Phishing saldırılarını erken fark etmek için alan adı, imza metni ve izin kontrolleri özetleniyor.',
    aiKeyPoints: ['Seed phrase asla paylaşılmaz', 'Alan adı dikkatle kontrol edilir', 'İmza metni okunur', 'Token izinleri düzenli temizlenir', 'Ayrı risk cüzdanı kullanılır'],
    aiWhoShouldRead: ['Airdrop kullanıcıları', 'Yeni cüzdan açanlar', 'NFT koleksiyonerleri'],
    aiLearningOutcomes: ['Phishing sinyallerini fark etme', 'Cüzdan izinlerini kontrol etme', 'Güvenli rutin kurma'],
    relatedConcepts: ['Wallet', 'Seed Phrase', 'Phishing'],
    content: [
      { id: 'riskler', heading: 'En Yaygın Riskler', body: 'Sahte mint sayfaları, kopya domainler ve sınırsız token izni kullanıcı kayıplarının ana nedenleri arasındadır.' },
      { id: 'kontrol-listesi', heading: 'Kontrol Listesi', body: 'Alan adını doğrula, imza mesajını oku, işlem simülasyonu kullan ve yüksek bakiyeli cüzdanla yeni dApp deneme.', kind: 'info' },
      { id: 'uyari', heading: 'Seed Phrase Uyarısı', body: 'Hiçbir meşru uygulama seed phrase istemez. Seed phrase isteyen her ekran saldırı kabul edilmelidir.', kind: 'warning' }
    ],
    comments: []
  },
  {
    id: 'a4',
    slug: 'on-chain-analiz-dune',
    title: 'On-Chain Analiz: Dune ile İlk Dashboard’unu Kur',
    subtitle: 'Zincir üstü veriyi sorgulamak, metrik seçmek ve yorumlamak için pratik başlangıç.',
    excerpt: 'Dune Analytics üzerinde temel SQL sorguları, dashboard mantığı ve metrik kalitesi üzerine rehber.',
    coverImage: 'https://picsum.photos/seed/academy-dune/1200/720',
    category: 'On-Chain Analiz',
    tags: ['Dune Analytics', 'The Graph', 'API'],
    authorName: 'Can Öz',
    authorAvatar: 'https://i.pravatar.cc/150?u=can-onchain',
    authorBio: 'Zincir üstü veri analizi ve dashboard tasarımı üzerine yazar.',
    publishedAt: '4 Haziran 2026',
    updatedAt: '4 Haziran 2026',
    readingTime: '12 dk',
    viewCount: '8.6K',
    commentCount: 0,
    level: 'Orta',
    contentType: 'Rehber',
    isFeatured: false,
    isPopular: true,
    aiSummary: 'Dune üzerinde basit sorgularla protokol kullanımını izlemek ve dashboard tasarlamak anlatılıyor.',
    aiKeyPoints: ['Doğru metrik seçimi önemlidir', 'SQL sorguları tekrar kullanılabilir', 'Dashboard bağlamla okunmalıdır', 'Veri gecikmesi kontrol edilir', 'Görselleştirme sade tutulur'],
    aiWhoShouldRead: ['Analistler', 'DeFi araştırmacıları', 'Ürün ekipleri'],
    aiLearningOutcomes: ['Dune sorgusu yazma', 'Metrik yorumlama', 'Dashboard düzenleme'],
    relatedConcepts: ['TVL', 'Liquidity', 'DeFi'],
    content: [
      { id: 'metrik-secimi', heading: 'Metrik Seçimi', body: 'Önce neyi ölçmek istediğini tanımla: kullanıcı sayısı, işlem hacmi, TVL değişimi veya retention farklı sorulara cevap verir.' },
      { id: 'sql', heading: 'Basit SQL Sorgusu', body: "select date_trunc('day', block_time) as day, count(*) as tx_count\nfrom ethereum.transactions\ngroup by 1\norder by 1 desc;", kind: 'code' },
      { id: 'yorumlama', heading: 'Veriyi Yorumlamak', body: 'Tek bir metrik karar vermek için yeterli değildir. Hacim, kullanıcı ve zaman bağlamı birlikte değerlendirilmelidir.', kind: 'quote' }
    ],
    comments: []
  },
  {
    id: 'a5',
    slug: 'ai-web3-agentlar',
    title: 'AI ve Web3: Agent Tabanlı Cüzdan Deneyimleri',
    subtitle: 'Yapay zeka destekli otomasyonların cüzdan, güvenlik ve işlem deneyimine etkisi.',
    excerpt: 'AI agentların Web3 arayüzlerinde nasıl kullanılabileceğini, riskleri ve ürün fırsatlarını inceliyoruz.',
    coverImage: 'https://picsum.photos/seed/academy-ai-web3/1200/720',
    category: 'Yapay Zeka',
    tags: ['AI', 'Wallet Security', 'API', 'Account Abstraction'],
    authorName: 'Deniz Sancar',
    authorAvatar: 'https://i.pravatar.cc/150?u=deniz-ai',
    authorBio: 'AI destekli ürünler ve Web3 otomasyonları üzerine araştırmacı.',
    publishedAt: '1 Haziran 2026',
    updatedAt: '3 Haziran 2026',
    readingTime: '10 dk',
    viewCount: '7.2K',
    commentCount: 0,
    level: 'İleri',
    contentType: 'Analiz',
    isFeatured: false,
    isPopular: false,
    aiSummary: 'AI agentların Web3 işlemlerini kolaylaştırırken yeni güvenlik ve onay riskleri oluşturduğu anlatılıyor.',
    aiKeyPoints: ['Agent yetkileri sınırlanmalı', 'İşlem simülasyonu gereklidir', 'AA deneyimi güçlendirir', 'Kullanıcı onayı açık olmalıdır', 'Risk limitleri ürünün parçasıdır'],
    aiWhoShouldRead: ['Web3 ürün ekipleri', 'AI geliştiricileri', 'Güvenlik ekipleri'],
    aiLearningOutcomes: ['Agent risklerini anlama', 'AA ile ilişki kurma', 'Ürün kontrol noktaları tasarlama'],
    relatedConcepts: ['Account Abstraction', 'Wallet', 'API'],
    content: [
      { id: 'agent-nedir', heading: 'Agent Nedir?', body: 'Agent, kullanıcı adına hedef odaklı adımlar planlayabilen ve belirli araçları kullanabilen yazılım katmanıdır.' },
      { id: 'yetki', heading: 'Yetki Sınırları', body: 'Web3 agentları için işlem limiti, protokol izin listesi ve onay gereklilikleri net tanımlanmalıdır.', kind: 'warning' },
      { id: 'firsatlar', heading: 'Ürün Fırsatları', body: 'Portfolio rebalancing, gas optimizasyonu ve risk uyarıları agent tabanlı deneyimler için güçlü kullanım alanlarıdır.' }
    ],
    comments: []
  },
  {
    id: 'a6',
    slug: 'akademik-rollup-raporu',
    title: 'Akademik Özet: Rollup Mimarilerinde Veri Erişilebilirliği',
    subtitle: 'Rollup sistemlerinin güvenlik varsayımları ve veri erişilebilirliği problemi üzerine araştırma özeti.',
    excerpt: 'Akademik çalışmaların pratik Web3 ürün kararlarına nasıl çevrilebileceğini anlatan kısa rapor.',
    coverImage: 'https://picsum.photos/seed/academy-rollup-paper/1200/720',
    category: 'Akademik Çalışmalar',
    tags: ['Layer-2', 'Rollup', 'Ethereum'],
    authorName: 'Dr. Bora Yıldız',
    authorAvatar: 'https://i.pravatar.cc/150?u=bora-academic',
    authorBio: 'Dağıtık sistemler ve L2 mimarileri üzerine akademik araştırmacı.',
    publishedAt: '28 Mayıs 2026',
    updatedAt: '30 Mayıs 2026',
    readingTime: '16 dk',
    viewCount: '5.1K',
    commentCount: 0,
    level: 'İleri',
    contentType: 'Akademik Çalışma',
    isFeatured: false,
    isPopular: false,
    aiSummary: 'Rollup sistemlerinde veri erişilebilirliğinin güvenlik ve maliyet üzerindeki etkileri özetleniyor.',
    aiKeyPoints: ['DA güvenlik için kritiktir', 'Maliyet ve güvenlik dengesi vardır', 'Ethereum roadmap etkili olur', 'Kullanıcı deneyimi dolaylı etkilenir', 'L2 seçimi varsayımlara bağlıdır'],
    aiWhoShouldRead: ['Araştırmacılar', 'L2 geliştiricileri', 'Teknik yatırımcılar'],
    aiLearningOutcomes: ['DA problemini anlama', 'Rollup tiplerini karşılaştırma', 'Araştırma sonucunu ürüne çevirme'],
    relatedConcepts: ['Layer-2', 'Rollup', 'Gas Fee'],
    content: [
      { id: 'problem', heading: 'Problem Tanımı', body: 'Rollup sistemleri işlem yürütmeyi zincir dışına taşısa da verinin doğrulanabilir biçimde erişilebilir kalmasına ihtiyaç duyar.' },
      { id: 'denge', heading: 'Güvenlik ve Maliyet Dengesi', body: 'Daha düşük maliyet çoğu zaman ek güven varsayımları getirir. Bu varsayımlar kullanıcı riskini etkiler.', kind: 'quote' },
      { id: 'sonuc', heading: 'Pratik Sonuç', body: 'Bir L2 seçerken yalnızca ücretlere değil, veri erişilebilirliği modeline ve çıkış mekanizmalarına da bakılmalıdır.' }
    ],
    comments: []
  }
];

export const ACADEMY_SERIES: AcademySeries[] = [
  {
    id: 'blockchain-temelleri',
    slug: 'blockchain-temelleri',
    title: 'Blockchain Temelleri',
    description: 'Kripto ekosistemine yeni başlayanlar için blok zinciri, cüzdan, işlem ve güvenlik temelleri.',
    coverImage: 'https://picsum.photos/seed/series-blockchain/900/520',
    level: 'Başlangıç',
    totalLessons: 4,
    totalReadingTime: '38 dk',
    progress: 25,
    lessons: [
      { articleSlug: 'blockchain-temelleri-nedir', title: 'Blockchain Temelleri', readingTime: '9 dk', completed: true },
      { articleSlug: 'wallet-security-phishing', title: 'Cüzdan Güvenliği', readingTime: '7 dk' },
      { articleSlug: 'defi-yield-basics', title: 'DeFi Kavramları', readingTime: '11 dk' },
      { articleSlug: 'on-chain-analiz-dune', title: 'Zincir Üstü Veri', readingTime: '12 dk' }
    ]
  },
  {
    id: 'solidity-baslangic',
    slug: 'solidity-baslangic',
    title: 'Solidity Başlangıç Serisi',
    description: 'Smart contract geliştirmeye giriş, ERC standartları, test ve güvenlik alışkanlıkları.',
    coverImage: 'https://picsum.photos/seed/series-solidity/900/520',
    level: 'Başlangıç',
    totalLessons: 5,
    totalReadingTime: '62 dk',
    progress: 20,
    lessons: [
      { articleSlug: 'solidity-baslangic-erc20', title: 'ERC-20 Token Mantığı', readingTime: '14 dk', completed: true },
      { articleSlug: 'wallet-security-phishing', title: 'Güvenlik Temelleri', readingTime: '7 dk' },
      { articleSlug: 'akademik-rollup-raporu', title: 'L2 Bağlamı', readingTime: '16 dk' }
    ]
  },
  {
    id: 'onchain-analiz-rehberi',
    slug: 'onchain-analiz-rehberi',
    title: 'On-Chain Analiz Rehberi',
    description: 'Dune, metrik seçimi, dashboard tasarımı ve veri yorumlama için uygulamalı seri.',
    coverImage: 'https://picsum.photos/seed/series-onchain/900/520',
    level: 'Orta',
    totalLessons: 3,
    totalReadingTime: '34 dk',
    progress: 0,
    lessons: [
      { articleSlug: 'on-chain-analiz-dune', title: 'Dune ile Dashboard', readingTime: '12 dk' },
      { articleSlug: 'blockchain-temelleri-nedir', title: 'Veri Kaynağı Mantığı', readingTime: '9 dk' },
      { articleSlug: 'akademik-rollup-raporu', title: 'L2 Verisini Okumak', readingTime: '16 dk' }
    ]
  }
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'g1',
    term: 'Blockchain',
    slug: 'blockchain',
    shortDefinition: 'İşlem kayıtlarının dağıtık ve değiştirilemez biçimde tutulduğu veri yapısı.',
    fullDefinition: 'Blockchain, birçok katılımcı tarafından doğrulanan işlem geçmişini bloklar halinde saklayan dağıtık defter teknolojisidir.',
    relatedTerms: ['Smart Contract', 'Gas Fee', 'Wallet']
  },
  {
    id: 'g2',
    term: 'Smart Contract',
    slug: 'smart-contract',
    shortDefinition: 'Blok zinciri üzerinde çalışan programlanabilir sözleşme mantığı.',
    fullDefinition: 'Smart contract, belirlenen koşullar gerçekleştiğinde zincir üzerinde otomatik çalışan ve sonucu herkes tarafından doğrulanabilen koddur.',
    relatedTerms: ['Solidity', 'Audit', 'DeFi']
  },
  {
    id: 'g3',
    term: 'DeFi',
    slug: 'defi',
    shortDefinition: 'Aracı kurum olmadan çalışan merkeziyetsiz finans uygulamaları.',
    fullDefinition: 'DeFi, borç verme, takas, yield ve türev gibi finansal işlemleri akıllı kontratlar üzerinden sunan protokol ekosistemidir.',
    relatedTerms: ['TVL', 'Liquidity', 'DAO']
  },
  {
    id: 'g4',
    term: 'Layer-2',
    slug: 'layer-2',
    shortDefinition: 'Ana zincirin üzerinde ölçeklenebilirliği artıran ikinci katman çözümler.',
    fullDefinition: 'Layer-2 ağları, işlem yürütmeyi ana zincir dışına taşıyarak ücretleri düşürmeyi ve kapasiteyi artırmayı hedefler.',
    relatedTerms: ['Rollup', 'Gas Fee', 'Ethereum']
  },
  {
    id: 'g5',
    term: 'Seed Phrase',
    slug: 'seed-phrase',
    shortDefinition: 'Cüzdanı kurtarmak için kullanılan gizli kelime dizisi.',
    fullDefinition: 'Seed phrase, cüzdan özel anahtarlarını yeniden üretmeyi sağlayan kritik kurtarma bilgisidir ve kimseyle paylaşılmamalıdır.',
    relatedTerms: ['Wallet', 'Phishing', 'Wallet Security']
  },
  {
    id: 'g6',
    term: 'Tokenomics',
    slug: 'tokenomics',
    shortDefinition: 'Bir tokenın arz, dağıtım, teşvik ve kullanım ekonomisi.',
    fullDefinition: 'Tokenomics, bir kripto varlığın ekonomik modelini, arz mekanizmasını, dağıtımını ve ekosistem içindeki faydasını inceler.',
    relatedTerms: ['DAO', 'Liquidity', 'TVL']
  }
];
