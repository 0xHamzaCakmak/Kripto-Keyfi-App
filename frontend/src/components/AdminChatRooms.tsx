import { useEffect, useMemo, useState } from 'react';
import { EyeOff, LockKeyhole, MessageSquare, Pencil, Plus, Radio } from 'lucide-react';
import { createAdminChatRoom, getAdminChatRooms, updateAdminChatRoom, updateAdminChatRoomStatus, type AdminChatRoom, type ChatRoomInput } from '../services/adminChatService';
import { getApiErrorMessage } from '../services/apiClient';

const emptyForm: ChatRoomInput = { slug: '', name: '', category: 'Piyasalar', icon: 'message-square', displayOrder: 0 };

export default function AdminChatRooms() {
  const [rooms, setRooms] = useState<AdminChatRoom[]>([]);
  const [form, setForm] = useState<ChatRoomInput>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const grouped = useMemo(() => rooms.reduce<Record<string, AdminChatRoom[]>>((result, room) => ({ ...result, [room.category]: [...(result[room.category] ?? []), room] }), {}), [rooms]);

  async function load() { setLoading(true); try { setRooms(await getAdminChatRooms()); } catch (reason) { setError(getApiErrorMessage(reason, 'Sohbet odaları yüklenemedi.')); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);

  function edit(room: AdminChatRoom) { setEditingId(room.id); setForm({ slug: room.slug, name: room.name, category: room.category, icon: room.icon, displayOrder: room.displayOrder }); setNotice(''); setError(''); }
  function reset() { setEditingId(null); setForm(emptyForm); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (editingId) await updateAdminChatRoom(editingId, form); else await createAdminChatRoom(form);
      const message = editingId ? 'Oda güncellendi.' : 'Yeni oda oluşturuldu.'; reset(); setNotice(message); await load();
    } catch (reason) { setError(getApiErrorMessage(reason, 'Oda kaydedilemedi.')); } finally { setSaving(false); }
  }
  async function status(room: AdminChatRoom, next: AdminChatRoom['status']) {
    try { const updated = await updateAdminChatRoomStatus(room.id, next); setRooms((current) => current.map((item) => item.id === room.id ? updated : item)); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Oda durumu güncellenemedi.')); }
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.7fr)]">
    <section className="rounded-[28px] border border-outline/10 bg-surface p-5">
      <div className="flex items-center gap-3"><MessageSquare className="text-primary"/><div><h2 className="font-headline text-xl font-black text-white">Sohbet odaları</h2><p className="text-xs text-on-surface-variant">Kapalı odalar okunabilir; gizli odalar kullanıcı listesinden kaldırılır.</p></div></div>
      {error && <p className="mt-4 rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}{notice && <p className="mt-4 rounded-xl bg-secondary/10 p-3 text-sm text-secondary">{notice}</p>}
      {loading ? <div className="mt-5 h-56 animate-pulse rounded-2xl bg-surface-high"/> : <div className="mt-5 space-y-6">{Object.entries(grouped).map(([category, items]) => <div key={category}><h3 className="mb-2 text-xs font-black uppercase tracking-wider text-primary">{category}</h3><div className="space-y-2">{items.map((room) => <article key={room.id} className="flex flex-col gap-3 rounded-2xl bg-surface-high p-4 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-bold text-white">{room.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${room.status === 'active' ? 'bg-secondary/10 text-secondary' : room.status === 'closed' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>{room.status}</span></div><p className="mt-1 text-xs text-on-surface-variant">/{room.slug} · {room.messageCount.toLocaleString('tr-TR')} mesaj · sıra {room.displayOrder}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => edit(room)} className="rounded-xl bg-background/50 p-2 text-white" title="Düzenle"><Pencil size={15}/></button><button onClick={() => void status(room, 'active')} disabled={room.status === 'active'} className="inline-flex items-center gap-1 rounded-xl bg-secondary/10 px-3 py-2 text-xs font-bold text-secondary disabled:opacity-30"><Radio size={14}/> Aç</button><button onClick={() => void status(room, 'closed')} disabled={room.status === 'closed'} className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary disabled:opacity-30"><LockKeyhole size={14}/> Kapat</button><button onClick={() => void status(room, 'hidden')} disabled={room.status === 'hidden'} className="inline-flex items-center gap-1 rounded-xl bg-error/10 px-3 py-2 text-xs font-bold text-error disabled:opacity-30"><EyeOff size={14}/> Gizle</button></div></article>)}</div></div>)}</div>}
    </section>
    <form onSubmit={save} className="h-fit rounded-[28px] border border-outline/10 bg-surface p-5 xl:sticky xl:top-24"><div className="flex items-center gap-2"><Plus className="text-primary"/><h2 className="font-headline text-xl font-black text-white">{editingId ? 'Odayı düzenle' : 'Yeni oda'}</h2></div><div className="mt-5 space-y-4">{[
      ['Oda adı', 'name', 'Bitcoin'], ['URL adresi', 'slug', 'bitcoin'], ['Kategori', 'category', 'Piyasalar'], ['İkon anahtarı', 'icon', 'message-square'],
    ].map(([label, key, placeholder]) => <label key={key} className="block text-xs font-bold text-on-surface-variant">{label}<input required={key !== 'icon'} value={String(form[key as keyof ChatRoomInput] ?? '')} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-outline/10 bg-background/50 px-4 py-3 text-sm text-white outline-none focus:border-primary"/></label>)}<label className="block text-xs font-bold text-on-surface-variant">Gösterim sırası<input type="number" min="0" value={form.displayOrder} onChange={(event) => setForm((current) => ({ ...current, displayOrder: Number(event.target.value) }))} className="mt-2 w-full rounded-xl border border-outline/10 bg-background/50 px-4 py-3 text-sm text-white"/></label></div><div className="mt-5 flex gap-2"><button disabled={saving} className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-black text-background disabled:opacity-50">{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>{editingId && <button type="button" onClick={reset} className="rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-white">Vazgeç</button>}</div></form>
  </div>;
}
