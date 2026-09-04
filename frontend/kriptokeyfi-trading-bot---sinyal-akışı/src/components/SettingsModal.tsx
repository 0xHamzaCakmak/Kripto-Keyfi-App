import React, { useState } from 'react';
import { X, Code2, Wifi, Zap, Check, Copy } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'websocket' | 'code' | 'params'>('websocket');
  const [copied, setCopied] = useState(false);
  const [wsUrl, setWsUrl] = useState('wss://api.kriptokeyfi.com/v1/stream/signals');
  const [apiKey, setApiKey] = useState('demo_bot_live_token_77a9b');

  if (!isOpen) return null;

  const codeSnippet = `import { SignalFlow, SignalFeed } from './components/SignalFlow';
import { signalEmitter } from './services/mockSignalEngine';

// 1. WebSocket veya Backend SSE dinleyicisi:
const ws = new WebSocket('${wsUrl}');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data formatı: { symbol: 'BTC/USDT', decision: 'LONG', confidence: 82, price: 69120 }
  signalEmitter.emit(data);
};

// 2. React component kullanımı:
export function MyTradingDashboard() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-8">
        <SignalFlow />
      </div>
      <div className="col-span-4">
        <SignalFeed />
      </div>
    </div>
  );
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b3139] bg-[#0b0e11]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#1e2329] border border-[#00d2ff]/40 text-[#00d2ff]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#eaecef]">Trading Bot & Sinyal Akışı Entegrasyonu</h3>
              <p className="text-xs text-[#848e9c]">Backend API, WebSocket ve Frontend Kod Rehberi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#848e9c] hover:text-[#eaecef] bg-[#1e2329] hover:bg-[#2b3139] transition-colors border border-[#2b3139]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2b3139] px-6 bg-[#0b0e11]">
          <button
            onClick={() => setActiveTab('websocket')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'websocket'
                ? 'border-[#00d2ff] text-[#00d2ff]'
                : 'border-transparent text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span>WebSocket / Canlı Akış</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-[#00d2ff] text-[#00d2ff]'
                : 'border-transparent text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Frontend Kod Entegrasyonu</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'websocket' && (
            <div className="space-y-4">
              <p className="text-[#eaecef]">
                Sinyal akışı komponenti tamamen bağımsız tasarlanmıştır. Botunuzun backend karar motorundan gelen
                sinyalleri WebSocket, SSE veya REST polling üzerinden anında alıp lazer/partikül ışınlarına dönüştürür.
              </p>

              <div className="space-y-3 bg-[#0b0e11]/80 p-4 rounded-xl border border-[#2b3139]">
                <div>
                  <label className="block text-[11px] font-bold text-[#848e9c] uppercase mb-1">
                    WebSocket Akış URL'i
                  </label>
                  <input
                    type="text"
                    value={wsUrl}
                    onChange={(e) => setWsUrl(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-[#eaecef] font-['JetBrains_Mono',monospace] text-xs focus:outline-none focus:border-[#00d2ff]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#848e9c] uppercase mb-1">
                    API / Stream Token (Opsiyonel)
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-2 text-[#eaecef] font-['JetBrains_Mono',monospace] text-xs focus:outline-none focus:border-[#00d2ff]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#02c076]/10 border border-[#02c076]/30 rounded-xl text-[#02c076]">
                ✓ <strong>Hazır & Dinamik:</strong> Dakikada 40-50+ sinyal geldiğinde DOM'a yüzlerce düğüm eklemek
                yerine yüksek performanslı Canvas 2D partikül motoru kullanarak 60 FPS akıcı neon akış sağlar.
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#848e9c] font-semibold">React Projenize Nasıl Dahil Edilir:</span>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#0b0e11] hover:bg-[#2b3139] text-[#00d2ff] rounded-lg border border-[#2b3139] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#02c076]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
                </button>
              </div>

              <pre className="p-4 bg-[#0b0e11] rounded-xl border border-[#2b3139] text-[#eaecef] font-['JetBrains_Mono',monospace] text-[11px] overflow-x-auto">
                <code>{codeSnippet}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#2b3139] bg-[#0b0e11] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#00d2ff] hover:bg-cyan-400 text-[#0b0e11] font-bold rounded-lg transition-colors text-xs shadow-[0_0_12px_rgba(0,210,255,0.4)]"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
