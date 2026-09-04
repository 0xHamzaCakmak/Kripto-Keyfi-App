import React, { useState } from 'react';
import { ExchangeAccount } from '../../types';
import { Building2, Plus, CheckCircle2, AlertCircle, RefreshCw, Key, ShieldCheck } from 'lucide-react';

export const ExchangeAccountsView: React.FC = () => {
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([
    {
      id: 'acc-1',
      name: 'Binance Testnet (Ana Geliştirici)',
      exchange: 'Binance Testnet',
      status: 'CONNECTED',
      totalBalance: 13492.8,
      availableBalance: 10248.5,
      currency: 'USDT',
      latencyMs: 42,
      apiKeyMasked: 'vmK7...8x9L (Demo API)',
      isTestnet: true,
    },
    {
      id: 'acc-2',
      name: 'Binance Live (Kurumsal Vadeli)',
      exchange: 'Binance Live',
      status: 'CONNECTED',
      totalBalance: 25000.0,
      availableBalance: 25000.0,
      currency: 'USDT',
      latencyMs: 38,
      apiKeyMasked: 'ak90...mP21 (Live API)',
      isTestnet: false,
    },
    {
      id: 'acc-3',
      name: 'Bybit Unified Account',
      exchange: 'Bybit',
      status: 'CONNECTED',
      totalBalance: 8200.0,
      availableBalance: 8200.0,
      currency: 'USDT',
      latencyMs: 65,
      apiKeyMasked: 'byb_...789A',
      isTestnet: false,
    },
  ]);

  return (
    <div id="exchange-accounts-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#00d2ff]/40 flex items-center justify-center text-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.25)]">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Borsa Hesapları & API Entegrasyonları
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00d2ff]/15 text-[#00d2ff] border border-[#00d2ff]/30">
                MULTI-EXCHANGE
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Binance Testnet, Live ve Bybit hesaplarınızın bağlantı durumu, gecikme süresi ve bakiye dağılımı.
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 bg-[#00d2ff] hover:bg-cyan-400 text-[#0b0e11] font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(0,210,255,0.3)] transition-all">
          <Plus className="w-4 h-4" />
          <span>Yeni Borsa / API Ekle</span>
        </button>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#eaecef]">{acc.name}</h3>
                  <span className="text-[10px] text-[#848e9c]">{acc.exchange}</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#02c076] bg-[#02c076]/15 border border-[#02c076]/30 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3" />
                  {acc.status}
                </span>
              </div>

              <div className="space-y-2 text-xs font-['JetBrains_Mono',monospace] mb-4">
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Toplam Bakiye:</span>
                  <span className="text-[#eaecef] font-bold">${acc.totalBalance.toLocaleString()} {acc.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Kullanılabilir:</span>
                  <span className="text-[#02c076] font-bold">${acc.availableBalance.toLocaleString()} {acc.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Gecikme (Ping):</span>
                  <span className="text-[#00d2ff] font-bold">{acc.latencyMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">API Maskesi:</span>
                  <span className="text-[#848e9c]">{acc.apiKeyMasked}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2b3139] flex items-center justify-between">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${acc.isTestnet ? 'bg-[#f0b90b]/15 text-[#f0b90b]' : 'bg-[#02c076]/15 text-[#02c076]'}`}>
                {acc.isTestnet ? 'DEMO TESTNET' : 'CANLI HESAP'}
              </span>

              <button className="text-[11px] font-bold text-[#00d2ff] hover:underline">
                Ayarları Düzenle
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
