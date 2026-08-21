import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Database, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function AITradingPage({ title, description, icon: Icon, action, children }: {
  title: string; description: string; icon: LucideIcon; action?: ReactNode; children: ReactNode;
}) {
  return <div className="space-y-6">
    <header className="rounded-[30px] border border-primary/15 bg-gradient-to-br from-surface via-surface to-primary/10 p-6 md:p-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><div className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary"><Icon aria-hidden="true" /></div><h1 className="mt-4 font-headline text-3xl font-black text-white md:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">{description}</p></div>
        {action}
      </div>
    </header>
    {children}
  </div>;
}

export function MetricCard({ label, value, detail, tone = 'neutral' }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'neutral' | 'safe' | 'warning' | 'danger' }) {
  return <div className={cn('rounded-[22px] border bg-surface p-5', tone === 'danger' ? 'border-error/25' : tone === 'safe' ? 'border-secondary/20' : tone === 'warning' ? 'border-tertiary/20' : 'border-outline/10')}>
    <p className="text-xs font-black uppercase tracking-[.14em] text-on-surface-variant">{label}</p>
    <div className={cn('mt-2 font-headline text-2xl font-black', tone === 'danger' ? 'text-error' : tone === 'safe' ? 'text-secondary' : tone === 'warning' ? 'text-tertiary' : 'text-white')}>{value}</div>
    {detail && <div className="mt-2 text-xs leading-5 text-outline">{detail}</div>}
  </div>;
}

export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'safe' | 'warning' | 'danger' }) {
  return <span className={cn('inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider',
    tone === 'safe' ? 'border-secondary/20 bg-secondary/10 text-secondary' : tone === 'danger' ? 'border-error/20 bg-error/10 text-error' : tone === 'warning' ? 'border-tertiary/20 bg-tertiary/10 text-tertiary' : 'border-outline/20 bg-surface-highest text-on-surface-variant')}>{children}</span>;
}

export function ModeBadge({ mode }: { mode: 'PAPER' | 'SHADOW' | 'LIVE' | 'UNKNOWN' }) {
  const meta = mode === 'PAPER' ? ['Simülasyon · gerçek emir yok', 'warning'] : mode === 'SHADOW' ? ['Canlı piyasa · gerçek emir yok', 'neutral'] : mode === 'LIVE' ? ['Gerçek sermaye', 'danger'] : ['Mod bilinmiyor', 'neutral'];
  return <StatusBadge tone={meta[1] as 'neutral' | 'warning' | 'danger'}>{mode} · {meta[0]}</StatusBadge>;
}

export function LoadingState({ label = 'Veriler yükleniyor…' }: { label?: string }) {
  return <div className="h-40 animate-pulse rounded-[24px] border border-outline/10 bg-surface" aria-label={label} />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-[24px] border border-dashed border-outline/25 bg-surface p-8 text-center"><Database className="mx-auto text-outline" /><h3 className="mt-3 font-headline font-black text-white">{title}</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">{description}</p></div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="flex gap-3 rounded-2xl border border-error/25 bg-error/10 p-4 text-sm text-error"><AlertTriangle className="shrink-0" size={19} />{message}</div>;
}

export function RefreshButton({ onClick, busy = false }: { onClick: () => void; busy?: boolean }) {
  return <button type="button" disabled={busy} onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-background disabled:opacity-50"><RefreshCw className={busy ? 'animate-spin' : ''} size={17} /> Yenile</button>;
}

export function formatMoney(value: number | null, currency = 'USDT') {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${currency}`;
}

export function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
