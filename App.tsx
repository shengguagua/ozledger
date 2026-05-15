import React, { useEffect, useMemo, useState } from 'react';
import { AppMeta, AppSettings, AssetSnapshot, BackupHistoryEntry, HistoricalAccountDetail } from './types';
import * as api from './services/apiService';
import { ApiRequestError } from './services/apiService';
import { ArrowDown, ArrowUp, BadgeCheck, Building2, CalendarDays, CircleDollarSign, Clock3, Database, Layers3, Loader2, NotebookPen, PanelTop, PencilLine, RotateCcw, Save, ServerCrash, ShieldCheck, Sparkles, TrendingDown, TrendingUp, WalletCards, X } from 'lucide-react';

const ownerOrder = ['小盛', '大王', '家庭'] as const;

const getCurrencySymbol = (currency: string) => {
  if (currency === 'AUD') return '$';
  if (currency === 'USD') return 'U$';
  return '¥';
};

const normalizeDisplayName = (name: string, currency: string) => {
  const directMap = new Map<string, string>([
    ['银行卡（工，中）-工', '工商银行'],
    ['工行卡', '工商银行'],
    ['工行', currency === 'CNY' ? '工商银行' : '工行'],
    ['银行卡（工，中）-中', '中国银行'],
    ['中行', currency === 'CNY' ? '中国银行' : '中行'],
    ['BOC', 'BOC'],
    ['HSBC', 'HSBC'],
    ['ANZ', 'ANZ'],
    ['COM', 'COM'],
    ['银行卡', '银行卡'],
    ['建行卡', '建设银行'],
    ['招行卡', '招商银行'],
    ['信用卡', '信用卡'],
    ['微信', '微信'],
    ['支付宝', '支付宝'],
    ['花呗', '花呗'],
    ['现金', '现金'],
    ['美股', '美股'],
    ['bond', 'bond'],
    ['A股票', 'A股票'],
    ['外汇', '外汇'],
    ['外汇（印尼卢比）', '外汇（印尼卢比）'],
    ['泰铢', '泰铢'],
  ]);

  return directMap.get(name) || name;
};

const normalizeLogicalAccountName = (name: string, currency: string) => {
  const directMap = new Map<string, string>([
    ['银行卡（工，中）-工', '工商银行'],
    ['工行卡', '工商银行'],
    ['工行', currency === 'CNY' ? '工商银行' : '工行'],
    ['银行卡（工，中）-中', currency === 'CNY' ? '中国银行' : 'BOC'],
    ['中行', currency === 'CNY' ? '中国银行' : 'BOC'],
    ['中国银行', '中国银行'],
    ['BOC', 'BOC'],
    ['COM', 'CBA'],
    ['CommBank', 'CBA'],
    ['CBA', 'CBA'],
    ['bond', 'BOND'],
    ['Bond (押金)', 'BOND'],
    ['美股账户', '美股'],
    ['现金(AUD)', '现金'],
    ['现金(CNY)', '现金'],
  ]);

  return directMap.get(name) || normalizeDisplayName(name, currency);
};

const groupByOwner = (details: HistoricalAccountDetail[]) => {
  return details.reduce((acc, detail) => {
    if (!acc[detail.owner]) acc[detail.owner] = [];
    acc[detail.owner].push(detail);
    return acc;
  }, {} as Record<string, HistoricalAccountDetail[]>);
};

const parseFoldedItemsFromNote = (note?: string): HistoricalAccountDetail[] => {
  if (!note) return [];

  const marker = '已折叠一次性项目:';
  const markerIndex = note.indexOf(marker);
  if (markerIndex === -1) return [];

  const foldedText = note.slice(markerIndex + marker.length).trim();
  if (!foldedText) return [];

  return foldedText
    .split(/[；;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const match = item.match(/^(小盛|大王|家庭)-(.+)\s(-?\d+(?:\.\d+)?)\s(AUD|CNY|USD)$/);
      if (!match) return null;

      const [, owner, name, amount, currency] = match;
      return {
        accountId: `folded-${owner}-${index}-${name}`,
        name,
        owner: owner as HistoricalAccountDetail['owner'],
        type: 'pending' as const,
        currency: currency as HistoricalAccountDetail['currency'],
        balance: Number(amount),
      };
    })
    .filter((detail): detail is HistoricalAccountDetail => Boolean(detail));
};

const splitCurrencyBuckets = (rows: HistoricalAccountDetail[]) => ({
  cny: rows.filter((detail) => detail.currency === 'CNY'),
  foreign: rows.filter((detail) => detail.currency !== 'CNY'),
});

const bucketIsEmpty = (buckets: ReturnType<typeof splitCurrencyBuckets>) => {
  return buckets.cny.length === 0 && buckets.foreign.length === 0;
};

const getLogicalAccountKey = (detail: HistoricalAccountDetail) => {
  return [detail.owner, normalizeLogicalAccountName(detail.name, detail.currency), detail.currency].join('::');
};

const isCommonAccountDetail = (detail: HistoricalAccountDetail, commonAccountKeys: Set<string>) => {
  return commonAccountKeys.has(getLogicalAccountKey(detail)) || detail.accountId.startsWith('custom-');
};

const parseLooseNumber = (value: string | number | undefined, fallback = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalized = (value || '').trim();
  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
    return fallback;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hasPositiveRate = (value: string | number | undefined, fallback: number) => parseLooseNumber(value, fallback) > 0;
const hasMatchingManualTotal = (manualTotal: string, computedTotal: number) =>
  Math.abs(parseLooseNumber(manualTotal, computedTotal) - computedTotal) <= 0.01;

const calculateSignedTotal = (rows: HistoricalAccountDetail[]) => {
  return rows.reduce((sum, detail) => {
    return sum + detail.balance;
  }, 0);
};

const calculateSignedTotalCNYEquivalent = (rows: HistoricalAccountDetail[], exchangeRate: number, usdRate: number) => {
  return rows.reduce((sum, detail) => {
    return sum + toCNY(detail.balance, detail.currency, exchangeRate, usdRate);
  }, 0);
};

const formatLocalDateTime = (value?: string) => {
  if (!value) return '尚未写入';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
};

const ownerPalette = {
  小盛: {
    badge: 'bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20',
    panel: 'from-sky-500/8 via-white to-sky-500/5',
    dot: 'bg-sky-500',
  },
  大王: {
    badge: 'bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/20',
    panel: 'from-violet-500/8 via-white to-violet-500/5',
    dot: 'bg-violet-500',
  },
  家庭: {
    badge: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',
    panel: 'from-amber-500/10 via-white to-amber-500/5',
    dot: 'bg-amber-500',
  },
} as const;

const isSubtractingDetail = (detail: HistoricalAccountDetail) => {
  return detail.balance < 0;
};

const buildSnapshotNote = (baseNote: string, foldedItems: HistoricalAccountDetail[]) => {
  const cleanedBase = baseNote.trim();
  if (!foldedItems.length) return cleanedBase;

  const foldedLabel = foldedItems
    .map((detail) => `${detail.owner}-${detail.name} ${detail.balance} ${detail.currency}`)
    .join('；');

  return `${cleanedBase ? `${cleanedBase} | ` : ''}已折叠一次性项目: ${foldedLabel}`;
};

const toCNY = (amount: number, currency: string, exchangeRate: number, usdRate: number) => {
  if (currency === 'CNY') return amount;
  if (currency === 'AUD') return amount * exchangeRate;
  if (currency === 'USD') return amount * exchangeRate / usdRate;
  return amount;
};

const calculateSnapshotTotalCNY = (
  accountDetails: HistoricalAccountDetail[],
  specialItems: HistoricalAccountDetail[],
  exchangeRate: number,
  usdRate: number
) => {
  const accountTotal = accountDetails.reduce((sum, detail) => {
    return sum + toCNY(detail.balance, detail.currency, exchangeRate, usdRate);
  }, 0);

  const specialTotal = specialItems.reduce((sum, detail) => {
    return sum + toCNY(detail.balance, detail.currency, exchangeRate, usdRate);
  }, 0);

  return Number((accountTotal + specialTotal).toFixed(2));
};

const insertCommonDetailAtPreferredPosition = (
  current: HistoricalAccountDetail[],
  nextDetail: HistoricalAccountDetail
) => {
  const details = [...current];
  let insertAt = details.length;

  for (let index = details.length - 1; index >= 0; index -= 1) {
    const detail = details[index];
    if (detail.owner === nextDetail.owner && detail.currency === nextDetail.currency) {
      insertAt = index + 1;
      break;
    }
    if (detail.owner === nextDetail.owner && insertAt === details.length) {
      insertAt = index + 1;
    }
  }

  details.splice(insertAt, 0, nextDetail);
  return details;
};

const moveDetailInList = (
  current: HistoricalAccountDetail[],
  accountId: string,
  direction: 'up' | 'down'
) => {
  const index = current.findIndex((detail) => detail.accountId === accountId);
  if (index === -1) return current;

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= current.length) return current;

  const next = [...current];
  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  return next.map((detail, orderIndex) => ({ ...detail, sortIndex: orderIndex }));
};

const getBalanceInputValue = (
  detail: HistoricalAccountDetail,
  accountBalanceMap: Record<string, string>,
  specialBalanceMap: Record<string, string>
) => {
  if (detail.accountId.startsWith('folded-')) {
    return specialBalanceMap[detail.accountId] ?? String(detail.balance);
  }

  return accountBalanceMap[detail.accountId] ?? String(detail.balance);
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'success' | 'accent';
}> = ({ label, value, hint, icon, tone = 'default' }) => {
  const toneClass = tone === 'success'
    ? 'border-emerald-200/70 bg-emerald-50/80'
    : tone === 'accent'
      ? 'border-sky-200/70 bg-sky-50/80'
      : 'border-slate-200/80 bg-white/90';

  return (
    <div className={`rounded-[24px] border ${toneClass} p-4 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.45)]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
          {icon}
        </div>
      </div>
      <div className="mt-3 text-xl font-bold text-slate-950">{value}</div>
      {hint ? <div className="mt-1 text-sm text-slate-500">{hint}</div> : null}
    </div>
  );
};

const ActionButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}> = ({ label, icon, onClick, disabled, variant = 'secondary' }) => {
  const className = variant === 'primary'
    ? 'border border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800'
    : variant === 'ghost'
      ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
      : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {icon}
      {label}
    </button>
  );
};

const ChangeList: React.FC<{
  title: string;
  emptyText: string;
  items: Array<{
    accountId: string;
    owner: string;
    name: string;
    currency: string;
    diff: number;
  }>;
}> = ({ title, emptyText, items }) => (
  <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)]">
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
      <Sparkles size={13} />
      {title}
    </div>
    {items.length === 0 ? (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-4 text-xs text-slate-400">
        {emptyText}
      </div>
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

const DetailSection: React.FC<{
  title: string;
  description: string;
  details: HistoricalAccountDetail[];
  emptyText: string;
  flatten?: boolean;
  editable?: boolean;
  onBalanceChange?: (detail: HistoricalAccountDetail, value: string) => void;
  onNameChange?: (detail: HistoricalAccountDetail, value: string) => void;
  onCurrencyChange?: (detail: HistoricalAccountDetail, value: string) => void;
  onDeleteDetail?: (detail: HistoricalAccountDetail) => void;
  onMoveDetail?: (detail: HistoricalAccountDetail, direction: 'up' | 'down') => void;
  balanceInputMap?: Record<string, string>;
  specialBalanceInputMap?: Record<string, string>;
  exchangeRate: number;
  usdRate: number;
}> = ({
  title,
  description,
  details,
  emptyText,
  flatten = false,
  editable = false,
  onBalanceChange,
  onNameChange,
  onCurrencyChange,
  onDeleteDetail,
  onMoveDetail,
  balanceInputMap = {},
  specialBalanceInputMap = {},
  exchangeRate,
  usdRate,
}) => {
  const grouped = useMemo(() => groupByOwner(details), [details]);
  const flatRows = useMemo(() => details, [details]);

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      <div className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.92)_100%)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
          <PanelTop size={13} />
          {title}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      {flatten ? (
        <div className="p-5">
          {flatRows.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              {emptyText}
            </div>
          ) : (
            <div className="space-y-5">
              {[
                { key: 'cny', label: '人民币', items: splitCurrencyBuckets(flatRows).cny },
                { key: 'foreign', label: '外币', items: splitCurrencyBuckets(flatRows).foreign },
              ].map((bucket) => (
                <div key={bucket.key} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{bucket.label}</div>
                    <div className="rounded-full bg-white px-3 py-1 text-[11px] font-mono font-bold text-slate-500 shadow-sm">
                      {bucket.label === '人民币'
                        ? `¥${calculateSignedTotal(bucket.items).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                        : `外币=${calculateSignedTotal(bucket.items).toLocaleString('en-US', { maximumFractionDigits: 2 })} / 人民币=${calculateSignedTotalCNYEquivalent(bucket.items, exchangeRate, usdRate).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                    </div>
                  </div>
                  {bucket.items.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-3 py-4 text-xs text-slate-400">
                      暂无
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
                      {bucket.items.map((detail) => (
                        <div key={`${bucket.key}-${detail.accountId}`} className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.45)]">
                          <div className="flex items-start justify-between gap-2">
                            {editable ? (
                              <input
                                type="text"
                                value={detail.name}
                                onChange={(e) => onNameChange?.(detail, e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-800 outline-none"
                              />
                            ) : (
                              <div className="truncate text-sm font-semibold text-slate-800">{normalizeDisplayName(detail.name, detail.currency)}</div>
                            )}
                            {editable && (
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onMoveDetail?.(detail, 'up')}
                                  className="rounded-lg bg-slate-100 p-1 text-slate-500 transition hover:bg-slate-200"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onMoveDetail?.(detail, 'down')}
                                  className="rounded-lg bg-slate-100 p-1 text-slate-500 transition hover:bg-slate-200"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteDetail?.(detail)}
                                  className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100"
                                >
                                  删除
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            {editable && detail.accountId.startsWith('folded-') ? (
                              <select
                                value={detail.currency}
                                onChange={(e) => onCurrencyChange?.(detail, e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 outline-none"
                              >
                                <option value="CNY">CNY</option>
                                <option value="AUD">AUD</option>
                                <option value="USD">USD</option>
                              </select>
                            ) : (
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{detail.currency}</div>
                            )}
                          </div>
                          {editable ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={getBalanceInputValue(detail, balanceInputMap, specialBalanceInputMap)}
                              onChange={(e) => onBalanceChange?.(detail, e.target.value)}
                              className={`mt-2.5 w-full rounded-xl border px-2.5 py-2 font-mono text-sm font-bold outline-none ${isSubtractingDetail(detail) ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                            />
                          ) : (
                            <div className={`mt-2.5 font-mono text-sm font-bold ${isSubtractingDetail(detail) ? 'text-rose-600' : 'text-slate-800'}`}>
                              {getCurrencySymbol(detail.currency)}
                              {detail.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 p-5">
          {ownerOrder.map((owner) => {
            const rows = grouped[owner] || [];
            const buckets = splitCurrencyBuckets(rows);
            const ownerTotal = calculateSignedTotalCNYEquivalent(rows, exchangeRate, usdRate);
            return (
              <div key={owner} className={`overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_20px_38px_-32px_rgba(15,23,42,0.55)]`}>
                <div className={`flex items-center justify-between border-b border-slate-200 bg-gradient-to-r ${ownerPalette[owner].panel} px-4 py-3.5`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${ownerPalette[owner].dot}`} />
                      <div className="text-sm font-bold text-slate-900">{owner}</div>
                      <div className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ownerPalette[owner].badge}`}>{rows.length} 项</div>
                    </div>
                    <div className="mt-1.5 text-xs font-mono text-slate-500">≈ ¥{ownerTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="hidden rounded-2xl border border-white/80 bg-white/70 px-3 py-2 text-right shadow-sm sm:block">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Owner Summary</div>
                    <div className="mt-1 font-display text-sm font-bold text-slate-900">{bucketIsEmpty(buckets) ? '待补录' : '已归类'}</div>
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto px-4 py-4">
                  {rows.length === 0 && (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                      {emptyText}
                    </div>
                  )}

                  {rows.length > 0 && (
                    <div className="space-y-5">
                      {[
                        { key: 'cny', label: '人民币', items: buckets.cny },
                        { key: 'foreign', label: '外币', items: buckets.foreign },
                      ].map((bucket) => (
                        <div key={bucket.key} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{bucket.label}</div>
                            <div className="rounded-full bg-white px-3 py-1 text-[11px] font-mono font-bold text-slate-500 shadow-sm">
                              {bucket.label === '人民币'
                                ? `¥${calculateSignedTotal(bucket.items).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                                : `外币=${calculateSignedTotal(bucket.items).toLocaleString('en-US', { maximumFractionDigits: 2 })} / 人民币=${calculateSignedTotalCNYEquivalent(bucket.items, exchangeRate, usdRate).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                            </div>
                          </div>
                          {bucket.items.length === 0 ? (
                            <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-3 py-4 text-xs text-slate-400">
                              暂无
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
                              {bucket.items.map((detail) => (
                                <div key={`${owner}-${bucket.key}-${detail.accountId}`} className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.5)]">
                                  <div className="flex items-start justify-between gap-2">
                                    {editable ? (
                                      <input
                                        type="text"
                                        value={detail.name}
                                        onChange={(e) => onNameChange?.(detail, e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-800 outline-none"
                                      />
                                    ) : (
                                      <div className="truncate text-sm font-semibold text-slate-800">{normalizeDisplayName(detail.name, detail.currency)}</div>
                                    )}
                                    {editable && (
                                      <div className="flex shrink-0 items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => onMoveDetail?.(detail, 'up')}
                                          className="rounded-lg bg-slate-100 p-1 text-slate-500 transition hover:bg-slate-200"
                                        >
                                          <ArrowUp size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onMoveDetail?.(detail, 'down')}
                                          className="rounded-lg bg-slate-100 p-1 text-slate-500 transition hover:bg-slate-200"
                                        >
                                          <ArrowDown size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onDeleteDetail?.(detail)}
                                          className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100"
                                        >
                                          删除
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{detail.currency}</div>
                                  {editable ? (
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={getBalanceInputValue(detail, balanceInputMap, specialBalanceInputMap)}
                                      onChange={(e) => onBalanceChange?.(detail, e.target.value)}
                                      className={`mt-2.5 w-full rounded-xl border px-2.5 py-2 font-mono text-sm font-bold outline-none ${isSubtractingDetail(detail) ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                                    />
                                  ) : (
                                    <div className={`mt-2.5 font-mono text-sm font-bold ${isSubtractingDetail(detail) ? 'text-rose-600' : 'text-slate-800'}`}>
                                      {getCurrencySymbol(detail.currency)}
                                      {detail.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const App: React.FC = () => {
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ exchangeRate: 4.5, usdRate: 1.5, financialNote: '', storageMode: 'sqlite' });
  const [meta, setMeta] = useState<AppMeta>({});
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [draftBaseNote, setDraftBaseNote] = useState('');
  const [draftAccountDetails, setDraftAccountDetails] = useState<HistoricalAccountDetail[]>([]);
  const [draftBalances, setDraftBalances] = useState<Record<string, string>>({});
  const [draftSpecialItems, setDraftSpecialItems] = useState<HistoricalAccountDetail[]>([]);
  const [draftSpecialBalances, setDraftSpecialBalances] = useState<Record<string, string>>({});
  const [draftExchangeRate, setDraftExchangeRate] = useState('');
  const [draftUsdRate, setDraftUsdRate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createKind, setCreateKind] = useState<'new' | 'backfill'>('new');
  const [createDate, setCreateDate] = useState('');
  const [createTotal, setCreateTotal] = useState('');
  const [createBaseNote, setCreateBaseNote] = useState('');
  const [createAccountDetails, setCreateAccountDetails] = useState<HistoricalAccountDetail[]>([]);
  const [createBalances, setCreateBalances] = useState<Record<string, string>>({});
  const [createSpecialItems, setCreateSpecialItems] = useState<HistoricalAccountDetail[]>([]);
  const [createSpecialBalances, setCreateSpecialBalances] = useState<Record<string, string>>({});
  const [commonDraftOwner, setCommonDraftOwner] = useState<HistoricalAccountDetail['owner']>('小盛');
  const [commonDraftCurrency, setCommonDraftCurrency] = useState<'CNY' | 'AUD' | 'USD'>('CNY');
  const [commonDraftName, setCommonDraftName] = useState('');
  const [createExchangeRate, setCreateExchangeRate] = useState('');
  const [createUsdRate, setCreateUsdRate] = useState('');

  const loadData = async () => {
    try {
      setServerError('');
      const [payload, backups] = await Promise.all([api.getBootstrapData(), api.getBackupHistory()]);
      setSnapshots(payload.snapshots || []);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(backups);
    } catch {
      setServerError('无法连接本地数据库服务，请先运行 `npm run dev`。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApiError = async (error: unknown, fallbackMessage: string) => {
    if (error instanceof ApiRequestError && error.status === 409) {
      setSaveError('发现数据库里有更新过的新数据，这次保存已被拦截。页面将刷新到最新状态。');
      setIsEditing(false);
      setIsCreating(false);
      await loadData();
      return;
    }
    setSaveError(error instanceof Error ? error.message : fallbackMessage);
  };

  const activeSnapshots = useMemo(
    () => snapshots.filter((snapshot) => !snapshot.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [snapshots]
  );

  useEffect(() => {
    if (!activeSnapshots.length) {
      setSelectedSnapshotId('');
      return;
    }

    if (!activeSnapshots.some((snapshot) => snapshot.id === selectedSnapshotId)) {
      setSelectedSnapshotId(activeSnapshots[0].id);
    }
  }, [activeSnapshots, selectedSnapshotId]);

  const selectedSnapshot = activeSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || activeSnapshots[0];
  const selectedSnapshotIndex = activeSnapshots.findIndex((snapshot) => snapshot.id === selectedSnapshot?.id);
  const previousSnapshot = selectedSnapshotIndex >= 0 ? activeSnapshots[selectedSnapshotIndex + 1] : undefined;

  useEffect(() => {
    setIsEditing(false);
    setIsCreating(false);
  }, [selectedSnapshotId]);

  useEffect(() => {
    if (!saveSuccess) return undefined;
    const timeout = window.setTimeout(() => setSaveSuccess(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [saveSuccess]);

  useEffect(() => {
    if (!saveError) return undefined;
    const timeout = window.setTimeout(() => setSaveError(''), 5200);
    return () => window.clearTimeout(timeout);
  }, [saveError]);

  useEffect(() => {
    if (!(isEditing || isCreating)) return undefined;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isCreating, isEditing]);

  const commonAccountKeys = useMemo(() => {
    if (!activeSnapshots.length) return new Set<string>();

    const recentSnapshots = activeSnapshots.slice(0, Math.min(activeSnapshots.length, 6));
    const frequencyMap = new Map<string, number>();
    for (const snapshot of recentSnapshots) {
      const seenInSnapshot = new Set<string>();
      for (const detail of snapshot.accountDetails || []) {
        const logicalKey = getLogicalAccountKey(detail);
        if (seenInSnapshot.has(logicalKey)) continue;
        seenInSnapshot.add(logicalKey);
        frequencyMap.set(logicalKey, (frequencyMap.get(logicalKey) || 0) + 1);
      }
    }

    const recurringThreshold = Math.min(3, recentSnapshots.length);
    return new Set(
      [...frequencyMap.entries()]
        .filter(([logicalKey, count]) => {
          const latestDetail = activeSnapshots[0]?.accountDetails?.find((detail) => getLogicalAccountKey(detail) === logicalKey);
          const forcedCommon = latestDetail && latestDetail.owner === '家庭' && ['BOND', '美股'].includes(normalizeLogicalAccountName(latestDetail.name, latestDetail.currency));
          return count >= recurringThreshold || Boolean(forcedCommon);
        })
        .map(([logicalKey]) => logicalKey)
    );
  }, [activeSnapshots]);

  const commonDetails = useMemo(
    () => (selectedSnapshot?.accountDetails || []).filter((detail) => isCommonAccountDetail(detail, commonAccountKeys)),
    [selectedSnapshot, commonAccountKeys]
  );

  const foldedSpecificDetails = useMemo(
    () => parseFoldedItemsFromNote(selectedSnapshot?.note),
    [selectedSnapshot]
  );

  const baseNote = useMemo(() => {
    if (!selectedSnapshot?.note) return '';
    return selectedSnapshot.note.split('已折叠一次性项目:')[0].replace(/\|\s*$/, '').trim();
  }, [selectedSnapshot]);

  const specificDetails = useMemo(
    () => [
      ...((selectedSnapshot?.accountDetails || []).filter((detail) => !isCommonAccountDetail(detail, commonAccountKeys))),
      ...foldedSpecificDetails,
    ],
    [selectedSnapshot, commonAccountKeys, foldedSpecificDetails]
  );

  const editableAccountDetails = useMemo(
    () => selectedSnapshot?.accountDetails || [],
    [selectedSnapshot]
  );

  const editableSpecificAccountDetails = useMemo(
    () => editableAccountDetails.filter((detail) => !isCommonAccountDetail(detail, commonAccountKeys)),
    [editableAccountDetails, commonAccountKeys]
  );

  const displayedCommonDetails = useMemo(() => {
    if (!isEditing) return commonDetails;
    return draftAccountDetails
      .filter((detail) => isCommonAccountDetail(detail, commonAccountKeys))
      .map((detail) => ({
      ...detail,
      balance: parseLooseNumber(draftBalances[detail.accountId], detail.balance),
    }));
  }, [commonAccountKeys, commonDetails, draftAccountDetails, draftBalances, isEditing]);

  const displayedSpecificDetails = useMemo(() => {
    const actualSpecific = (isEditing ? draftAccountDetails : editableSpecificAccountDetails)
      .filter((detail) => !isCommonAccountDetail(detail, commonAccountKeys))
      .map((detail) => ({
      ...detail,
      balance: parseLooseNumber(draftBalances[detail.accountId], detail.balance),
    }));
    const nextSpecialItems = isEditing
      ? draftSpecialItems.map((detail) => ({
          ...detail,
          balance: parseLooseNumber(draftSpecialBalances[detail.accountId], detail.balance),
        }))
      : [];
    return isEditing ? [...actualSpecific, ...nextSpecialItems] : specificDetails;
  }, [commonAccountKeys, draftAccountDetails, draftBalances, draftSpecialBalances, draftSpecialItems, editableSpecificAccountDetails, isEditing, specificDetails]);

  const displayedCreateCommonDetails = useMemo(() => {
    if (!isCreating) return commonDetails;
    return createAccountDetails
      .filter((detail) => isCommonAccountDetail(detail, commonAccountKeys))
      .map((detail) => ({
      ...detail,
      balance: parseLooseNumber(createBalances[detail.accountId], detail.balance),
    }));
  }, [commonAccountKeys, commonDetails, createAccountDetails, createBalances, isCreating]);

  const displayedCreateSpecificDetails = useMemo(() => {
    const actualSpecific = (isCreating ? createAccountDetails : editableSpecificAccountDetails)
      .filter((detail) => !isCommonAccountDetail(detail, commonAccountKeys))
      .map((detail) => ({
      ...detail,
      balance: parseLooseNumber(createBalances[detail.accountId], detail.balance),
    }));
    const nextSpecialItems = isCreating
      ? createSpecialItems.map((detail) => ({
          ...detail,
          balance: parseLooseNumber(createSpecialBalances[detail.accountId], detail.balance),
        }))
      : [];
    return isCreating ? [...actualSpecific, ...nextSpecialItems] : specificDetails;
  }, [commonAccountKeys, createAccountDetails, createBalances, createSpecialBalances, createSpecialItems, editableSpecificAccountDetails, isCreating, specificDetails]);

  const selectedExchangeRate = selectedSnapshot?.exchangeRate ?? settings.exchangeRate;
  const selectedUsdRate = selectedSnapshot?.usdRate ?? settings.usdRate;

  const latestSnapshot = activeSnapshots[0];

  const spendableCash = useMemo(() => {
    const details = latestSnapshot?.accountDetails || [];
    const excludedNameKeywords = ['待报销', '机票', '生活费'];
    const audNet = details
      .filter((detail) =>
        detail.currency === 'AUD'
        && detail.owner !== '家庭'
        && !['investment', 'longterm', 'pending'].includes(detail.type)
        && !['美股', 'bond'].includes(detail.name)
        && !excludedNameKeywords.some((keyword) => detail.name.includes(keyword))
      )
      .reduce((sum, detail) => sum + detail.balance, 0);
    const cnyNet = details
      .filter((detail) =>
        detail.currency === 'CNY'
        && detail.owner !== '家庭'
        && !['investment', 'longterm', 'pending'].includes(detail.type)
        && !['美股', 'bond'].includes(detail.name)
        && !excludedNameKeywords.some((keyword) => detail.name.includes(keyword))
      )
      .reduce((sum, detail) => sum + detail.balance, 0);

    return { audNet, cnyNet };
  }, [latestSnapshot]);

  const overallChange = useMemo(() => {
    if (!selectedSnapshot || !previousSnapshot) return null;

    const currentMap = new Map((selectedSnapshot.accountDetails || []).map((detail) => [detail.accountId, detail]));
    const previousMap = new Map((previousSnapshot.accountDetails || []).map((detail) => [detail.accountId, detail]));
    const ids = [...new Set([...currentMap.keys(), ...previousMap.keys()])];
    const changes = ids.map((accountId) => {
      const current = currentMap.get(accountId);
      const previous = previousMap.get(accountId);
      return {
        accountId,
        name: current?.name || previous?.name || accountId,
        owner: current?.owner || previous?.owner || '家庭',
        currency: current?.currency || previous?.currency || 'CNY',
        currentBalance: current?.balance || 0,
        previousBalance: previous?.balance || 0,
        diff: (current?.balance || 0) - (previous?.balance || 0),
      };
    }).filter((item) => Math.abs(item.diff) > 0.0001);

    const cnyChange = changes
      .filter((item) => item.currency === 'CNY')
      .reduce((sum, item) => sum + item.diff, 0);
    const audChange = changes
      .filter((item) => item.currency === 'AUD')
      .reduce((sum, item) => sum + item.diff, 0);
    const usdChange = changes
      .filter((item) => item.currency === 'USD')
      .reduce((sum, item) => sum + item.diff, 0);

    const added = changes.filter((item) => Math.abs(item.previousBalance) < 0.0001 && Math.abs(item.currentBalance) > 0.0001);
    const removed = changes.filter((item) => Math.abs(item.currentBalance) < 0.0001 && Math.abs(item.previousBalance) > 0.0001);
    const changed = changes.filter((item) => Math.abs(item.currentBalance) > 0.0001 && Math.abs(item.previousBalance) > 0.0001);

    return {
      totalCNY: Number((selectedSnapshot.totalCNY - previousSnapshot.totalCNY).toFixed(2)),
      cnyChange: Number(cnyChange.toFixed(2)),
      audChange: Number(audChange.toFixed(2)),
      usdChange: Number(usdChange.toFixed(2)),
      added: added.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 6),
      removed: removed.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 6),
      changed: changed.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 8),
    };
  }, [previousSnapshot, selectedSnapshot]);

  const computedCreateTotal = useMemo(() => {
    const nextAccountDetails = createAccountDetails.map((detail) => ({
      ...detail,
      balance: parseLooseNumber(createBalances[detail.accountId], detail.balance),
    }));
    const nextSpecialItems = createSpecialItems.map((detail) => ({
      ...detail,
      balance: parseLooseNumber(createSpecialBalances[detail.accountId], detail.balance),
    }));
    return calculateSnapshotTotalCNY(
      nextAccountDetails,
      nextSpecialItems,
      parseLooseNumber(createExchangeRate, settings.exchangeRate),
      parseLooseNumber(createUsdRate, settings.usdRate)
    );
  }, [createAccountDetails, createBalances, createExchangeRate, createSpecialBalances, createSpecialItems, createUsdRate, settings.exchangeRate, settings.usdRate]);

  const computedDraftTotal = useMemo(() => {
    const nextAccountDetails = draftAccountDetails.map((detail) => ({
      ...detail,
      balance: parseLooseNumber(draftBalances[detail.accountId], detail.balance),
    }));
    const nextSpecialItems = draftSpecialItems.map((detail) => ({
      ...detail,
      balance: parseLooseNumber(draftSpecialBalances[detail.accountId], detail.balance),
    }));
    return calculateSnapshotTotalCNY(
      nextAccountDetails,
      nextSpecialItems,
      parseLooseNumber(draftExchangeRate, settings.exchangeRate),
      parseLooseNumber(draftUsdRate, settings.usdRate)
    );
  }, [draftAccountDetails, draftBalances, draftExchangeRate, draftSpecialBalances, draftSpecialItems, draftUsdRate, settings.exchangeRate, settings.usdRate]);

  const startEditing = () => {
    if (!selectedSnapshot) return;
    setDraftBaseNote(baseNote);
    setDraftBalances(
      Object.fromEntries((selectedSnapshot.accountDetails || []).map((detail) => [detail.accountId, String(detail.balance)]))
    );
    setDraftAccountDetails((selectedSnapshot.accountDetails || []).map((detail) => ({ ...detail })));
    setDraftSpecialItems(foldedSpecificDetails.map((detail) => ({ ...detail })));
    setDraftSpecialBalances(
      Object.fromEntries(foldedSpecificDetails.map((detail) => [detail.accountId, String(detail.balance)]))
    );
    setDraftExchangeRate(String(selectedSnapshot.exchangeRate ?? settings.exchangeRate));
    setDraftUsdRate(String(selectedSnapshot.usdRate ?? settings.usdRate));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setDraftBaseNote('');
    setDraftAccountDetails([]);
    setDraftBalances({});
    setDraftSpecialItems([]);
    setDraftSpecialBalances({});
    setDraftExchangeRate('');
    setDraftUsdRate('');
  };

  const startCreating = (kind: 'new' | 'backfill') => {
    if (!selectedSnapshot) return;
    const nextSpecialItems = foldedSpecificDetails.map((detail, index) => ({
      ...detail,
      accountId: `${detail.accountId}-${Date.now()}-${index}`,
    }));
    setIsEditing(false);
    setCreateKind(kind);
    setCreateDate(kind === 'new' ? new Date().toISOString().split('T')[0] : '');
    setCreateTotal(String(selectedSnapshot.totalCNY));
    setCreateBaseNote('');
    setCreateBalances(
      Object.fromEntries((selectedSnapshot.accountDetails || []).map((detail) => [detail.accountId, String(detail.balance)]))
    );
    setCreateAccountDetails((selectedSnapshot.accountDetails || []).map((detail) => ({ ...detail })));
    setCreateSpecialItems(nextSpecialItems);
    setCreateSpecialBalances(
      Object.fromEntries(nextSpecialItems.map((detail) => [detail.accountId, String(detail.balance)]))
    );
    setCreateExchangeRate(String(selectedSnapshot.exchangeRate ?? settings.exchangeRate));
    setCreateUsdRate(String(selectedSnapshot.usdRate ?? settings.usdRate));
    setIsCreating(true);
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setCreateDate('');
    setCreateTotal('');
    setCreateBaseNote('');
    setCreateAccountDetails([]);
    setCreateBalances({});
    setCreateSpecialItems([]);
    setCreateSpecialBalances({});
    setCreateExchangeRate('');
    setCreateUsdRate('');
  };

  const updateSpecialItem = (index: number, field: 'name' | 'currency' | 'balance', value: string) => {
    setDraftSpecialItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === 'balance') return { ...item, balance: parseLooseNumber(value, item.balance) };
        return { ...item, [field]: value };
      })
    );
  };

  const handleInlineBalanceChange = (detail: HistoricalAccountDetail, value: string) => {
    if (detail.accountId.startsWith('folded-')) {
      setDraftSpecialBalances((current) => ({ ...current, [detail.accountId]: value }));
      return;
    }

    setDraftBalances((current) => ({ ...current, [detail.accountId]: value }));
  };

  const handleInlineSpecialNameChange = (detail: HistoricalAccountDetail, value: string) => {
    const index = draftSpecialItems.findIndex((item) => item.accountId === detail.accountId);
    if (index >= 0) updateSpecialItem(index, 'name', value);
  };

  const handleInlineSpecialCurrencyChange = (detail: HistoricalAccountDetail, value: string) => {
    const index = draftSpecialItems.findIndex((item) => item.accountId === detail.accountId);
    if (index >= 0) updateSpecialItem(index, 'currency', value);
  };

  const handleInlineNameChange = (detail: HistoricalAccountDetail, value: string) => {
    if (detail.accountId.startsWith('folded-')) {
      handleInlineSpecialNameChange(detail, value);
      return;
    }
    setDraftAccountDetails((current) => current.map((item) => (item.accountId === detail.accountId ? { ...item, name: value } : item)));
  };

  const handleCreateInlineBalanceChange = (detail: HistoricalAccountDetail, value: string) => {
    if (detail.accountId.startsWith('folded-')) {
      setCreateSpecialBalances((current) => ({ ...current, [detail.accountId]: value }));
      return;
    }

    setCreateBalances((current) => ({ ...current, [detail.accountId]: value }));
  };

  const addCommonAccountRow = (forCreate: boolean) => {
    if (!commonDraftName.trim()) return;
    const nextDetail: HistoricalAccountDetail = {
      accountId: `custom-${commonDraftOwner}-${commonDraftCurrency}-${Date.now()}`,
      name: commonDraftName.trim(),
      owner: commonDraftOwner,
      type: 'bank',
      currency: commonDraftCurrency,
      balance: 0,
    };

    if (forCreate) {
      setCreateAccountDetails((current) => insertCommonDetailAtPreferredPosition(current, nextDetail));
      setCreateBalances((current) => ({ ...current, [nextDetail.accountId]: '0' }));
    } else {
      setDraftAccountDetails((current) => insertCommonDetailAtPreferredPosition(current, nextDetail));
      setDraftBalances((current) => ({ ...current, [nextDetail.accountId]: '0' }));
    }

    setCommonDraftName('');
  };

  const removeCommonAccountRow = (detail: HistoricalAccountDetail, forCreate: boolean) => {
    if (forCreate) {
      setCreateAccountDetails((current) => current.filter((item) => item.accountId !== detail.accountId));
      setCreateBalances((current) => {
        const next = { ...current };
        delete next[detail.accountId];
        return next;
      });
    } else {
      setDraftAccountDetails((current) => current.filter((item) => item.accountId !== detail.accountId));
      setDraftBalances((current) => {
        const next = { ...current };
        delete next[detail.accountId];
        return next;
      });
    }
  };

  const handleCreateSpecialNameChange = (detail: HistoricalAccountDetail, value: string) => {
    setCreateSpecialItems((current) =>
      current.map((item) => (item.accountId === detail.accountId ? { ...item, name: value } : item))
    );
  };

  const handleCreateSpecialCurrencyChange = (detail: HistoricalAccountDetail, value: string) => {
    setCreateSpecialItems((current) =>
      current.map((item) => (item.accountId === detail.accountId ? { ...item, currency: value as HistoricalAccountDetail['currency'] } : item))
    );
  };

  const handleCreateInlineNameChange = (detail: HistoricalAccountDetail, value: string) => {
    if (detail.accountId.startsWith('folded-')) {
      handleCreateSpecialNameChange(detail, value);
      return;
    }
    setCreateAccountDetails((current) => current.map((item) => (item.accountId === detail.accountId ? { ...item, name: value } : item)));
  };

  const handleMoveDetail = (detail: HistoricalAccountDetail, direction: 'up' | 'down', forCreate: boolean) => {
    if (detail.accountId.startsWith('folded-')) {
      if (forCreate) {
        setCreateSpecialItems((current) => moveDetailInList(current, detail.accountId, direction));
      } else {
        setDraftSpecialItems((current) => moveDetailInList(current, detail.accountId, direction));
      }
      return;
    }

    if (forCreate) {
      setCreateAccountDetails((current) => moveDetailInList(current, detail.accountId, direction));
    } else {
      setDraftAccountDetails((current) => moveDetailInList(current, detail.accountId, direction));
    }
  };

  const handleDeleteDetail = (detail: HistoricalAccountDetail, forCreate: boolean) => {
    if (detail.accountId.startsWith('folded-')) {
      if (forCreate) {
        setCreateSpecialItems((current) => current.filter((item) => item.accountId !== detail.accountId));
        setCreateSpecialBalances((current) => {
          const next = { ...current };
          delete next[detail.accountId];
          return next;
        });
      } else {
        setDraftSpecialItems((current) => current.filter((item) => item.accountId !== detail.accountId));
        setDraftSpecialBalances((current) => {
          const next = { ...current };
          delete next[detail.accountId];
          return next;
        });
      }
      return;
    }
    removeCommonAccountRow(detail, forCreate);
  };

  const addSpecialItem = () => {
    const accountId = `folded-家庭-${Date.now()}`;
    setDraftSpecialItems((current) => [
      ...current,
      {
        accountId,
        name: '',
        owner: '家庭',
        type: 'pending',
        currency: 'CNY',
        balance: 0,
      },
    ]);
    setDraftSpecialBalances((current) => ({ ...current, [accountId]: '0' }));
  };

  const addCreateSpecialItem = () => {
    const accountId = `folded-家庭-${Date.now()}`;
    setCreateSpecialItems((current) => [
      ...current,
      {
        accountId,
        name: '',
        owner: '家庭',
        type: 'pending',
        currency: 'CNY',
        balance: 0,
      },
    ]);
    setCreateSpecialBalances((current) => ({ ...current, [accountId]: '0' }));
  };

  const handleSaveSnapshotEdits = async () => {
    if (!selectedSnapshot) return;
    if (!hasPositiveRate(draftExchangeRate, settings.exchangeRate) || !hasPositiveRate(draftUsdRate, settings.usdRate)) {
      setSaveError('汇率必须是大于 0 的数字。');
      return;
    }

    const nextAccountDetails = draftAccountDetails.map((detail) => ({
      ...detail,
      balance: parseLooseNumber(draftBalances[detail.accountId], detail.balance),
    }));
    const nextSpecialItems = draftSpecialItems.map((detail) => ({
      ...detail,
      balance: parseLooseNumber(draftSpecialBalances[detail.accountId], detail.balance),
    }));

    const nextNote = buildSnapshotNote(draftBaseNote, nextSpecialItems.filter((item) => item.name.trim()));
    const nextSnapshot: AssetSnapshot = {
      ...selectedSnapshot,
      totalCNY: computedDraftTotal,
      exchangeRate: parseLooseNumber(draftExchangeRate, settings.exchangeRate),
      usdRate: parseLooseNumber(draftUsdRate, settings.usdRate),
      note: nextNote,
      accountDetails: nextAccountDetails,
    };

    const updatedSnapshots = snapshots.map((snapshot) => (snapshot.id === selectedSnapshot.id ? nextSnapshot : snapshot));
    try {
      setIsSaving(true);
      setSaveError('');
      const payload = await api.saveSnapshots(updatedSnapshots, settings.lastSavedAt);
      setSnapshots(payload.snapshots);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(await api.getBackupHistory());
      cancelEditing();
      setSaveSuccess(`已保存 ${nextSnapshot.date}`);
    } catch (error) {
      await handleApiError(error, '保存失败，请确认后端正在运行。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNewSnapshot = async () => {
    if (!selectedSnapshot) return;
    if (!createDate) {
      setSaveError('请选择日期。');
      return;
    }
    if (!hasPositiveRate(createExchangeRate, settings.exchangeRate) || !hasPositiveRate(createUsdRate, settings.usdRate)) {
      setSaveError('汇率必须是大于 0 的数字。');
      return;
    }
    if (createKind === 'backfill' && !hasMatchingManualTotal(createTotal, computedCreateTotal)) {
      setSaveError(`手填总资产与明细计算不一致。当前明细自动计算为 ¥${computedCreateTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}。`);
      return;
    }

    const nextAccountDetails = createAccountDetails.map((detail) => ({
      ...detail,
      balance: parseLooseNumber(createBalances[detail.accountId], detail.balance),
    }));
    const nextSpecialItems = createSpecialItems.map((detail) => ({
      ...detail,
      balance: parseLooseNumber(createSpecialBalances[detail.accountId], detail.balance),
    }));

    const nextSnapshot: AssetSnapshot = {
      id: crypto.randomUUID(),
      date: createDate,
      totalCNY: computedCreateTotal,
      exchangeRate: parseLooseNumber(createExchangeRate, settings.exchangeRate),
      usdRate: parseLooseNumber(createUsdRate, settings.usdRate),
      note: buildSnapshotNote(createBaseNote, nextSpecialItems.filter((item) => item.name.trim())),
      isDeleted: false,
      accountDetails: nextAccountDetails,
    };

    const updatedSnapshots = [...snapshots.filter((snapshot) => snapshot.date !== createDate), nextSnapshot]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    try {
      setIsSaving(true);
      setSaveError('');
      const payload = await api.saveSnapshots(updatedSnapshots, settings.lastSavedAt);
      setSnapshots(payload.snapshots);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(await api.getBackupHistory());
      setSelectedSnapshotId(nextSnapshot.id);
      cancelCreating();
      setSaveSuccess(`已保存 ${nextSnapshot.date}`);
    } catch (error) {
      await handleApiError(error, '保存失败，请确认后端正在运行。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreBackup = async (fileName?: string) => {
    if (!fileName) return;
    const confirmed = window.confirm(`确认回滚到备份 ${fileName} 吗？当前最新数据会被覆盖。`);
    if (!confirmed) return;

    try {
      setIsRestoringBackup(fileName);
      setSaveError('');
      const payload = await api.restoreBackup(fileName);
      setSnapshots(payload.snapshots || []);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(await api.getBackupHistory());
      setSaveSuccess(`已回滚到 ${fileName}`);
    } catch (error) {
      await handleApiError(error, '回滚失败，请确认后端正在运行且备份文件有效。');
    } finally {
      setIsRestoringBackup('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent px-6">
        <div className="rounded-[30px] border border-slate-200 bg-white/90 px-8 py-8 shadow-[0_35px_90px_-55px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 size={20} className="animate-spin" />
            <span className="font-medium">正在读取快照数据...</span>
          </div>
        </div>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent p-6">
        <div className="w-full max-w-xl rounded-[32px] border border-rose-100 bg-white/95 p-8 shadow-[0_40px_100px_-60px_rgba(244,63,94,0.45)] backdrop-blur">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-50 text-rose-600">
            <ServerCrash size={24} />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">本地数据库服务未启动</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">{serverError}</p>
          <pre className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">{`npm install\nnpm run dev`}</pre>
        </div>
      </div>
    );
  }

  if (!selectedSnapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent p-6">
        <div className="rounded-[32px] border border-slate-200 bg-white/95 px-6 py-10 text-center shadow-[0_35px_90px_-55px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="font-display text-xl font-bold text-slate-900">还没有可查看的期别</div>
          <p className="mt-3 text-sm text-slate-500">数据库里暂无快照记录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-16 text-slate-800">
      <div className="mx-auto max-w-[1500px] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-slate-200/70 bg-[linear-gradient(135deg,#0f172a_0%,#16213c_35%,#1f4f46_100%)] p-5 text-white shadow-[0_45px_120px_-60px_rgba(15,23,42,0.75)] sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.26em] text-emerald-50/80 backdrop-blur">
                <ShieldCheck size={13} />
                OZLedger Pro
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">资产快照工作台</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200/78 sm:text-[15px]">
                面向连续期别管理的余额总览、变动解释、补录与回滚工作区。所有原有功能和数据保持不变，这一版只把操作体验整理成更像正式商用软件的工作台。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[600px]">
              <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-3.5 backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-200/65">
                  <CalendarDays size={12} />
                  当前期别
                </div>
                <div className="mt-2 font-display text-xl font-bold">{selectedSnapshot.date}</div>
                <div className="mt-1 text-xs text-slate-200/65">已选中查看与编辑</div>
              </div>
              <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-3.5 backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-200/65">
                  <CircleDollarSign size={12} />
                  快照总额
                </div>
                <div className="mt-2 font-mono text-xl font-bold">¥{selectedSnapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div>
                <div className="mt-1 text-xs text-slate-200/65">按当前汇率折算后的总资产</div>
              </div>
              <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-3.5 backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-200/65">
                  <Database size={12} />
                  存储引擎
                </div>
                <div className="mt-2 text-sm font-semibold">{settings.storageMode || 'sqlite'}</div>
                <div className="mt-1 truncate text-xs text-slate-200/65">{meta.dbTargetHost || meta.dbPath || 'data/ozledger.sqlite'}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-4">
            <div className="rounded-[22px] border border-white/12 bg-white/8 px-4 py-3.5 backdrop-blur">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-200/65">同步状态</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <BadgeCheck size={15} className="text-emerald-300" />
                数据库在线
              </div>
            </div>
            <div className="rounded-[22px] border border-white/12 bg-white/8 px-4 py-3.5 backdrop-blur">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-200/65">最近写入</div>
              <div className="mt-2 text-sm font-semibold text-white">{formatLocalDateTime(settings.lastSavedAt)}</div>
            </div>
            <div className="rounded-[22px] border border-white/12 bg-white/8 px-4 py-3.5 backdrop-blur">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-200/65">快照数量</div>
              <div className="mt-2 text-sm font-semibold text-white">{activeSnapshots.length} 期有效记录</div>
            </div>
            <div className="rounded-[22px] border border-white/12 bg-white/8 px-4 py-3.5 backdrop-blur">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-200/65">数据路径</div>
              <div className="mt-2 truncate text-sm font-semibold text-white">{meta.dbPath || 'data/ozledger.sqlite'}</div>
            </div>
          </div>
        </div>

        <section className="mt-5 rounded-[28px] border border-slate-200/80 bg-white/90 px-4 py-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] backdrop-blur sm:px-5">
          {(saveError || saveSuccess) && (
            <div className={`mb-4 rounded-[20px] border px-4 py-3 text-sm ${
              saveError
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
              {saveError || saveSuccess}
            </div>
          )}
          <div className="grid gap-3 xl:grid-cols-4">
            <MetricCard
              label="最新可支配澳币"
              value={`$${spendableCash.audNet.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`}
              hint="排除了家庭长期项目与待报销项"
              icon={<WalletCards size={18} />}
              tone="accent"
            />
            <MetricCard
              label="最新可支配人民币"
              value={`¥${spendableCash.cnyNet.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`}
              hint="最新一期现金流观察位"
              icon={<CircleDollarSign size={18} />}
              tone="success"
            />
            <MetricCard
              label="当前汇率"
              value={`AUD/CNY ${selectedExchangeRate.toLocaleString('en-US', { maximumFractionDigits: 4 })}`}
              hint={`USD/AUD ${selectedUsdRate.toLocaleString('en-US', { maximumFractionDigits: 4 })}`}
              icon={<Building2 size={18} />}
            />
            <MetricCard
              label="最后同步"
              value={formatLocalDateTime(settings.lastSavedAt)}
              hint={meta.dbTargetHost ? `数据库主机 ${meta.dbTargetHost}` : '本地与线上配置已接通'}
              icon={<Clock3 size={18} />}
            />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <CalendarDays size={13} />
              历史期别导航
            </div>
            <p className="mt-2 text-sm text-slate-500">像时间轴一样切换任一期别，下面的账户、说明、差异和备份操作都会跟着切换。</p>
          </div>
          <div className="overflow-x-auto px-5 py-5 sm:px-6">
            <div className="flex min-w-max gap-3 pb-1">
              {activeSnapshots.map((snapshot) => {
                const isActive = snapshot.id === selectedSnapshot.id;
                return (
                  <button
                    key={snapshot.id}
                    type="button"
                    onClick={() => setSelectedSnapshotId(snapshot.id)}
                    className={`min-w-[170px] rounded-[24px] border px-4 py-3.5 text-left transition-all ${
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,0.75)]'
                        : 'border-slate-200 bg-slate-50/90 text-slate-700 hover:-translate-y-0.5 hover:bg-white'
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.2em] opacity-70">Snapshot</div>
                    <div className="mt-2 font-display text-base font-bold">{snapshot.date}</div>
                    <div className={`mt-3 text-xs ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                      ¥{snapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 xl:grid-cols-4">
          <MetricCard
            label="选中期别"
            value={selectedSnapshot.date}
            hint="当前工作上下文"
            icon={<CalendarDays size={18} />}
          />
          <MetricCard
            label="通用账户"
            value={`${commonDetails.length}`}
            hint="长期重复出现的核心账户"
            icon={<Layers3 size={18} />}
          />
          <MetricCard
            label="当期特有"
            value={`${specificDetails.length}`}
            hint="一次性项目与折叠明细"
            icon={<NotebookPen size={18} />}
          />
          <MetricCard
            label="数据库状态"
            value={settings.storageMode || 'sqlite'}
            hint={meta.dbTargetHost ? `target ${meta.dbTargetHost}` : meta.dbPath || '本地文件库'}
            icon={<Database size={18} />}
          />
        </section>

        {overallChange && (
          <section className="mt-5 rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  <Sparkles size={13} />
                  整体资金变化
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  对比 {selectedSnapshot.date} 和上一期 {previousSnapshot?.date}
                </div>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${overallChange.totalCNY >= 0 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'}`}>
                {overallChange.totalCNY >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {overallChange.totalCNY >= 0 ? '+' : ''}¥{overallChange.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-3.5">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">人民币变化</div>
                <div className={`mt-2 font-mono text-base font-bold ${overallChange.cnyChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {overallChange.cnyChange >= 0 ? '+' : ''}¥{overallChange.cnyChange.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-3.5">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">澳币变化</div>
                <div className={`mt-2 font-mono text-base font-bold ${overallChange.audChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {overallChange.audChange >= 0 ? '+' : ''}${overallChange.audChange.toLocaleString('en-AU', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-3.5">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">美元变化</div>
                <div className={`mt-2 font-mono text-base font-bold ${overallChange.usdChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {overallChange.usdChange >= 0 ? '+' : ''}U${overallChange.usdChange.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              <ChangeList
                title="新增项目"
                emptyText="这一期没有新增项目。"
                items={overallChange.added}
              />
              <ChangeList
                title="消失项目"
                emptyText="这一期没有清零或移除项目。"
                items={overallChange.removed}
              />
              <ChangeList
                title="余额变化"
                emptyText="这一期没有持续项目的余额变化。"
                items={overallChange.changed}
              />
            </div>
          </section>
        )}

        <section className="mt-5 rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)] sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="xl:w-[220px]">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                <NotebookPen size={13} />
                期别说明
              </div>
              {isEditing ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">自动重算</div>
                  <div className="mt-1.5 font-mono text-base font-bold text-slate-900">
                    ¥{computedDraftTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">期别总额</div>
                  <div className="mt-1.5 text-base font-bold text-slate-900">¥{selectedSnapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div>
                </div>
              )}
            </div>
            <div className="flex-1 rounded-[26px] border border-slate-200 bg-slate-50/60 p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftExchangeRate}
                      onChange={(e) => setDraftExchangeRate(e.target.value)}
                      placeholder="AUD/CNY"
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftUsdRate}
                      onChange={(e) => setDraftUsdRate(e.target.value)}
                      placeholder="USD/AUD"
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
                    />
                  </div>
                  <textarea
                    value={draftBaseNote}
                    onChange={(e) => setDraftBaseNote(e.target.value)}
                    placeholder="补充说明，这里不会自动覆盖一次性项目列表。"
                    className="min-h-[120px] w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600 outline-none"
                  />
                </div>
              ) : (
                <div className="max-w-4xl text-sm leading-7 text-slate-600">{selectedSnapshot.note || '无备注'}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:w-[360px] xl:justify-end">
              {isEditing ? (
                <>
                  <ActionButton label={isSaving ? '保存中…' : '保存修改'} icon={<Save size={15} />} onClick={handleSaveSnapshotEdits} disabled={isSaving} variant="primary" />
                  <ActionButton label="取消" icon={<X size={15} />} onClick={cancelEditing} variant="ghost" />
                </>
              ) : (
                <>
                  <ActionButton label="新增新一期" icon={<CalendarDays size={15} />} onClick={() => startCreating('new')} variant="primary" />
                  <ActionButton label="手动补录漏期" icon={<NotebookPen size={15} />} onClick={() => startCreating('backfill')} />
                  <ActionButton label="手动修改这一期" icon={<PencilLine size={15} />} onClick={startEditing} />
                </>
              )}
            </div>
          </div>
        </section>

        {isCreating && (
          <section className="mt-5 rounded-[30px] border border-sky-200/70 bg-[linear-gradient(180deg,#f8fbff_0%,#f8fafc_100%)] p-5 shadow-[0_24px_60px_-42px_rgba(14,165,233,0.35)] sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  <Sparkles size={13} />
                  {createKind === 'new' ? '新增新一期' : '手动补录漏期'}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  以当前选中的 {selectedSnapshot.date} 为基础复制一份，再改日期和余额后保存成新期别。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ActionButton label={isSaving ? '保存中…' : '保存新期别'} icon={<Save size={15} />} onClick={handleSaveNewSnapshot} disabled={isSaving} variant="primary" />
                <ActionButton label="取消" icon={<X size={15} />} onClick={cancelCreating} variant="ghost" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[180px_180px_180px_180px_1fr]">
              <input
                type="date"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                className="rounded-xl border border-[#dfd3be] bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              />
              {createKind === 'new' ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">自动计算总资产</div>
                  <div className="mt-1 font-mono text-sm font-bold text-brand-navy">
                    ¥{computedCreateTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  inputMode="decimal"
                  value={createTotal}
                  onChange={(e) => setCreateTotal(e.target.value)}
                  placeholder="期别总资产"
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
                />
              )}
              <input
                type="text"
                inputMode="decimal"
                value={createExchangeRate}
                onChange={(e) => setCreateExchangeRate(e.target.value)}
                placeholder="AUD/CNY"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
              />
              <input
                type="text"
                inputMode="decimal"
                value={createUsdRate}
                onChange={(e) => setCreateUsdRate(e.target.value)}
                placeholder="USD/AUD"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
              />
              <input
                type="text"
                value={createBaseNote}
                onChange={(e) => setCreateBaseNote(e.target.value)}
                placeholder="备注，可留空"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              />
            </div>

            {createKind === 'backfill' && createTotal && (
              <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                hasMatchingManualTotal(createTotal, computedCreateTotal)
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}>
                明细自动计算：¥{computedCreateTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                {!hasMatchingManualTotal(createTotal, computedCreateTotal) && '，请先把手填总资产对齐后再保存。'}
              </div>
            )}

            <div className="mt-5 space-y-5">
              <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.35)]">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">通用账户维护</div>
                <div className="mt-3 grid gap-3 md:grid-cols-[120px_120px_1fr_100px]">
                  <select value={commonDraftOwner} onChange={(e) => setCommonDraftOwner(e.target.value as HistoricalAccountDetail['owner'])} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
                    <option value="小盛">小盛</option>
                    <option value="大王">大王</option>
                    <option value="家庭">家庭</option>
                  </select>
                  <select value={commonDraftCurrency} onChange={(e) => setCommonDraftCurrency(e.target.value as 'CNY' | 'AUD' | 'USD')} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
                    <option value="CNY">CNY</option>
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                  </select>
                  <input value={commonDraftName} onChange={(e) => setCommonDraftName(e.target.value)} placeholder="新增通用账户名称" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none" />
                  <button type="button" onClick={() => addCommonAccountRow(true)} className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800">新增</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {displayedCreateCommonDetails.map((detail) => (
                    <button key={detail.accountId} type="button" onClick={() => removeCommonAccountRow(detail, true)} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">
                      删除 {normalizeDisplayName(detail.name, detail.currency)}
                    </button>
                  ))}
                </div>
              </section>

              <DetailSection
                title="新期别 · 通用账户"
                description="直接在这里改余额。默认基于当前选中期复制。"
                details={displayedCreateCommonDetails}
                emptyText="没有通用账户"
                editable
                onBalanceChange={handleCreateInlineBalanceChange}
                onNameChange={handleCreateInlineNameChange}
                onDeleteDetail={(detail) => handleDeleteDetail(detail, true)}
                onMoveDetail={(detail, direction) => handleMoveDetail(detail, direction, true)}
                balanceInputMap={createBalances}
                specialBalanceInputMap={createSpecialBalances}
                exchangeRate={parseLooseNumber(createExchangeRate, settings.exchangeRate)}
                usdRate={parseLooseNumber(createUsdRate, settings.usdRate)}
              />

              <DetailSection
                title="新期别 · 当期特有"
                description="这里可以补漏掉的一次性项目，或新增这一期独有的项目。"
                details={displayedCreateSpecificDetails}
                emptyText="这一期没有特有项目"
                flatten
                editable
                onBalanceChange={handleCreateInlineBalanceChange}
                onNameChange={handleCreateSpecialNameChange}
                onCurrencyChange={handleCreateSpecialCurrencyChange}
                onDeleteDetail={(detail) => handleDeleteDetail(detail, true)}
                onMoveDetail={(detail, direction) => handleMoveDetail(detail, direction, true)}
                balanceInputMap={createBalances}
                specialBalanceInputMap={createSpecialBalances}
                exchangeRate={parseLooseNumber(createExchangeRate, settings.exchangeRate)}
                usdRate={parseLooseNumber(createUsdRate, settings.usdRate)}
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addCreateSpecialItem}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  新增一次性项目
                </button>
              </div>
            </div>
          </section>
        )}

        {!isCreating && (
        <div className="mt-5 space-y-5">
          {isEditing && (
            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.35)]">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">通用账户维护</div>
              <div className="mt-3 grid gap-3 md:grid-cols-[120px_120px_1fr_100px]">
                <select value={commonDraftOwner} onChange={(e) => setCommonDraftOwner(e.target.value as HistoricalAccountDetail['owner'])} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
                  <option value="小盛">小盛</option>
                  <option value="大王">大王</option>
                  <option value="家庭">家庭</option>
                </select>
                <select value={commonDraftCurrency} onChange={(e) => setCommonDraftCurrency(e.target.value as 'CNY' | 'AUD' | 'USD')} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
                  <option value="CNY">CNY</option>
                  <option value="AUD">AUD</option>
                  <option value="USD">USD</option>
                </select>
                <input value={commonDraftName} onChange={(e) => setCommonDraftName(e.target.value)} placeholder="新增通用账户名称" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none" />
                <button type="button" onClick={() => addCommonAccountRow(false)} className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800">新增</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {displayedCommonDetails.map((detail) => (
                  <button key={detail.accountId} type="button" onClick={() => removeCommonAccountRow(detail, false)} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">
                    删除 {normalizeDisplayName(detail.name, detail.currency)}
                  </button>
                ))}
              </div>
            </section>
          )}

          <DetailSection
            title="通用账户"
            description="这些账户按高频核心账户处理，适合放银行卡、现金、微信、支付宝、固定券商账户等长期反复出现的余额。"
            details={displayedCommonDetails}
            emptyText="没有通用账户"
            editable={isEditing}
            onBalanceChange={handleInlineBalanceChange}
            onNameChange={handleInlineNameChange}
            onDeleteDetail={(detail) => handleDeleteDetail(detail, false)}
            onMoveDetail={(detail, direction) => handleMoveDetail(detail, direction, false)}
            balanceInputMap={draftBalances}
            specialBalanceInputMap={draftSpecialBalances}
            exchangeRate={isEditing ? parseLooseNumber(draftExchangeRate, settings.exchangeRate) : selectedExchangeRate}
            usdRate={isEditing ? parseLooseNumber(draftUsdRate, settings.usdRate) : selectedUsdRate}
          />

          <DetailSection
            title="当期特有"
            description="这里直接按家庭一次性项目看，不再分人。备注里被折叠的机票、生活费、相机、临时存款也会直接拆出来。"
            details={displayedSpecificDetails}
            emptyText="这一期没有特有项目"
            flatten
            editable={isEditing}
            onBalanceChange={handleInlineBalanceChange}
            onNameChange={handleInlineSpecialNameChange}
            onCurrencyChange={handleInlineSpecialCurrencyChange}
            onDeleteDetail={(detail) => handleDeleteDetail(detail, false)}
            onMoveDetail={(detail, direction) => handleMoveDetail(detail, direction, false)}
            balanceInputMap={draftBalances}
            specialBalanceInputMap={draftSpecialBalances}
            exchangeRate={isEditing ? parseLooseNumber(draftExchangeRate, settings.exchangeRate) : selectedExchangeRate}
            usdRate={isEditing ? parseLooseNumber(draftUsdRate, settings.usdRate) : selectedUsdRate}
          />
        </div>
        )}

        {isEditing && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={addSpecialItem}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            >
              新增一次性项目
            </button>
          </div>
        )}

        <section className="mt-5 rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                <ShieldCheck size={13} />
                备份与回滚
              </div>
              <div className="mt-2 text-sm text-slate-500">每次保存都会自动生成备份。这里保留最近的版本，方便回滚。</div>
            </div>
            <button
              type="button"
              onClick={async () => setBackupHistory(await api.getBackupHistory())}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            >
              刷新列表
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {backupHistory.slice(0, 6).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{entry.summary}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })} · {entry.fileName || entry.backupPath || '无文件名'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestoreBackup(entry.fileName)}
                  disabled={isRestoringBackup === entry.fileName}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  {isRestoringBackup === entry.fileName ? '回滚中' : '回滚'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <Database size={13} />
          <span>{settings.lastSavedAt ? `最近写入 ${new Date(settings.lastSavedAt).toLocaleString('zh-CN', { hour12: false })}` : 'SQLite 已连接'}</span>
          <span>· 变更日志：`data/change-log.md`</span>
          <span>· 当前版本保持所有原有保存、补录、回滚能力</span>
        </div>
      </div>
    </div>
  );
};

export default App;
