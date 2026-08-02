import { useEffect, useRef, useState } from 'react';

type GoogleCredentialResponse = { credential?: string };
type GoogleAccounts = {
  id: {
    initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
    renderButton(element: HTMLElement, options: Record<string, string | number>): void;
  };
};

declare global {
  interface Window { google?: { accounts: GoogleAccounts } }
}

let scriptPromise: Promise<void> | null = null;

function loadGoogleIdentity() {
  if (window.google?.accounts) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google oturum servisi yüklenemedi.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google oturum servisi yüklenemedi.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function GoogleSignInButton({ disabled = false, onCredential, onError }: {
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const [configured] = useState(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID));
  callbackRef.current = onCredential;
  errorRef.current = onError;

  useEffect(() => {
    if (!configured || disabled) return;
    let active = true;
    void loadGoogleIdentity().then(() => {
      if (!active || !containerRef.current || !window.google?.accounts) return;
      containerRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID!,
        callback: (response) => response.credential
          ? callbackRef.current(response.credential)
          : errorRef.current('Google kimlik bilgisi alınamadı.'),
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with',
        shape: 'rectangular', logo_alignment: 'left', width: Math.min(containerRef.current.clientWidth || 400, 400),
      });
    }).catch((error: unknown) => {
      if (active) errorRef.current(error instanceof Error ? error.message : 'Google oturum servisi yüklenemedi.');
    });
    return () => { active = false; };
  }, [configured, disabled]);

  if (!configured) {
    return <div className="rounded-xl border border-outline/10 bg-surface-high px-4 py-3 text-center text-xs font-bold text-on-surface-variant">Google girişi yapılandırma bekliyor</div>;
  }
  if (disabled) {
    return <div className="rounded-xl border border-outline/10 bg-surface-high px-4 py-3 text-center text-xs font-bold text-on-surface-variant opacity-60">Google ile kayıt için sözleşmeleri kabul edin</div>;
  }
  return <div ref={containerRef} className="flex min-h-10 w-full justify-center overflow-hidden rounded-xl" />;
}
