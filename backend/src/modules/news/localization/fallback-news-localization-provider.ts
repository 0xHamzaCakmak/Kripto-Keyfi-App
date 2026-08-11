import type {
  NewsLocalizationInput,
  NewsLocalizationOutput,
  NewsLocalizationProvider,
} from './news-localization-provider.js';

type Candidate = { provider: NewsLocalizationProvider; unavailableUntil: number };

export class FallbackNewsLocalizationProvider implements NewsLocalizationProvider {
  readonly name = 'multi-provider';
  readonly configured: boolean;
  private readonly candidates: Candidate[];

  constructor(providers: NewsLocalizationProvider[], private readonly now: () => number = Date.now) {
    this.candidates = providers.map((provider) => ({ provider, unavailableUntil: 0 }));
    this.configured = providers.some((provider) => provider.configured);
  }

  async localize(input: NewsLocalizationInput): Promise<NewsLocalizationOutput> {
    const errors: string[] = [];
    for (const candidate of this.candidates) {
      if (!candidate.provider.configured || candidate.unavailableUntil > this.now()) continue;
      try {
        const output = await candidate.provider.localize(input);
        candidate.unavailableUntil = 0;
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${candidate.provider.name}: ${message.slice(0, 250)}`);
        const longCooldown = /(?:429|rate limit|quota|tokens? per day|\bTPD\b|401|402|403|balance)/i.test(message);
        candidate.unavailableUntil = this.now() + (longCooldown ? 5 * 60_000 : 30_000);
      }
    }
    if (!errors.length) throw new Error('No configured and currently available news AI provider');
    throw new Error(`All news AI providers failed: ${errors.join(' | ')}`);
  }
}
