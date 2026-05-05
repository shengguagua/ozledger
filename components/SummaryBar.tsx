import React from 'react';
import { ArrowLeftRight, CalendarClock, Database, Settings2, Sparkles } from 'lucide-react';

interface Props {
  totalAUD: number;
  totalCNY: number;
  activeSnapshotCount: number;
  exchangeRate: number;
  usdRate: number;
  lastSavedAt?: string;
  storageMode?: string;
  onRateChange: (rate: number) => void;
  onUsdRateChange: (rate: number) => void;
  onOpenSettings: () => void;
}

const TopDashboard: React.FC<Props> = ({
  totalAUD,
  totalCNY,
  activeSnapshotCount,
  exchangeRate,
  usdRate,
  lastSavedAt,
  storageMode,
  onRateChange,
  onUsdRateChange,
  onOpenSettings,
}) => {
  const savedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString('zh-CN', { hour12: false })
    : '尚未写入';

  return (
    <div className="mb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] border border-emerald-950/10 bg-[linear-gradient(135deg,#18352a_0%,#274c3c_50%,#e3b45e_180%)] shadow-soft">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,240,210,0.22),transparent_28%)]" />
          <div className="relative z-10 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-100">
                  <Sparkles size={12} />
                  Snapshot Ledger
                </div>
                <div className="mt-5">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                    按周期记录余额，
                    <span className="block text-amber-200">重点看各期变化。</span>
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-emerald-50/78 sm:text-base">
                    这里不是流水账。你只需要在每个阶段更新账户余额，保存一个时间点，然后用时间轴观察资产如何变化。
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-end gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-100/70">Current Period</div>
                    <div className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl">
                      ¥{totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="mt-2 text-sm font-medium text-amber-100/80">
                      ≈ ${totalAUD.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-emerald-50/90 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100/70">
                      <ArrowLeftRight size={12} />
                      汇率基准
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-[11px] text-emerald-50/60">AUD/CNY</span>
                        <input
                          type="number"
                          step="0.01"
                          value={exchangeRate}
                          onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
                          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-300"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-emerald-50/60">USD/AUD</span>
                        <input
                          type="number"
                          step="0.01"
                          value={usdRate}
                          onChange={(e) => onUsdRateChange(parseFloat(e.target.value) || 0)}
                          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-300"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px] lg:grid-cols-1">
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-white backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/68">快照数</div>
                      <div className="mt-2 font-display text-3xl font-bold">{activeSnapshotCount}</div>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3 text-amber-200">
                      <CalendarClock size={18} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 text-white backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/68">{storageMode || 'sqlite'}</div>
                      <div className="mt-2 text-sm font-semibold leading-6 text-emerald-50/88">{savedLabel}</div>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-3 text-amber-200">
                      <Database size={18} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={onOpenSettings}
                  className="rounded-[24px] border border-white/10 bg-[#f6edd8] p-4 text-left text-brand-navy transition-colors hover:bg-[#fff5df]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-brand-primary/70">系统设置</div>
                      <div className="mt-2 font-bold">数据库、导入导出、余额维护</div>
                    </div>
                    <div className="rounded-2xl bg-brand-navy p-3 text-white">
                      <Settings2 size={18} />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopDashboard;
