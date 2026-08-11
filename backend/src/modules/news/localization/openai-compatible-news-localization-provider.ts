import { z } from 'zod';
import {
  NEWS_LOCALIZATION_SYSTEM_PROMPT,
  newsLocalizationResponseSchema,
  newsLocalizationUserPrompt,
  normalizeNewsLocalizationOutput,
} from './groq-news-localization-provider.js';
import type {
  NewsLocalizationInput,
  NewsLocalizationOutput,
  NewsLocalizationProvider,
} from './news-localization-provider.js';

const responseEnvelopeSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
});

type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

class CompatibleApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(`${status}: ${message}`);
    this.name = 'CompatibleApiError';
  }
}

function errorMessage(payload: unknown, provider: string, status: number) {
  const parsed = z.object({ error: z.object({ message: z.string() }) }).safeParse(payload);
  return parsed.success ? parsed.data.error.message.slice(0, 300) : `${provider} request failed (${status})`;
}

export class DeepSeekNewsLocalizationProvider implements NewsLocalizationProvider {
  readonly name = 'deepseek';
  readonly configured: boolean;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: ProviderConfig) {
    this.configured = Boolean(config.apiKey);
    this.fetcher = config.fetcher ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async localize(input: NewsLocalizationInput): Promise<NewsLocalizationOutput> {
    if (!this.configured) throw new Error(`${this.name} API key is not configured`);
    let response: Response;
    try {
      response = await this.fetcher(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1_600,
          thinking: { type: 'disabled' },
          temperature: 0.2,
          messages: [
            { role: 'system', content: NEWS_LOCALIZATION_SYSTEM_PROMPT },
            { role: 'user', content: newsLocalizationUserPrompt(input) },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(`${this.name} request could not be completed`, { cause: error });
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new CompatibleApiError(response.status, errorMessage(payload, this.name, response.status));
    const envelope = responseEnvelopeSchema.parse(payload);
    const localized = newsLocalizationResponseSchema.parse(JSON.parse(envelope.choices[0]!.message.content));
    return normalizeNewsLocalizationOutput(localized, input, this.name, this.config.model);
  }
}
