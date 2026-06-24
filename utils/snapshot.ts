import { HistoricalAccountDetail } from '../types';

export const ownerOrder = ['小盛', '大王', '家庭'] as const;

// 花青 / 赭石 / 黛 —— 国画矿物颜料配色
export const ownerPalette = {
  小盛: { badge: 'bg-qing/10 text-qing-600 ring-1 ring-qing/20', panel: 'from-qing/10 via-paper-50 to-paper-50', dot: 'bg-qing' },
  大王: { badge: 'bg-zhe/10 text-zhe-600 ring-1 ring-zhe/20', panel: 'from-zhe/10 via-paper-50 to-paper-50', dot: 'bg-zhe' },
  家庭: { badge: 'bg-dai/10 text-dai-600 ring-1 ring-dai/20', panel: 'from-dai/10 via-paper-50 to-paper-50', dot: 'bg-dai' },
} as const;

export const getCurrencySymbol = (currency: string) => {
  if (currency === 'AUD') return '$';
  if (currency === 'USD') return 'U$';
  return '¥';
};

const displayMap = new Map<string, string>([
  ['银行卡（工，中）-工', '工商银行'], ['工行卡', '工商银行'], ['银行卡（工，中）-中', '中国银行'], ['建行卡', '建设银行'],
  ['招行卡', '招商银行'], ['BOC', 'BOC'], ['HSBC', 'HSBC'], ['ANZ', 'ANZ'], ['COM', 'COM'],
  ['银行卡', '银行卡'], ['信用卡', '信用卡'], ['微信', '微信'], ['支付宝', '支付宝'], ['花呗', '花呗'],
  ['现金', '现金'], ['美股', '美股'], ['bond', 'bond'], ['A股票', 'A股票'], ['外汇', '外汇'],
  ['外汇（印尼卢比）', '外汇（印尼卢比）'], ['泰铢', '泰铢'],
]);

const logicalMap = new Map<string, string>([
  ['银行卡（工，中）-工', '工商银行'], ['工行卡', '工商银行'],
  ['银行卡（工，中）-中', 'BOC'], ['中行', 'BOC'], ['COM', 'CBA'], ['CommBank', 'CBA'], ['CBA', 'CBA'],
  ['bond', 'BOND'], ['Bond (押金)', 'BOND'], ['美股账户', '美股'], ['现金(AUD)', '现金'], ['现金(CNY)', '现金'],
]);

export const normalizeDisplayName = (name: string, _currency: string) => displayMap.get(name) ?? name;

export const normalizeLogicalAccountName = (name: string, currency: string) => {
  if (logicalMap.has(name)) return logicalMap.get(name)!;
  if (name === '工行' && currency === 'CNY') return '工商银行';
  if (name === '中行' && currency === 'CNY') return '中国银行';
  return normalizeDisplayName(name, currency);
};

export const getLogicalAccountKey = (detail: HistoricalAccountDetail) =>
  [detail.owner, normalizeLogicalAccountName(detail.name, detail.currency), detail.currency].join('::');

export const isCommonAccountDetail = (detail: HistoricalAccountDetail, commonKeys: Set<string>) =>
  commonKeys.has(getLogicalAccountKey(detail)) || detail.accountId.startsWith('custom-');

export const groupByOwner = (details: HistoricalAccountDetail[]) =>
  details.reduce((acc, d) => { (acc[d.owner] ??= []).push(d); return acc; }, {} as Record<string, HistoricalAccountDetail[]>);

export const splitCurrencyBuckets = (rows: HistoricalAccountDetail[]) => ({
  cny: rows.filter((d) => d.currency === 'CNY'),
  foreign: rows.filter((d) => d.currency !== 'CNY'),
});

export const bucketIsEmpty = (b: ReturnType<typeof splitCurrencyBuckets>) => b.cny.length === 0 && b.foreign.length === 0;

export const parseLooseNumber = (value: string | number | undefined, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const n = Number((value || '').trim());
  return Number.isFinite(n) ? n : fallback;
};

export const hasPositiveRate = (v: string | number | undefined, fb: number) => parseLooseNumber(v, fb) > 0;

export const hasMatchingManualTotal = (manual: string, computed: number) =>
  Math.abs(parseLooseNumber(manual, computed) - computed) <= 0.01;

export const toCNY = (amount: number, currency: string, rate: number, usdRate: number) => {
  if (currency === 'CNY') return amount;
  if (currency === 'AUD') return amount * rate;
  if (currency === 'USD') return (amount * rate) / usdRate;
  return amount;
};

export const calculateSignedTotal = (rows: HistoricalAccountDetail[]) => rows.reduce((s, d) => s + d.balance, 0);

export const calculateSignedTotalCNYEquivalent = (rows: HistoricalAccountDetail[], rate: number, usdRate: number) =>
  rows.reduce((s, d) => s + toCNY(d.balance, d.currency, rate, usdRate), 0);

export const calculateSnapshotTotalCNY = (
  accountDetails: HistoricalAccountDetail[],
  specialItems: HistoricalAccountDetail[],
  rate: number, usdRate: number,
) => Number(([...accountDetails, ...specialItems].reduce((s, d) => s + toCNY(d.balance, d.currency, rate, usdRate), 0)).toFixed(2));

export const formatLocalDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未写入';

export const isSubtractingDetail = (d: HistoricalAccountDetail) => d.balance < 0;

export const buildSnapshotNote = (base: string, foldedItems: HistoricalAccountDetail[]) => {
  const clean = base.trim();
  if (!foldedItems.length) return clean;
  const label = foldedItems.map((d) => `${d.owner}-${d.name} ${d.balance} ${d.currency}`).join('；');
  return `${clean ? `${clean} | ` : ''}已折叠一次性项目: ${label}`;
};

export const parseFoldedItemsFromNote = (note?: string): HistoricalAccountDetail[] => {
  if (!note) return [];
  const marker = '已折叠一次性项目:';
  const idx = note.indexOf(marker);
  if (idx === -1) return [];
  return note.slice(idx + marker.length).trim()
    .split(/[；;]+/)
    .map((item, i) => {
      const m = item.trim().match(/^(小盛|大王|家庭)-(.+)\s(-?\d+(?:\.\d+)?)\s(AUD|CNY|USD)$/);
      if (!m) return null;
      const [, owner, name, amount, currency] = m;
      return { accountId: `folded-${owner}-${i}-${name}`, name, owner, type: 'pending' as const, currency, balance: Number(amount) } as HistoricalAccountDetail;
    })
    .filter((d): d is HistoricalAccountDetail => d !== null);
};

export const insertCommonDetailAtPreferredPosition = (
  current: HistoricalAccountDetail[], next: HistoricalAccountDetail,
) => {
  const details = [...current];
  let insertAt = details.length;
  for (let i = details.length - 1; i >= 0; i--) {
    if (details[i].owner === next.owner && details[i].currency === next.currency) { insertAt = i + 1; break; }
    if (details[i].owner === next.owner && insertAt === details.length) insertAt = i + 1;
  }
  details.splice(insertAt, 0, next);
  return details;
};

export const moveDetailInList = (current: HistoricalAccountDetail[], accountId: string, dir: 'up' | 'down') => {
  const i = current.findIndex((d) => d.accountId === accountId);
  if (i === -1) return current;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= current.length) return current;
  const next = [...current];
  [next[i], next[j]] = [next[j], next[i]];
  return next.map((d, idx) => ({ ...d, sortIndex: idx }));
};

export const getBalanceInputValue = (
  detail: HistoricalAccountDetail,
  accountMap: Record<string, string>,
  specialMap: Record<string, string>,
) => (detail.accountId.startsWith('folded-') ? specialMap[detail.accountId] : accountMap[detail.accountId]) ?? String(detail.balance);
