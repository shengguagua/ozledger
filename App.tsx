import React, { useEffect, useMemo, useState } from 'react';
import { AppMeta, AppSettings, AssetSnapshot, BackupHistoryEntry, HistoricalAccountDetail } from './types';
import * as api from './services/apiService';
import { ArrowDown, ArrowUp, CalendarDays, Database, Layers3, Loader2, NotebookPen, PencilLine, RotateCcw, Save, ServerCrash, TrendingDown, TrendingUp, X } from 'lucide-react';

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

const isCommonAccountDetail = (detail: HistoricalAccountDetail, commonAccountIds: Set<string>) => {
  return commonAccountIds.has(detail.accountId) || detail.accountId.startsWith('custom-');
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
  <div className="rounded-[20px] border border-[#e8dfcf] bg-white p-4">
    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</div>
    {items.length === 0 ? (
      <div className="mt-3 rounded-xl border border-dashed border-[#e5dcc9] bg-[#fcfaf4] px-3 py-3 text-xs text-slate-400">
        {emptyText}
      </div>
    ) : (
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={`${item.accountId}-${item.currency}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#f0e6d4] bg-[#fcfaf4] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">{item.owner} · {normalizeDisplayName(item.name, item.currency)}</div>
              <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{item.currency}</div>
            </div>
            <div className={`shrink-0 font-mono text-sm font-bold ${item.diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
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
    <section className="overflow-hidden rounded-[28px] border border-[#e6decd] bg-brand-paper shadow-soft">
      <div className="border-b border-[#ece1cc] bg-[#f8f2e4] px-4 py-4 sm:px-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{title}</div>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      {flatten ? (
        <div className="p-4">
          {flatRows.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#dfd3be] bg-[#fcfaf4] px-4 py-6 text-center text-sm text-slate-400">
              {emptyText}
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { key: 'cny', label: '人民币', items: splitCurrencyBuckets(flatRows).cny },
                { key: 'foreign', label: '外币', items: splitCurrencyBuckets(flatRows).foreign },
              ].map((bucket) => (
                <div key={bucket.key}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{bucket.label}</div>
                    <div className="text-[11px] font-mono font-bold text-slate-500">
                      {bucket.label === '人民币'
                        ? `¥${calculateSignedTotal(bucket.items).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                        : `外币=${calculateSignedTotal(bucket.items).toLocaleString('en-US', { maximumFractionDigits: 2 })} / 人民币=${calculateSignedTotalCNYEquivalent(bucket.items, exchangeRate, usdRate).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                    </div>
                  </div>
                  {bucket.items.length === 0 ? (
                    <div className="rounded-[14px] border border-dashed border-[#e5dcc9] bg-[#fcfaf4] px-3 py-3 text-xs text-slate-400">
                      暂无
                    </div>
                  ) : (
                    <div className="grid gap-2 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
                      {bucket.items.map((detail) => (
                        <div key={`${bucket.key}-${detail.accountId}`} className="rounded-[16px] border border-[#ece2d0] bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-2">
                            {editable ? (
                              <input
                                type="text"
                                value={detail.name}
                                onChange={(e) => onNameChange?.(detail, e.target.value)}
                                className="w-full rounded-lg border border-[#dfd3be] bg-[#fcfaf4] px-2.5 py-2 text-sm font-semibold text-slate-800 outline-none"
                              />
                            ) : (
                              <div className="truncate text-sm font-semibold text-slate-800">{normalizeDisplayName(detail.name, detail.currency)}</div>
                            )}
                            {editable && (
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onMoveDetail?.(detail, 'up')}
                                  className="rounded-lg bg-slate-100 p-1 text-slate-500"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onMoveDetail?.(detail, 'down')}
                                  className="rounded-lg bg-slate-100 p-1 text-slate-500"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteDetail?.(detail)}
                                  className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600"
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
                                className="w-full rounded-lg border border-[#dfd3be] bg-[#fcfaf4] px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 outline-none"
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
                              className={`mt-2 w-full rounded-lg border px-2.5 py-2 font-mono text-sm font-bold outline-none ${isSubtractingDetail(detail) ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-[#dfd3be] bg-[#fcfaf4] text-slate-800'}`}
                            />
                          ) : (
                            <div className={`mt-2 font-mono text-sm font-bold ${isSubtractingDetail(detail) ? 'text-rose-600' : 'text-slate-800'}`}>
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
        <div className="grid gap-4 p-4">
          {ownerOrder.map((owner) => {
            const rows = grouped[owner] || [];
            const buckets = splitCurrencyBuckets(rows);
            const ownerTotal = calculateSignedTotalCNYEquivalent(rows, exchangeRate, usdRate);
            return (
              <div key={owner} className="overflow-hidden rounded-[22px] border border-[#e7decc] bg-white">
                <div className="flex items-center justify-between border-b border-[#efe4d2] bg-[#fcfaf4] px-4 py-3">
                  <div>
                    <div className="text-sm font-bold text-brand-navy">{owner}</div>
                    <div className="mt-1 text-xs font-mono text-slate-500">≈ ¥{ownerTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="rounded-full bg-[#f2eadb] px-2.5 py-1 text-[11px] font-bold text-slate-500">{rows.length} 项</div>
                </div>
                <div className="max-h-[360px] overflow-y-auto px-3 py-3">
                  {rows.length === 0 && (
                    <div className="rounded-[16px] border border-dashed border-[#dfd3be] bg-[#fcfaf4] px-4 py-6 text-center text-sm text-slate-400">
                      {emptyText}
                    </div>
                  )}

                  {rows.length > 0 && (
                    <div className="space-y-4">
                      {[
                        { key: 'cny', label: '人民币', items: buckets.cny },
                        { key: 'foreign', label: '外币', items: buckets.foreign },
                      ].map((bucket) => (
                        <div key={bucket.key}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{bucket.label}</div>
                            <div className="text-[11px] font-mono font-bold text-slate-500">
                              {bucket.label === '人民币'
                                ? `¥${calculateSignedTotal(bucket.items).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                                : `外币=${calculateSignedTotal(bucket.items).toLocaleString('en-US', { maximumFractionDigits: 2 })} / 人民币=${calculateSignedTotalCNYEquivalent(bucket.items, exchangeRate, usdRate).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                            </div>
                          </div>
                          {bucket.items.length === 0 ? (
                            <div className="rounded-[14px] border border-dashed border-[#e5dcc9] bg-[#fcfaf4] px-3 py-3 text-xs text-slate-400">
                              暂无
                            </div>
                          ) : (
                            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
                              {bucket.items.map((detail) => (
                                <div key={`${owner}-${bucket.key}-${detail.accountId}`} className="rounded-[16px] border border-[#ece2d0] bg-[#fcfaf4] px-3 py-3">
                                  <div className="flex items-start justify-between gap-2">
                                    {editable ? (
                                      <input
                                        type="text"
                                        value={detail.name}
                                        onChange={(e) => onNameChange?.(detail, e.target.value)}
                                        className="w-full rounded-lg border border-[#dfd3be] bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 outline-none"
                                      />
                                    ) : (
                                      <div className="truncate text-sm font-semibold text-slate-800">{normalizeDisplayName(detail.name, detail.currency)}</div>
                                    )}
                                    {editable && (
                                      <div className="flex shrink-0 items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => onMoveDetail?.(detail, 'up')}
                                          className="rounded-lg bg-slate-100 p-1 text-slate-500"
                                        >
                                          <ArrowUp size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onMoveDetail?.(detail, 'down')}
                                          className="rounded-lg bg-slate-100 p-1 text-slate-500"
                                        >
                                          <ArrowDown size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onDeleteDetail?.(detail)}
                                          className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600"
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
                                      className={`mt-2 w-full rounded-lg border px-2.5 py-2 font-mono text-sm font-bold outline-none ${isSubtractingDetail(detail) ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-[#dfd3be] bg-white text-slate-800'}`}
                                    />
                                  ) : (
                                    <div className={`mt-2 font-mono text-sm font-bold ${isSubtractingDetail(detail) ? 'text-rose-600' : 'text-slate-800'}`}>
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

  useEffect(() => {
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

    loadData();
  }, []);

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

  const commonAccountIds = useMemo(() => {
    if (!activeSnapshots.length) return new Set<string>();

    const frequencyMap = new Map<string, number>();
    for (const snapshot of activeSnapshots) {
      const seenInSnapshot = new Set<string>();
      for (const detail of snapshot.accountDetails || []) {
        if (seenInSnapshot.has(detail.accountId)) continue;
        seenInSnapshot.add(detail.accountId);
        frequencyMap.set(detail.accountId, (frequencyMap.get(detail.accountId) || 0) + 1);
      }
    }

    const recurringThreshold = Math.max(3, Math.ceil(activeSnapshots.length * 0.4));
    return new Set(
      [...frequencyMap.entries()]
        .filter(([accountId, count]) => {
          const latestDetail = activeSnapshots[0]?.accountDetails?.find((detail) => detail.accountId === accountId);
          const forcedCommon = latestDetail && latestDetail.owner === '家庭' && ['bond', '美股'].includes(latestDetail.name);
          return count >= recurringThreshold || Boolean(forcedCommon);
        })
        .map(([accountId]) => accountId)
    );
  }, [activeSnapshots]);

  const commonDetails = useMemo(
    () => (selectedSnapshot?.accountDetails || []).filter((detail) => commonAccountIds.has(detail.accountId)),
    [selectedSnapshot, commonAccountIds]
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
      ...((selectedSnapshot?.accountDetails || []).filter((detail) => !commonAccountIds.has(detail.accountId))),
      ...foldedSpecificDetails,
    ],
    [selectedSnapshot, commonAccountIds, foldedSpecificDetails]
  );

  const editableAccountDetails = useMemo(
    () => selectedSnapshot?.accountDetails || [],
    [selectedSnapshot]
  );

  const editableSpecificAccountDetails = useMemo(
    () => editableAccountDetails.filter((detail) => !commonAccountIds.has(detail.accountId)),
    [editableAccountDetails, commonAccountIds]
  );

  const displayedCommonDetails = useMemo(() => {
    if (!isEditing) return commonDetails;
    return draftAccountDetails
      .filter((detail) => isCommonAccountDetail(detail, commonAccountIds))
      .map((detail) => ({
      ...detail,
      balance: parseLooseNumber(draftBalances[detail.accountId], detail.balance),
    }));
  }, [commonAccountIds, commonDetails, draftAccountDetails, draftBalances, isEditing]);

  const displayedSpecificDetails = useMemo(() => {
    const actualSpecific = (isEditing ? draftAccountDetails : editableSpecificAccountDetails)
      .filter((detail) => !isCommonAccountDetail(detail, commonAccountIds))
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
  }, [commonAccountIds, draftAccountDetails, draftBalances, draftSpecialBalances, draftSpecialItems, editableSpecificAccountDetails, isEditing, specificDetails]);

  const displayedCreateCommonDetails = useMemo(() => {
    if (!isCreating) return commonDetails;
    return createAccountDetails
      .filter((detail) => isCommonAccountDetail(detail, commonAccountIds))
      .map((detail) => ({
      ...detail,
      balance: parseLooseNumber(createBalances[detail.accountId], detail.balance),
    }));
  }, [commonAccountIds, commonDetails, createAccountDetails, createBalances, isCreating]);

  const displayedCreateSpecificDetails = useMemo(() => {
    const actualSpecific = (isCreating ? createAccountDetails : editableSpecificAccountDetails)
      .filter((detail) => !isCommonAccountDetail(detail, commonAccountIds))
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
  }, [commonAccountIds, createAccountDetails, createBalances, createSpecialBalances, createSpecialItems, editableSpecificAccountDetails, isCreating, specificDetails]);

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
      const payload = await api.saveSnapshots(updatedSnapshots);
      setSnapshots(payload.snapshots);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(await api.getBackupHistory());
      cancelEditing();
    } catch {
      alert('保存失败，请确认后端正在运行。');
    }
  };

  const handleSaveNewSnapshot = async () => {
    if (!selectedSnapshot) return;
    if (!createDate) {
      alert('请选择日期');
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
      totalCNY: createKind === 'new' ? computedCreateTotal : parseLooseNumber(createTotal, 0),
      exchangeRate: parseLooseNumber(createExchangeRate, settings.exchangeRate),
      usdRate: parseLooseNumber(createUsdRate, settings.usdRate),
      note: buildSnapshotNote(createBaseNote, nextSpecialItems.filter((item) => item.name.trim())),
      isDeleted: false,
      accountDetails: nextAccountDetails,
    };

    const updatedSnapshots = [...snapshots.filter((snapshot) => snapshot.date !== createDate), nextSnapshot]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    try {
      const payload = await api.saveSnapshots(updatedSnapshots);
      setSnapshots(payload.snapshots);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(await api.getBackupHistory());
      setSelectedSnapshotId(nextSnapshot.id);
      cancelCreating();
    } catch {
      alert('保存失败，请确认后端正在运行。');
    }
  };

  const handleRestoreBackup = async (fileName?: string) => {
    if (!fileName) return;
    const confirmed = window.confirm(`确认回滚到备份 ${fileName} 吗？当前最新数据会被覆盖。`);
    if (!confirmed) return;

    try {
      setIsRestoringBackup(fileName);
      const payload = await api.restoreBackup(fileName);
      setSnapshots(payload.snapshots || []);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(await api.getBackupHistory());
      alert('回滚完成。');
    } catch {
      alert('回滚失败，请确认后端正在运行且备份文件有效。');
    } finally {
      setIsRestoringBackup('');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
          <span>正在读取快照数据...</span>
        </div>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-[30px] border border-rose-100 bg-white p-8 shadow-soft">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ServerCrash size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">本地数据库服务未启动</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">{serverError}</p>
          <pre className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">{`npm install\nnpm run dev`}</pre>
        </div>
      </div>
    );
  }

  if (!selectedSnapshot) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
        <div className="rounded-[30px] border border-[#e6decd] bg-brand-paper px-6 py-10 text-center shadow-soft">
          <div className="text-lg font-bold text-brand-navy">还没有可查看的期别</div>
          <p className="mt-3 text-sm text-slate-500">数据库里暂无快照记录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-16">
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-[#ddd2bc] bg-[linear-gradient(135deg,#173329_0%,#305342_100%)] p-5 text-white shadow-soft sm:p-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-100/70">Snapshot Ledger</div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold">各期余额总览</h1>
              <p className="mt-2.5 max-w-2xl text-sm leading-6 text-emerald-50/80">
                主页只做一件事：选一个期别，然后看那个时间点的余额情况。上半部分是通用账户，下半部分是当期特有项目。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-50/60">当前选中</div>
                <div className="mt-2 font-mono text-lg font-bold">{selectedSnapshot.date}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-50/60">期别总资产</div>
                <div className="mt-2 font-mono text-lg font-bold">¥{selectedSnapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-50/60">{settings.storageMode || 'sqlite'}</div>
                <div className="mt-2 text-sm font-semibold">{meta.dbPath || 'data/ozledger.sqlite'}</div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-5 rounded-[24px] border border-[#e6decd] bg-brand-paper px-4 py-4 shadow-soft sm:px-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] border border-[#e8dfcf] bg-white px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">最新一期澳币净余额</div>
              <div className="mt-2 font-mono text-lg font-bold text-brand-navy">
                ${spendableCash.audNet.toLocaleString('en-AU', { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-[18px] border border-[#e8dfcf] bg-white px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">最新一期人民币净余额</div>
              <div className="mt-2 font-mono text-lg font-bold text-brand-navy">
                ¥{spendableCash.cnyNet.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-[#e6decd] bg-brand-paper shadow-soft">
          <div className="border-b border-[#ece1cc] bg-[#f8f2e4] px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <CalendarDays size={13} />
              历史期别
            </div>
            <p className="mt-1.5 text-sm text-slate-500">横向选择一个期别，下面立即切换到该期余额详情。</p>
          </div>
          <div className="overflow-x-auto px-4 py-4 sm:px-5">
            <div className="flex min-w-max gap-3">
              {activeSnapshots.map((snapshot) => {
                const isActive = snapshot.id === selectedSnapshot.id;
                return (
                  <button
                    key={snapshot.id}
                    type="button"
                    onClick={() => setSelectedSnapshotId(snapshot.id)}
                    className={`min-w-[148px] rounded-[20px] border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'border-[#18352a] bg-[#18352a] text-white'
                        : 'border-[#e4dac8] bg-white text-slate-700 hover:bg-[#fcfaf4]'
                    }`}
                  >
                    <div className="font-mono text-sm font-bold">{snapshot.date}</div>
                    <div className={`mt-2 text-xs ${isActive ? 'text-emerald-50/70' : 'text-slate-400'}`}>
                      ¥{snapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-[22px] border border-[#e6decd] bg-brand-paper p-4 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <CalendarDays size={13} />
              选中期别
            </div>
            <div className="mt-2.5 text-xl font-bold text-brand-navy">{selectedSnapshot.date}</div>
          </div>
          <div className="rounded-[22px] border border-[#e6decd] bg-brand-paper p-4 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <Layers3 size={13} />
              通用账户
            </div>
            <div className="mt-2.5 text-xl font-bold text-brand-navy">{commonDetails.length}</div>
          </div>
          <div className="rounded-[22px] border border-[#e6decd] bg-brand-paper p-4 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <NotebookPen size={13} />
              当期特有
            </div>
            <div className="mt-2.5 text-xl font-bold text-brand-navy">{specificDetails.length}</div>
          </div>
          <div className="rounded-[22px] border border-[#e6decd] bg-brand-paper p-4 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <Database size={13} />
              当期汇率
            </div>
            <div className="mt-2.5 space-y-1 text-sm font-mono font-bold text-brand-navy">
              <div>AUD/CNY {selectedExchangeRate.toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>
              <div>USD/AUD {selectedUsdRate.toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>
            </div>
          </div>
        </section>

        {overallChange && (
          <section className="mt-5 rounded-[24px] border border-[#e6decd] bg-brand-paper p-4 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">整体资金变化</div>
                <div className="mt-1 text-sm text-slate-500">
                  对比 {selectedSnapshot.date} 和上一期 {previousSnapshot?.date}
                </div>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${overallChange.totalCNY >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {overallChange.totalCNY >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {overallChange.totalCNY >= 0 ? '+' : ''}¥{overallChange.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-[#e8dfcf] bg-white px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">人民币变化</div>
                <div className={`mt-2 font-mono text-base font-bold ${overallChange.cnyChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {overallChange.cnyChange >= 0 ? '+' : ''}¥{overallChange.cnyChange.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-[18px] border border-[#e8dfcf] bg-white px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">澳币变化</div>
                <div className={`mt-2 font-mono text-base font-bold ${overallChange.audChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {overallChange.audChange >= 0 ? '+' : ''}${overallChange.audChange.toLocaleString('en-AU', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-[18px] border border-[#e8dfcf] bg-white px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">美元变化</div>
                <div className={`mt-2 font-mono text-base font-bold ${overallChange.usdChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {overallChange.usdChange >= 0 ? '+' : ''}U${overallChange.usdChange.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-3">
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

        <section className="mt-5 rounded-[28px] border border-[#e6decd] bg-brand-paper p-4 shadow-soft sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">该期说明</div>
              {isEditing ? (
                <div className="mt-2 rounded-xl border border-[#d6d9cf] bg-[#f4f7f0] px-3 py-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">自动重算</div>
                  <div className="mt-1 font-mono text-base font-bold text-brand-navy">
                    ¥{computedDraftTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-base font-bold text-brand-navy">¥{selectedSnapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div>
              )}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftExchangeRate}
                      onChange={(e) => setDraftExchangeRate(e.target.value)}
                      placeholder="AUD/CNY"
                      className="rounded-xl border border-[#dfd3be] bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftUsdRate}
                      onChange={(e) => setDraftUsdRate(e.target.value)}
                      placeholder="USD/AUD"
                      className="rounded-xl border border-[#dfd3be] bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
                    />
                  </div>
                  <textarea
                    value={draftBaseNote}
                    onChange={(e) => setDraftBaseNote(e.target.value)}
                    placeholder="补充说明，这里不会自动覆盖一次性项目列表。"
                    className="min-h-[96px] w-full rounded-2xl border border-[#dfd3be] bg-white px-4 py-3 text-sm leading-6 text-slate-600 outline-none"
                  />
                </div>
              ) : (
                <div className="max-w-3xl text-sm leading-6 text-slate-500">{selectedSnapshot.note || '无备注'}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveSnapshotEdits}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#18352a] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <Save size={15} />
                    保存修改
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#ddd2bc] bg-white px-4 py-2.5 text-sm font-bold text-slate-600"
                  >
                    <X size={15} />
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startCreating('new')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#18352a] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <CalendarDays size={15} />
                    新增新一期
                  </button>
                  <button
                    type="button"
                    onClick={() => startCreating('backfill')}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#ddd2bc] bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
                  >
                    <NotebookPen size={15} />
                    手动补录漏期
                  </button>
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#ddd2bc] bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
                  >
                    <PencilLine size={15} />
                    手动修改这一期
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {isCreating && (
          <section className="mt-5 rounded-[28px] border border-[#d8cfbe] bg-[#fffaf0] p-4 shadow-soft sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  {createKind === 'new' ? '新增新一期' : '手动补录漏期'}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  以当前选中的 {selectedSnapshot.date} 为基础复制一份，再改日期和余额后保存成新期别。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveNewSnapshot}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#18352a] px-4 py-2.5 text-sm font-bold text-white"
                >
                  <Save size={15} />
                  保存新期别
                </button>
                <button
                  type="button"
                  onClick={cancelCreating}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#ddd2bc] bg-white px-4 py-2.5 text-sm font-bold text-slate-600"
                >
                  <X size={15} />
                  取消
                </button>
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
                <div className="rounded-xl border border-[#d6d9cf] bg-[#f4f7f0] px-3 py-2.5">
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
                  className="rounded-xl border border-[#dfd3be] bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
                />
              )}
              <input
                type="text"
                inputMode="decimal"
                value={createExchangeRate}
                onChange={(e) => setCreateExchangeRate(e.target.value)}
                placeholder="AUD/CNY"
                className="rounded-xl border border-[#dfd3be] bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
              />
              <input
                type="text"
                inputMode="decimal"
                value={createUsdRate}
                onChange={(e) => setCreateUsdRate(e.target.value)}
                placeholder="USD/AUD"
                className="rounded-xl border border-[#dfd3be] bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none"
              />
              <input
                type="text"
                value={createBaseNote}
                onChange={(e) => setCreateBaseNote(e.target.value)}
                placeholder="备注，可留空"
                className="rounded-xl border border-[#dfd3be] bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
              />
            </div>

            <div className="mt-5 space-y-5">
              <section className="rounded-[24px] border border-[#e6decd] bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">通用账户维护</div>
                <div className="mt-3 grid gap-3 md:grid-cols-[120px_120px_1fr_100px]">
                  <select value={commonDraftOwner} onChange={(e) => setCommonDraftOwner(e.target.value as HistoricalAccountDetail['owner'])} className="rounded-xl border border-[#dfd3be] bg-[#fcfaf4] px-3 py-2 text-sm outline-none">
                    <option value="小盛">小盛</option>
                    <option value="大王">大王</option>
                    <option value="家庭">家庭</option>
                  </select>
                  <select value={commonDraftCurrency} onChange={(e) => setCommonDraftCurrency(e.target.value as 'CNY' | 'AUD' | 'USD')} className="rounded-xl border border-[#dfd3be] bg-[#fcfaf4] px-3 py-2 text-sm outline-none">
                    <option value="CNY">CNY</option>
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                  </select>
                  <input value={commonDraftName} onChange={(e) => setCommonDraftName(e.target.value)} placeholder="新增通用账户名称" className="rounded-xl border border-[#dfd3be] bg-[#fcfaf4] px-3 py-2 text-sm outline-none" />
                  <button type="button" onClick={() => addCommonAccountRow(true)} className="rounded-xl bg-[#18352a] px-3 py-2 text-sm font-bold text-white">新增</button>
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
                  className="rounded-xl border border-[#ddd2bc] bg-white px-3 py-2 text-xs font-bold text-slate-600"
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
            <section className="rounded-[24px] border border-[#e6decd] bg-white p-4 shadow-soft">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">通用账户维护</div>
              <div className="mt-3 grid gap-3 md:grid-cols-[120px_120px_1fr_100px]">
                <select value={commonDraftOwner} onChange={(e) => setCommonDraftOwner(e.target.value as HistoricalAccountDetail['owner'])} className="rounded-xl border border-[#dfd3be] bg-[#fcfaf4] px-3 py-2 text-sm outline-none">
                  <option value="小盛">小盛</option>
                  <option value="大王">大王</option>
                  <option value="家庭">家庭</option>
                </select>
                <select value={commonDraftCurrency} onChange={(e) => setCommonDraftCurrency(e.target.value as 'CNY' | 'AUD' | 'USD')} className="rounded-xl border border-[#dfd3be] bg-[#fcfaf4] px-3 py-2 text-sm outline-none">
                  <option value="CNY">CNY</option>
                  <option value="AUD">AUD</option>
                  <option value="USD">USD</option>
                </select>
                <input value={commonDraftName} onChange={(e) => setCommonDraftName(e.target.value)} placeholder="新增通用账户名称" className="rounded-xl border border-[#dfd3be] bg-[#fcfaf4] px-3 py-2 text-sm outline-none" />
                <button type="button" onClick={() => addCommonAccountRow(false)} className="rounded-xl bg-[#18352a] px-3 py-2 text-sm font-bold text-white">新增</button>
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
              className="rounded-xl border border-[#ddd2bc] bg-white px-3 py-2 text-xs font-bold text-slate-600"
            >
              新增一次性项目
            </button>
          </div>
        )}

        <section className="mt-5 rounded-[24px] border border-[#e6decd] bg-brand-paper p-4 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">备份与回滚</div>
              <div className="mt-1 text-sm text-slate-500">每次保存都会自动生成备份。这里可以回滚到最近的版本。</div>
            </div>
            <button
              type="button"
              onClick={async () => setBackupHistory(await api.getBackupHistory())}
              className="rounded-xl border border-[#ddd2bc] bg-white px-3 py-2 text-xs font-bold text-slate-600"
            >
              刷新列表
            </button>
          </div>
          <div className="mt-4 grid gap-2">
            {backupHistory.slice(0, 6).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-[#e8dfcf] bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{entry.summary}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })} · {entry.fileName || entry.backupPath || '无文件名'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestoreBackup(entry.fileName)}
                  disabled={isRestoringBackup === entry.fileName}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  <RotateCcw size={13} />
                  {isRestoringBackup === entry.fileName ? '回滚中' : '回滚'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
          <Database size={13} />
          <span>{settings.lastSavedAt ? `最近写入 ${new Date(settings.lastSavedAt).toLocaleString('zh-CN', { hour12: false })}` : 'SQLite 已连接'}</span>
          <span>· 变更日志：`data/change-log.md`</span>
        </div>
      </div>
    </div>
  );
};

export default App;
