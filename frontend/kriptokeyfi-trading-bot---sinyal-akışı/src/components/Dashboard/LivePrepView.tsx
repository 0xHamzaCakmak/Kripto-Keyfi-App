import React from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, KeyRound, Server, Zap, ArrowRight } from 'lucide-react';

export const LivePrepView: React.FC = () => {
  const checklist = [
    {
      title: 'Binance Live API Anahtarları ve IP Kısıtlaması',
      status: 'TAMAMLANDI',
      pass: true,
      desc: 'Ed25519 asimetrik anahtar doğrulaması ve sunucu statik IP adresi bağlandı.',
    },
    {
      title: 'Maksimum Kaldıraç ve Margin Kotası Sınırı (Max 15x)',
      status: 'ONAYLANDI',
      pass: true,
      desc: 'Risk motoru hesap genelinde 15x üzerindeki marjin taleplerini otomatik bloke eder.',
    },
    {
      title: 'Acil Durdurma (Global Kill-Switch) Tetikleyicisi',
      status: 'DEVREDE',
      pass: true,
      desc: 'Günlük hesap kaybı %5 seviyesine ulaştığında tüm açık pozisyonlar anında market fiyattan kapatılır.',
    },
    {
      title: 'Bakiye Teminat Yeterliliği (Canlı Bakiye Ayrımı)',
      status: 'BEKLİYOR',
      pass: false,
      desc: 'Canlı hesap için minimum $1,000 USDT likit marjin provizyonu gerekmektedir.',
    },
  ];

  return (
    <div id="live-prep-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#f0b90b]/40 flex items-center justify-center text-[#f0b90b] shadow-[0_0_15px_rgba(240,185,11,0.25)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Canlı Piyasaya Geçiş Hazırlığı (Live Prep Checklist)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30">
                PROD GÜVENLİK
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Testnet botlarının gerçek sermaye ile canlı emir iletimine açılması için gerekli güvenlik adımları.
            </p>
          </div>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(2,192,118,0.4)] transition-all">
          <span>Canlı Modu Aktifleştir</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Checklist Items */}
      <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl space-y-3">
        {checklist.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
              item.pass
                ? 'bg-[#0b0e11]/80 border-[#02c076]/30'
                : 'bg-[#0b0e11]/80 border-[#f0b90b]/30'
            }`}
          >
            <div className="flex items-start gap-3">
              {item.pass ? (
                <CheckCircle2 className="w-5 h-5 text-[#02c076] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[#f0b90b] shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-xs font-bold text-[#eaecef]">{item.title}</h4>
                <p className="text-[11px] text-[#848e9c] mt-0.5">{item.desc}</p>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-['JetBrains_Mono',monospace] shrink-0 ${
                item.pass
                  ? 'bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30'
                  : 'bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30'
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
