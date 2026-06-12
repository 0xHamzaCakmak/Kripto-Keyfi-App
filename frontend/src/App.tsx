import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import TickerTape from './components/TickerTape';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import Ecosystem from './components/Ecosystem';
import Chat from './components/Chat';
import Insights, { SavedNewsPage } from './components/Insights';
import ArticleDetail from './components/ArticleDetail';
import GamesPage, { UpDownGamePage } from './components/Games';
import WhaleGuessPage from './components/WhaleGuess';
import TransferVolumeGuessPage from './components/TransferVolumeGuess';
import ScamOrSafePage from './components/ScamOrSafe';
import GasFeeChallengePage from './components/GasFeeChallenge';
import Profile, { CreatorApplyPage, CreatorDashboard, CreatorVerificationPage, PlaceholderDashboard, PublicProfile } from './components/Profile';
import VideoCenter, { ChannelProfile, SavedVideosPage, VideoDetail } from './components/Videos';
import AcademyHome, { AcademyArticleDetail, AcademySeriesDetail, AcademySeriesList, GlossaryDetail, GlossaryPage, ReadingList } from './components/Academy';
import { ConnectWalletPage, ForgotPasswordPage, LoginPage, LoginRequiredPage, OnboardingPage, RegisterPage } from './components/Auth';
import { getAuthState } from './services/authService';

function ProtectedRoute({ children, feature }: { children: React.ReactNode; feature: string }) {
  return getAuthState() ? <>{children}</> : <LoginRequiredPage feature={feature} />;
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <main className="pt-24 pb-20 px-8 max-w-[1600px] mx-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/connect-wallet" element={<ConnectWalletPage />} />
            <Route path="/assets" element={<ProtectedRoute feature="My Assets"><Dashboard /></ProtectedRoute>} />
            <Route path="/my-assets" element={<ProtectedRoute feature="My Assets"><Dashboard /></ProtectedRoute>} />
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
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile" element={<ProtectedRoute feature="Identity Center"><Profile /></ProtectedRoute>} />
            <Route path="/identity" element={<ProtectedRoute feature="Identity Center"><Profile /></ProtectedRoute>} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/creator/apply" element={<ProtectedRoute feature="Creator başvurusu"><CreatorApplyPage /></ProtectedRoute>} />
            <Route path="/creator/verify" element={<ProtectedRoute feature="Creator doğrulama"><CreatorVerificationPage /></ProtectedRoute>} />
            <Route path="/creator/dashboard" element={<ProtectedRoute feature="Creator Dashboard"><CreatorDashboard /></ProtectedRoute>} />
            <Route path="/author/apply" element={<ProtectedRoute feature="Author başvurusu"><PlaceholderDashboard title="Author Başvuru Ekranı Hazırlanıyor" /></ProtectedRoute>} />
            <Route path="/project/apply" element={<ProtectedRoute feature="Project Owner başvurusu"><PlaceholderDashboard title="Project Owner Başvuru Ekranı Hazırlanıyor" /></ProtectedRoute>} />
            <Route path="/developer/apply" element={<ProtectedRoute feature="Developer başvurusu"><PlaceholderDashboard title="Developer Başvuru Ekranı Hazırlanıyor" /></ProtectedRoute>} />
            <Route path="/author/dashboard" element={<ProtectedRoute feature="Author Dashboard"><PlaceholderDashboard title="Author Dashboard" /></ProtectedRoute>} />
            <Route path="/project/dashboard" element={<ProtectedRoute feature="Project Owner Dashboard"><PlaceholderDashboard title="Project Owner Dashboard" /></ProtectedRoute>} />
            <Route path="/developer/dashboard" element={<ProtectedRoute feature="Developer Dashboard"><PlaceholderDashboard title="Developer Dashboard" /></ProtectedRoute>} />
            <Route path="/settings/security" element={<ProtectedRoute feature="Security Settings"><PlaceholderDashboard title="Security Settings" /></ProtectedRoute>} />
            <Route path="/settings/wallets" element={<ProtectedRoute feature="Wallet Settings"><PlaceholderDashboard title="Wallet Settings" /></ProtectedRoute>} />
            <Route path="/blog" element={<Insights />} />
            <Route path="/blog/category/:category" element={<Insights />} />
            <Route path="/blog/tag/:tag" element={<Insights />} />
            <Route path="/blog/:slug" element={<ArticleDetail />} />
            <Route path="/saved-news" element={<SavedNewsPage />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/insights/:id" element={<ArticleDetail />} />
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
          </Routes>
        </main>
        <TickerTape />
      </div>
    </Router>
  );
}
