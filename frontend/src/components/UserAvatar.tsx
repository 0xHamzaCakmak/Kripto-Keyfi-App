import { useEffect, useMemo, useState } from 'react';
import { cn } from '../lib/utils';

function initialsFor(name?: string | null, username?: string | null, email?: string | null) {
  const source = name?.trim() || username?.trim() || email?.split('@')[0] || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}` : source.slice(0, 2)).toLocaleUpperCase('tr-TR');
}

export function UserAvatar({ avatarUrl, displayName, username, email, className }: {
  avatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatarUrl]);
  const initials = useMemo(() => initialsFor(displayName, username, email), [displayName, username, email]);

  if (avatarUrl && !failed) {
    return <img src={avatarUrl} alt={displayName || username || 'Kullanıcı'} onError={() => setFailed(true)} className={cn('object-cover', className)} />;
  }
  return <span aria-label={displayName || username || 'Kullanıcı'} className={cn('inline-flex items-center justify-center bg-primary/15 font-headline font-black text-primary', className)}>{initials}</span>;
}
