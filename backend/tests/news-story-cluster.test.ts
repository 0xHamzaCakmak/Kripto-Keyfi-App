import { describe, expect, it } from 'vitest';
import { storyClusterKey } from '../src/modules/news/news-story-cluster.js';

describe('news story clusters', () => {
  it('groups matching event anchors independent of title wording', () => {
    expect(storyClusterKey("Bitcoin ETF girişleri 620 milyon dolara ulaştı")).toBe(storyClusterKey("Spot Bitcoin ETF'lerine 620 milyon dolar giriş"));
  });
  it('does not create broad clusters without enough anchors', () => {
    expect(storyClusterKey('Piyasalarda yeni haftanın görünümü')).toBeNull();
  });
});
