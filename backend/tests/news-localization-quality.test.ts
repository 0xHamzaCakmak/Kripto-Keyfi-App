import { describe, expect, it } from 'vitest';
import { evaluateNewsLocalization } from '../src/modules/news/localization/news-localization-quality.js';

const input = { title: 'Bitcoin ETF haberi', excerpt: 'Kısa bir kaynak açıklaması.', sourceName: 'Kaynak', language: 'tr', category: 'Bitcoin', publishedAt: new Date(), existingTags: [] };
const output = { titleTr: 'Bitcoin ETF gelişmesi', summaryTr: 'Bitcoin ETF tarafında yeni bir gelişme yaşandı ve ayrıntıların ilerleyen dönemde netleşmesi bekleniyor.', whyItMatters: 'Bu gelişme kurumsal yatırımcıların kripto ürünlerine yaklaşımını anlamak açısından önem taşıyabilir. Kalıcı bir eğilim için yeni verilerin gelmesi gerekir. Piyasa katılımcıları haberin uygulama tarafındaki sonuçlarını izleyecektir.', marketImpact: 'Gelişmenin doğrulanması halinde ilgili ürünlere yönelik ilgi artabilir ancak tek başına kalıcı fiyat hareketi anlamına gelmez. Likidite koşulları ayrıca değerlendirilmelidir.', watchOuts: 'Resmî açıklamalar, takip eden fon akışları ve piyasanın ilk tepkisi birlikte izlenmelidir.', confidence: 0.9, needsReview: false, tags: ['Bitcoin', 'ETF'], relatedCoins: ['BTC'], provider: 'groq', model: 'qwen/qwen3.6-27b' };

describe('evaluateNewsLocalization', () => {
  it('keeps limited source input publishable while flagging it and capping confidence', () => {
    const result = evaluateNewsLocalization(input, output);
    expect(result.flags).toContain('SHORT_SOURCE_INPUT');
    expect(result.output.needsReview).toBe(false);
    expect(result.output.confidence).toBe(0.65);
  });

  it('rejects URLs and markdown-like output through quality flags', () => {
    const result = evaluateNewsLocalization({ ...input, excerpt: Array(50).fill('bilgi').join(' ') }, { ...output, whyItMatters: `**Başlık** ${output.whyItMatters} https://example.com` });
    expect(result.flags).toEqual(expect.arrayContaining(['UNEXPECTED_URL', 'MARKDOWN_OUTPUT']));
  });

  it('flags excessive source similarity and invalid summary lengths', () => {
    const repeated = Array(45).fill('bitcoin etf kurumsal yatırımcı talebi arttı').join(' ');
    const similar = evaluateNewsLocalization(
      { ...input, excerpt: repeated },
      { ...output, summaryTr: repeated },
    );
    expect(similar.flags).toEqual(expect.arrayContaining(['SUMMARY_TOO_LONG', 'HIGH_SOURCE_OVERLAP']));
    expect(similar.output.needsReview).toBe(true);

    const short = evaluateNewsLocalization(
      { ...input, excerpt: Array(50).fill('kaynak bilgisi').join(' ') },
      { ...output, summaryTr: 'Çok kısa özet.' },
    );
    expect(short.flags).toContain('SUMMARY_TOO_SHORT');
    expect(short.output.needsReview).toBe(false);
  });

  it('blocks AI output that still contains encoding artifacts', () => {
    const result = evaluateNewsLocalization(
      { ...input, excerpt: Array(50).fill('kaynak bilgisi').join(' ') },
      { ...output, summaryTr: 'Uniswap, Robinhood Chain �zerinde yeni bir token platformu a�tı ve ayrıntılar kullanıcılarla paylaşıldı.' },
    );
    expect(result.flags).toContain('ENCODING_ARTIFACT');
    expect(result.output.needsReview).toBe(true);
  });
});
