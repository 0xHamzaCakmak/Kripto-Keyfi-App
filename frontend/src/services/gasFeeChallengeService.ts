export type GasMode = 'gas_direction' | 'transaction_cost' | 'cheapest_network' | 'layer2_compare';
export type GasDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type GasComparisonRow = {
  network: string;
  gasGwei: string;
  estimatedCostUsd: string;
  note: string;
};

export type GasScenario = {
  id: string;
  mode: GasMode;
  difficulty: GasDifficulty;
  title: string;
  network: string;
  transactionType: string;
  currentGasGwei: string;
  pendingTx: string;
  networkStatus: string;
  gasLimit: string;
  estimatedCostUsd: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  learningNote: string;
  comparisonTable?: GasComparisonRow[];
};

export type GasAnswerResult = {
  isCorrect: boolean;
  points: number;
  streakBonus: number;
};

export type GasHistoryItem = {
  id: string;
  scenarioId: string;
  mode: GasMode;
  difficulty: GasDifficulty;
  title: string;
  selectedAnswer: string;
  correctAnswer: string;
  points: number;
  createdAt: string;
};

export type GasStats = {
  totalScore: number;
  totalAttempts: number;
  correctAnswers: number;
  currentStreak: number;
  bestStreak: number;
};

const SCORE_KEY = 'gasFeeChallengeScore';
const STATS_KEY = 'gasFeeChallengeStats';
const HISTORY_KEY = 'gasFeeChallengeHistory';
const MODE_KEY = 'selectedGasMode';
const DIFFICULTY_KEY = 'selectedGasDifficulty';
const HISTORY_LIMIT = 20;

export const gasModeOptions: Array<{ value: GasMode; label: string; description: string }> = [
  { value: 'gas_direction', label: 'Gas Yönü Tahmini', description: 'Gas fee 5 dakika sonra artar mı, düşer mi tahmin et.' },
  { value: 'transaction_cost', label: 'İşlem Maliyeti', description: 'Verilen işlem türünün yaklaşık dolar maliyetini seç.' },
  { value: 'cheapest_network', label: 'En Ucuz Ağ', description: 'Aynı işlem için genellikle en düşük ücretli ağı bul.' },
  { value: 'layer2_compare', label: 'Layer-2 Karşılaştırması', description: 'L1/L2 maliyet farklarını yorumla.' }
];

export const gasDifficultyOptions: Array<{ value: GasDifficulty; label: string; bonus: number; description: string }> = [
  { value: 'beginner', label: 'Başlangıç', bonus: 0, description: 'Basit ağ ve işlem maliyeti soruları.' },
  { value: 'intermediate', label: 'Orta', bonus: 5, description: 'Pending tx, congestion ve Gwei bilgisi.' },
  { value: 'advanced', label: 'İleri', bonus: 10, description: 'L1/L2, bridge, NFT mint ve karmaşık işlemler.' }
];

const ethL2Comparison: GasComparisonRow[] = [
  { network: 'Ethereum', gasGwei: '32 Gwei', estimatedCostUsd: '$18 - $35', note: 'L1 güvenliği ve yoğun talep maliyeti artırabilir.' },
  { network: 'Arbitrum', gasGwei: '0.08 Gwei', estimatedCostUsd: '$0.20 - $0.80', note: 'Rollup paketleme maliyeti düşürebilir.' },
  { network: 'Base', gasGwei: '0.05 Gwei', estimatedCostUsd: '$0.10 - $0.60', note: 'L2 işlem işleme maliyeti düşüktür.' },
  { network: 'Polygon', gasGwei: '70 Gwei', estimatedCostUsd: '$0.01 - $0.20', note: 'Token fiyatı ve ağ yapısı maliyeti düşük tutabilir.' },
  { network: 'BNB Chain', gasGwei: '3 Gwei', estimatedCostUsd: '$0.03 - $0.30', note: 'Genellikle düşük işlem ücreti sunar.' }
];

function makeScenario(
  id: string,
  mode: GasMode,
  difficulty: GasDifficulty,
  title: string,
  network: string,
  transactionType: string,
  currentGasGwei: string,
  pendingTx: string,
  networkStatus: string,
  gasLimit: string,
  estimatedCostUsd: string,
  question: string,
  options: string[],
  correctAnswer: string,
  explanation: string,
  learningNote: string,
  comparisonTable?: GasComparisonRow[]
): GasScenario {
  return {
    id,
    mode,
    difficulty,
    title,
    network,
    transactionType,
    currentGasGwei,
    pendingTx,
    networkStatus,
    gasLimit,
    estimatedCostUsd,
    question,
    options,
    correctAnswer,
    explanation,
    learningNote,
    comparisonTable
  };
}

export const gasScenarios: GasScenario[] = [
  makeScenario(
    'eth-nft-mint-spike',
    'gas_direction',
    'beginner',
    'Popüler NFT mint başladı',
    'Ethereum',
    'NFT Mint',
    '28 Gwei',
    '184.000',
    'Yoğun',
    '140.000',
    '$18 - $45',
    '5 dakika sonra gas fee ne olur?',
    ['10-20 Gwei', '20-30 Gwei', '30-40 Gwei', '40+ Gwei'],
    '40+ Gwei',
    'Pending işlem sayısı yüksek ve NFT mint gibi yoğun etkileşimli işlemler ağ talebini artırabilir. Bu nedenle gas fee yükselme eğilimi gösterebilir.',
    'Gas fee, ağdaki işlem talebi arttıkça yükselebilir.'
  ),
  makeScenario('quiet-eth-transfer', 'gas_direction', 'beginner', 'Sakin Ethereum saati', 'Ethereum', 'ETH Transfer', '16 Gwei', '42.000', 'Sakin', '21.000', '$0.80 - $2.00', '5 dakika sonra gas için en olası aralık hangisi?', ['8-12 Gwei', '14-20 Gwei', '30-40 Gwei', '60+ Gwei'], '14-20 Gwei', 'Ağ sakin ve pending işlem sayısı düşükse gas kısa vadede benzer aralıkta kalabilir.', 'ETH transferi genelde daha basit bir işlemdir.'),
  makeScenario('base-social-surge', 'gas_direction', 'intermediate', 'Base sosyal uygulama yoğunluğu', 'Base', 'Contract Interaction', '0.06 Gwei', '88.000', 'Orta yoğun', '95.000', '$0.05 - $0.40', 'Kısa vadede Base gas yönü için en olası yorum nedir?', ['Düşük kalabilir', 'Bir miktar artabilir', 'Ethereum L1 kadar pahalı olur', 'Gas fee yoktur'], 'Bir miktar artabilir', 'L2 ağlarda maliyet düşük olsa da yoğun kontrat etkileşimi kısa süreli artış yaratabilir.', 'Layer-2 ağlarda da gas vardır, sadece genellikle daha düşüktür.'),
  makeScenario('arbitrum-airdrop-claim', 'gas_direction', 'intermediate', 'Airdrop claim yoğunluğu', 'Arbitrum', 'Claim Airdrop', '0.11 Gwei', '132.000', 'Yoğun', '180.000', '$0.35 - $1.20', 'Claim yoğunluğu devam ederse gas nasıl değişebilir?', ['Düşme eğilimi', 'Artma eğilimi', 'Sıfırlanır', 'Token fiyatına bağlıdır'], 'Artma eğilimi', 'Claim işlemleri kontrat çağırır ve kısa süreli talep artışı maliyeti yükseltebilir.', 'Airdrop dönemlerinde pending tx ve kontrat yoğunluğu birlikte izlenmelidir.'),
  makeScenario('eth-mempool-clears', 'gas_direction', 'advanced', 'Mempool boşalıyor', 'Ethereum', 'ERC20 Transfer', '42 Gwei', '210.000 -> 70.000', 'Yoğunluk azalıyor', '65.000', '$4 - $12', 'Pending tx hızla azalırsa 5 dakika sonra gas için en olası aralık nedir?', ['10-20 Gwei', '30-40 Gwei', '60+ Gwei', '100+ Gwei'], '30-40 Gwei', 'Pending işlem sayısı azalırken gas genellikle gevşeyebilir; ancak tamamen düşmesi anlık talebe bağlıdır.', 'Gas tahminleri yaklaşık yorumdur ve blok doluluğuna göre değişebilir.'),
  makeScenario('optimism-bridge-wave', 'gas_direction', 'advanced', 'Optimism bridge dalgası', 'Optimism', 'Bridge Transfer', '0.04 Gwei', '96.000', 'Yoğun', '220.000', '$0.60 - $2.10', 'Bridge aktivitesi artarsa en olası gas yorumu hangisi?', ['Ağ talebi artabilir', 'Gas fee kesin sıfır olur', 'L2 merkezi borsadır', 'Token fiyatı tek belirleyicidir'], 'Ağ talebi artabilir', 'Bridge işlemleri kontrat etkileşimi içerir ve ağ talebini artırabilir.', 'Bridge işlemleri basit transferden daha karmaşık olabilir.'),

  makeScenario('eth-simple-transfer-cost', 'transaction_cost', 'beginner', 'Basit ETH transferi', 'Ethereum', 'ETH Transfer', '18 Gwei', '58.000', 'Normal', '21.000', '$1.10', 'Bu işlem yaklaşık kaç dolar gas maliyeti oluşturur?', ['$0.20', '$1.50', '$8', '$35'], '$1.50', 'Basit ETH transferi düşük gas limit kullanır. 18 Gwei civarında maliyet yaklaşık düşük tek haneli dolar altında kalabilir.', 'Basit transferler swap veya bridge işlemlerinden daha az gas gerektirir.'),
  makeScenario('erc20-transfer-cost', 'transaction_cost', 'beginner', 'ERC20 transferi', 'Ethereum', 'ERC20 Transfer', '22 Gwei', '77.000', 'Normal', '65.000', '$4.30', 'ERC20 transferi için yaklaşık maliyet hangisine yakındır?', ['$0.05', '$1.00', '$4', '$60'], '$4', 'ERC20 transferi basit ETH transferinden daha fazla gas limit kullanır.', 'Token transferleri kontrat çağırdığı için ETH transferinden pahalı olabilir.'),
  makeScenario('uniswap-swap-cost', 'transaction_cost', 'intermediate', 'Uniswap swap maliyeti', 'Ethereum', 'Uniswap Swap', '30 Gwei', '145.000', 'Yoğun', '160.000', '$18.40', 'Bu swap işlemi yaklaşık kaç dolar maliyet çıkarabilir?', ['$0.20', '$2', '$18', '$90'], '$18', 'Swap işlemleri birkaç kontrat çağrısı yapabilir ve basit transfere göre daha yüksek gas kullanır.', 'Swap, bridge veya contract deploy daha karmaşık işlemler olduğu için daha yüksek gas gerektirebilir.'),
  makeScenario('nft-mint-cost', 'transaction_cost', 'intermediate', 'NFT mint maliyeti', 'Ethereum', 'NFT Mint', '36 Gwei', '178.000', 'Yoğun', '180.000', '$25.70', 'NFT mint yaklaşık hangi maliyet bandına yakındır?', ['$0.50', '$3', '$25', '$120'], '$25', 'NFT mint işlemleri kontrat yazımı ve event üretimi nedeniyle yüksek gas kullanabilir.', 'Popüler mint dönemlerinde hem işlem karmaşıklığı hem ağ talebi maliyeti artırabilir.'),
  makeScenario('contract-deploy-cost', 'transaction_cost', 'advanced', 'Contract deploy', 'Ethereum', 'Contract Deploy', '26 Gwei', '120.000', 'Normal', '1.250.000', '$95.00', 'Contract deploy için yaklaşık maliyet hangisi daha olasıdır?', ['$1', '$8', '$35', '$95'], '$95', 'Contract deploy, bytecode yayınladığı için yüksek gas limit kullanır.', 'Deploy işlemleri genellikle en pahalı işlem türleri arasındadır.'),
  makeScenario('base-swap-cost', 'transaction_cost', 'advanced', 'Base swap maliyeti', 'Base', 'Swap', '0.05 Gwei', '64.000', 'Normal', '180.000', '$0.28', 'Base üzerinde swap yaklaşık hangi maliyet bandında olabilir?', ['$0.20', '$8', '$35', '$120'], '$0.20', 'Base gibi L2 ağlarda swap işlemi L1’e göre çok daha düşük kullanıcı maliyeti oluşturabilir.', 'Layer-2 ağlar işlemleri daha verimli işleyerek kullanıcı maliyetini düşürmeyi hedefler.'),

  makeScenario('usdt-cheapest-network', 'cheapest_network', 'beginner', 'USDT transfer ağı', 'Multi-chain', 'USDT Transfer', '-', '-', 'Karşılaştırma', '-', '-', 'USDT transferi için genelde en düşük ücret hangi ağda olur?', ['Ethereum', 'Arbitrum', 'Base', 'BNB Chain'], 'Base', 'Ethereum genellikle daha pahalıdır; Base, Arbitrum veya BNB Chain gibi ağlar düşük maliyetli olabilir.', 'En ucuz ağ seçimi likidite, destek ve köprü maliyetiyle birlikte düşünülmelidir.', ethL2Comparison),
  makeScenario('nft-mint-cheapest', 'cheapest_network', 'beginner', 'NFT mint için ağ seçimi', 'Multi-chain', 'NFT Mint', '-', '-', 'Karşılaştırma', '-', '-', 'Aynı NFT mint için genelde en düşük kullanıcı maliyeti hangi ağda olabilir?', ['Ethereum', 'Base', 'Bitcoin', 'Optimism'], 'Base', 'Base gibi L2 ağlar NFT mint işlemlerini Ethereum ana ağına göre daha düşük maliyetle işleyebilir.', 'NFT mint maliyeti ağ yoğunluğu ve kontrat tasarımına göre değişebilir.', ethL2Comparison),
  makeScenario('swap-cheapest-network', 'cheapest_network', 'intermediate', 'Swap için ağ karşılaştırması', 'Multi-chain', 'Swap', '-', '-', 'Karşılaştırma', '-', '-', 'Aynı swap için genelde en düşük ücretli seçenek hangisi olabilir?', ['Ethereum Mainnet', 'Arbitrum', 'BNB Chain', 'Hepsi aynı'], 'Arbitrum', 'Arbitrum gibi rollup ağları swap maliyetini Ethereum ana ağına göre düşürebilir.', 'Düşük gas her zaman en iyi rota değildir; likidite ve slippage de önemlidir.', ethL2Comparison),
  makeScenario('bridge-cheapest-network', 'cheapest_network', 'intermediate', 'Bridge çıkış maliyeti', 'Multi-chain', 'Bridge Transfer', '-', '-', 'Karşılaştırma', '-', '-', 'Kullanıcı maliyeti açısından genelde hangi ağ daha düşük ücret sunabilir?', ['Ethereum', 'Polygon', 'Ethereum yoğun saat', 'Hepsi kesin aynı'], 'Polygon', 'Polygon gibi ağlarda işlem ücretleri genellikle Ethereum ana ağına göre düşüktür.', 'Bridge toplam maliyeti hem kaynak hem hedef ağ ücretlerinden etkilenebilir.', ethL2Comparison),
  makeScenario('approve-cheapest-network', 'cheapest_network', 'advanced', 'Token approve karşılaştırması', 'Multi-chain', 'Token Approve', '-', '-', 'Karşılaştırma', '-', '-', 'Token approve işlemi için genellikle düşük maliyetli ağ hangisidir?', ['Ethereum', 'Base', 'Ethereum yoğun mint anı', 'L1 her zaman ucuzdur'], 'Base', 'Approve de kontrat çağrısıdır; L2 ağlarda kullanıcı maliyeti genellikle daha düşük olabilir.', 'Approve işlemlerinde izin miktarı ve hedef kontrat güvenliği ayrıca kontrol edilmelidir.', ethL2Comparison),
  makeScenario('deploy-cheapest-network', 'cheapest_network', 'advanced', 'Contract deploy ağı', 'Multi-chain', 'Contract Deploy', '-', '-', 'Karşılaştırma', '-', '-', 'Contract deploy maliyetini düşürmek için hangi ağ daha uygun olabilir?', ['Ethereum', 'Base', 'Ethereum yoğun saat', 'Gas fee olmayan ağ'], 'Base', 'Deploy yüksek gas limit kullanır; L2 ağlar bu maliyeti ciddi şekilde düşürebilir.', 'Deploy maliyeti düşük olsa bile güvenlik, kullanıcı tabanı ve likidite ayrıca değerlendirilmelidir.', ethL2Comparison),

  makeScenario('why-l2-cheaper', 'layer2_compare', 'beginner', 'Layer-2 neden ucuz?', 'Ethereum / Arbitrum / Base', 'Swap', '32 Gwei', '150.000', 'L1 yoğun', '160.000', '$18 vs $0.40', 'Ethereum ana ağında swap pahalıyken Arbitrum/Base üzerinde neden daha ucuz olabilir?', ['Layer-2 işlemleri ana ağ güvenliğini kullanırken işlemleri daha verimli paketler', 'Çünkü Layer-2 merkezi borsadır', 'Çünkü gas fee yoktur', 'Çünkü token fiyatı düşüktür'], 'Layer-2 işlemleri ana ağ güvenliğini kullanırken işlemleri daha verimli paketler', 'Layer-2 ağlar işlemleri paketleyerek L1 maliyetini daha verimli paylaştırabilir.', 'Layer-2 ağlar gas fee’yi yok etmez; genellikle düşürmeyi hedefler.', ethL2Comparison),
  makeScenario('rollup-basics', 'layer2_compare', 'beginner', 'Rollup temel mantığı', 'Optimism', 'ERC20 Transfer', '0.03 Gwei', '52.000', 'Normal', '65.000', '$0.12', 'Rollup ağlarında maliyet neden düşük olabilir?', ['İşlemler paketlenir ve L1’e özet veri gönderilir', 'Her işlem ücretsizdir', 'Madenciler maliyeti öder', 'Token fiyatı sabittir'], 'İşlemler paketlenir ve L1’e özet veri gönderilir', 'Rollup mimarisi çok sayıda işlemi daha verimli biçimde L1’e taşımayı hedefler.', 'Rollup maliyetleri veri maliyeti ve ağ yoğunluğuna göre değişebilir.', ethL2Comparison),
  makeScenario('l1-security-l2-cost', 'layer2_compare', 'intermediate', 'L1 güvenliği, L2 maliyeti', 'Arbitrum', 'Bridge Transfer', '0.09 Gwei', '91.000', 'Orta yoğun', '230.000', '$0.80', 'L2 ağları için doğru yorum hangisidir?', ['Genellikle L1 güvenliğinden yararlanır ve işlemleri daha verimli işler', 'Her zaman merkezi borsadır', 'Gas limit kavramı yoktur', 'Ethereum ile maliyet her zaman aynıdır'], 'Genellikle L1 güvenliğinden yararlanır ve işlemleri daha verimli işler', 'L2 tasarımları farklıdır ancak genel amaç L1 güvenliğini kullanırken kullanıcı maliyetini düşürmektir.', 'Her L2 aynı değildir; güvenlik modeli ve veri yayınlama yöntemi incelenmelidir.', ethL2Comparison),
  makeScenario('polygon-vs-rollup', 'layer2_compare', 'intermediate', 'Polygon ve rollup farkı', 'Polygon / Arbitrum', 'USDC Transfer', '70 Gwei', '65.000', 'Normal', '65.000', '$0.02 - $0.40', 'Polygon ve rollup ağları için en doğru ifade hangisidir?', ['Maliyetleri düşük olabilir ama güvenlik modelleri farklıdır', 'Hepsi Ethereum L1 ile aynıdır', 'Hiçbirinde işlem ücreti yoktur', 'Sadece token fiyatı önemlidir'], 'Maliyetleri düşük olabilir ama güvenlik modelleri farklıdır', 'Düşük ücret ortak hedef olabilir, fakat ağların güvenlik ve veri kullanılabilirliği varsayımları farklıdır.', 'Ucuz işlem ücreti tek başına ağ seçimi için yeterli değildir.', ethL2Comparison),
  makeScenario('bridge-l1-l2', 'layer2_compare', 'advanced', 'Bridge maliyetini okumak', 'Ethereum / Base', 'Bridge Transfer', '24 Gwei', '110.000', 'Normal', '260.000', '$12 + L2 fee', 'Bridge işlemlerinde maliyet neden tek bir ağ ücretinden ibaret olmayabilir?', ['Kaynak ve hedef ağ işlemleri ile bridge kontrat maliyeti etkili olabilir', 'Bridge her zaman ücretsizdir', 'Sadece token sembolü belirler', 'Gas fee kesin sabittir'], 'Kaynak ve hedef ağ işlemleri ile bridge kontrat maliyeti etkili olabilir', 'Bridge işlemleri çoğu zaman kaynak ağ, hedef ağ ve protokol maliyeti bileşenlerinden oluşur.', 'Bridge maliyeti ve güvenliği birlikte değerlendirilmelidir.', ethL2Comparison),
  makeScenario('calldata-cost', 'layer2_compare', 'advanced', 'Veri maliyeti etkisi', 'Ethereum / Optimism', 'Batch Submit', '35 Gwei', '190.000', 'Yoğun L1', '500.000', '$L1 data cost', 'L2 ücretleri neden Ethereum L1 yoğunluğundan etkilenebilir?', ['L2 verisinin bir kısmı L1’e yazıldığı için L1 veri maliyeti etkili olabilir', 'L2 tamamen gas feesizdir', 'L1 fiyatı sadece token fiyatıdır', 'Pending tx hiçbir şeyi etkilemez'], 'L2 verisinin bir kısmı L1’e yazıldığı için L1 veri maliyeti etkili olabilir', 'Bazı L2 ücretlerinde L1 veri yayınlama maliyeti önemli bileşendir.', 'L2 düşük maliyetli olabilir ama L1 yoğunluğu tamamen önemsiz değildir.', ethL2Comparison)
];

const defaultStats: GasStats = {
  totalScore: 0,
  totalAttempts: 0,
  correctAnswers: 0,
  currentStreak: 0,
  bestStreak: 0
};

export function getGasFeeScenarios() {
  return gasScenarios;
}

export function getModeLabel(mode: GasMode) {
  return gasModeOptions.find((option) => option.value === mode)?.label ?? mode;
}

export function getDifficultyLabel(difficulty: GasDifficulty) {
  return gasDifficultyOptions.find((option) => option.value === difficulty)?.label ?? difficulty;
}

export function getSavedGasMode(): GasMode {
  const saved = localStorage.getItem(MODE_KEY) as GasMode | null;
  return saved && gasModeOptions.some((option) => option.value === saved) ? saved : 'gas_direction';
}

export function getSavedGasDifficulty(): GasDifficulty {
  const saved = localStorage.getItem(DIFFICULTY_KEY) as GasDifficulty | null;
  return saved && gasDifficultyOptions.some((option) => option.value === saved) ? saved : 'beginner';
}

export function saveGasMode(mode: GasMode) {
  localStorage.setItem(MODE_KEY, mode);
}

export function saveGasDifficulty(difficulty: GasDifficulty) {
  localStorage.setItem(DIFFICULTY_KEY, difficulty);
}

export function getScenarioByModeAndDifficulty(mode: GasMode, difficulty: GasDifficulty) {
  return gasScenarios.find((scenario) => scenario.mode === mode && scenario.difficulty === difficulty) ?? gasScenarios[0];
}

export function getNextGasScenario(mode: GasMode, difficulty: GasDifficulty, currentId?: string) {
  const candidates = gasScenarios.filter((scenario) => scenario.mode === mode && scenario.difficulty === difficulty && scenario.id !== currentId);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? getScenarioByModeAndDifficulty(mode, difficulty);
}

export function calculateGasScore(scenario: GasScenario, selectedAnswer: string, currentStreak: number): GasAnswerResult {
  const isCorrect = selectedAnswer === scenario.correctAnswer;
  const difficultyBonus = gasDifficultyOptions.find((option) => option.value === scenario.difficulty)?.bonus ?? 0;
  const nextStreak = isCorrect ? currentStreak + 1 : 0;
  const streakBonus = isCorrect && nextStreak > 0 && nextStreak % 3 === 0 ? 10 : 0;
  const points = isCorrect ? 20 + difficultyBonus + streakBonus : 0;

  return { isCorrect, points, streakBonus };
}

export function submitGasFeeAnswer(scenario: GasScenario, selectedAnswer: string, currentStreak: number) {
  return calculateGasScore(scenario, selectedAnswer, currentStreak);
}

export function getGasFeeStats(): GasStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...defaultStats, ...JSON.parse(raw) } : defaultStats;
  } catch {
    return defaultStats;
  }
}

export function getGasFeeHistory(): GasHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGasFeeHistory(item: GasHistoryItem) {
  const nextHistory = [item, ...getGasFeeHistory()].slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export function saveGasFeeStats(previousStats: GasStats, result: GasAnswerResult) {
  const currentStreak = result.isCorrect ? previousStats.currentStreak + 1 : 0;
  const nextStats: GasStats = {
    totalScore: previousStats.totalScore + result.points,
    totalAttempts: previousStats.totalAttempts + 1,
    correctAnswers: previousStats.correctAnswers + (result.isCorrect ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(previousStats.bestStreak, currentStreak)
  };

  localStorage.setItem(SCORE_KEY, String(nextStats.totalScore));
  localStorage.setItem(STATS_KEY, JSON.stringify(nextStats));
  return nextStats;
}
