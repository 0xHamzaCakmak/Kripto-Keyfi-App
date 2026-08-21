import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import PrivacyConsent from './components/PrivacyConsent';
import AnalyticsTracker from './components/AnalyticsTracker';
import Insights, { SavedNewsPage } from './components/Insights';
import { AdminRoute, ProtectedRoute } from './auth/RouteGuards';

const Home = lazy(() => import('./components/Home'));
const Ecosystem = lazy(() => import('./components/Ecosystem'));
const Chat = lazy(() => import('./components/Chat'));
const TickerTape = lazy(() => import('./components/TickerTape'));
const ArticleDetail = lazy(() => import('./components/ArticleDetail'));
const GamesPage = lazy(() => import('./components/Games'));
const UpDownGamePage = lazy(() => import('./components/Games').then((module) => ({ default: module.UpDownGamePage })));
const WhaleGuessPage = lazy(() => import('./components/WhaleGuess'));
const TransferVolumeGuessPage = lazy(() => import('./components/TransferVolumeGuess'));
const ScamOrSafePage = lazy(() => import('./components/ScamOrSafe'));
const GasFeeChallengePage = lazy(() => import('./components/GasFeeChallenge'));
const PlaceholderDashboard = lazy(() => import('./components/Profile').then((module) => ({ default: module.PlaceholderDashboard })));
const TokenAirdropManager = lazy(() => import('./components/TokenAirdropManager'));
const VideoCenter = lazy(() => import('./components/Videos'));
const ChannelProfile = lazy(() => import('./components/Videos').then((module) => ({ default: module.ChannelProfile })));
const SavedVideosPage = lazy(() => import('./components/Videos').then((module) => ({ default: module.SavedVideosPage })));
const VideoDetail = lazy(() => import('./components/Videos').then((module) => ({ default: module.VideoDetail })));
const AcademyHome = lazy(() => import('./components/Academy'));
const AcademyArticleDetail = lazy(() => import('./components/Academy').then((module) => ({ default: module.AcademyArticleDetail })));
const AcademySeriesDetail = lazy(() => import('./components/Academy').then((module) => ({ default: module.AcademySeriesDetail })));
const AcademySeriesList = lazy(() => import('./components/Academy').then((module) => ({ default: module.AcademySeriesList })));
const GlossaryDetail = lazy(() => import('./components/Academy').then((module) => ({ default: module.GlossaryDetail })));
const GlossaryPage = lazy(() => import('./components/Academy').then((module) => ({ default: module.GlossaryPage })));
const ReadingList = lazy(() => import('./components/Academy').then((module) => ({ default: module.ReadingList })));
const LoginPage = lazy(() => import('./components/Auth').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./components/Auth').then((module) => ({ default: module.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./components/Auth').then((module) => ({ default: module.ForgotPasswordPage })));
const OnboardingPage = lazy(() => import('./components/Auth').then((module) => ({ default: module.OnboardingPage })));
const ConnectWalletPage = lazy(() => import('./components/Auth').then((module) => ({ default: module.ConnectWalletPage })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AdminUsers = lazy(() => import('./components/AdminUsers'));
const AdminUserDetail = lazy(() => import('./components/AdminUserDetail'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const TradingBotDashboard = lazy(() => import('./components/TradingBotDashboard'));
const TradingBots = lazy(() => import('./components/TradingBots'));
const TradingBotGuide = lazy(() => import('./components/TradingBotGuide'));
const AdminNewsSources = lazy(() => import('./components/AdminNewsSources'));
const AdminVideos = lazy(() => import('./components/AdminVideos'));
const AdminYoutubeChannels = lazy(() => import('./components/AdminYoutubeChannels'));
const AdminYoutubeScoring = lazy(() => import('./components/AdminYoutubeScoring'));
const AdminCreatorApplications = lazy(() => import('./components/AdminCreatorApplications'));
const ExchangeAccounts = lazy(() => import('./components/ExchangeAccounts'));
const ManualTrading = lazy(() => import('./components/ManualTrading'));
const OpenOrdersPage = lazy(() => import('./components/TradingActivity').then((module) => ({ default: module.OpenOrdersPage })));
const OpenPositionsPage = lazy(() => import('./components/TradingActivity').then((module) => ({ default: module.OpenPositionsPage })));
const GridBotsPage = lazy(() => import('./components/TradingAdminPhases').then((module) => ({ default: module.GridBotsPage })));
const TradingProfitLossPage = lazy(() => import('./components/TradingAdminPhases').then((module) => ({ default: module.TradingProfitLossPage })));
const TradingRiskManagementPage = lazy(() => import('./components/TradingAdminPhases').then((module) => ({ default: module.TradingRiskManagementPage })));
const TradingSystemStatusPage = lazy(() => import('./components/TradingAdminPhases').then((module) => ({ default: module.TradingSystemStatusPage })));
const AITradingLayout = lazy(() => import('./components/ai-trading/AITradingLayout'));
const AITradingOverview = lazy(() => import('./components/ai-trading/AITradingOverview'));
const AITradingArena = lazy(() => import('./components/ai-trading/AITradingArena'));
const AITradingChampions = lazy(() => import('./components/ai-trading/AITradingChampions'));
const AITradingEvolution = lazy(() => import('./components/ai-trading/AITradingEvolution'));
const UserProfilePage = lazy(() => import('./components/UserProfilePage'));
const KOLExplorer = lazy(() => import('./components/KOLIntelligence'));
const KOLProfile = lazy(() => import('./components/KOLIntelligence').then((module) => ({ default: module.KOLProfile })));
const ScoreMethodology = lazy(() => import('./components/KOLIntelligence').then((module) => ({ default: module.ScoreMethodology })));
const KOLDataSources = lazy(() => import('./components/KOLDataSources'));
const CampaignsPage = lazy(() => import('./components/KOLWorkspaces'));
const CampaignDetailPage = lazy(() => import('./components/CampaignDetailFull'));
const KOLDashboardPage = lazy(() => import('./components/KOLWorkspaces').then((module) => ({ default: module.KOLDashboardPage })));
const AdminKOLWorkspace = lazy(() => import('./components/KOLWorkspaces').then((module) => ({ default: module.AdminKOLWorkspace })));
const AdminPredictionReview = lazy(() => import('./components/AdminPredictionReview'));
const AdminCampaignManagement = lazy(() => import('./components/AdminCampaignManagement'));
const KOLModuleOverview = lazy(() => import('./components/KOLModuleOverview'));
const TradingModuleLayout = lazy(() => import('./components/AdminModuleLayout').then((module) => ({ default: module.TradingModuleLayout })));
const KolModuleLayout = lazy(() => import('./components/AdminModuleLayout').then((module) => ({ default: module.KolModuleLayout })));
const VideoModuleLayout = lazy(() => import('./components/AdminModuleLayout').then((module) => ({ default: module.VideoModuleLayout })));
const AnalyticsModuleLayout = lazy(() => import('./components/AdminModuleLayout').then((module) => ({ default: module.AnalyticsModuleLayout })));
const AnalyticsOverview = lazy(() => import('./components/AdminAnalytics'));
const AnalyticsTraffic = lazy(() => import('./components/AdminAnalytics').then((module) => ({ default: module.AnalyticsTraffic })));
const AnalyticsFunnel = lazy(() => import('./components/AdminAnalytics').then((module) => ({ default: module.AnalyticsFunnel })));
const AnalyticsContent = lazy(() => import('./components/AdminAnalytics').then((module) => ({ default: module.AnalyticsContent })));
const ChatModuleLayout = lazy(() => import('./components/AdminModuleLayout').then((module) => ({ default: module.ChatModuleLayout })));
const AdminChatRooms = lazy(() => import('./components/AdminChatRooms'));

export default function App() {
  return (
    <Router>
      <AnalyticsTracker />
      <div className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <main className="mx-auto max-w-[1600px] px-4 pb-20 pt-24 sm:px-6 lg:px-8">
          <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-surface-high" aria-label="Sayfa yükleniyor" />}><Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
              <Route path="trading" element={<TradingModuleLayout />}>
                <Route index element={<TradingBotDashboard />} />
                <Route path="bots" element={<TradingBots />} />
                <Route path="guide" element={<TradingBotGuide />} />
                <Route path="manual" element={<ManualTrading />} />
                <Route path="exchanges" element={<ExchangeAccounts />} />
                <Route path="orders" element={<OpenOrdersPage />} />
                <Route path="positions" element={<OpenPositionsPage />} />
                <Route path="grid" element={<GridBotsPage />} />
                <Route path="profit-loss" element={<TradingProfitLossPage />} />
                <Route path="risk" element={<TradingRiskManagementPage />} />
                <Route path="system" element={<TradingSystemStatusPage />} />
                <Route path="ai" element={<AITradingLayout />}>
                  <Route index element={<AITradingOverview />} />
                  <Route path="arena" element={<AITradingArena />} />
                  <Route path="champions" element={<AITradingChampions />} />
                  <Route path="evolution" element={<AITradingEvolution />} />
                </Route>
                <Route path="accounts" element={<Navigate to="/admin/trading/exchanges" replace />} />
                <Route path="bots/guide" element={<Navigate to="/admin/trading/guide" replace />} />
              </Route>
              <Route path="news/sources" element={<AdminNewsSources />} />
              <Route path="videos" element={<VideoModuleLayout />}>
                <Route index element={<AdminVideos />} />
                <Route path="channels" element={<AdminYoutubeChannels />} />
                <Route path="scoring" element={<AdminYoutubeScoring />} />
                <Route path="creators" element={<AdminCreatorApplications />} />
              </Route>
              <Route path="kol" element={<KolModuleLayout />}>
                <Route index element={<KOLModuleOverview />} />
                <Route path="intelligence" element={<AdminKOLWorkspace />} />
                <Route path="predictions" element={<AdminPredictionReview />} />
                <Route path="campaigns" element={<AdminCampaignManagement />} />
              </Route>
              <Route path="kols" element={<Navigate to="/admin/kol/intelligence" replace />} />
              <Route path="kols/predictions" element={<Navigate to="/admin/kol/predictions" replace />} />
              <Route path="kols/campaigns" element={<Navigate to="/admin/kol/campaigns" replace />} />
              <Route path="analytics" element={<AnalyticsModuleLayout />}>
                <Route index element={<AnalyticsOverview />} />
                <Route path="pages" element={<AnalyticsTraffic type="top-pages" />} />
                <Route path="referrers" element={<AnalyticsTraffic type="referrers" />} />
                <Route path="devices" element={<AnalyticsTraffic type="devices" />} />
                <Route path="funnel" element={<AnalyticsFunnel />} />
                <Route path="content" element={<AnalyticsContent />} />
              </Route>
              <Route path="chat" element={<ChatModuleLayout />}>
                <Route index element={<AdminChatRooms />} />
              </Route>
            </Route>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/connect-wallet" element={<ConnectWalletPage />} />
            <Route path="/assets" element={<ProtectedRoute feature="My Assets"><PlaceholderDashboard title="My Assets hazırlanıyor" /></ProtectedRoute>} />
            <Route path="/my-assets" element={<ProtectedRoute feature="My Assets"><PlaceholderDashboard title="My Assets hazırlanıyor" /></ProtectedRoute>} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/up-down" element={<UpDownGamePage />} />
            <Route path="/games/eth-up-down" element={<UpDownGamePage assetId="eth" />} />
            <Route path="/games/whale-guess" element={<WhaleGuessPage />} />
            <Route path="/games/transfer-volume-guess" element={<TransferVolumeGuessPage />} />
            <Route path="/games/scam-or-safe" element={<ScamOrSafePage />} />
            <Route path="/games/gas-fee-challenge" element={<GasFeeChallengePage />} />
            <Route path="/ecosystem" element={<Ecosystem />} />
            <Route path="/ecosystem/:section" element={<Ecosystem />} />
            <Route path="/ecosystem/:section/:tool" element={<Ecosystem />} />
            <Route path="/ecosystem/launchpad" element={<Ecosystem />} />
            <Route path="/chat" element={<ProtectedRoute feature="Sohbet"><Chat /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute feature="Profil"><UserProfilePage /></ProtectedRoute>} />
            <Route path="/kol-intelligence" element={<KOLExplorer />} />
            <Route path="/kol-intelligence/methodology" element={<ScoreMethodology />} />
            <Route path="/kol-intelligence/data-sources" element={<KOLDataSources />} />
            <Route path="/kol/:slug" element={<KOLProfile />} />
            <Route path="/company/campaigns" element={<ProtectedRoute feature="Kampanyalar"><CampaignsPage /></ProtectedRoute>} />
            <Route path="/company/campaigns/:id" element={<ProtectedRoute feature="Kampanya detayı"><CampaignDetailPage /></ProtectedRoute>} />
            <Route path="/kol/dashboard" element={<ProtectedRoute feature="KOL Dashboard"><KOLDashboardPage /></ProtectedRoute>} />
            <Route path="/identity" element={<ProtectedRoute feature="Profil"><UserProfilePage /></ProtectedRoute>} />
            <Route path="/u/:username" element={<PlaceholderDashboard title="Public profil hazırlanıyor" />} />
            <Route path="/creator/apply" element={<Navigate to="/profile" replace />} />
            <Route path="/creator/verify" element={<Navigate to="/profile" replace />} />
            <Route path="/creator/dashboard" element={<Navigate to="/profile" replace />} />
            <Route path="/author/apply" element={<ProtectedRoute feature="Author başvurusu"><PlaceholderDashboard title="Author Başvuru Ekranı Hazırlanıyor" /></ProtectedRoute>} />
            <Route path="/project/apply" element={<ProtectedRoute feature="Project Owner başvurusu"><PlaceholderDashboard title="Project Owner Başvuru Ekranı Hazırlanıyor" /></ProtectedRoute>} />
            <Route path="/developer/apply" element={<ProtectedRoute feature="Developer başvurusu"><PlaceholderDashboard title="Developer Başvuru Ekranı Hazırlanıyor" /></ProtectedRoute>} />
            <Route path="/author/dashboard" element={<ProtectedRoute feature="Author Dashboard"><PlaceholderDashboard title="Author Dashboard" /></ProtectedRoute>} />
            <Route path="/project/dashboard" element={<ProtectedRoute feature="Project Owner Dashboard"><PlaceholderDashboard title="Project Owner Dashboard" /></ProtectedRoute>} />
            <Route path="/developer/dashboard" element={<ProtectedRoute feature="Developer Dashboard"><PlaceholderDashboard title="Developer Dashboard" /></ProtectedRoute>} />
            <Route path="/settings/security" element={<ProtectedRoute feature="Security Settings"><PlaceholderDashboard title="Security Settings" /></ProtectedRoute>} />
            <Route path="/settings/wallets" element={<ProtectedRoute feature="Wallet Settings"><PlaceholderDashboard title="Wallet Settings" /></ProtectedRoute>} />
            <Route path="/blog/*" element={<LegacyNewsRedirect />} />
            <Route path="/saved-news" element={<SavedNewsPage />} />
            <Route path="/insights/*" element={<LegacyNewsRedirect />} />
            <Route path="/haberler" element={<Insights />} />
            <Route path="/haberler/kategori/:category" element={<Insights />} />
            <Route path="/haberler/etiket/:tag" element={<Insights />} />
            <Route path="/haberler/konu/:topic" element={<Insights />} />
            <Route path="/haberler/:slug" element={<ArticleDetail />} />
            <Route path="/videos" element={<VideoCenter />} />
            <Route path="/videos/category/:category" element={<VideoCenter />} />
            <Route path="/videos/:id" element={<VideoDetail />} />
            <Route path="/creators/:creatorSlug" element={<ChannelProfile />} />
            <Route path="/watch-later" element={<SavedVideosPage type="watchLater" />} />
            <Route path="/favorites" element={<SavedVideosPage type="favorites" />} />
            <Route path="/followed-channels" element={<SavedVideosPage type="followedChannels" />} />
            <Route path="/academy" element={<AcademyHome />} />
            <Route path="/academy/category/:category" element={<AcademyHome />} />
            <Route path="/academy/tag/:tag" element={<AcademyHome />} />
            <Route path="/academy/articles/:slug" element={<AcademyArticleDetail />} />
            <Route path="/academy/series" element={<AcademySeriesList />} />
            <Route path="/academy/series/:slug" element={<AcademySeriesDetail />} />
            <Route path="/academy/glossary" element={<GlossaryPage />} />
            <Route path="/academy/glossary/:slug" element={<GlossaryDetail />} />
            <Route path="/academy/reading-list" element={<ReadingList />} />
            <Route path="/token-airdrop-manager" element={<TokenAirdropManager />} />
          </Routes></Suspense>
        </main>
        <Suspense fallback={null}><TickerTape /></Suspense>
        <PrivacyConsent />
      </div>
    </Router>
  );
}

function LegacyNewsRedirect() {
  const { pathname } = useLocation();
  const path = pathname.replace(/^\/(?:blog|insights)\/?/, '');
  if (!path) return <Navigate to="/haberler" replace />;
  if (path.startsWith('category/')) return <Navigate to={`/haberler/kategori/${path.slice('category/'.length)}`} replace />;
  if (path.startsWith('tag/')) return <Navigate to={`/haberler/etiket/${path.slice('tag/'.length)}`} replace />;
  return <Navigate to={`/haberler/${path}`} replace />;
}
