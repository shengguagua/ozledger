import React from 'react';
import { Sparkles } from 'lucide-react';
import { getCurrencySymbol, normalizeDisplayName } from '../utils/snapshot';

type Tone = 'default' | 'success' | 'accent';

const TONE: Record<Tone, { chip: string; mark: string; tick: string }> = {
  default: { chip: 'bg-ink-800 text-paper-50', mark: 'text-ink-900', tick: 'bg-ink-400' },
  success: { chip: 'bg-gain text-paper-50', mark: 'text-gain', tick: 'bg-gain' },
  accent: { chip: 'bg-qing text-paper-50', mark: 'text-qing', tick: 'bg-qing' },
};

/** 印章 — 朱砂方印，书法字 */
export const Seal: React.FC<{ char?: string; size?: number; className?: string }> = ({
  char = '账', size = 40, className = '',
}) => (
  <div
    className={`seal-stamp flex shrink-0 items-center justify-center rounded-[9px] leading-none ${className}`}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.52) }}
  >
    {char}
  </div>
);

/** 宋朝体小标题 + 朱砂提示笔 */
export const SectionLabel: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  icon, children, className = '',
}) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-cinnabar" />
    {icon && <span className="text-ink-400">{icon}</span>}
    <span className="font-serif text-[15px] font-semibold tracking-wide text-ink-600">{children}</span>
  </div>
);

/** 宣纸卡片 */
export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-ink-200/60 bg-paper-50/95 shadow-ink ${className}`}>{children}</div>
);

export const MetricCard: React.FC<{
  label: string; value: string; hint?: string; icon: React.ReactNode; tone?: Tone;
}> = ({ label, value, hint, icon, tone = 'default' }) => {
  const t = TONE[tone];
  const watermark = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 88 })
    : icon;
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={`pointer-events-none absolute -bottom-5 -right-3 opacity-[0.05] ${t.mark}`}>{watermark}</div>
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-[3px] rounded-full ${t.tick}`} />
          <div className="font-serif text-sm text-ink-400">{label}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-[9px] ${t.chip} shadow-ink-sm`}>{icon}</div>
      </div>
      <div className="relative mt-4 font-mono text-[22px] font-semibold tracking-tight text-ink-900">{value}</div>
      {hint && <div className="relative mt-1.5 text-[13px] leading-5 text-ink-400">{hint}</div>}
    </Card>
  );
};

export const ActionButton: React.FC<{
  label: string; icon: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost';
}> = ({ label, icon, onClick, disabled, variant = 'secondary' }) => {
  const cls = variant === 'primary'
    ? 'bg-ink-800 text-paper-50 shadow-ink-sm hover:bg-ink-900'
    : variant === 'ghost'
      ? 'text-ink-500 hover:bg-ink-50'
      : 'border border-ink-200 bg-paper-50 text-ink-700 hover:border-ink-300 hover:bg-paper';
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${cls} disabled:cursor-not-allowed disabled:opacity-50`}>
      {icon}{label}
    </button>
  );
};

export const ChangeList: React.FC<{
  title: string; emptyText: string;
  items: Array<{ accountId: string; owner: string; name: string; currency: string; diff: number }>;
}> = ({ title, emptyText, items }) => (
  <Card className="p-4">
    <SectionLabel icon={<Sparkles size={14} />}>{title}</SectionLabel>
    {items.length === 0 ? (
      <div className="mt-4 rounded-xl border border-dashed border-ink-200 bg-paper px-3 py-5 text-center text-xs text-ink-300">{emptyText}</div>
    ) : (
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={`${item.accountId}-${item.currency}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-paper px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink-700">{item.owner} · {normalizeDisplayName(item.name, item.currency)}</div>
              <div className="mt-0.5 font-mono text-[11px] tracking-wide text-ink-300">{item.currency}</div>
            </div>
            <div className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-sm font-semibold ${item.diff >= 0 ? 'bg-gain-100 text-gain-600' : 'bg-loss-100 text-loss-600'}`}>
              {item.diff >= 0 ? '+' : ''}{getCurrencySymbol(item.currency)}{item.diff.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);
