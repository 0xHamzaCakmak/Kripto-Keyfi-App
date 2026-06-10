export function askKriptoKeyfiAi(question: string) {
  if (!question.trim()) {
    return 'Soru yazdığınızda kısa bir açıklama ve ilgili okuma önerisi burada görünecek.';
  }

  if (/erc-?4337|account abstraction/i.test(question)) {
    return 'ERC-4337, kullanıcı hesaplarını daha esnek hale getiren Account Abstraction standardıdır. Sosyal kurtarma, gas sponsorluğu ve akıllı cüzdan deneyimleri için temel yapı sağlar.';
  }

  if (/security|güvenlik|wallet|phishing/i.test(question)) {
    return 'Cüzdan güvenliğinde temel kontrol: seed phrase paylaşmamak, imza metnini okumak, token izinlerini sınırlamak ve yeni dApp denemelerinde ayrı cüzdan kullanmaktır.';
  }

  return 'Bu konu için kısa cevap: piyasa verisini, zincir üstü sinyalleri ve risk yönetimini birlikte okumak gerekir. İlgili Akademi ve Haber içeriklerine bakabilirsiniz.';
}
