import { api, getApiErrorMessage } from './apiClient';
import type { KOL } from './kolService';

export type Company = { id: string; name: string; website?: string; sector?: string; country: string; verified: boolean; _count?: { campaigns: number } };
export type Campaign = { id: string; companyId: string; name: string; project: string; description?: string; goal: string; budget: number; currency: string; countryTargets: string[]; languageTargets: string[]; categories: string[]; startDate: string; endDate: string; status: string; kpi: string; company?: Company; influencers?: CampaignKOL[] };
export type CampaignKOL = { id: string; agreedPrice: number; currency: string; deliverable: string; status: string; kol: KOL; trackingLinks: Array<{ id: string; code: string; destinationUrl: string; isActive: boolean }> };
export type XProfilePreview = {
  platform: 'X'; platformUserId: string; profileUrl: string; username: string; displayName: string; bio: string; location: string;
  avatarUrl?: string; bannerUrl?: string; verified: boolean; protected: boolean; createdAt?: string; followersCount: number;
  followingCount: number; contentCount: number; listedCount: number; fetchedAt: string;
};

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
export const workspaceApi = {
  companies: async () => unwrap(await api.get<{ data: Company[] }>('/kols/companies')),
  createCompany: async (input: { name: string; website?: string; sector?: string; country: string }) => unwrap(await api.post<{ data: Company }>('/kols/companies', input)),
  campaigns: async () => unwrap(await api.get<{ data: Campaign[] }>('/kols/campaigns')),
  campaign: async (id: string) => unwrap(await api.get<{ data: Campaign }>(`/kols/campaigns/${id}`)),
  analytics: async (id: string) => unwrap(await api.get<{ data: unknown }>(`/kols/campaigns/${id}/analytics`)),
  matches: async (id: string) => unwrap(await api.get<{ data: Array<{ kol: KOL; matchScore: number; factors: Record<string, number> }> }>(`/kols/campaigns/${id}/matches`)),
  createCampaign: async (input: Record<string, unknown>) => unwrap(await api.post<{ data: Campaign }>('/kols/campaigns', input)),
  assignKOL: async (id: string, input: Record<string, unknown>) => unwrap(await api.post<{ data: CampaignKOL }>(`/kols/campaigns/${id}/influencers`, input)),
  setCampaignStatus: async (id: string, status: string) => unwrap(await api.patch<{ data: Campaign }>(`/kols/campaigns/${id}/status`, { status })),
  kolDashboard: async () => unwrap(await api.get<{ data: KOL & { campaignInfluencers: CampaignKOL[] } }>('/kols/me/dashboard')),
  adminKOLs: async () => unwrap(await api.get<{ data: KOL[] }>('/admin/kols')),
  adminLookupXProfile: async (profileUrl: string) => unwrap(await api.post<{ data: XProfilePreview }>('/admin/kols/profile-lookup', { profileUrl })),
  adminImportXProfile: async (input: { profileUrl: string; categories: string[]; country: string; language: string }) => unwrap(await api.post<{ data: KOL }>('/admin/kols/profile-import', input)),
  adminCampaigns: async () => unwrap(await api.get<{ data: Campaign[] }>('/admin/kols/campaigns')),
  adminCampaignStatus: async (id: string, status: string) => unwrap(await api.patch<{ data: Campaign }>(`/admin/kols/campaigns/${id}/status`, { status })),
  adminCreateKOL: async (input: Record<string, unknown>) => unwrap(await api.post<{ data: KOL }>('/admin/kols', input)),
  adminUpdateKOL: async (id: string, input: Record<string, unknown>) => unwrap(await api.patch<{ data: KOL }>(`/admin/kols/${id}`, input)),
  adminAddSocial: async (id: string, input: Record<string, unknown>) => unwrap(await api.post(`/admin/kols/${id}/social-accounts`, input)),
  adminAddScore: async (id: string, input: Record<string, unknown>) => unwrap(await api.post(`/admin/kols/${id}/scores`, input)),
  adminRecalculate: async (id: string) => unwrap(await api.post(`/admin/kols/${id}/recalculate`)),
  adminAddPrediction: async (id: string, input: Record<string, unknown>) => unwrap(await api.post(`/admin/kols/${id}/predictions`, input)),
  adminEvaluatePrediction: async (id: string, predictionId: string, input: Record<string, unknown>) => unwrap(await api.patch(`/admin/kols/${id}/predictions/${predictionId}`, input)),
  adminAddRisk: async (id: string, input: Record<string, unknown>) => unwrap(await api.post(`/admin/kols/${id}/risk-events`, input)),
  adminAddAudience: async (id: string, input: Record<string, unknown>) => unwrap(await api.post(`/admin/kols/${id}/audience-metrics`, input)),
};

export const workspaceError = (error: unknown, fallback = 'İşlem tamamlanamadı.') => getApiErrorMessage(error, fallback);
