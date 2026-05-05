import React, { useMemo } from 'react';
import { AssetSnapshot, HistoricalAccountDetail } from '../types';
import { ArrowLeft, CalendarDays, Layers3, NotebookPen } from 'lucide-react';

interface Props {
  snapshot: AssetSnapshot;
  previousSnapshot?: AssetSnapshot;
  onBack: () => void;
}

const ownerOrder = ['小盛', '大王', '家庭'] as const;

const getCurrencySymbol = (currency: string) => {
  if (currency === 'AUD') return '$';
  if (currency === 'USD') return 'U$';
  return '¥';
};

const SnapshotDetailPage: React.FC<Props> = ({ snapshot, previousSnapshot, onBack }) => {
  const groupedDetails = useMemo(() => {
    return (snapshot.accountDetails || []).reduce((acc, detail) => {
      if (!acc[detail.owner]) acc[detail.owner] = [];
      acc[detail.owner].push(detail);
      return acc;
    }, {} as Record<string, HistoricalAccountDetail[]>);
  }, [snapshot]);

  const previousBalanceMap = useMemo(
    () => new Map((previousSnapshot?.accountDetails || []).map((detail) => [detail.accountId, detail.balance])),
    [previousSnapshot]
  );

  const deltaFromPrevious = previousSnapshot ? snapshot.totalCNY - previousSnapshot.totalCNY : 0;

  return (
    <div className="min-h-screen bg-transparent font-sans pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[#ddd2bc] bg-white/85 px-4 py-2 text-sm font-bold text-slate-700 backdrop-blur transition-colors hover:bg-white"
        >
          <ArrowLeft size={16} />
          返回主页
        </button>

        <div className="mt-5 rounded-[34px] border border-[#ddd2bc] bg-[linear-gradient(135deg,#173329_0%,#305342_100%)] p-6 text-white shadow-soft sm:p-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-100/70">Snapshot Detail</div>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-4xl font-bold">{snapshot.date}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/80">
                这是该期的余额结构页，只看这个时间点各账户余额，不展开交易明细。
              </p>
            </div>
            <div className="rounded-[26px] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-50/60">期别总资产</div>
              <div className="mt-2 font-mono text-3xl font-bold">
                ¥{snapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-[#e6decd] bg-brand-paper p-5 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <CalendarDays size={13} />
              与上一期
            </div>
            <div className={`mt-3 font-mono text-2xl font-bold ${deltaFromPrevious >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {previousSnapshot ? `${deltaFromPrevious >= 0 ? '+' : ''}¥${deltaFromPrevious.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}` : '无上一期'}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {previousSnapshot ? `对比 ${previousSnapshot.date}` : '这是最早的一期'}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#e6decd] bg-brand-paper p-5 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <Layers3 size={13} />
              余额项
            </div>
            <div className="mt-3 font-mono text-2xl font-bold text-slate-800">
              {(snapshot.accountDetails || []).length}
            </div>
            <div className="mt-2 text-xs text-slate-400">该期实际记录到的账户数量</div>
          </div>

          <div className="rounded-[28px] border border-[#e6decd] bg-brand-paper p-5 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <NotebookPen size={13} />
              备注
            </div>
            <div className="mt-3 text-sm leading-7 text-slate-600">{snapshot.note || '无备注'}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          {ownerOrder.map((owner) => {
            const rows = (groupedDetails[owner] || []).slice().sort((a, b) => a.currency.localeCompare(b.currency) || a.name.localeCompare(b.name));
            return (
              <section key={owner} className="overflow-hidden rounded-[30px] border border-[#e6decd] bg-brand-paper shadow-soft">
                <div className="border-b border-[#eee3cf] bg-[#f8f1e2] px-5 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{owner}</div>
                  <div className="mt-2 text-xl font-bold text-brand-navy">{rows.length} 个余额项</div>
                </div>
                <div className="grid gap-3 p-4">
                  {rows.length === 0 && (
                    <div className="rounded-[22px] border border-dashed border-[#dfd2bd] bg-white px-4 py-8 text-center text-sm text-slate-400">
                      这一期没有该分组的数据
                    </div>
                  )}

                  {rows.map((detail) => {
                    const previousBalance = previousBalanceMap.get(detail.accountId) || 0;
                    const delta = detail.balance - previousBalance;
                    const isPositive = delta >= 0;
                    return (
                      <div key={`${owner}-${detail.accountId}`} className="rounded-[24px] border border-[#e9deca] bg-white px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-800">{detail.name}</div>
                            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{detail.currency}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm font-bold text-slate-800">
                              {getCurrencySymbol(detail.currency)}
                              {detail.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </div>
                            <div className={`mt-1 text-[11px] font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isPositive ? '+' : ''}
                              {getCurrencySymbol(detail.currency)}
                              {Math.abs(delta).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SnapshotDetailPage;
