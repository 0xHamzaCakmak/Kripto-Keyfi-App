import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Globe,
  Lock,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';

type DeploymentRecord = {
  id: string;
  network: string;
  name: string;
  symbol: string;
  supply: string;
  decimals: string;
  burnable: boolean;
  mintable: boolean;
  pausable: boolean;
  contractAddress: string;
  deployedAt: string;
};

type LaunchpadFormData = {
  network: string;
  name: string;
  symbol: string;
  supply: string;
  decimals: string;
  burnable: boolean;
  mintable: boolean;
  pausable: boolean;
};

type FeatureKey = 'burnable' | 'mintable' | 'pausable';

const STORAGE_KEY = 'kripto-keyfi-launchpad-deployments';

const networks = [
  { name: 'Ethereum', icon: 'ETH', color: 'bg-[#627EEA]' },
  { name: 'Solana', icon: 'S', color: 'bg-[#14F195] text-background' },
  { name: 'Arbitrum', icon: 'A', color: 'bg-[#28A0F0]' },
  { name: 'Polygon', icon: 'P', color: 'bg-[#8247E5]' },
];

const defaultFormData: LaunchpadFormData = {
  network: 'Ethereum',
  name: '',
  symbol: '',
  supply: '1000000',
  decimals: '18',
  burnable: true,
  mintable: false,
  pausable: false,
};

const featureOptions: Array<{ id: FeatureKey; label: string; desc: string }> = [
  { id: 'burnable', label: 'Burnable', desc: 'Tokens can be destroyed to reduce supply.' },
  { id: 'mintable', label: 'Mintable', desc: 'New tokens can be created after deployment.' },
  { id: 'pausable', label: 'Pausable', desc: 'Transfers can be paused in case of emergency.' },
];

function formatAddress(seed: string) {
  const hex = Array.from(seed)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 40)
    .padEnd(40, '0');

  return `0x${hex}`;
}

export default function Launchpad() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<LaunchpadFormData>(defaultFormData);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [latestDeployment, setLatestDeployment] = useState<DeploymentRecord | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as DeploymentRecord[];
      setDeployments(parsed);
      setLatestDeployment(parsed[0] ?? null);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const stepErrors = useMemo(() => {
    const errors: string[] = [];

    if (step === 2) {
      if (!formData.name.trim()) errors.push('Token name is required.');
      if (!formData.symbol.trim()) errors.push('Token symbol is required.');
      if (!/^\d+$/.test(formData.supply.replaceAll(',', ''))) errors.push('Supply must be numeric.');
      if (!/^\d+$/.test(formData.decimals)) errors.push('Decimals must be numeric.');
    }

    return errors;
  }, [formData, step]);

  const nextStep = () => {
    if (stepErrors.length > 0) {
      setSubmitError(stepErrors[0]);
      return;
    }

    setSubmitError(null);
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setSubmitError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const updateField = <K extends keyof LaunchpadFormData>(key: K, value: LaunchpadFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const deployToken = async () => {
    const validationErrors = [
      !formData.name.trim() ? 'Token name is required.' : null,
      !formData.symbol.trim() ? 'Token symbol is required.' : null,
      !/^\d+$/.test(formData.supply.replaceAll(',', '')) ? 'Supply must be numeric.' : null,
      !/^\d+$/.test(formData.decimals) ? 'Decimals must be numeric.' : null,
    ].filter(Boolean) as string[];

    if (validationErrors.length > 0) {
      setSubmitError(validationErrors[0]);
      setStep(2);
      return;
    }

    setSubmitError(null);
    setIsDeploying(true);

    await new Promise((resolve) => window.setTimeout(resolve, 900));

    const deployment: DeploymentRecord = {
      id: crypto.randomUUID(),
      ...formData,
      contractAddress: formatAddress(`${formData.network}-${formData.symbol}-${Date.now()}`),
      deployedAt: new Date().toISOString(),
    };

    const nextDeployments = [deployment, ...deployments].slice(0, 6);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDeployments));
    setDeployments(nextDeployments);
    setLatestDeployment(deployment);
    setIsDeploying(false);
    setStep(4);
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setSubmitError(null);
    setStep(1);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/20 text-primary shadow-xl shadow-primary/10">
          <Rocket size={32} />
        </div>
        <h2 className="text-4xl font-headline font-extrabold tracking-tight text-white">Token Launchpad</h2>
        <p className="text-on-surface-variant max-w-2xl mx-auto">
          Kendi tokenini dakikalar icinde olustur, ozelliklerini sec ve dagitim kaydini bu panelden takip et.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 max-w-6xl mx-auto">
        <div className="glass-panel rounded-[32px] p-8 min-h-[420px] border border-outline/10">
          <div className="flex items-center justify-between px-2 relative mb-8">
            <div className="absolute left-6 right-6 top-5 h-1 bg-white/5 z-0 rounded-full" />
            <div
              className="absolute left-6 top-5 h-1 bg-primary z-0 transition-all duration-500 rounded-full"
              style={{ width: `calc(${((step - 1) / 3) * 100}% - 0.5rem)` }}
            />

            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300',
                    step >= s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface border border-white/10 text-on-surface-variant'
                  )}
                >
                  {step > s ? <CheckCircle2 size={18} /> : s}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-widest',
                    step >= s ? 'text-primary' : 'text-on-surface-variant'
                  )}
                >
                  {s === 1 ? 'Network' : s === 2 ? 'Details' : s === 3 ? 'Options' : 'Deploy'}
                </span>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {step === 1 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-headline font-bold flex items-center gap-2 text-white">
                    <Globe size={20} className="text-primary" />
                    Select Network
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {networks.map((net) => (
                      <button
                        key={net.name}
                        onClick={() => updateField('network', net.name)}
                        className={cn(
                          'p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 group',
                          formData.network === net.name
                            ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                            : 'bg-white/5 border-white/5 hover:border-white/10'
                        )}
                      >
                        <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-110 transition-transform', net.color)}>
                          {net.icon}
                        </div>
                        <span className="font-bold text-white">{net.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-headline font-bold flex items-center gap-2 text-white">
                    <Coins size={20} className="text-primary" />
                    Token Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Token Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Ether Slate"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-primary/50 transition-all"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Symbol</label>
                      <input
                        type="text"
                        placeholder="e.g. SLATE"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-primary/50 transition-all uppercase"
                        value={formData.symbol}
                        onChange={(e) => updateField('symbol', e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Total Supply</label>
                      <input
                        type="text"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-primary/50 transition-all"
                        value={formData.supply}
                        onChange={(e) => updateField('supply', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Decimals</label>
                      <input
                        type="text"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-primary/50 transition-all"
                        value={formData.decimals}
                        onChange={(e) => updateField('decimals', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-headline font-bold flex items-center gap-2 text-white">
                    <Settings size={20} className="text-primary" />
                    Advanced Options
                  </h3>
                  <div className="space-y-4">
                    {featureOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateField(opt.id, !formData[opt.id])}
                        className={cn(
                          'w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between group text-left',
                          formData[opt.id] ? 'bg-primary/10 border-primary' : 'bg-white/5 border-white/5 hover:border-white/10'
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                              formData[opt.id] ? 'bg-primary text-white' : 'bg-white/10 text-on-surface-variant'
                            )}
                          >
                            <Lock size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-white">{opt.label}</p>
                            <p className="text-[11px] text-on-surface-variant">{opt.desc}</p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                            formData[opt.id] ? 'bg-primary border-primary text-white' : 'border-white/20'
                          )}
                        >
                          {formData[opt.id] && <CheckCircle2 size={14} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-headline font-bold flex items-center gap-2 text-white">
                    <Zap size={20} className="text-primary" />
                    Deployment Summary
                  </h3>

                  <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-on-surface-variant">Network</p>
                        <p className="font-bold text-primary">{formData.network}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant">Token Name</p>
                        <p className="font-bold text-white">{formData.name || 'Untitled Token'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant">Symbol</p>
                        <p className="font-bold text-white">{formData.symbol || 'TKN'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant">Total Supply</p>
                        <p className="font-bold text-white">{formData.supply}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-on-surface-variant">Decimals</p>
                        <p className="font-bold text-white">{formData.decimals}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex flex-wrap gap-2">
                      {formData.burnable && <span className="px-2 py-1 rounded bg-secondary/10 text-secondary text-[10px] font-bold uppercase">Burnable</span>}
                      {formData.mintable && <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">Mintable</span>}
                      {formData.pausable && <span className="px-2 py-1 rounded bg-tertiary/10 text-tertiary text-[10px] font-bold uppercase">Pausable</span>}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center gap-3">
                    <AlertCircle size={20} className="text-yellow-400 shrink-0" />
                    <p className="text-xs text-yellow-200">
                      Demo dagitimi yerel olarak kaydedilir. Gercek zincir entegrasyonu icin cuzdan ve backend transaction akisi eklenmelidir.
                    </p>
                  </div>

                  {latestDeployment && (
                    <div className="p-5 rounded-2xl bg-secondary/10 border border-secondary/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="text-secondary shrink-0 mt-0.5" size={20} />
                        <div className="space-y-1">
                          <p className="font-bold text-white">Son olusturulan token kaydi hazir</p>
                          <p className="text-sm text-on-surface-variant">
                            {latestDeployment.name} ({latestDeployment.symbol}) icin uretim kaydi olusturuldu.
                          </p>
                          <p className="text-xs text-secondary break-all">{latestDeployment.contractAddress}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {submitError && (
            <div className="mt-6 p-4 rounded-2xl bg-error/10 border border-error/20 text-error text-sm">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-8 border-t border-white/5">
            <button
              onClick={prevStep}
              disabled={step === 1 || isDeploying}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all',
                step === 1 ? 'opacity-0 pointer-events-none' : 'bg-white/5 border border-white/10 hover:bg-white/10'
              )}
            >
              <ChevronLeft size={20} /> Back
            </button>

            {step < 4 ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              >
                Continue <ChevronRight size={20} />
              </button>
            ) : (
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 font-bold"
                >
                  New Token
                </button>
                <button
                  type="button"
                  onClick={deployToken}
                  disabled={isDeploying}
                  className="flex items-center gap-2 px-10 py-4 rounded-full bg-gradient-to-r from-primary to-secondary text-white font-black text-lg shadow-xl shadow-primary/20 disabled:opacity-70"
                >
                  {isDeploying ? 'Deploying...' : 'Deploy Token'}
                  <Rocket size={22} className={cn(!isDeploying && 'animate-bounce')} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] bg-surface-high p-6 border border-outline/10">
            <h3 className="font-headline font-bold text-white text-lg mb-4 flex items-center gap-2">
              <ShieldCheck size={18} className="text-secondary" />
              Security Checks
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-on-surface-variant">
                <CheckCircle2 size={16} className="text-secondary" />
                Audit-ready ERC20 feature set
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant">
                <CheckCircle2 size={16} className="text-secondary" />
                Network and supply validation
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant">
                <CheckCircle2 size={16} className="text-secondary" />
                Local deployment history
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-surface p-6 border border-outline/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline font-bold text-white text-lg flex items-center gap-2">
                <Clock3 size={18} className="text-primary" />
                Recent Tokens
              </h3>
              <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">{deployments.length} saved</span>
            </div>

            <div className="space-y-3">
              {deployments.length === 0 && (
                <div className="rounded-2xl bg-surface-high p-4 text-sm text-on-surface-variant">
                  Henuz olusturulmus token kaydi yok.
                </div>
              )}

              {deployments.map((deployment) => (
                <div key={deployment.id} className="rounded-2xl bg-surface-high p-4 border border-outline/5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-bold text-white">{deployment.name}</p>
                      <p className="text-xs text-primary">{deployment.symbol} • {deployment.network}</p>
                    </div>
                    <Sparkles size={16} className="text-secondary shrink-0" />
                  </div>
                  <p className="text-[11px] text-on-surface-variant break-all">{deployment.contractAddress}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
