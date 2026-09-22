import { useState } from 'react';
import { closeOpenPosition } from '../../../../services/tradingService';
import { getApiErrorMessage } from '../../../../services/apiClient';
import type { TradeProPosition } from '../../services/backendDashboard';

export function PositionCloseDialog({ accountId, position, disabled, onClose, onSubmitted }: { accountId: string; position: TradeProPosition; disabled: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [type, setType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState(position.quantity.replace('-', ''));
  const [price, setPrice] = useState(position.markPrice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy || disabled) return;
    if (!window.confirm(`${position.symbol} ${position.side}: ${quantity} miktarı için ${type} kapatma emri gönderilsin mi?`)) return;
    setBusy(true); setError('');
    try {
      await closeOpenPosition(accountId, position, { type, quantity, ...(type === 'LIMIT' ? { price } : {}) });
      onSubmitted(); onClose();
    } catch (reason) { setError(getApiErrorMessage(reason, 'Kapatma isteği başarısız oldu.')); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"><div role="dialog" aria-modal="true" aria-label="Pozisyon kapatma" className="w-full max-w-lg rounded-2xl border border-[#2b3139] bg-[#1e2329] p-6">
    <div className="flex justify-between gap-3"><h2 className="font-bold">{position.symbol} · {position.side}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Kapat">✕</button></div>
    <p className="my-4 text-xs text-[#848e9c]">Emir mevcut pozisyonu azaltır. Limit emir gerçekleşene kadar pozisyon açık kalabilir. Açık miktar: {position.quantity}</p>
    {error && <p role="alert" className="mb-4 text-sm text-[#f84960]">{error}</p>}
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }}><fieldset disabled={busy || disabled} className="space-y-4">
      <label className="block text-xs">Emir tipi<select value={type} onChange={(event) => setType(event.target.value as 'MARKET' | 'LIMIT')} className="mt-1 w-full rounded-lg bg-[#0b0e11] p-3"><option>MARKET</option><option>LIMIT</option></select></label>
      <label className="block text-xs">Kapatılacak miktar<input required type="number" min="0.000000000000000001" max={Math.abs(Number(position.quantity))} step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg bg-[#0b0e11] p-3"/></label>
      {type === 'LIMIT' && <label className="block text-xs">Limit fiyatı<input required type="number" min="0.000000000000000001" step="any" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded-lg bg-[#0b0e11] p-3"/></label>}
      <button type="submit" className="w-full rounded-lg bg-[#f84960] p-3 font-bold disabled:opacity-40">{busy ? 'Gönderiliyor…' : `${type} kapatma isteği gönder`}</button>
    </fieldset></form>
  </div></div>;
}
