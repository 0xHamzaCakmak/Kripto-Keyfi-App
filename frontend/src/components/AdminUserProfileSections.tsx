import { ExternalLink, Image, Layers3, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { getApiErrorMessage } from '../services/apiClient';
import { executeAdminUserProfileAction, type AdminUserProfileSection } from '../services/adminUserService';

function labelFor(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, (value) => value.toLocaleUpperCase('tr-TR'));
}

function rowsFrom(data: unknown): Array<Record<string, unknown>> {
  if (data === null || data === undefined) return [];
  if (Array.isArray(data)) return data.map((item) => (
    typeof item === 'object' && item !== null ? item as Record<string, unknown> : { value: item }
  ));
  return [typeof data === 'object' ? data as Record<string, unknown> : { value: data }];
}

function FieldValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-outline">—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Evet' : 'Hayır'}</span>;
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/avatar|image/i.test(field) && /^https?:\/\//.test(text)) return <img src={text} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-outline/15" />;
  if (/url$/i.test(field) && /^https?:\/\//.test(text)) return <a href={text} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all font-bold text-primary hover:underline">Bağlantıyı aç <ExternalLink size={13} /></a>;
  if (/At$/.test(field) && !Number.isNaN(Date.parse(text))) return <span>{new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(text))}</span>;
  return <span className="break-words">{text}</span>;
}

export function UserProfileSectionCard({ section, userId, onChanged }: { section: AdminUserProfileSection; userId: string; onChanged: () => void }) {
  const rows = rowsFrom(section.data);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  async function runAction(row: Record<string, unknown>, rowIndex: number, actionIndex: number) {
    const action = section.actions[actionIndex];
    if (!action || (action.confirm && !window.confirm(action.confirm))) return;
    const key = `${String(row.id ?? rowIndex)}:${action.key}`;
    setBusyKey(key); setError('');
    try { await executeAdminUserProfileAction(action, userId, row); onChanged(); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Profil işlemi tamamlanamadı.')); }
    finally { setBusyKey(''); }
  }

  return <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-7">
    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Layers3 size={18} /></span><div><h2 className="font-headline text-lg font-black text-white">{section.title}</h2><p className="mt-0.5 text-xs text-on-surface-variant">{rows.length} kayıt</p></div></div>
    {error && <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-bold text-error">{error}</div>}
    {rows.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-outline/15 p-6 text-center"><Image className="mx-auto text-outline" size={24} /><p className="mt-2 text-sm text-on-surface-variant">Bu bölümde henüz kayıt yok.</p></div> : <div className="mt-5 space-y-3">{rows.map((row, rowIndex) => <article key={String(row.id ?? rowIndex)} className="rounded-2xl bg-background/45 p-4"><dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{Object.entries(row).map(([field, value]) => <div key={field} className={/description|notes/i.test(field) ? 'sm:col-span-2' : ''}><dt className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">{labelFor(field)}</dt><dd className="mt-1.5 text-sm text-white"><FieldValue field={field} value={value} /></dd></div>)}</dl>{section.actions.length > 0 && <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-outline/10 pt-4">{section.actions.map((action, actionIndex) => { const key = `${String(row.id ?? rowIndex)}:${action.key}`; return <button key={action.key} type="button" disabled={Boolean(busyKey)} onClick={() => void runAction(row, rowIndex, actionIndex)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black disabled:opacity-50 ${action.tone === 'danger' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{busyKey === key && <LoaderCircle className="animate-spin" size={14} />}{action.label}</button>; })}</div>}</article>)}</div>}
  </section>;
}

export default function AdminUserProfileSections({ userId, sections, loading, onChanged }: { userId: string; sections: AdminUserProfileSection[]; loading: boolean; onChanged: () => void }) {
  if (loading) return <div className="flex min-h-36 items-center justify-center rounded-[28px] border border-outline/10 bg-surface"><LoaderCircle className="animate-spin text-primary" size={24} /></div>;
  if (sections.length === 0) return <div className="rounded-[28px] border border-dashed border-outline/15 bg-surface p-8 text-center text-sm text-on-surface-variant">Yüklenebilen profil bölümü bulunamadı.</div>;
  return <div className="grid gap-6 xl:grid-cols-2">{sections.map((section) => <UserProfileSectionCard key={section.key} section={section} userId={userId} onChanged={onChanged} />)}</div>;
}
