import React from 'react';
import { Sparkles } from 'lucide-react';
import { getCurrencySymbol, normalizeDisplayName } from '../utils/snapshot';

export const MetricCard: React.FC<{
  label: string; value: string; hint?: string; icon: React.ReactNode; tone?: 'default' | 'success' | 'accent';
}> = ({ label, value, hint, icon, tone = 'default' }) => {
  const cls = tone === 'success'
    ? 'border-emerald-200/70 bg-emerald-50/80'
    : tone === 'accent' ? 'border-sky-200/70 bg-sky-50/80' : 'border-slate-200/80 bg-white/90';
  return (
    <div className={`rounded-[24px] border ${cls} p-4 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.45)]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">{icon}</div>
      </div>
      <div className="mt-3 text-xl font-bold text-slate-950">{value}</div>
      {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
    </div>
  );
};

export const ActionButton: React.FC<{
  label: string; icon: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost';
}> = ({ label, icon, onClick, disabled, variant = 'secondary' }) => {
  const cls = variant === 'primary'
    ? 'border border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800'
    : variant === 'ghost' ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
    : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${cls} disabled:cursor-not-allowed disabled:opacity-60`}>
      {icon}{label}
    </button>
  );
};

export const ChangeList: React.FC<{
  title: string; emptyText: string;
  items: Array<{ accountId: string; owner: string; name: string; currency: string; diff: number }>;
}> = ({ title, emptyText, items }) => (
  <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)]">
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
      <Sparkles size={13} />{title}
    </div>
    {items.length === 0 ? (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-4 text-xs text-slate-400">{emptyText}</div>
    ) : (
      <div className="mt-4 grid gap-2.5">
        {items.map((item) => (
          <div key={`${item.accountId}-${item.currency}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-3.5 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">{item.owner} · {normalizeDisplayName(item.name, item.currency)}</div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.currency}</div>
            </div>
            <div className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-sm font-bold ${item.diff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {item.diff >= 0 ? '+' : ''}{getCurrencySymbol(item.currency)}{item.diff.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
