import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Code,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Link2,
  Menu,
  MessageSquare,
  Paperclip,
  PlusCircle,
  Search,
  Send,
  Shield,
  Smile,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap
} from 'lucide-react';
import { ChatCoin, ChatMessage as ChatMessageType, ChatReaction, ChatUser } from '../types';
import { cn } from '../lib/utils';
import { getCoinBySymbol, getMentionedCoins, MOCK_COINS } from '../services/coinService';
import { askKriptoKeyfiAi } from '../services/aiService';
import { getWhaleFeed } from '../services/whaleService';
import { getChatChannels, getChatMessages, getChatNews, getChatUsers } from '../services/chatService';

const reactionOptions = [
  { id: 'useful', label: 'Faydalı' },
  { id: 'quality', label: 'Kaliteli analiz' },
  { id: 'alpha', label: 'Alpha' },
  { id: 'security', label: 'Güvenlik uyarısı' }
];

const academySuggestions = [
  {
    keywords: ['erc4337', 'erc-4337', 'account abstraction'],
    title: 'AI ve Web3: Agent Tabanlı Cüzdan Deneyimleri',
    excerpt: 'Account Abstraction ve akıllı cüzdan deneyimlerinin ürün etkisini öğren.',
    readingTime: '10 dk',
    slug: 'ai-web3-agentlar'
  },
  {
    keywords: ['smart contract', 'solidity', 'reentrancy', 'tx.origin'],
    title: 'Solidity Başlangıç: ERC-20 Token Mantığını Anlamak',
    excerpt: 'Smart contract geliştirme ve güvenli kod alışkanlıkları için pratik başlangıç.',
    readingTime: '14 dk',
    slug: 'solidity-baslangic-erc20'
  },
  {
    keywords: ['layer-2', 'rollup'],
    title: 'Akademik Özet: Rollup Mimarilerinde Veri Erişilebilirliği',
    excerpt: 'Rollup güvenlik varsayımları ve veri erişilebilirliği problemini incele.',
    readingTime: '16 dk',
    slug: 'akademik-rollup-raporu'
  },
  {
    keywords: ['defi', 'wallet security'],
    title: 'Wallet Security: Phishing Saldırılarını Erken Fark Etmek',
    excerpt: 'Cüzdan güvenliği, phishing ve izin yönetimi için hızlı kontrol listesi.',
    readingTime: '7 dk',
    slug: 'wallet-security-phishing'
  }
];

function getLinks(text: string) {
  return text.match(/https?:\/\/[^\s]+/g) || [];
}

function isYoutubeLink(link: string) {
  return /youtube\.com|youtu\.be/i.test(link);
}

function getWallets(text: string) {
  return text.match(/0x[a-fA-F0-9]{40}/g) || [];
}

function getAcademySuggestion(text: string) {
  const normalized = text.toLowerCase();
  return academySuggestions.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function UserBadge({ user }: { user: ChatUser }) {
  return (
    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
      {user.role}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-outline/5 bg-surface-high/40 p-6 text-center text-sm text-on-surface-variant">
      {label}
    </div>
  );
}

function ChatSidebar({
  activeChannel,
  setActiveChannel,
  mobileOpen,
  setMobileOpen
}: {
  activeChannel: string;
  setActiveChannel: (id: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const channels = getChatChannels();
  const grouped = channels.reduce<Record<string, typeof channels>>((groups, channel) => {
    groups[channel.group] = [...(groups[channel.group] || []), channel];
    return groups;
  }, {});

  return (
    <aside className={cn(
      'bg-surface-high/30 border-outline/5 flex flex-col overflow-hidden border-r',
      'xl:relative xl:flex xl:h-full xl:w-72',
      mobileOpen ? 'fixed inset-y-0 left-0 z-50 w-[min(86vw,340px)] rounded-r-[28px] border-r bg-surface shadow-2xl' : 'hidden xl:flex'
    )}>
      <div className="flex items-center justify-between px-5 py-5">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Community Hub</h2>
          <p className="mt-1 font-headline text-lg font-extrabold text-white">Kanallar</p>
        </div>
        <button type="button" onClick={() => setMobileOpen(false)} className="xl:hidden text-on-surface-variant">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">
        {Object.entries(grouped).map(([group, groupChannels]) => (
          <div key={group} className="mb-6">
            <h3 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{group}</h3>
            <div className="space-y-1">
              {groupChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => {
                    setActiveChannel(channel.id);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all',
                    activeChannel === channel.id
                      ? 'border-l-4 border-primary bg-surface-high text-primary'
                      : 'text-on-surface-variant hover:bg-surface-high hover:text-white'
                  )}
                >
                  <MessageSquare size={16} />
                  <span className="flex-1 text-sm font-semibold">{channel.name}</span>
                  {channel.online && <span className="text-[10px] text-secondary">{channel.online}</span>}
                  {channel.unread && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">{channel.unread}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function CoinMentionCard({ coin }: { coin: ChatCoin }) {
  const isPositive = coin.change24h >= 0;

  return (
    <Link to={`/coins/${coin.symbol.toLowerCase()}`} className="block rounded-2xl border border-outline/5 bg-surface-high/70 p-4 hover:bg-surface-highest">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-headline text-base font-bold text-white">${coin.symbol}</p>
          <p className="text-xs text-on-surface-variant">{coin.name} / {coin.marketCap}</p>
        </div>
        <div className="text-right">
          <p className="font-headline text-sm font-bold text-white">${coin.price.toLocaleString()}</p>
          <p className={cn('inline-flex items-center gap-1 text-xs font-bold', isPositive ? 'text-secondary' : 'text-error')}>
            {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {isPositive ? '+' : ''}{coin.change24h}%
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Trend: {coin.trend}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">Detaya git <ExternalLink size={12} /></span>
      </div>
    </Link>
  );
}

function YouTubePreviewCard() {
  return (
    <Link to="/videos/eth-etf-2026" className="flex max-w-xl gap-4 rounded-2xl border border-outline/5 bg-surface-high/70 p-3 hover:bg-surface-highest">
      <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl">
        <img src="https://picsum.photos/seed/chat-youtube-preview/420/240" alt="YouTube preview" className="h-full w-full object-cover" />
        <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-bold text-white">18:42</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Video Preview</p>
        <h4 className="mt-1 line-clamp-2 font-headline text-sm font-bold text-white">Ethereum ETF Etkisi: Kurumsal Para Web3 Piyasasını Nasıl Değiştirir?</h4>
        <p className="mt-2 text-xs text-on-surface-variant">Kripto Keyfi Research</p>
        <p className="mt-2 text-xs font-bold text-primary">Video Merkezi’nde İzle</p>
      </div>
    </Link>
  );
}

function LinkPreviewCard({ link }: { link: string }) {
  const domain = new URL(link).hostname.replace('www.', '');

  return (
    <a href={link} target="_blank" rel="noreferrer" className="block max-w-xl rounded-2xl border border-outline/5 bg-surface-high/70 p-4 hover:bg-surface-highest">
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{domain}</p>
      <h4 className="mt-2 font-headline text-sm font-bold text-white">Kripto güvenlik uyarısı ve hızlı kontrol listesi</h4>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-on-surface-variant">Paylaşılan bağlantı için basit önizleme. Gerçek metadata backend entegrasyonu ile alınacak.</p>
    </a>
  );
}

function AcademySuggestionCard({ suggestion }: { suggestion: NonNullable<ReturnType<typeof getAcademySuggestion>> }) {
  return (
    <Link to={`/academy/articles/${suggestion.slug}`} className="block max-w-xl rounded-2xl border border-primary/10 bg-primary/5 p-4 hover:bg-primary/10">
      <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
        <Sparkles size={14} /> Akademi Önerisi
      </p>
      <h4 className="font-headline text-sm font-bold text-white">{suggestion.title}</h4>
      <p className="mt-2 text-xs leading-5 text-on-surface-variant">{suggestion.excerpt}</p>
      <p className="mt-3 text-xs font-bold text-primary">Oku / {suggestion.readingTime}</p>
    </Link>
  );
}

function WalletPreviewCard({ address }: { address: string }) {
  return (
    <Link to={`/wallet/${address}`} className="block max-w-xl rounded-2xl border border-tertiary/10 bg-tertiary/5 p-4 hover:bg-tertiary/10">
      <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-tertiary">
        <Wallet size={14} /> Wallet Analizi
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-on-surface-variant">Adres</p>
          <p className="font-mono text-sm font-bold text-white">{shortenAddress(address)}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Ağ</p>
          <p className="text-sm font-bold text-white">Ethereum / EVM</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">İlk işlem</p>
          <p className="text-sm font-bold text-white">Mayıs 2021</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Risk puanı</p>
          <p className="text-sm font-bold text-secondary">24 / 100</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-tertiary">Detaylı Analiz</p>
    </Link>
  );
}

function MessageReactions({
  message,
  onReact
}: {
  message: ChatMessageType;
  onReact: (messageId: string, reaction: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {reactionOptions.map((option) => {
        const current = message.reactions.find((reaction) => reaction.id === option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onReact(message.id, option.id)}
            className={cn(
              'rounded-full px-3 py-1 text-[10px] font-bold transition-all',
              current ? 'bg-primary/10 text-primary' : 'bg-surface-high/70 text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-white'
            )}
          >
            {option.label}{current ? ` ${current.count}` : ''}
          </button>
        );
      })}
    </div>
  );
}

function ChatMessage({
  message,
  user,
  onReact
}: {
  message: ChatMessageType;
  user: ChatUser;
  onReact: (messageId: string, reaction: string) => void;
}) {
  const mentionedCoins = getMentionedCoins(message.text);
  const links = getLinks(message.text);
  const wallets = getWallets(message.text);
  const suggestion = getAcademySuggestion(message.text);

  return (
    <article className="group flex items-start gap-4">
      <img src={user.avatar} alt={user.name} className="h-10 w-10 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-white">{user.name}</span>
          <UserBadge user={user} />
          <span className="text-[10px] font-medium text-on-surface-variant">{message.createdAt}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 text-on-surface/90">{message.text}</p>
        {message.code && (
          <pre className="max-w-2xl overflow-x-auto rounded-xl border-l-2 border-secondary bg-surface-highest p-4 font-mono text-xs text-secondary-dim">
            <code>{message.code}</code>
          </pre>
        )}
        {mentionedCoins.length > 0 && (
          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            {mentionedCoins.map((coin) => <CoinMentionCard key={coin.symbol} coin={coin} />)}
          </div>
        )}
        {links.map((link) => isYoutubeLink(link) ? <YouTubePreviewCard key={link} /> : <LinkPreviewCard key={link} link={link} />)}
        {wallets.map((wallet) => <WalletPreviewCard key={wallet} address={wallet} />)}
        {suggestion && <AcademySuggestionCard suggestion={suggestion} />}
        <MessageReactions message={message} onReact={onReact} />
      </div>
    </article>
  );
}

function ChatMessageList({
  messages,
  users,
  onReact
}: {
  messages: ChatMessageType[];
  users: ChatUser[];
  onReact: (messageId: string, reaction: string) => void;
}) {
  if (!messages.length) {
    return <EmptyState label="Henüz mesaj yok. Bu kanalda ilk konuşmayı siz başlatabilirsiniz." />;
  }

  return (
    <div className="space-y-8">
      {messages.map((message) => {
        const user = users.find((item) => item.id === message.userId) || users[0];
        return <ChatMessage key={message.id} message={message} user={user} onReact={onReact} />;
      })}
    </div>
  );
}

function MessageInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const coinTerm = text.match(/\$[A-Za-z]*$/)?.[0]?.replace('$', '').toUpperCase();
  const showCoins = text.endsWith('$') || Boolean(coinTerm);
  const suggestions = showCoins ? MOCK_COINS.filter((coin) => !coinTerm || coin.symbol.startsWith(coinTerm)).slice(0, 7) : [];

  function addCoin(symbol: string) {
    setText((current) => current.replace(/\$[A-Za-z]*$/, `$${symbol} `));
  }

  return (
    <footer className="border-t border-outline/5 p-4 md:p-6">
      <div className="relative rounded-2xl bg-surface-highest p-3 shadow-2xl">
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-4 mb-2 w-64 rounded-2xl border border-outline/5 bg-surface p-2 shadow-2xl">
            {suggestions.map((coin) => (
              <button key={coin.symbol} type="button" onClick={() => addCoin(coin.symbol)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-surface-high">
                <span className="text-sm font-bold text-white">${coin.symbol}</span>
                <span className="text-xs text-on-surface-variant">{coin.name}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-14 w-full resize-none border-none bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 no-scrollbar"
          placeholder="Mesaj yaz... $ ile coin ara, link veya wallet adresi paylaş"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 text-on-surface-variant">
            {[PlusCircle, Smile, ImageIcon, Paperclip, Link2, Code, BarChart3].map((Icon, index) => (
              <button key={index} type="button" className="rounded-lg p-2 transition-colors hover:bg-surface-high hover:text-primary">
                <Icon size={18} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!text.trim()) return;
              onSend(text);
              setText('');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-dim px-6 py-2 text-sm font-bold text-background hover:shadow-[0_0_20px_rgba(141,172,255,0.4)]"
          >
            Gönder <Send size={14} />
          </button>
        </div>
      </div>
    </footer>
  );
}

function MarketHighlights() {
  return (
    <Widget title="Market Highlights">
      <div className="space-y-3">
        {MOCK_COINS.slice(0, 4).map((coin) => (
          <Link key={coin.symbol} to={`/coins/${coin.symbol.toLowerCase()}`} className="flex items-center justify-between rounded-2xl bg-surface-high/50 p-3 hover:bg-surface-high">
            <div>
              <p className="text-sm font-bold text-white">${coin.symbol}</p>
              <p className="text-[10px] text-on-surface-variant">{coin.name}</p>
            </div>
            <span className={cn('text-xs font-bold', coin.change24h >= 0 ? 'text-secondary' : 'text-error')}>
              {coin.change24h >= 0 ? '+' : ''}{coin.change24h}%
            </span>
          </Link>
        ))}
      </div>
    </Widget>
  );
}

function BreakingNewsWidget() {
  const news = getChatNews();

  return (
    <Widget title="Son Dakika Haberleri">
      {news.length ? (
        <div className="space-y-3">
          {news.map((item) => (
            <Link key={item.id} to={`/blog/${item.slug}`} className="block rounded-2xl bg-surface-high/50 p-3 hover:bg-surface-high">
              <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">{item.category} / {item.publishedAt}</p>
              <h4 className="mt-1 text-sm font-bold text-white">{item.title}</h4>
              <p className="mt-2 text-xs font-bold text-primary">Habere git</p>
            </Link>
          ))}
        </div>
      ) : <EmptyState label="Haber bulunamadı." />}
    </Widget>
  );
}

function WhaleFeedWidget() {
  const whales = getWhaleFeed();

  return (
    <Widget title="Whale Feed">
      {whales.length ? (
        <div className="space-y-3">
          {whales.map((whale) => (
            <div key={whale.id} className="rounded-2xl bg-surface-high/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-white">{whale.amount}</p>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold',
                  whale.importance === 'Yüksek' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
                )}>
                  {whale.importance}
                </span>
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">{whale.type} / {whale.network} / {whale.time}</p>
            </div>
          ))}
        </div>
      ) : <EmptyState label="Whale feed şu an boş." />}
    </Widget>
  );
}

function TrendingTagsWidget() {
  return (
    <Widget title="Trend Etiketler">
      <div className="flex flex-wrap gap-2">
        {['#ETF', '#L2Summer', '#SolanaSzn', '#Airdrop', '#Security', '#ERC4337'].map((tag) => (
          <span key={tag} className="rounded-lg bg-surface-high px-2 py-1 text-[10px] font-bold text-primary">{tag}</span>
        ))}
      </div>
    </Widget>
  );
}

function AiAssistantBox() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('Piyasa, Web3, smart contract ve güvenlik hakkında hızlı soru sor.');

  return (
    <Widget title="Kripto Keyfi AI">
      <p className="mb-4 text-sm leading-6 text-on-surface-variant">{answer}</p>
      <div className="space-y-3">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="w-full rounded-xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface placeholder:text-outline/70"
          placeholder="ERC-4337 nedir?"
        />
        <button type="button" onClick={() => setAnswer(askKriptoKeyfiAi(question))} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background">
          Sor <Bot size={16} />
        </button>
      </div>
    </Widget>
  );
}

function ActiveUsersList({ users }: { users: ChatUser[] }) {
  if (!users.length) {
    return <EmptyState label="Kullanıcı bulunamadı." />;
  }

  return (
    <Widget title={`Active Users (${users.filter((user) => user.isOnline).length})`}>
      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-3 rounded-2xl bg-surface-high/30 p-2">
            <div className="relative">
              <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-lg" />
              {user.isOnline && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-secondary" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{user.name}</p>
              <p className="text-[10px] text-on-surface-variant">{user.role} / Rep {user.reputation}</p>
            </div>
            <MessageSquare size={14} className="text-on-surface-variant" />
          </div>
        ))}
      </div>
    </Widget>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface p-5">
      <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{title}</h2>
      {children}
    </section>
  );
}

function ChatRightPanel({ users }: { users: ChatUser[] }) {
  return (
    <aside className="space-y-5 border-outline/5 bg-surface-high/20 p-4 xl:h-full xl:overflow-y-auto xl:border-l xl:p-5 no-scrollbar">
      <MarketHighlights />
      <BreakingNewsWidget />
      <WhaleFeedWidget />
      <TrendingTagsWidget />
      <AiAssistantBox />
      <ActiveUsersList users={users} />
    </aside>
  );
}

export default function Chat() {
  const users = getChatUsers();
  const [activeChannel, setActiveChannel] = useState('global');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>(() => getChatMessages('global'));

  const activeChannelName = getChatChannels().find((channel) => channel.id === activeChannel)?.name || 'Global Stream';
  const visibleMessages = useMemo(() => messages.filter((message) => message.channelId === activeChannel), [messages, activeChannel]);

  function handleReact(messageId: string, reactionId: string) {
    const reactionLabel = reactionOptions.find((reaction) => reaction.id === reactionId)?.label || reactionId;
    setMessages((current) => current.map((message) => {
      if (message.id !== messageId) return message;
      const existing = message.reactions.find((reaction) => reaction.id === reactionId);
      const reactions = existing
        ? message.reactions.map((reaction) => reaction.id === reactionId ? { ...reaction, count: reaction.count + 1 } : reaction)
        : [...message.reactions, { id: reactionId, label: reactionLabel, count: 1 }];
      return { ...message, reactions };
    }));
  }

  function handleSend(text: string) {
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        userId: 'u6',
        channelId: activeChannel,
        text,
        createdAt: 'Şimdi',
        reactions: []
      }
    ]);
  }

  return (
    <div className="grid min-h-[calc(100vh-160px)] overflow-hidden rounded-[32px] border border-outline/5 bg-surface xl:h-[calc(100vh-160px)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
      {mobileSidebarOpen && (
        <button type="button" aria-label="Close channel drawer" onClick={() => setMobileSidebarOpen(false)} className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm xl:hidden" />
      )}
      <ChatSidebar activeChannel={activeChannel} setActiveChannel={setActiveChannel} mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />

      <section className="flex min-h-[720px] flex-col overflow-hidden xl:min-h-0">
        <header className="flex h-16 items-center justify-between border-b border-outline/5 bg-surface-high/10 px-4 md:px-6">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setMobileSidebarOpen(true)} className="rounded-xl bg-surface-high p-2 text-on-surface-variant xl:hidden">
              <Menu size={18} />
            </button>
            <Globe className="text-primary" size={20} />
            <div>
              <h1 className="text-sm font-bold text-white">{activeChannelName}</h1>
              <p className="text-[10px] font-medium text-secondary">Akıllı topluluk merkezi / {visibleMessages.length} mesaj</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-on-surface-variant">
            <button className="hover:text-white"><Search size={18} /></button>
            <button className="hover:text-white"><Bell size={18} /></button>
            <button className="hover:text-white"><Star size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
          <ChatMessageList messages={visibleMessages} users={users} onReact={handleReact} />
          <div className="mt-8 flex items-center gap-4 py-2 opacity-60">
            <div className="h-px flex-1 bg-outline/30" />
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <Zap size={13} /> Market Alert: $SOL ekosistem hacmi yükseldi
            </span>
            <div className="h-px flex-1 bg-outline/30" />
          </div>
        </div>

        <MessageInput onSend={handleSend} />
      </section>

      <ChatRightPanel users={users} />
    </div>
  );
}
