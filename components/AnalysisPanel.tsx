import React, { useEffect, useMemo, useState } from 'react';
import { AssetSnapshot, HistoricalAccountDetail } from '../types';
import { ArrowDownRight, ArrowUpRight, BarChart3, Layers2, Milestone } from 'lucide-react';

interface Props {
  snapshots: AssetSnapshot[];
  currentTotalCNY: number;
  currentDetails: HistoricalAccountDetail[];
  exchangeRate: number;
}

const owners = ['小盛', '大王', '家庭'] as const;

const symbol = (currency: string) => {
  if (currency === 'AUD') return '$';
  if (currency === 'USD') return 'U$';
  return '¥';
};

const AnalysisPanel: React.FC<Props> = ({ snapshots, currentTotalCNY, currentDetails, exchangeRate }) => {
  const activeSnapshots = useMemo(
    () => snapshots.filter((snapshot) => !snapshot.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [snapshots]
  );

  const timeline = useMemo(() => {
    const historical = activeSnapshots.map((snapshot, index) => {
      const previous = activeSnapshots[index + 1];
      return {
        id: snapshot.id,
        date: snapshot.date,
        totalCNY: snapshot.totalCNY,
        note: snapshot.note || '',
        accountDetails: snapshot.accountDetails || [],
        delta: previous ? snapshot.totalCNY - previous.totalCNY : 0,
      };
    });

    return [
      {
        id: 'live',
        date: '当前',
        totalCNY: currentTotalCNY,
        note: '当前期余额（未保存）',
        accountDetails: currentDetails,
        delta: historical[0] ? currentTotalCNY - historical[0].totalCNY : 0,
      },
      ...historical,
    ];
  }, [activeSnapshots, currentTotalCNY, currentDetails]);

  const [selectedId, setSelectedId] = useState<string>(timeline[0]?.id || 'live');

  useEffect(() => {
    if (!timeline.some((item) => item.id === selectedId)) {
      setSelectedId(timeline[0]?.id || 'live');
    }
  }, [timeline, selectedId]);

  const selected = timeline.find((item) => item.id === selectedId) || timeline[0];
  const previous = timeline.find((item) => item.id !== selected?.id && item.date !== '当前' && new Date(item.date).getTime() < new Date(selected?.date || '').getTime())
    || activeSnapshots[0];

  const groupedDetails = useMemo(() => {
    return (selected?.accountDetails || []).reduce((acc, detail) => {
      if (!acc[detail.owner]) acc[detail.owner] = [];
      acc[detail.owner].push(detail);
      return acc;
    }, {} as Record<string, HistoricalAccountDetail[]>);
  }, [selected]);

  const previousMap = useMemo(
    () => new Map((((previous as AssetSnapshot | undefined)?.accountDetails) || []).map((detail) => [detail.accountId, detail.balance])),
    [previous]
  );

  const ownerTotals = useMemo(() => {
    const compute = (details: HistoricalAccountDetail[]) =>
      details.reduce((sum, detail) => {
        const cny = detail.currency === 'AUD'
          ? detail.balance * exchangeRate
          : detail.currency === 'USD'
            ? detail.balance * exchangeRate
            : detail.balance;
        return sum + (detail.type === 'credit' || detail.type === 'huabei' ? -cny : cny);
      }, 0);

    return owners.map((owner) => ({
      owner,
      totalCNY: compute(groupedDetails[owner] || []),
      count: (groupedDetails[owner] || []).length,
    }));
  }, [groupedDetails, exchangeRate]);

  return (
    <div className="rounded-[28px] border border-[#e6decd] bg-brand-paper p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#efe7d6] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-primary">
            <BarChart3 size={12} />
            Period View
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-brand-navy">各期余额观察台</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
            只看每一期的总资产、结构和相邻两期变化。你点哪一期，就看哪一期的余额状态。
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[26px] border border-[#e7ddcd] bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
            <Milestone size={13} />
            时间轴
          </div>
          <div className="mt-4 space-y-2">
            {timeline.map((item) => {
              const isSelected = selected?.id === item.id;
              const isPositive = item.delta >= 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-[22px] border px-4 py-3 text-left transition-colors ${isSelected ? 'border-brand-primary bg-[#f8f3e7]' : 'border-[#efe6d8] bg-[#fcfaf4] hover:bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-brand-navy">{item.date}</div>
                      <div className="mt-1 text-xs text-slate-400 line-clamp-2">{item.note || '当期快照'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-slate-800">
                        ¥{item.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                      </div>
                      <div className={`mt-1 text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {item.delta >= 0 ? '+' : ''}¥{item.delta.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-[#e7ddcd] bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">选中期别</div>
              <div className="mt-3 font-display text-2xl font-bold text-brand-navy">{selected?.date}</div>
              <div className="mt-2 text-xs text-slate-400">{selected?.note || '无备注'}</div>
            </div>
            <div className="rounded-[24px] border border-[#e7ddcd] bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">期别总资产</div>
              <div className="mt-3 font-mono text-2xl font-bold text-slate-800">
                ¥{selected?.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className={`rounded-[24px] border p-4 ${selected && selected.delta >= 0 ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'}`}>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em]">较上一期</div>
              <div className={`mt-3 font-mono text-2xl font-bold ${selected && selected.delta >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {selected && selected.delta >= 0 ? '+' : ''}¥{selected?.delta.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-[#e7ddcd] bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
              <Layers2 size={13} />
              当期结构
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {ownerTotals.map((item) => (
                <div key={item.owner} className="rounded-[22px] border border-[#efe6d8] bg-[#fcfaf4] px-4 py-3">
                  <div className="text-xs text-slate-400">{item.owner}</div>
                  <div className="mt-2 font-mono text-lg font-bold text-slate-800">
                    ¥{item.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{item.count} 个余额项</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {owners.map((owner) => {
              const rows = (groupedDetails[owner] || []).slice().sort((a, b) => a.currency.localeCompare(b.currency) || a.name.localeCompare(b.name));
              if (rows.length === 0) return null;
              return (
                <div key={owner} className="overflow-hidden rounded-[26px] border border-[#e7ddcd] bg-white">
                  <div className="border-b border-[#efe6d8] bg-[#f8f3e7] px-4 py-3 text-sm font-bold text-brand-navy">{owner}</div>
                  <div className="grid gap-2 p-3">
                    {rows.map((detail) => {
                      const previousBalance = previousMap.get(detail.accountId) || 0;
                      const delta = detail.balance - previousBalance;
                      const isPositive = delta >= 0;
                      return (
                        <div key={`${owner}-${detail.accountId}`} className="flex items-center justify-between gap-3 rounded-[20px] border border-[#efe6d8] bg-[#fcfaf4] px-4 py-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-700">{detail.name}</div>
                            <div className="mt-1 text-[11px] text-slate-400">{detail.currency}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono text-sm font-bold text-slate-800">
                              {symbol(detail.currency)}{detail.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </div>
                            <div className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                              {isPositive ? '+' : ''}{symbol(detail.currency)}{Math.abs(delta).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;
