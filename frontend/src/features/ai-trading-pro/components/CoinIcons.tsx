import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export const BitcoinIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#F7931A" />
    <path
      d="M22.5 13.7c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.6c-.4-.1-.9-.2-1.3-.3l.7-2.7-1.6-.4-.7 2.7c-.3-.1-.7-.2-1.1-.3l-2.2-.6-.4 1.7s1.2.3 1.2.3c.7.2.8.6.8.9l-.8 3.2c.1 0 .1 0 .2.1l-.2-.1-1.1 4.5c-.1.2-.3.6-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.1.5c.4.1.8.2 1.1.3l-.7 2.8 1.6.4.7-2.7c.4.1.9.2 1.3.3l-.7 2.7 1.6.4.7-2.8c2.8.5 4.9.3 5.8-2.2.7-2-.03-3.1-1.5-3.8 1.1-.2 1.9-1 2.1-2.5zm-3.7 5.4c-.5 2-3.9.9-5 .6l.9-3.6c1.1.3 4.6.8 4.1 3zm.5-5.5c-.5 1.8-3.3.9-4.2.7l.8-3.3c.9.2 3.8.7 3.4 2.6z"
      fill="white"
    />
  </svg>
);

export const EthereumIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#627EEA" />
    <path d="M16.5 4v8.9l7.5 3.3L16.5 4z" fill="#FFF" fillOpacity=".6" />
    <path d="M16.5 4L9 16.2l7.5-3.3V4z" fill="#FFF" />
    <path d="M16.5 21.9v6.1L24 17.6l-7.5 4.3z" fill="#FFF" fillOpacity=".6" />
    <path d="M16.5 28v-6.1L9 17.6l7.5 10.4z" fill="#FFF" />
    <path d="M16.5 20.6l7.5-4.4-7.5-3.3v7.7z" fill="#FFF" fillOpacity=".2" />
    <path d="M9 16.2l7.5 4.4v-7.7L9 16.2z" fill="#FFF" fillOpacity=".6" />
  </svg>
);

export const BnbIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
    <path
      d="M16 6.5l3.2 3.2-5.4 5.4-3.2-3.2L16 6.5zm6.5 6.5l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2zm-13 0l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2zM16 19.5l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2zm-3.2-3.2l3.2-3.2 3.2 3.2-3.2 3.2-3.2-3.2z"
      fill="white"
    />
  </svg>
);

export const SolanaIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#14F195" />
    <path
      d="M8.5 20.7a.8.8 0 01.6-.3h13.8a.4.4 0 01.3.7l-2.6 2.6a.8.8 0 01-.6.3H6.2a.4.4 0 01-.3-.7l2.6-2.6zm0-10.4a.8.8 0 01.6-.3h13.8a.4.4 0 01.3.7l-2.6 2.6a.8.8 0 01-.6.3H6.2a.4.4 0 01-.3-.7l2.6-2.6zm15 5.2a.8.8 0 01-.6.3H9.1a.4.4 0 01-.3-.7l2.6-2.6a.8.8 0 01.6-.3h13.8a.4.4 0 01.3.7l-2.6 2.6z"
      fill="#0B0E14"
    />
  </svg>
);

export const XrpIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#23292F" />
    <path
      d="M23.2 8h2.3l-5.6 5.5-2.2 2.2 4.1 4.1 1.4 1.4-2.3 2.8-5.5-5.5-4.1-4.1 5.5-5.5 2.2 2.2-1.4 1.4-2.2-2.2 3.6-3.6z"
      fill="white"
    />
    <path
      d="M8.8 8h-2.3l5.6 5.5 2.2 2.2-4.1 4.1-1.4 1.4 2.3 2.8 5.5-5.5 4.1-4.1-5.5-5.5-2.2 2.2 1.4 1.4 2.2-2.2-3.6-3.6z"
      fill="white"
    />
  </svg>
);

export const AvaxIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#E84142" />
    <path
      d="M17.8 7.3a2 2 0 00-3.6 0L8.4 18.7a2 2 0 001.8 2.9h3.6a2 2 0 001.8-1.1l2.4-4.5 2.4 4.5a2 2 0 001.8 1.1h3.6a2 2 0 001.8-2.9L17.8 7.3z"
      fill="white"
    />
  </svg>
);

export const DogeIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#C2A633" />
    <path
      d="M11 9h5.5c4.1 0 7.5 3.1 7.5 7s-3.4 7-7.5 7H11V9zm3.5 11.2h2c2.4 0 4.3-1.9 4.3-4.2s-1.9-4.2-4.3-4.2h-2v8.4zm-1.8-4.7h7.2v1h-7.2v-1z"
      fill="white"
    />
  </svg>
);

export const AdaIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#0033AD" />
    <circle cx="16" cy="16" r="3" fill="white" />
    <circle cx="16" cy="9" r="1.5" fill="white" />
    <circle cx="16" cy="23" r="1.5" fill="white" />
    <circle cx="9" cy="16" r="1.5" fill="white" />
    <circle cx="23" cy="16" r="1.5" fill="white" />
    <circle cx="11" cy="11" r="1.2" fill="white" />
    <circle cx="21" cy="21" r="1.2" fill="white" />
    <circle cx="21" cy="11" r="1.2" fill="white" />
    <circle cx="11" cy="21" r="1.2" fill="white" />
  </svg>
);

export const UsdtIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path
      d="M17.6 15.6v-2.3h4.4v-2.6H10v2.6h4.4v2.3c-4.4.2-7.7 1.1-7.7 2.2 0 1.1 3.3 2 7.7 2.2v6.6h3.2v-6.6c4.4-.2 7.7-1.1 7.7-2.2 0-1.1-3.3-2-7.7-2.2zm0 3.8v-.2c3.5-.1 6.1-.7 6.1-1.4s-2.6-1.3-6.1-1.4v2.8c-.5 0-1 0-1.6 0-.5 0-1.1 0-1.6 0v-2.8c-3.5.1-6.1.7-6.1 1.4s2.6 1.3 6.1 1.4v.2c-3.9-.2-6.9-.9-6.9-1.6 0-.7 3-1.4 6.9-1.6v-1.6h-3.2v-1.1h10.4v1.1h-3.2v1.6c3.9.2 6.9.9 6.9 1.6 0 .7-3 1.4-6.9 1.6z"
      fill="white"
    />
  </svg>
);

export const getCoinIcon = (symbol: string, size = 22): React.ReactNode => {
  const cleanSymbol = symbol.replace('/USDT', '').replace('USDT', '').toUpperCase();
  switch (cleanSymbol) {
    case 'BTC':
      return <BitcoinIcon size={size} />;
    case 'ETH':
      return <EthereumIcon size={size} />;
    case 'BNB':
      return <BnbIcon size={size} />;
    case 'SOL':
      return <SolanaIcon size={size} />;
    case 'XRP':
      return <XrpIcon size={size} />;
    case 'AVAX':
      return <AvaxIcon size={size} />;
    case 'DOGE':
      return <DogeIcon size={size} />;
    case 'ADA':
      return <AdaIcon size={size} />;
    case 'USDT':
      return <UsdtIcon size={size} />;
    default:
      return (
        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-cyan-300">
          {cleanSymbol.slice(0, 3)}
        </div>
      );
  }
};
