import React, { useState } from 'react';
import { OrderItem } from '../../types';
import { getCoinIcon } from '../CoinIcons';
import { Clock, CheckCircle2, XCircle, Trash2, Filter } from 'lucide-react';

export const OrdersFullView: React.FC = () => {
  const [orders, setOrders] = useState<OrderItem[]>([
    {
      id: 'ord-101',
      timestamp: '12:44:10',
      symbol: 'BTCUSDT',
      type: 'LIMIT',
      side: 'BUY',
      price: 63200.0,
      amount: 0.05,
      filled: 0,
      status: 'OPEN',
      reduceOnly: false,
    },
    {
      id: 'ord-102',
      timestamp: '12:35:00',
      symbol: 'ETHUSDT',
      type: 'TAKE_PROFIT',
      side: 'SELL',
      price: 3620.0,
      amount: 0.8,
      filled: 0,
      status: 'OPEN',
      reduceOnly: true,
    },
    {
      id: 'ord-103',
      timestamp: '12:15:22',
      symbol: 'SOLUSDT',
      type: 'MARKET',
      side: 'BUY',
      price: 154.2,
      amount: 4.0,
      filled: 4.0,
      status: 'FILLED',
      reduceOnly: false,
    },
    {
      id: 'ord-104',
      timestamp: '11:50:00',
      symbol: 'NEARUSDT',
      type: 'LIMIT',
      side: 'BUY',
      price: 4.5,
      amount: 50.0,
      filled: 0,
      status: 'CANCELED',
      reduceOnly: false,
    },
  ]);

  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
    return true;
  });

  const handleCancelOrder = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: 'CANCELED' } : o))
    );
  };

  const handleCancelAll = () => {
    setOrders((prev) =>
      prev.map((o) => (o.status === 'OPEN' ? { ...o, status: 'CANCELED' } : o))
    );
  };

  return (
    <div id="orders-full-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#f0b90b]/40 flex items-center justify-center text-[#f0b90b] shadow-[0_0_15px_rgba(240,185,11,0.25)]">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Emirler & İşlem Geçmişi
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30">
                BEKLEYEN & DOLAN EMİRLER
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Açık limit emirleri, tetiklenen stop emirleri ve geçmiş işlem kayıtları.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCancelAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#f84960]/20 hover:bg-[#f84960]/30 text-[#f84960] border border-[#f84960]/40 rounded-xl text-xs font-bold transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Tüm Bekleyenleri İptal Et</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['ALL', 'OPEN', 'FILLED', 'CANCELED'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterStatus === st
                ? 'bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/40'
                : 'bg-[#1e2329] text-[#848e9c] border border-[#2b3139] hover:text-[#eaecef]'
            }`}
          >
            {st === 'ALL'
              ? 'Tüm Emirler'
              : st === 'OPEN'
              ? 'Açık Emirler'
              : st === 'FILLED'
              ? 'Gerçekleşenler'
              : 'İptal Edilenler'}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-['JetBrains_Mono',monospace]">
            <thead>
              <tr className="bg-[#0b0e11] text-[11px] font-bold text-[#848e9c] uppercase tracking-wider border-b border-[#2b3139]">
                <th className="py-3 px-4 font-['Inter',sans-serif]">ZAMAN</th>
                <th className="py-3 px-4 font-['Inter',sans-serif]">PARİTE / TİP</th>
                <th className="py-3 px-4">YÖN</th>
                <th className="py-3 px-4 text-right">FİYAT</th>
                <th className="py-3 px-4 text-right">MİKTAR</th>
                <th className="py-3 px-4 text-right">DOLULUK</th>
                <th className="py-3 px-4 text-center font-['Inter',sans-serif]">DURUM</th>
                <th className="py-3 px-4 text-center font-['Inter',sans-serif]">İŞLEM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b3139]">
              {filteredOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-[#2b3139]/40 transition-colors">
                  <td className="py-3 px-4 text-[#848e9c]">{ord.timestamp}</td>
                  <td className="py-3 px-4 font-['Inter',sans-serif]">
                    <div className="flex items-center gap-2">
                      {getCoinIcon(ord.symbol, 16)}
                      <span className="font-bold text-[#eaecef]">{ord.symbol}</span>
                      <span className="text-[10px] text-[#848e9c] font-['JetBrains_Mono',monospace]">({ord.type})</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-bold ${
                        ord.side === 'BUY' ? 'text-[#02c076]' : 'text-[#f84960]'
                      }`}
                    >
                      {ord.side === 'BUY' ? 'AL' : 'SAT'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#eaecef]">
                    ${ord.price.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#eaecef]">
                    {ord.amount}
                  </td>
                  <td className="py-3 px-4 text-right text-[#00d2ff]">
                    {((ord.filled / ord.amount) * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.status === 'OPEN'
                          ? 'bg-[#00d2ff]/15 text-[#00d2ff] border border-[#00d2ff]/30'
                          : ord.status === 'FILLED'
                          ? 'bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30'
                          : 'bg-[#848e9c]/15 text-[#848e9c] border border-[#848e9c]/30'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {ord.status === 'OPEN' && (
                      <button
                        onClick={() => handleCancelOrder(ord.id)}
                        className="px-2.5 py-1 bg-[#f84960]/15 hover:bg-[#f84960]/30 text-[#f84960] border border-[#f84960]/30 rounded text-[10px] font-bold transition-colors"
                      >
                        İptal
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
