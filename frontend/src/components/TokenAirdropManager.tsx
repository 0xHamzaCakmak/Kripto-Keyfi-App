import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Coins,
  FileInput,
  FilePlus,
  FileText,
  FolderOpen,
  Fuel,
  LayoutList,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

const MOCK_WALLET_ADDRESS = '0x7Ea8...93bD';
const MOCK_NETWORK = 'Ethereum';
const MOCK_TOKEN = {
  logo: 'https://images.unsplash.com/photo-1558980664-10be5937151f?auto=format&fit=crop&w=120&q=80',
  name: 'KriptoKeyfi Token',
  symbol: 'KKEY',
  decimals: 18,
  balance: '12,475.84',
  network: 'Ethereum',
};

const sampleRecipients = Array.from({ length: 200 }, (_, idx) => {
  const amount = (Math.random() * 480 + 20).toFixed(2);
  const wallet = `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`.padEnd(42, '0');
  const isValid = Math.random() > 0.07;
  const isDuplicate = !isValid ? false : Math.random() > 0.92;
  const status = !isValid ? 'Invalid Address' : isDuplicate ? 'Duplicate' : 'Valid';
  return {
    id: idx + 1,
    wallet: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
    fullWallet: wallet,
    amount,
    status,
    validation: isValid ? (isDuplicate ? 'Duplicate' : 'Valid') : 'Invalid',
  };
});

const toolbarButtons = [
  { label: 'Sort Amount ↑', icon: ArrowUpDown, action: 'sort-asc' },
  { label: 'Sort Amount ↓', icon: ArrowUpDown, action: 'sort-desc' },
  { label: 'Sort Wallet A-Z', icon: LayoutList, action: 'wallet-az' },
  { label: 'Sort Wallet Z-A', icon: LayoutList, action: 'wallet-za' },
  { label: 'Only Invalid', icon: AlertTriangle, action: 'invalid' },
  { label: 'Only Duplicate', icon: AlertTriangle, action: 'duplicate' },
  { label: 'Only Selected', icon: CheckCircle2, action: 'selected' },
  { label: 'Clear Filter', icon: X, action: 'clear' },
];

function formatNumber(value: string | number) {
  return typeof value === 'number' ? value.toLocaleString() : value;
}

function shorten(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function TokenAirdropManager() {
  const [contractAddress, setContractAddress] = useState('0x8Fb3c9a3dA6f6b6C10c4A7d3f8C9B7d3c4A9d2F1');
  const [fileName, setFileName] = useState('wallet-list.csv');
  const [fileSize, setFileSize] = useState('24.1 KB');
  const [totalRows, setTotalRows] = useState(200);
  const [validRows, setValidRows] = useState(186);
  const [invalidRows, setInvalidRows] = useState(14);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [selectedTokenAmount, setSelectedTokenAmount] = useState(3290.72);

  const activeRows = useMemo(() => {
    let rows = sampleRecipients;
    if (searchQuery.trim()) {
      rows = rows.filter((row) => row.wallet.includes(searchQuery) || row.amount.includes(searchQuery));
    }
    if (activeFilter === 'invalid') rows = rows.filter((row) => row.status === 'Invalid Address');
    if (activeFilter === 'duplicate') rows = rows.filter((row) => row.status === 'Duplicate');
    if (activeFilter === 'selected') rows = rows.filter((row) => selectedIds.includes(row.id));
    return rows;
  }, [searchQuery, activeFilter, selectedIds]);

  const selectedCount = selectedIds.length;
  const totalAmount = selectedIds.length ? selectedIds.reduce((sum, id) => {
    const recipient = sampleRecipients.find((row) => row.id === id);
    return sum + (recipient ? Number(recipient.amount) : 0);
  }, 0) : 0;

  function toggleRow(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setTotalRows(200);
    setValidRows(186);
    setInvalidRows(14);
  }

  return (
    <div className="space-y-8 pb-24">
      <header className="rounded-[32px] border border-outline/5 bg-surface p-8 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">
              Premium Airdrop Suite
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight text-white">
                Token Airdrop Manager
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300">
                Upload wallet list and distribute ERC20/BEP20 tokens in one transaction workflow.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-outline/5 bg-surface p-6 shadow-[0_30px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl min-w-[320px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-on-surface-variant">Connected Wallet</p>
                <p className="mt-4 font-headline text-lg font-bold text-white">{MOCK_WALLET_ADDRESS}</p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.18)]">
                Connected
              </span>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="rounded-3xl bg-surface-high p-4 border border-outline/5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Network</p>
                <p className="mt-2 font-semibold text-white">{MOCK_NETWORK}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-3xl bg-surface-high p-4 border border-outline/5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Token Balance</p>
                  <p className="mt-2 font-semibold text-white">{MOCK_TOKEN.balance} {MOCK_TOKEN.symbol}</p>
                </div>
                <div className="rounded-3xl bg-surface-high p-4 border border-outline/5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Native Balance</p>
                  <p className="mt-2 font-semibold text-white">2.18 ETH</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-[32px] border border-outline/5 bg-surface p-8 shadow-[0_40px_120px_rgba(0,0,0,0.4)] backdrop-blur-xl"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Step 1</p>
                <h2 className="mt-3 text-3xl font-bold text-white">Token Information</h2>
              </div>
              <div className="rounded-3xl bg-surface-high px-4 py-3 text-sm text-slate-300 border border-outline/5">
                Read only token preview data from contract lookup.
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-semibold text-white">Contract Address</span>
                <input
                  value={contractAddress}
                  onChange={(event) => setContractAddress(event.target.value)}
                  className="w-full rounded-3xl border border-outline/5 bg-surface px-4 py-3 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Paste Contract Address"
                />
              </label>

              <div className="rounded-3xl border border-outline/5 bg-surface p-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-3xl bg-surface-high p-3 shadow-[0_0_30px_rgba(247,147,26,0.08)]">
                    <img src={MOCK_TOKEN.logo} alt="Token logo" className="h-11 w-11 rounded-2xl object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">Token Preview</p>
                    <p className="mt-2 text-xl font-bold text-white">{MOCK_TOKEN.name}</p>
                    <p className="text-sm text-slate-400">{MOCK_TOKEN.symbol}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-surface-high p-4 border border-outline/5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Decimals</p>
                    <p className="mt-2 text-sm font-semibold text-white">{MOCK_TOKEN.decimals}</p>
                  </div>
                  <div className="rounded-3xl bg-surface-high p-4 border border-outline/5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Your Balance</p>
                    <p className="mt-2 text-sm font-semibold text-white">{MOCK_TOKEN.balance}</p>
                  </div>
                  <div className="rounded-3xl bg-surface-high p-4 border border-outline/5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Network</p>
                    <p className="mt-2 text-sm font-semibold text-white">{MOCK_TOKEN.network}</p>
                  </div>
                  <div className="rounded-3xl bg-surface-high p-4 border border-outline/5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Symbol</p>
                    <p className="mt-2 text-sm font-semibold text-white">{MOCK_TOKEN.symbol}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="rounded-[32px] border border-outline/5 bg-surface p-8 shadow-[0_40px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Step 2</p>
                <h2 className="mt-3 text-3xl font-bold text-white">Upload Wallet List</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-3xl bg-surface-high px-4 py-3 text-sm text-slate-300 border border-outline/5">
                <FileText size={16} /> Supports CSV · XLSX · TXT
              </div>
            </div>

            <div className="mt-8 rounded-[32px] border border-amber-500/10 bg-surface p-8 text-center text-slate-300 shadow-[inset_0_0_80px_rgba(247,147,26,0.08)]">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-surface-high shadow-[0_0_30px_rgba(247,147,26,0.15)]">
                <FileInput className="text-amber-300" size={32} />
              </div>
              <p className="mt-6 text-xl font-semibold text-white">Drag & Drop or Browse File</p>
              <p className="mt-2 text-sm text-slate-400">Upload a wallet list to preview recipients, validation and gas estimates.</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-amber-500/20 bg-surface-high px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-surface-highest">
                  Browse File
                  <input type="file" accept=".csv,.xlsx,.txt" className="hidden" onChange={handleFileChange} />
                </label>
                <span className="text-sm text-slate-500">or drop wallet list directly*</span>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'File Name', value: fileName, icon: FolderOpen },
                { label: 'File Size', value: fileSize, icon: FileText },
                { label: 'Total Rows', value: totalRows, icon: Wallet },
                { label: 'Valid Rows', value: validRows, icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-outline/5 bg-surface-high p-4">
                  <div className="flex items-center gap-3 text-amber-300">
                    <item.icon size={18} />
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{item.label}</p>
                  </div>
                  <p className="mt-4 text-2xl font-bold text-white">{item.value}</p>
                </div>
              ))}
              <div className="rounded-3xl border border-outline/5 bg-surface-high p-4">
                <div className="flex items-center gap-3 text-amber-300">
                  <AlertTriangle size={18} />
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Invalid Rows</p>
                </div>
                <p className="mt-4 text-2xl font-bold text-white">{invalidRows}</p>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-outline/5 bg-surface-high/80 p-5 text-left text-sm text-slate-300">
              <p className="font-semibold text-white">Parsing Rules</p>
              <p className="mt-3 leading-7">Expected columns: <span className="font-medium text-white">Wallet Address</span> and <span className="font-medium text-white">Amount</span>.<br />If invalid address, duplicate or empty amount is detected, the row will be flagged automatically.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="grid gap-4 xl:grid-cols-2"
          >
            {[
              { label: 'Total Wallets', value: 200, icon: Wallet },
              { label: 'Total Selected', value: selectedCount, icon: CheckCircle2 },
              { label: 'Total Token', value: `${formatNumber(selectedCount ? totalAmount.toFixed(2) : 0)} ${MOCK_TOKEN.symbol}`, icon: Coins },
              { label: 'Estimated Gas Fee', value: '0.012 ETH', icon: Fuel },
            ].map((card) => (
              <div key={card.label} className="rounded-[28px] border border-outline/5 bg-surface-high p-6 shadow-[0_25px_50px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-3 text-amber-300">
                  <card.icon size={18} />
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{card.label}</p>
                </div>
                <p className="mt-5 text-3xl font-bold text-white">{card.value}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="rounded-[32px] border border-outline/5 bg-surface p-6 shadow-[0_40px_90px_rgba(0,0,0,0.3)]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-2 sm:grid-cols-2 sm:items-center">
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded-3xl border border-outline/5 bg-surface px-4 py-3 text-sm text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    placeholder="Search Wallet or Address"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {toolbarButtons.map((button) => (
                  <button
                    key={button.action}
                    type="button"
                    onClick={() => setActiveFilter(button.action)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                      activeFilter === button.action
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-outline/5 bg-surface-high text-slate-300 hover:border-amber-500/20 hover:text-white'
                    )}
                  >
                    <button.icon size={16} />
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="rounded-[32px] border border-outline/5 bg-surface p-0 shadow-[0_40px_90px_rgba(0,0,0,0.35)]"
          >
            <div className="overflow-hidden rounded-[32px] border-b border-outline/5 bg-surface-high p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-amber-300">Recipient Table</p>
                  <h3 className="mt-2 text-2xl font-bold text-white">Distribution list</h3>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <ShieldCheck size={16} /> Live validation
                </div>
              </div>
            </div>
            <div className="max-h-[660px] overflow-x-auto overflow-y-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="sticky top-0 bg-surface-high">
                  <tr>
                    <th className="whitespace-nowrap border-b border-outline/5 px-4 py-4 text-slate-400"> <input type="checkbox" className="h-4 w-4 rounded border-outline/5 bg-surface-high text-amber-300" aria-label="Select all recipients" /> </th>
                    <th className="border-b border-outline/5 px-4 py-4 text-slate-400">Wallet Address</th>
                    <th className="border-b border-outline/5 px-4 py-4 text-slate-400">Amount</th>
                    <th className="border-b border-outline/5 px-4 py-4 text-slate-400">Status</th>
                    <th className="border-b border-outline/5 px-4 py-4 text-slate-400">Validation</th>
                    <th className="border-b border-outline/5 px-4 py-4 text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((recipient) => {
                    const selected = selectedIds.includes(recipient.id);
                    return (
                      <motion.tr
                        key={recipient.id}
                        layout
                        whileHover={{ y: -1 }}
                        className={cn(
                          'border-b border-outline/5 transition-colors',
                          selected ? 'bg-surface-high' : 'bg-transparent'
                        )}
                      >
                        <td className="px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleRow(recipient.id)}
                            className="h-4 w-4 rounded border-outline/5 text-amber-300"
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-white">{recipient.wallet}</span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(recipient.fullWallet)}
                              className="rounded-full border border-outline/5 bg-surface-high p-2 text-slate-400 transition hover:border-amber-500/30 hover:text-white"
                            >
                              <ClipboardCopy size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-white">{recipient.amount} {MOCK_TOKEN.symbol}</td>
                        <td className="px-4 py-4 align-top">
                          <span className={cn(
                            'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]',
                            recipient.status === 'Valid' ? 'bg-emerald-500/10 text-emerald-300' : recipient.status === 'Duplicate' ? 'bg-amber-500/10 text-amber-300' : 'bg-red-500/10 text-red-300'
                          )}>
                            {recipient.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-300">{recipient.validation}</td>
                        <td className="px-4 py-4 align-top">
                          <div className="inline-flex flex-wrap gap-2">
                            <button className="inline-flex items-center gap-2 rounded-full border border-outline/5 bg-surface-high px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-amber-500/30 hover:text-white">
                              <ChevronDown size={12} /> Edit
                            </button>
                            <button className="inline-flex items-center gap-2 rounded-full border border-outline/5 bg-surface-high px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-red-400/30 hover:text-white">
                              <X size={12} /> Delete
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-[32px] border border-outline/5 bg-surface p-6 shadow-[0_40px_100px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center gap-3 text-amber-300">
              <Sparkles size={20} />
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Summary Panel</p>
            </div>
            <div className="mt-6 space-y-4">
              {[
                { label: 'Connected Wallet', value: MOCK_WALLET_ADDRESS },
                { label: 'Token', value: `${MOCK_TOKEN.symbol}` },
                { label: 'Current Balance', value: `${MOCK_TOKEN.balance} ${MOCK_TOKEN.symbol}` },
                { label: 'Selected Wallets', value: selectedCount },
                { label: 'Total Amount', value: `${formatNumber(totalAmount.toFixed(2))} ${MOCK_TOKEN.symbol}` },
                { label: 'Estimated Gas', value: '0.012 ETH' },
                { label: 'Remaining Balance', value: `${(Number(MOCK_TOKEN.balance.replace(',', '')) - totalAmount).toFixed(2)} ${MOCK_TOKEN.symbol}` },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-outline/5 bg-surface-high p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-3xl border border-amber-500/10 bg-surface-high p-4">
              <p className="text-sm font-semibold text-white">Warnings</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2 text-amber-200"><AlertTriangle size={16} /> <span>14 invalid rows detected.</span></li>
                <li className="flex items-start gap-2 text-amber-200"><AlertTriangle size={16} /> <span>5 duplicate wallet entries found.</span></li>
                <li className="flex items-start gap-2 text-rose-300"><AlertTriangle size={16} /> <span>Estimated total may exceed safe transfer threshold.</span></li>
              </ul>
            </div>
          </motion.div>
        </aside>
      </section>

      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-10"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-4xl overflow-hidden rounded-[36px] border border-outline/5 bg-surface shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-outline/5 px-6 py-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Transaction Preview</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Ready to distribute</h2>
                </div>
                <button type="button" onClick={() => setIsPreviewOpen(false)} className="rounded-full border border-outline/5 bg-surface-high p-3 text-slate-300 transition hover:bg-surface-highest">
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="space-y-5 rounded-[28px] border border-outline/5 bg-surface-high p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl bg-surface-high p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Token</p>
                      <p className="mt-2 text-lg font-semibold text-white">{MOCK_TOKEN.name} ({MOCK_TOKEN.symbol})</p>
                    </div>
                    <div className="rounded-3xl bg-surface-high p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Network</p>
                      <p className="mt-2 text-lg font-semibold text-white">{MOCK_NETWORK}</p>
                    </div>
                    <div className="rounded-3xl bg-surface-high p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Wallet Count</p>
                      <p className="mt-2 text-lg font-semibold text-white">{selectedCount || 0}</p>
                    </div>
                    <div className="rounded-3xl bg-surface-high p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Estimated Gas</p>
                      <p className="mt-2 text-lg font-semibold text-white">0.012 ETH / $24.80</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-amber-300">First 10 Recipients</p>
                    <div className="mt-4 space-y-3 rounded-[24px] bg-surface-high p-4">
                      {sampleRecipients.slice(0, 10).map((recipient) => (
                        <div key={recipient.id} className="flex items-center justify-between gap-4 rounded-3xl border border-outline/5 bg-surface-high px-4 py-3">
                          <p className="font-semibold text-white">{recipient.wallet}</p>
                          <p className="text-sm text-slate-300">{recipient.amount} {MOCK_TOKEN.symbol}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4 rounded-[28px] border border-outline/5 bg-surface p-6">
                  <div className="rounded-3xl bg-surface-high p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Gas Estimate</p>
                    <p className="mt-3 text-3xl font-bold text-white">0.012 ETH</p>
                    <p className="text-sm text-slate-400">Approx. $24.80</p>
                  </div>
                  <div className="rounded-3xl bg-surface-high p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Total Amount</p>
                    <p className="mt-3 text-3xl font-bold text-white">{formatNumber(totalAmount.toFixed(2))} {MOCK_TOKEN.symbol}</p>
                  </div>
                  <button className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
                    <Send size={18} /> Confirm Distribution
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline/5 bg-surface/95 px-6 py-4 backdrop-blur-xl shadow-[0_-20px_60px_rgba(0,0,0,0.55)]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <button className="inline-flex items-center gap-2 rounded-full border border-outline/5 bg-surface-high px-4 py-3 text-white transition hover:bg-surface-highest">
              <FilePlus size={16} /> Import Another File
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-outline/5 bg-surface-high px-4 py-3 text-white transition hover:bg-surface-highest">
              <X size={16} /> Clear List
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-amber-500 bg-amber-500/10 px-4 py-3 text-amber-300 transition hover:bg-amber-500/15">
              <LayoutList size={16} /> Preview Transaction
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-outline/5 bg-surface-high px-4 py-3 text-white transition hover:bg-surface-highest">
              <ShieldCheck size={16} /> Review Selected
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            disabled={!isConnected || !contractAddress || validRows === 0 || selectedCount === 0}
            className="inline-flex items-center justify-center rounded-3xl bg-amber-500 px-6 py-4 text-sm font-bold text-slate-950 shadow-[0_30px_60px_rgba(247,147,26,0.28)] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
