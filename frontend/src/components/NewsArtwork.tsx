import { useEffect, useState } from 'react';
import type { NewsArticle } from '../types';
import { cn } from '../lib/utils';

const defaultImageHosts = ['media.kriptokeyfi.com', 'cdn.sanity.io', 'coin-turk.com', 'www.coin-turk.com', 'www.coindesk.com', 'assets.coindesk.com', 'www.btchaber.com', 'btchaber.com'];
const configuredImageHosts = (import.meta.env.VITE_NEWS_IMAGE_HOSTS ?? '').split(',').map((host) => host.trim().toLocaleLowerCase()).filter(Boolean);
function configuredR2ImageHost() {
  try { return new URL(import.meta.env.VITE_R2_PUBLIC_URL ?? '').hostname.toLocaleLowerCase(); }
  catch { return ''; }
}
const allowedImageHosts = new Set([...defaultImageHosts, ...configuredImageHosts, configuredR2ImageHost()].filter(Boolean));
function isAllowedImageHost(hostname: string) {
  const normalizedHost = hostname.toLocaleLowerCase();
  return allowedImageHosts.has(normalizedHost) || normalizedHost.endsWith('.r2.dev');
}
function safeImageUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith('/')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && isAllowedImageHost(url.hostname) ? url.toString() : null; }
  catch { return null; }
}

export default function NewsArtwork({ article, className, imageClassName, eager = false }: { article: NewsArticle; className?: string; imageClassName?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [article.coverImageUrl]);
  const imageUrl = safeImageUrl(article.coverImageUrl);

  return (
    <div className={cn('relative overflow-hidden bg-[linear-gradient(135deg,#2a2415_0%,#0e0e0d_55%,#39290a_100%)]', className)}>
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt={article.coverImageAlt ?? article.title}
          width="1200"
          height="675"
          className={cn('h-full w-full object-cover', imageClassName)}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 66vw, 900px"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <img src="/pwa/icon-192.png" alt="" width="192" height="192" loading="lazy" decoding="async" className="h-1/2 max-h-28 w-auto rounded-[22%] opacity-45 grayscale-[15%]" />
          <span className="absolute bottom-3 left-4 right-4 truncate text-[10px] font-black uppercase tracking-[.18em] text-primary/80">{article.category ?? 'KriptoKeyfi Haber'}</span>
        </div>
      )}
    </div>
  );
}
