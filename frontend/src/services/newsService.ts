import { api } from './apiClient';
import type { NewsArticle } from '../types';

type ApiResponse<T> = { success: true; data: T };
export type NewsList = { articles: NewsArticle[]; nextCursor: string | null };
export type NewsDetail = { article: NewsArticle; related: NewsArticle[]; popular: NewsArticle[]; saved: boolean };
export const NEWS_CATEGORIES = ['Tümü', 'Bitcoin', 'Ethereum', 'Altcoin', 'DeFi', 'Web3', 'Regülasyon', 'Güvenlik', 'Analiz'];

export async function getNews(params: { q?: string; category?: string; tag?: string; topic?: string; cursor?: string } = {}) {
  const response = await api.get<ApiResponse<NewsList>>('/news', { params: { ...params, limit: 18, category: params.category === 'Tümü' ? undefined : params.category } });
  return response.data.data;
}
export async function getNewsBySlug(slug: string) { const response = await api.get<ApiResponse<NewsDetail>>(`/news/${encodeURIComponent(slug)}`); return response.data.data; }
export async function saveNews(articleId: string) { await api.post(`/news/${articleId}/save`); }
export async function unsaveNews(articleId: string) { await api.delete(`/news/${articleId}/save`); }
