export type ScamDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type ScamRiskLevel = 'safe' | 'risky' | 'high_scam';
export type ScamMainRisk =
  | 'mint_authority'
  | 'unlocked_liquidity'
  | 'owner_privileges'
  | 'honeypot'
  | 'blacklist'
  | 'high_tax'
  | 'fake_audit'
  | 'holder_concentration'
  | 'new_project'
  | 'social_inconsistency'
  | 'low_risk';

export type ScamScenario = {
  id: string;
  title: string;
  projectName: string;
  tokenSymbol: string;
  network: string;
  difficulty: ScamDifficulty;
  projectAge: string;
  holders: string;
  liquidity: string;
  liquidityLocked: boolean;
  liquidityLockDuration: string;
  auditStatus: string;
  auditProvider: string;
  ownerRenounced: boolean;
  mintEnabled: boolean;
  blacklistEnabled: boolean;
  honeypotRisk: string;
  buyTax: string;
  sellTax: string;
  topHoldersPercent: string;
  contractVerified: boolean;
  websiteStatus: string;
  socialStatus: string;
  codeSnippet?: string;
  riskSignals: string[];
  correctRiskLevel: ScamRiskLevel;
  correctMainRisk: ScamMainRisk;
  explanation: string;
  learningNote: string;
};

export type ScamGuessResult = {
  riskCorrect: boolean;
  mainRiskCorrect: boolean;
  points: number;
};

export type ScamHistoryItem = {
  id: string;
  scenarioId: string;
  projectName: string;
  tokenSymbol: string;
  difficulty: ScamDifficulty;
  selectedRiskLevel: ScamRiskLevel;
  correctRiskLevel: ScamRiskLevel;
  selectedMainRisk?: ScamMainRisk | null;
  correctMainRisk: ScamMainRisk;
  points: number;
  createdAt: string;
};

export type ScamStats = {
  totalScore: number;
  totalAttempts: number;
  correctAnswers: number;
  currentStreak: number;
  bestStreak: number;
};

const SCORE_KEY = 'scamOrSafeScore';
const STATS_KEY = 'scamOrSafeStats';
const HISTORY_KEY = 'scamOrSafeHistory';
const DIFFICULTY_KEY = 'selectedDifficulty';
const HISTORY_LIMIT = 20;

export const difficultyOptions: Array<{ value: ScamDifficulty; label: string; description: string; bonus: number }> = [
  { value: 'beginner', label: 'Başlangıç', description: 'Basit proje kartı ve temel güvenlik sinyalleri.', bonus: 0 },
  { value: 'intermediate', label: 'Orta', description: 'Tokenomics, likidite, holder ve sosyal veri analizi.', bonus: 5 },
  { value: 'advanced', label: 'İleri', description: 'Contract fonksiyonları, yetkiler ve honeypot sinyalleri.', bonus: 10 },
  { value: 'expert', label: 'Uzman', description: 'Karışık sinyaller ve ana risk sebebi analizi.', bonus: 15 }
];

export const riskLevelOptions: Array<{ value: ScamRiskLevel; label: string; tone: 'safe' | 'warn' | 'danger' }> = [
  { value: 'safe', label: 'Güvenilir görünüyor', tone: 'safe' },
  { value: 'risky', label: 'Riskli', tone: 'warn' },
  { value: 'high_scam', label: 'Scam riski yüksek', tone: 'danger' }
];

export const mainRiskOptions: Array<{ value: ScamMainRisk; label: string }> = [
  { value: 'mint_authority', label: 'Mint yetkisi' },
  { value: 'unlocked_liquidity', label: 'Likidite kilitli değil' },
  { value: 'owner_privileges', label: 'Owner yetkisi' },
  { value: 'honeypot', label: 'Honeypot riski' },
  { value: 'blacklist', label: 'Blacklist fonksiyonu' },
  { value: 'high_tax', label: 'Aşırı yüksek vergi' },
  { value: 'fake_audit', label: 'Sahte audit' },
  { value: 'holder_concentration', label: 'Holder yoğunlaşması' },
  { value: 'new_project', label: 'Yeni açılmış proje' },
  { value: 'social_inconsistency', label: 'Sosyal medya tutarsızlığı' },
  { value: 'low_risk', label: 'Risk yok / düşük risk' }
];

const snippets = {
  mint: `function mint(address to, uint256 amount) external onlyOwner {\n  _mint(to, amount);\n}`,
  blacklist: `mapping(address => bool) public blacklist;\nfunction setBlacklist(address user, bool value) external onlyOwner {\n  blacklist[user] = value;\n}`,
  tax: `function setFees(uint256 buyFee, uint256 sellFee) external onlyOwner {\n  fees.buy = buyFee;\n  fees.sell = sellFee;\n}`,
  proxy: `function upgradeTo(address newImplementation) external onlyOwner {\n  _upgradeTo(newImplementation);\n}`,
  honeypot: `function _transfer(address from, address to, uint256 amount) internal override {\n  require(canSell[from] || to != pair, "sell disabled");\n}`
};

export const scamScenarios: ScamScenario[] = [
  {
    id: 'dogemoon-ai',
    title: 'Yeni meme token lansmanı',
    projectName: 'DOGEMOON AI',
    tokenSymbol: 'DMAI',
    network: 'BNB Chain',
    difficulty: 'beginner',
    projectAge: '2 gün',
    holders: '1.240',
    liquidity: '$42.000',
    liquidityLocked: false,
    liquidityLockDuration: 'Yok',
    auditStatus: 'Yok',
    auditProvider: '-',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Bilinmiyor',
    buyTax: '%4',
    sellTax: '%8',
    topHoldersPercent: '%54',
    contractVerified: true,
    websiteStatus: 'Yeni açılmış',
    socialStatus: '50.000 takipçi, düşük etkileşim',
    riskSignals: ['Yeni proje', 'Likidite kilidi yok', 'Audit yok', 'Sosyal etkileşim tutarsız'],
    correctRiskLevel: 'high_scam',
    correctMainRisk: 'unlocked_liquidity',
    explanation: 'Yeni açılmış proje, audit yokluğu, likidite kilidinin olmaması ve sosyal medya tutarsızlığı yüksek risk sinyalleri taşır.',
    learningNote: 'Likidite kilidi olmayan projelerde geliştirici likiditeyi çekebilir. Bu rug pull riskini artırır.'
  },
  {
    id: 'safeeth',
    title: 'Dengeli tokenomics örneği',
    projectName: 'SAFEETH',
    tokenSymbol: 'SETH',
    network: 'Ethereum',
    difficulty: 'intermediate',
    projectAge: '14 ay',
    holders: '18.400',
    liquidity: '$3.2M',
    liquidityLocked: true,
    liquidityLockDuration: '12 ay',
    auditStatus: 'Var',
    auditProvider: 'CertiMock',
    ownerRenounced: true,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Düşük',
    buyTax: '%2',
    sellTax: '%2',
    topHoldersPercent: '%18',
    contractVerified: true,
    websiteStatus: 'Aktif',
    socialStatus: 'Tutarlı topluluk aktivitesi',
    riskSignals: ['Likidite kilitli', 'Owner renounced', 'Düşük vergi', 'Dengeli holder dağılımı'],
    correctRiskLevel: 'safe',
    correctMainRisk: 'low_risk',
    explanation: 'Likiditenin kilitli olması, owner yetkisinin bırakılması, düşük vergi oranı ve dengeli holder dağılımı riskleri azaltır. Yine de kesin güvenli anlamına gelmez.',
    learningNote: 'Düşük risk görünümü garanti değildir; audit kapsamı, piyasa koşulları ve sözleşme davranışı ayrıca incelenmelidir.'
  },
  {
    id: 'infinite-mint',
    title: 'Owner kontrollü mint fonksiyonu',
    projectName: 'MintFlex',
    tokenSymbol: 'MFLX',
    network: 'Ethereum',
    difficulty: 'advanced',
    projectAge: '3 hafta',
    holders: '3.920',
    liquidity: '$620.000',
    liquidityLocked: true,
    liquidityLockDuration: '3 ay',
    auditStatus: 'Yok',
    auditProvider: '-',
    ownerRenounced: false,
    mintEnabled: true,
    blacklistEnabled: false,
    honeypotRisk: 'Orta',
    buyTax: '%1',
    sellTax: '%1',
    topHoldersPercent: '%29',
    contractVerified: true,
    websiteStatus: 'Aktif',
    socialStatus: 'Normal',
    codeSnippet: snippets.mint,
    riskSignals: ['Mint fonksiyonu açık', 'Owner yetkisi devam ediyor', 'Audit yok'],
    correctRiskLevel: 'risky',
    correctMainRisk: 'mint_authority',
    explanation: 'Owner sınırsız token basabiliyorsa arzı artırarak kullanıcılar için risk oluşturabilir.',
    learningNote: 'Mint yetkisi kontrollü ve şeffaf mekanizmaya bağlı değilse önemli bir token arz riskidir.'
  },
  {
    id: 'honeypot-sell-disabled',
    title: 'Satış kısıtı şüphesi',
    projectName: 'HoneySwap AI',
    tokenSymbol: 'HNYAI',
    network: 'BNB Chain',
    difficulty: 'advanced',
    projectAge: '5 gün',
    holders: '860',
    liquidity: '$95.000',
    liquidityLocked: false,
    liquidityLockDuration: 'Yok',
    auditStatus: 'Yok',
    auditProvider: '-',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: true,
    honeypotRisk: 'Yüksek',
    buyTax: '%3',
    sellTax: '%3',
    topHoldersPercent: '%47',
    contractVerified: true,
    websiteStatus: 'Tek sayfa',
    socialStatus: 'Yoğun reklam, düşük gerçek etkileşim',
    codeSnippet: snippets.honeypot,
    riskSignals: ['Satış kısıtı', 'Blacklist benzeri kontrol', 'Likidite kilidi yok'],
    correctRiskLevel: 'high_scam',
    correctMainRisk: 'honeypot',
    explanation: 'Satışı belirli adreslere kapatabilen mantık, honeypot davranışı için güçlü risk sinyali olabilir.',
    learningNote: 'Honeypot riski olan tokenlarda alım mümkünken satış engellenebilir.'
  },
  {
    id: 'high-tax-token',
    title: 'Aşırı sell tax',
    projectName: 'TaxRocket',
    tokenSymbol: 'TAXR',
    network: 'BNB Chain',
    difficulty: 'intermediate',
    projectAge: '11 gün',
    holders: '2.700',
    liquidity: '$180.000',
    liquidityLocked: true,
    liquidityLockDuration: '30 gün',
    auditStatus: 'Yok',
    auditProvider: '-',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Orta',
    buyTax: '%8',
    sellTax: '%28',
    topHoldersPercent: '%33',
    contractVerified: true,
    websiteStatus: 'Aktif',
    socialStatus: 'Aşırı getiri odaklı söylem',
    riskSignals: ['Aşırı sell tax', 'Owner yetkisi devam ediyor', 'Kısa likidite kilidi'],
    correctRiskLevel: 'high_scam',
    correctMainRisk: 'high_tax',
    explanation: 'Çok yüksek satış vergisi kullanıcıların çıkış maliyetini artırır ve kötüye kullanım riski taşır.',
    learningNote: 'High tax tek başına kesin sonuç değildir, fakat özellikle değiştirilebilir durumdaysa önemli risk sinyalidir.'
  },
  {
    id: 'holder-whale-heavy',
    title: 'Holder yoğunlaşması',
    projectName: 'WhaleDAO',
    tokenSymbol: 'WDAO',
    network: 'Ethereum',
    difficulty: 'intermediate',
    projectAge: '2 ay',
    holders: '6.100',
    liquidity: '$1.1M',
    liquidityLocked: true,
    liquidityLockDuration: '6 ay',
    auditStatus: 'Var',
    auditProvider: 'AuditLab',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Düşük',
    buyTax: '%0',
    sellTax: '%0',
    topHoldersPercent: '%72',
    contractVerified: true,
    websiteStatus: 'Aktif',
    socialStatus: 'Normal',
    riskSignals: ['Top holder yoğunlaşması', 'Owner yetkisi devam ediyor'],
    correctRiskLevel: 'risky',
    correctMainRisk: 'holder_concentration',
    explanation: 'Top holder oranının çok yüksek olması, büyük satış veya yönetişim kontrolü riski oluşturabilir.',
    learningNote: 'Holder dağılımı token risk analizinde likidite ve yetkiler kadar önemlidir.'
  },
  {
    id: 'old-audit-risk',
    title: 'Eski audit, yeni kontrat',
    projectName: 'AuditedFarm',
    tokenSymbol: 'AFARM',
    network: 'Arbitrum',
    difficulty: 'expert',
    projectAge: '9 ay',
    holders: '12.300',
    liquidity: '$2.4M',
    liquidityLocked: true,
    liquidityLockDuration: '7 gün',
    auditStatus: 'Var ama eski',
    auditProvider: 'Unknown Audit',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: true,
    honeypotRisk: 'Orta',
    buyTax: '%4',
    sellTax: '%25',
    topHoldersPercent: '%62',
    contractVerified: true,
    websiteStatus: 'Aktif',
    socialStatus: 'Duyurular tutarsız',
    codeSnippet: snippets.blacklist,
    riskSignals: ['Kısa likidite kilidi', 'Blacklist', 'Yüksek sell tax', 'Holder yoğunlaşması'],
    correctRiskLevel: 'high_scam',
    correctMainRisk: 'high_tax',
    explanation: 'Audit olsa bile kısa likidite kilidi, blacklist fonksiyonu, yüksek satış vergisi ve yoğun holder dağılımı birlikte yüksek risk sinyali taşır.',
    learningNote: 'Audit olması tek başına güvenli demek değildir. Audit tarihi, kapsamı ve son kontrat değişiklikleri incelenmelidir.'
  },
  {
    id: 'renounced-simple',
    title: 'Owner yetkisi bırakılmış token',
    projectName: 'Community Base',
    tokenSymbol: 'CBASE',
    network: 'Base',
    difficulty: 'beginner',
    projectAge: '8 ay',
    holders: '9.800',
    liquidity: '$840.000',
    liquidityLocked: true,
    liquidityLockDuration: '18 ay',
    auditStatus: 'Topluluk incelemesi var',
    auditProvider: 'Community Review',
    ownerRenounced: true,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Düşük',
    buyTax: '%1',
    sellTax: '%1',
    topHoldersPercent: '%21',
    contractVerified: true,
    websiteStatus: 'Aktif',
    socialStatus: 'Tutarlı',
    riskSignals: ['Owner renounced', 'Likidite kilitli', 'Düşük vergi'],
    correctRiskLevel: 'safe',
    correctMainRisk: 'low_risk',
    explanation: 'Owner yetkisinin bırakılması ve uzun likidite kilidi riskleri azaltır. Bu yine de garanti değildir.',
    learningNote: 'Güvenli görünen projelerde bile kontrat doğrulaması ve likidite geçmişi kontrol edilmelidir.'
  },
  {
    id: 'proxy-upgrade',
    title: 'Yükseltilebilir proxy kontrat',
    projectName: 'FlexProxy Finance',
    tokenSymbol: 'FPX',
    network: 'Ethereum',
    difficulty: 'advanced',
    projectAge: '4 ay',
    holders: '4.450',
    liquidity: '$1.6M',
    liquidityLocked: true,
    liquidityLockDuration: '9 ay',
    auditStatus: 'Var',
    auditProvider: 'ChainMock',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Düşük',
    buyTax: '%0',
    sellTax: '%0',
    topHoldersPercent: '%25',
    contractVerified: true,
    websiteStatus: 'Aktif',
    socialStatus: 'Normal',
    codeSnippet: snippets.proxy,
    riskSignals: ['Proxy upgrade yetkisi', 'Owner yetkisi devam ediyor'],
    correctRiskLevel: 'risky',
    correctMainRisk: 'owner_privileges',
    explanation: 'Proxy kontratlar meşru olabilir; ancak upgrade yetkisi merkezi bir adreste kalıyorsa davranış değiştirilebilir.',
    learningNote: 'Proxy riskinde multisig, timelock ve governance kontrolleri aranmalıdır.'
  },
  {
    id: 'phishing-airdrop',
    title: 'Airdrop claim sayfası',
    projectName: 'Arbitrum Bonus Claim',
    tokenSymbol: 'ARBX',
    network: 'Arbitrum',
    difficulty: 'beginner',
    projectAge: '1 gün',
    holders: 'Bilinmiyor',
    liquidity: 'Yok',
    liquidityLocked: false,
    liquidityLockDuration: 'Yok',
    auditStatus: 'Yok',
    auditProvider: '-',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Bilinmiyor',
    buyTax: '-',
    sellTax: '-',
    topHoldersPercent: '-',
    contractVerified: false,
    websiteStatus: 'Resmi siteye çok benzer alan adı',
    socialStatus: 'Sahte kampanya linkleri',
    riskSignals: ['Sahte website', 'Airdrop claim baskısı', 'Kontrat doğrulanmamış'],
    correctRiskLevel: 'high_scam',
    correctMainRisk: 'social_inconsistency',
    explanation: 'Resmi siteye benzeyen alan adı ve acele ettiren claim akışı phishing riski taşıyabilir.',
    learningNote: 'Airdrop claim sayfalarında resmi kaynak, domain ve imzalanan izinler mutlaka kontrol edilmelidir.'
  },
  {
    id: 'fake-partnership',
    title: 'Sahte partnerlik iddiası',
    projectName: 'MetaBank AI',
    tokenSymbol: 'MBAI',
    network: 'BNB Chain',
    difficulty: 'beginner',
    projectAge: '6 gün',
    holders: '2.100',
    liquidity: '$55.000',
    liquidityLocked: false,
    liquidityLockDuration: 'Yok',
    auditStatus: 'Sitede logo var, rapor yok',
    auditProvider: 'Belirsiz',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Bilinmiyor',
    buyTax: '%5',
    sellTax: '%12',
    topHoldersPercent: '%49',
    contractVerified: false,
    websiteStatus: 'Partner logoları doğrulanamıyor',
    socialStatus: 'Bot benzeri yorumlar',
    riskSignals: ['Sahte audit iddiası', 'Doğrulanamayan partnerlik', 'Kontrat doğrulanmamış'],
    correctRiskLevel: 'high_scam',
    correctMainRisk: 'fake_audit',
    explanation: 'Audit veya partnerlik iddiası rapor ve resmi kaynakla doğrulanamıyorsa güvenilir kabul edilmemelidir.',
    learningNote: 'Logo görmek kanıt değildir; audit raporu, hash, tarih ve sağlayıcı kaynağı kontrol edilmelidir.'
  },
  {
    id: 'defi-realistic',
    title: 'Gerçekçi DeFi risk dengesi',
    projectName: 'LendLayer',
    tokenSymbol: 'LAYER',
    network: 'Ethereum',
    difficulty: 'expert',
    projectAge: '18 ay',
    holders: '31.000',
    liquidity: '$8.4M',
    liquidityLocked: true,
    liquidityLockDuration: '24 ay',
    auditStatus: 'Çoklu audit',
    auditProvider: 'OpenZeppelin + TrailMock',
    ownerRenounced: false,
    mintEnabled: false,
    blacklistEnabled: false,
    honeypotRisk: 'Düşük',
    buyTax: '%0',
    sellTax: '%0',
    topHoldersPercent: '%24',
    contractVerified: true,
    websiteStatus: 'Aktif',
    socialStatus: 'Tutarlı geliştirici aktivitesi',
    riskSignals: ['Timelock governance', 'Multisig owner', 'Çoklu audit'],
    correctRiskLevel: 'safe',
    correctMainRisk: 'low_risk',
    explanation: 'Çoklu audit, uzun likidite kilidi, doğrulanmış kontrat ve governance kontrolleri düşük risk görünümü sağlar. Kesin garanti değildir.',
    learningNote: 'Profesyonel projelerde bile oracle, yönetişim ve likidite riskleri izlenmeye devam edilmelidir.'
  }
];

const extraScenarios: ScamScenario[] = [
  ['moon-liqless', 'Moon Launch', 'MOONL', 'new_project', 'high_scam', 'unlocked_liquidity', 'Likidite kilidi olmayan yeni meme token yüksek risk sinyali taşır.'],
  ['blacklist-tax', 'TradeGate', 'TGATE', 'advanced', 'high_scam', 'blacklist', 'Blacklist fonksiyonu kötüye kullanılırsa bazı kullanıcıların satışı engellenebilir.'],
  ['social-bot', 'Viral Inu', 'VINU', 'beginner', 'risky', 'social_inconsistency', 'Yüksek takipçi ve düşük etkileşim sosyal medya tutarsızlığına işaret edebilir.'],
  ['verified-low-liq', 'TinyPool', 'TPOOL', 'intermediate', 'risky', 'unlocked_liquidity', 'Verified contract tek başına yeterli değildir; düşük ve kilitsiz likidite risk taşır.'],
  ['audit-but-mint', 'AuditMint', 'AMNT', 'advanced', 'risky', 'mint_authority', 'Audit raporu olsa bile açık mint yetkisi arz riski oluşturabilir.'],
  ['clean-stable', 'StableFlow', 'SFLW', 'intermediate', 'safe', 'low_risk', 'Düşük vergi, locked liquidity ve dengeli holder dağılımı düşük risk görünümü sunar.'],
  ['owner-wallet', 'OwnerBank', 'OBNK', 'expert', 'risky', 'owner_privileges', 'Owner yetkileri multisig veya timelock olmadan merkezi risk oluşturabilir.'],
  ['honeypot-basic', 'Green Candle', 'GCAN', 'beginner', 'high_scam', 'honeypot', 'Satış yapılamadığına dair kullanıcı raporları honeypot riskini artırır.']
].map(([id, projectName, tokenSymbol, difficulty, risk, mainRisk, explanation]) => ({
  id,
  title: `${projectName} risk kartı`,
  projectName,
  tokenSymbol,
  network: difficulty === 'beginner' ? 'BNB Chain' : 'Ethereum',
  difficulty: difficulty as ScamDifficulty,
  projectAge: risk === 'safe' ? '10 ay' : '9 gün',
  holders: risk === 'safe' ? '14.500' : '1.900',
  liquidity: risk === 'safe' ? '$2.1M' : '$120.000',
  liquidityLocked: risk === 'safe',
  liquidityLockDuration: risk === 'safe' ? '12 ay' : 'Yok',
  auditStatus: risk === 'safe' ? 'Var' : 'Belirsiz',
  auditProvider: risk === 'safe' ? 'AuditLab' : '-',
  ownerRenounced: risk === 'safe',
  mintEnabled: mainRisk === 'mint_authority',
  blacklistEnabled: mainRisk === 'blacklist' || mainRisk === 'honeypot',
  honeypotRisk: mainRisk === 'honeypot' ? 'Yüksek' : 'Orta',
  buyTax: risk === 'safe' ? '%1' : '%5',
  sellTax: mainRisk === 'high_tax' ? '%30' : risk === 'safe' ? '%1' : '%12',
  topHoldersPercent: mainRisk === 'holder_concentration' ? '%66' : risk === 'safe' ? '%20' : '%48',
  contractVerified: risk !== 'high_scam',
  websiteStatus: risk === 'safe' ? 'Aktif' : 'Yeni ve sınırlı bilgi',
  socialStatus: mainRisk === 'social_inconsistency' ? 'Yüksek takipçi, düşük etkileşim' : 'Sınırlı veri',
  codeSnippet: mainRisk === 'mint_authority' ? snippets.mint : mainRisk === 'blacklist' ? snippets.blacklist : mainRisk === 'honeypot' ? snippets.honeypot : undefined,
  riskSignals: [getMainRiskLabel(mainRisk as ScamMainRisk), risk === 'safe' ? 'Düşük risk görünümü' : 'Ek doğrulama gerekli'],
  correctRiskLevel: risk as ScamRiskLevel,
  correctMainRisk: mainRisk as ScamMainRisk,
  explanation,
  learningNote: 'Bu veri tek başına yeterli değildir; güvenlik değerlendirmesinde birden fazla sinyal birlikte okunmalıdır.'
}));

export function getScamScenarios() {
  return [...scamScenarios, ...extraScenarios];
}

export function getRiskLevelLabel(riskLevel: ScamRiskLevel) {
  return riskLevelOptions.find((option) => option.value === riskLevel)?.label ?? riskLevel;
}

export function getMainRiskLabel(mainRisk: ScamMainRisk) {
  return mainRiskOptions.find((option) => option.value === mainRisk)?.label ?? mainRisk;
}

export function getDifficultyLabel(difficulty: ScamDifficulty) {
  return difficultyOptions.find((option) => option.value === difficulty)?.label ?? difficulty;
}

export function needsMainRisk(difficulty: ScamDifficulty) {
  return difficulty !== 'beginner';
}

export function getSavedDifficulty(): ScamDifficulty {
  const saved = localStorage.getItem(DIFFICULTY_KEY) as ScamDifficulty | null;
  return saved && difficultyOptions.some((option) => option.value === saved) ? saved : 'beginner';
}

export function saveSelectedDifficulty(difficulty: ScamDifficulty) {
  localStorage.setItem(DIFFICULTY_KEY, difficulty);
}

export function getScenarioByDifficulty(difficulty: ScamDifficulty) {
  return getScamScenarios().find((scenario) => scenario.difficulty === difficulty) ?? getScamScenarios()[0];
}

export function getNextScenario(difficulty: ScamDifficulty, currentId?: string) {
  const candidates = getScamScenarios().filter((scenario) => scenario.difficulty === difficulty && scenario.id !== currentId);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? getScenarioByDifficulty(difficulty);
}

export function calculateScamScore(scenario: ScamScenario, selectedRiskLevel: ScamRiskLevel, selectedMainRisk?: ScamMainRisk | null) {
  const riskCorrect = selectedRiskLevel === scenario.correctRiskLevel;
  const mainRiskRequired = needsMainRisk(scenario.difficulty);
  const mainRiskCorrect = !mainRiskRequired || selectedMainRisk === scenario.correctMainRisk;
  const difficultyBonus = difficultyOptions.find((option) => option.value === scenario.difficulty)?.bonus ?? 0;
  const points = (riskCorrect ? 10 : 0) + (mainRiskRequired && mainRiskCorrect ? 15 : 0) + (riskCorrect ? difficultyBonus : 0);

  return { riskCorrect, mainRiskCorrect, points };
}

export function submitScamGuess(scenario: ScamScenario, selectedRiskLevel: ScamRiskLevel, selectedMainRisk?: ScamMainRisk | null): ScamGuessResult {
  return calculateScamScore(scenario, selectedRiskLevel, selectedMainRisk);
}

const defaultStats: ScamStats = {
  totalScore: 0,
  totalAttempts: 0,
  correctAnswers: 0,
  currentStreak: 0,
  bestStreak: 0
};

export function getScamStats(): ScamStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...defaultStats, ...JSON.parse(raw) } : defaultStats;
  } catch {
    return defaultStats;
  }
}

export function getScamHistory(): ScamHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveScamHistory(item: ScamHistoryItem) {
  const nextHistory = [item, ...getScamHistory()].slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export function saveScamStats(previousStats: ScamStats, result: ScamGuessResult) {
  const isCorrect = result.riskCorrect && result.mainRiskCorrect;
  const currentStreak = isCorrect ? previousStats.currentStreak + 1 : 0;
  const nextStats: ScamStats = {
    totalScore: previousStats.totalScore + result.points,
    totalAttempts: previousStats.totalAttempts + 1,
    correctAnswers: previousStats.correctAnswers + (isCorrect ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(previousStats.bestStreak, currentStreak)
  };

  localStorage.setItem(SCORE_KEY, String(nextStats.totalScore));
  localStorage.setItem(STATS_KEY, JSON.stringify(nextStats));
  return nextStats;
}
