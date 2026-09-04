import React from 'react';
import { BookOpen, Sparkles, HelpCircle, CheckCircle, Shield, Zap } from 'lucide-react';

export const BotGuideView: React.FC = () => {
  const guides = [
    {
      title: '1. AI Momentum & Volatilite Modeli Nasıl Karar Alır?',
      desc: 'Momentum motoru; 15 dakikalık ve 1 saatlik mumlarda EMA200 üzerindeki RSI sapmalarını, order book derinlik asimetrisini ve vadeli fonlama oranını (Funding Rate) eş zamanlı tarar. 3 indikatörün 2 tanesi aynı yönde %75+ güven sağladığında otomatik sinyal lazeri üretir.',
    },
    {
      title: '2. Otomatik Risk & Trailing Stop Mekanizması',
      desc: 'Her açılan pozisyonda otomatik %1.5 stop-loss ve %3.5 kâr al (TP) emri borsaya iletilir. Pozisyon %2.0 kâra geçtiğinde stop seviyesi otomatik olarak giriş fiyatına (Breakeven) çekilerek sermaye riski sıfırlanır.',
    },
    {
      title: '3. Testnet ile Canlı Borsa Arasındaki Farklar',
      desc: 'Testnet ortamında Binance Demo API kullanılır ve sanal USDT ile gerçek tahta fiyatları simüle edilir. Canlı moda geçiş yapıldığında sistem doğrudan Binance Futures canlı API anahtarlarınıza bağlanarak gerçek emir iletimi yapar.',
    },
  ];

  return (
    <div id="bot-guide-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#00d2ff]/40 flex items-center justify-center text-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.25)]">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Bot Kullanım Rehberi & Strateji Kılavuzu
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00d2ff]/15 text-[#00d2ff] border border-[#00d2ff]/30">
                DOKÜMANTASYON
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Botların çalışma prensibi, parametre açıklamaları ve profesyonel risk yönetimi ilkeleri.
            </p>
          </div>
        </div>
      </div>

      {/* Guide Content Cards */}
      <div className="space-y-4">
        {guides.map((g, idx) => (
          <div
            key={idx}
            className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-6 shadow-xl space-y-2"
          >
            <h3 className="text-sm font-bold text-[#eaecef] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#f0b90b]" />
              <span>{g.title}</span>
            </h3>
            <p className="text-xs text-[#848e9c] leading-relaxed pl-6">{g.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
