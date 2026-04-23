import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import TickerTape from './components/TickerTape';
import Dashboard from './components/Dashboard';
import Ecosystem from './components/Ecosystem';
import Launchpad from './components/Launchpad';
import Chat from './components/Chat';
import Insights from './components/Insights';
import ArticleDetail from './components/ArticleDetail';
import Profile from './components/Profile';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <main className="pt-24 pb-20 px-8 max-w-[1600px] mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ecosystem" element={<Ecosystem />} />
            <Route path="/ecosystem/launchpad" element={<Launchpad />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/insights/:id" element={<ArticleDetail />} />
            <Route path="/videos" element={<div className="flex items-center justify-center h-[60vh] text-on-surface-variant font-headline text-xl">Video Hub Coming Soon</div>} />
            <Route path="/academy" element={<div className="flex items-center justify-center h-[60vh] text-on-surface-variant font-headline text-xl">Academy Coming Soon</div>} />
          </Routes>
        </main>
        <TickerTape />
      </div>
    </Router>
  );
}
