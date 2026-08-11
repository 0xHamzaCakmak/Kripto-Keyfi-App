import { describe, expect, it, vi } from 'vitest';
import { FallbackNewsLocalizationProvider } from '../src/modules/news/localization/fallback-news-localization-provider.js';
import { DeepSeekNewsLocalizationProvider } from '../src/modules/news/localization/openai-compatible-news-localization-provider.js';
import type { NewsLocalizationInput, NewsLocalizationOutput, NewsLocalizationProvider } from '../src/modules/news/localization/news-localization-provider.js';

const input: NewsLocalizationInput = {
  title: 'Bitcoin ETF records a new inflow',
  excerpt: 'Bitcoin exchange traded funds recorded a new inflow while market participants monitored institutional demand and changing liquidity conditions across major trading venues.',
  sourceName: 'Example',
  language: 'en',
  category: 'bitcoin',
  publishedAt: new Date('2026-08-12T00:00:00.000Z'),
  existingTags: ['Bitcoin'],
};

const apiOutput = {
  title_tr: 'Bitcoin ETF yeni para girişi kaydetti',
  summary_tr: 'Bitcoin ETF ürünleri yeni bir para girişi kaydetti. Piyasa katılımcıları kurumsal talebi izliyor.',
  why_it_matters: 'Kurumsal ürünlere yönelen para akışı, yatırımcı talebinin ölçülmesi açısından önem taşıyor ve piyasa likiditesine ilişkin değerlendirmeleri etkileyebilir.',
  market_impact: 'Devam eden girişler, Bitcoin piyasasındaki talep görünümünü destekleyebilir; ancak tek bir veri noktası kalıcı eğilim anlamına gelmez.',
  watch_outs: 'Takip eden günlerde fon akışlarının yönü, işlem hacmi ve piyasa likiditesindeki değişimler yakından izlenmeli.',
  confidence: 0.9,
  needs_review: false,
  tags: ['Bitcoin', 'ETF'],
  related_coins: ['BTC'],
};

const normalizedOutput: NewsLocalizationOutput = {
  titleTr: apiOutput.title_tr,
  summaryTr: apiOutput.summary_tr,
  whyItMatters: apiOutput.why_it_matters,
  marketImpact: apiOutput.market_impact,
  watchOuts: apiOutput.watch_outs,
  confidence: 0.9,
  needsReview: false,
  tags: ['Bitcoin', 'ETF'],
  relatedCoins: ['BTC'],
  provider: 'deepseek',
  model: 'test-model',
};

describe('DeepSeek news localization provider', () => {
  it('uses DeepSeek chat completions and returns the shared normalized contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(apiOutput) } }] }), { status: 200 }));
    const provider = new DeepSeekNewsLocalizationProvider({
      apiKey: 'test-key', baseUrl: 'https://api.deepseek.test', model: 'deepseek-test', fetcher,
    });

    const result = await provider.localize(input);

    expect(result).toMatchObject({ provider: 'deepseek', model: 'deepseek-test', titleTr: apiOutput.title_tr });
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(request).toMatchObject({ model: 'deepseek-test', max_tokens: 1600, thinking: { type: 'disabled' } });
  });
});

describe('multi-provider fallback', () => {
  it('switches providers after a rate limit and temporarily bypasses the unavailable provider', async () => {
    const groqLocalize = vi.fn().mockRejectedValue(new Error('429 daily rate limit reached'));
    const deepSeekLocalize = vi.fn().mockResolvedValue(normalizedOutput);
    const providers: NewsLocalizationProvider[] = [
      { name: 'groq', configured: true, localize: groqLocalize },
      { name: 'deepseek', configured: true, localize: deepSeekLocalize },
    ];
    const provider = new FallbackNewsLocalizationProvider(providers, () => 1_000);

    await expect(provider.localize(input)).resolves.toEqual(normalizedOutput);
    await expect(provider.localize(input)).resolves.toEqual(normalizedOutput);
    expect(groqLocalize).toHaveBeenCalledOnce();
    expect(deepSeekLocalize).toHaveBeenCalledTimes(2);
  });
});
