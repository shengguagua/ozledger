import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, PanelTop } from 'lucide-react';
import { HistoricalAccountDetail } from '../types';
import {
  ownerOrder, ownerPalette, normalizeDisplayName, groupByOwner,
  splitCurrencyBuckets, bucketIsEmpty, calculateSignedTotal, calculateSignedTotalCNYEquivalent,
  getCurrencySymbol, isSubtractingDetail, getBalanceInputValue,
} from '../utils/snapshot';

interface Props {
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
}

const AccountCard: React.FC<{
  detail: HistoricalAccountDetail;
  editable: boolean;
  balanceInputMap: Record<string, string>;
  specialBalanceInputMap: Record<string, string>;
  onBalanceChange?: Props['onBalanceChange'];
  onNameChange?: Props['onNameChange'];
  onCurrencyChange?: Props['onCurrencyChange'];
  onDeleteDetail?: Props['onDeleteDetail'];
  onMoveDetail?: Props['onMoveDetail'];
  showCurrency?: boolean;
}> = ({ detail, editable, balanceInputMap, specialBalanceInputMap, onBalanceChange, onNameChange, onCurrencyChange, onDeleteDetail, onMoveDetail, showCurrency = true }) => {
  const balVal = getBalanceInputValue(detail, balanceInputMap, specialBalanceInputMap);
  const subtracting = isSubtractingDetail(detail);
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-2">
        {editable ? (
          <input type="text" value={detail.name} onChange={(e) => onNameChange?.(detail, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-800 outline-none" />
        ) : (
          <div className="truncate text-sm font-semibold text-slate-800">{normalizeDisplayName(detail.name, detail.currency)}</div>
        )}
        {editable && (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => onMoveDetail?.(detail, 'up')} className="rounded-lg bg-slate-100 p-1 text-slate-500 hover:bg-slate-200"><ArrowUp size={12} /></button>
            <button type="button" onClick={() => onMoveDetail?.(detail, 'down')} className="rounded-lg bg-slate-100 p-1 text-slate-500 hover:bg-slate-200"><ArrowDown size={12} /></button>
            <button type="button" onClick={() => onDeleteDetail?.(detail)} className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100">删除</button>
          </div>
        )}
      </div>
      {showCurrency && (
        editable && detail.accountId.startsWith('folded-') ? (
          <select value={detail.currency} onChange={(e) => onCurrencyChange?.(detail, e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 outline-none">
            <option value="CNY">CNY</option><option value="AUD">AUD</option><option value="USD">USD</option>
          </select>
        ) : (
          <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{detail.currency}</div>
        )
      )}
      {editable ? (
        <input type="text" inputMode="decimal" value={balVal} onChange={(e) => onBalanceChange?.(detail, e.target.value)}
          className={`mt-2.5 w-full rounded-xl border px-2.5 py-2 font-mono text-sm font-bold outline-none ${subtracting ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-800'}`} />
      ) : (
        <div className={`mt-2.5 font-mono text-sm font-bold ${subtracting ? 'text-rose-600' : 'text-slate-800'}`}>
          {getCurrencySymbol(detail.currency)}{detail.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
};

const BucketSection: React.FC<{
  items: HistoricalAccountDetail[];
  label: string;
  exchangeRate: number;
  usdRate: number;
  editable: boolean;
  balanceInputMap: Record<string, string>;
  specialBalanceInputMap: Record<string, string>;
  onBalanceChange?: Props['onBalanceChange'];
  onNameChange?: Props['onNameChange'];
  onCurrencyChange?: Props['onCurrencyChange'];
  onDeleteDetail?: Props['onDeleteDetail'];
  onMoveDetail?: Props['onMoveDetail'];
  showCurrency?: boolean;
}> = ({ items, label, exchangeRate, usdRate, editable, balanceInputMap, specialBalanceInputMap, onBalanceChange, onNameChange, onCurrencyChange, onDeleteDetail, onMoveDetail, showCurrency = true }) => (
  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="rounded-full bg-white px-3 py-1 text-[11px] font-mono font-bold text-slate-500 shadow-sm">
        {label === '人民币'
          ? `¥${calculateSignedTotal(items).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
          : `外币=${calculateSignedTotal(items).toLocaleString('en-US', { maximumFractionDigits: 2 })} / 人民币=${calculateSignedTotalCNYEquivalent(items, exchangeRate, usdRate).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
      </div>
    </div>
    {items.length === 0 ? (
      <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-3 py-4 text-xs text-slate-400">暂无</div>
    ) : (
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
        {items.map((d) => (
          <AccountCard key={d.accountId} detail={d} editable={editable} balanceInputMap={balanceInputMap} specialBalanceInputMap={specialBalanceInputMap}
            onBalanceChange={onBalanceChange} onNameChange={onNameChange} onCurrencyChange={onCurrencyChange}
            onDeleteDetail={onDeleteDetail} onMoveDetail={onMoveDetail} showCurrency={showCurrency} />
        ))}
      </div>
    )}
  </div>
);

const DetailSection: React.FC<Props> = ({
  title, description, details, emptyText, flatten = false, editable = false,
  onBalanceChange, onNameChange, onCurrencyChange, onDeleteDetail, onMoveDetail,
  balanceInputMap = {}, specialBalanceInputMap = {}, exchangeRate, usdRate,
}) => {
  const grouped = useMemo(() => groupByOwner(details), [details]);
  const cardProps = { editable, balanceInputMap, specialBalanceInputMap, exchangeRate, usdRate, onBalanceChange, onNameChange, onCurrencyChange, onDeleteDetail, onMoveDetail };

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      <div className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.92)_100%)] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400"><PanelTop size={13} />{title}</div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {flatten ? (
        <div className="p-5">
          {details.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">{emptyText}</div>
          ) : (
            <div className="space-y-5">
              {[{ key: 'cny', label: '人民币', items: splitCurrencyBuckets(details).cny }, { key: 'foreign', label: '外币', items: splitCurrencyBuckets(details).foreign }].map((b) => (
                <BucketSection key={b.key} items={b.items} label={b.label} {...cardProps} />
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
              <div key={owner} className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_20px_38px_-32px_rgba(15,23,42,0.55)]">
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
                    <div className="mt-1 text-sm font-bold text-slate-900">{bucketIsEmpty(buckets) ? '待补录' : '已归类'}</div>
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto px-4 py-4">
                  {rows.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">{emptyText}</div>
                  ) : (
                    <div className="space-y-5">
                      {[{ key: 'cny', label: '人民币', items: buckets.cny }, { key: 'foreign', label: '外币', items: buckets.foreign }].map((b) => (
                        <BucketSection key={b.key} items={b.items} label={b.label} {...cardProps} showCurrency={false} />
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

export default DetailSection;
