import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, PanelTop } from 'lucide-react';
import { HistoricalAccountDetail } from '../types';
import { SectionLabel } from './ui';
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
    <div className="rounded-xl border border-ink-100 bg-paper-50 px-3.5 py-3 shadow-ink-sm">
      <div className="flex items-start justify-between gap-2">
        {editable ? (
          <input type="text" value={detail.name} onChange={(e) => onNameChange?.(detail, e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-paper px-2.5 py-2 text-sm font-medium text-ink-700 outline-none transition focus:border-ink-400" />
        ) : (
          <div className="truncate text-sm font-medium text-ink-700">{normalizeDisplayName(detail.name, detail.currency)}</div>
        )}
        {editable && (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => onMoveDetail?.(detail, 'up')} className="rounded-md bg-ink-100 p-1 text-ink-500 hover:bg-ink-200"><ArrowUp size={12} /></button>
            <button type="button" onClick={() => onMoveDetail?.(detail, 'down')} className="rounded-md bg-ink-100 p-1 text-ink-500 hover:bg-ink-200"><ArrowDown size={12} /></button>
            <button type="button" onClick={() => onDeleteDetail?.(detail)} className="rounded-md bg-loss-100 px-2 py-1 text-[11px] font-medium text-loss-600 hover:bg-loss/15">删除</button>
          </div>
        )}
      </div>
      {showCurrency && (
        editable && detail.accountId.startsWith('folded-') ? (
          <select value={detail.currency} onChange={(e) => onCurrencyChange?.(detail, e.target.value)}
            className="mt-2 w-full rounded-lg border border-ink-200 bg-paper px-2.5 py-2 font-mono text-[11px] font-medium tracking-wide text-ink-500 outline-none">
            <option value="CNY">CNY</option><option value="AUD">AUD</option><option value="USD">USD</option>
          </select>
        ) : (
          <div className="mt-2 font-mono text-[11px] tracking-wide text-ink-300">{detail.currency}</div>
        )
      )}
      {editable ? (
        <input type="text" inputMode="decimal" value={balVal} onChange={(e) => onBalanceChange?.(detail, e.target.value)}
          className={`mt-2.5 w-full rounded-lg border px-2.5 py-2 font-mono text-sm font-semibold outline-none transition ${subtracting ? 'border-loss/30 bg-loss-100 text-loss-600' : 'border-ink-200 bg-paper text-ink-700 focus:border-ink-400'}`} />
      ) : (
        <div className={`mt-2.5 font-mono text-sm font-semibold ${subtracting ? 'text-loss-600' : 'text-ink-800'}`}>
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
  <div className="rounded-xl border border-ink-100 bg-paper/40 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="font-serif text-sm text-ink-400">{label}</div>
      <div className="rounded-full bg-paper-50 px-3 py-1 font-mono text-[11px] font-semibold text-ink-500 shadow-ink-sm">
        {label === '人民币'
          ? `¥${calculateSignedTotal(items).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
          : `外币=${calculateSignedTotal(items).toLocaleString('en-US', { maximumFractionDigits: 2 })} / 人民币=${calculateSignedTotalCNYEquivalent(items, exchangeRate, usdRate).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
      </div>
    </div>
    {items.length === 0 ? (
      <div className="rounded-lg border border-dashed border-ink-200 bg-paper-50 px-3 py-4 text-xs text-ink-300">暂无</div>
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
    <section className="overflow-hidden rounded-2xl border border-ink-200/60 bg-paper-50/95 shadow-ink">
      <div className="border-b border-ink-100 bg-paper/50 px-5 py-4 sm:px-6">
        <SectionLabel icon={<PanelTop size={14} />}>{title}</SectionLabel>
        <p className="mt-2 text-sm leading-6 text-ink-400">{description}</p>
      </div>
      {flatten ? (
        <div className="p-5">
          {details.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 bg-paper px-4 py-8 text-center text-sm text-ink-300">{emptyText}</div>
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
              <div key={owner} className="overflow-hidden rounded-xl border border-ink-100 bg-paper-50">
                <div className={`flex items-center justify-between border-b border-ink-100 bg-gradient-to-r ${ownerPalette[owner].panel} px-4 py-3.5`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${ownerPalette[owner].dot}`} />
                      <div className="font-serif text-sm font-semibold text-ink-800">{owner}</div>
                      <div className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ownerPalette[owner].badge}`}>{rows.length} 项</div>
                    </div>
                    <div className="mt-1.5 font-mono text-xs text-ink-400">≈ ¥{ownerTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                  </div>
                  <div className="hidden rounded-xl border border-ink-100 bg-paper-50/80 px-3 py-2 text-right shadow-ink-sm sm:block">
                    <div className="font-serif text-[10px] tracking-wide text-ink-300">归类状态</div>
                    <div className="mt-0.5 font-serif text-sm font-semibold text-ink-800">{bucketIsEmpty(buckets) ? '待补录' : '已归类'}</div>
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto px-4 py-4">
                  {rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ink-200 bg-paper px-4 py-8 text-center text-sm text-ink-300">{emptyText}</div>
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
