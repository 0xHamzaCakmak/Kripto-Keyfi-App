import type { NewsArticle } from '../types';

const plainText = (value = '') => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const trimAtWord = (value: string, max: number) => {
  if (value.length <= max) return value;
  const sliced = value.slice(0, max + 1);
  const boundary = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, boundary > max * 0.65 ? boundary : max).replace(/[\s,;:.!?-]+$/g, '')}…`;
};
const categorySlug = (value: string | null) => {
  const text = (value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-');
  if (/bitcoin|btc/.test(text)) return 'bitcoin';
  if (/ethereum|eth/.test(text)) return 'ethereum';
  if (/defi/.test(text)) return 'defi';
  if (/web3|blockchain/.test(text)) return 'web3';
  if (/borsa|exchange|binance|coinbase/.test(text)) return 'borsa-haberleri';
  if (/regulasyon|sec|cftc/.test(text)) return 'regulasyon';
  if (/guvenlik|hack|security/.test(text)) return 'guvenlik';
  if (/nft/.test(text)) return 'nft';
  if (/yapay-zeka|artificial-intelligence|ai/.test(text)) return 'yapay-zeka';
  return 'altcoin';
};
const seoTitle = (article: NewsArticle) => {
  const title = plainText(article.title);
  const category = plainText(article.category || 'Kripto');
  const candidates = [`${title} | ${category} | KriptoKeyfi`, `${title} | Güncel Kripto Haberi`, `${title} | KriptoKeyfi`, `${title} | Kripto`, `${title} | Haber`].filter((candidate) => candidate.length <= 60);
  return candidates.length ? candidates.sort((left, right) => Math.abs(58 - left.length) - Math.abs(58 - right.length))[0] : trimAtWord(title, 59);
};
const seoDescription = (article: NewsArticle) => trimAtWord(`KriptoKeyfi'nin ${article.source?.name ?? 'orijinal kaynak'} kaynaklı haber özeti: ${plainText(article.excerpt || article.title)} Gelişmenin kripto ve Web3 ekosistemine etkisini, temel ayrıntıları ve kaynak bağlantısını inceleyin.`, 158);

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, key); document.head.append(element); }
  element.content = content;
}

function setSchema(id: string, value: object) {
  let element = document.getElementById(id) as HTMLScriptElement | null;
  if (!element) { element = document.createElement('script'); element.id = id; element.type = 'application/ld+json'; document.head.append(element); }
  element.text = JSON.stringify(value);
}

export function applyNewsSeo(article: NewsArticle) {
  const origin = window.location.origin;
  const url = `${origin}/haberler/${article.slug}`;
  const title = seoTitle(article);
  const description = seoDescription(article);
  const image = article.coverImageUrl || `${origin}/pwa/icon-512.png`;
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('property', 'og:type', 'article'); setMeta('property', 'og:title', title); setMeta('property', 'og:description', description); setMeta('property', 'og:url', url); setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:card', 'summary_large_image'); setMeta('name', 'twitter:title', title); setMeta('name', 'twitter:description', description); setMeta('name', 'twitter:image', image);
  setMeta('name', 'robots', article.aiSummary?.needsReview || article.archivedAt ? 'noindex,follow' : 'index,follow,max-image-preview:large');
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); } canonical.href = url;
  setSchema('news-article-schema', { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: article.title, image: [image], datePublished: article.publishedAt, ...(article.sourceUpdatedAt ? { dateModified: article.sourceUpdatedAt } : {}), author: { '@type': article.authorName ? 'Person' : 'Organization', name: article.authorName ?? article.source?.name ?? 'KriptoKeyfi' }, publisher: { '@type': 'Organization', name: 'KriptoKeyfi', logo: { '@type': 'ImageObject', url: `${origin}/pwa/icon-512.png` } }, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, isBasedOn: article.originalUrl });
  const category = categorySlug(article.category);
  setSchema('news-breadcrumb-schema', { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Anasayfa', item: `${origin}/` }, { '@type': 'ListItem', position: 2, name: 'Haberler', item: `${origin}/haberler` }, { '@type': 'ListItem', position: 3, name: article.category ?? 'Kripto', item: `${origin}/haberler/kategori/${category}` }, { '@type': 'ListItem', position: 4, name: article.title, item: url }] });
}
