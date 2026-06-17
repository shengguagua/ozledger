import React, { useMemo } from 'react';
import { BadgeCheck, Building2, CircleDollarSign, Clock3, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { AppMeta, AppSettings, AssetSnapshot } from '../types';
import { MetricCard } from '../components/ui';
import { formatLocalDateTime, toCNY } from '../utils/snapshot';

interface Props {
  snapshots: AssetSnapshot[];
  settings: AppSettings;
  meta: AppMeta;
}

const DashboardPage: React.FC<Props> = ({ snapshots, settings, meta }) => {
  const active = useMemo(
    () => snapshots.filter((s) => !s.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [snapshots],
  );

  const latest = active[0];
  const rate = latest?.exchangeRate ?? settings.exchangeRate;
  const usdRate = latest?.usdRate ?? settings.usdRate;

  const spendable = useMemo(() => {
    const details = latest?.accountDetails || [];
    const exclude = ['待报销', '机票', '生活费'];
    const filter = (currency: string) => details.filter(
      (d) => d.currency === currency && d.owner !== '家庭'
        && !['investment', 'longterm', 'pending'].includes(d.type)
        && !['美股', 'bond'].includes(d.name)
        && !exclude.some((kw) => d.name.includes(kw)),
    );
    return { aud: filter('AUD').reduce((s, d) => s + d.balance, 0), cny: filter('CNY').reduce((s, d) => s + d.balance, 0) };
  }, [latest]);

  const ownerTotals = useMemo(() => {
    if (!latest?.accountDetails) return [];
    const map = new Map<string, number>();
    for (const d of latest.accountDetails) {
      map.set(d.owner, (map.get(d.owner) || 0) + toCNY(d.balance, d.currency, rate, usdRate));
    }
    return [
      { owner: '小盛', color: 'bg-sky-500', text: 'text-sky-700', total: map.get('小盛') || 0 },
      { owner: '大王', color: 'bg-violet-500', text: 'text-violet-700', total: map.get('大王') || 0 },
      { owner: '家庭', color: 'bg-amber-500', text: 'text-amber-700', total: map.get('家庭') || 0 },
    ];
  }, [latest, rate, usdRate]);

  const recentChange = useMemo(() => {
    if (active.length < 2) return null;
    return { amount: active[0].totalCNY - active[1].totalCNY, date: active[1].date };
  }, [active]);

  // Trend chart data: last 12 snapshots
  const trendData = useMemo(() => {
    const items = active.slice(0, 12).reverse();
    const max = Math.max(...items.map((s) => s.totalCNY), 1);
    return items.map((s) => ({ date: s.date.slice(0, 7), total: s.totalCNY, pct: (s.totalCNY / max) * 100 }));
  }, [active]);

  if (!latest) {
    return <div className="text-slate-400 py-20 text-center">暂无快照数据。</div>;
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="可支配澳币" value={`$${spendable.aud.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`}
          hint="排除家庭长期项与待报销" icon={<WalletCards size={18} />} tone="accent" />
        <MetricCard label="可支配人民币" value={`¥${spendable.cny.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`}
          hint="最新一期现金流观察位" icon={<CircleDollarSign size={18} />} tone="success" />
        <MetricCard label="当前汇率" value={`AUD/CNY ${rate.toLocaleString('en-US', { maximumFractionDigits: 4 })}`}
          hint={`USD/AUD ${usdRate.toLocaleString('en-US', { maximumFractionDigits: 4 })}`} icon={<Building2 size={18} />} />
        <MetricCard label="最后同步" value={formatLocalDateTime(settings.lastSavedAt)}
          hint={meta.dbTargetHost ? `主机 ${meta.dbTargetHost}` : '本地配置已接通'} icon={<Clock3 size={18} />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Trend chart */}
        <div className="xl:col-span-2 rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">总资产走势</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                ¥{(latest.totalCNY / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 万
              </div>
            </div>
            {recentChange && (
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
                recentChange.amount >= 0 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
              }`}>
                {recentChange.amount >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {recentChange.amount >= 0 ? '+' : ''}¥{(recentChange.amount / 10000).toFixed(1)}万 vs {recentChange.date}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {trendData.map((item) => (
              <div key={item.date} className="flex items-center gap-3">
                <div className="w-14 shrink-0 text-right text-[11px] font-mono text-slate-400">{item.date}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-700 to-slate-500 transition-all duration-500"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <div className="w-20 shrink-0 text-right text-[11px] font-mono font-bold text-slate-600">
                  ¥{(item.total / 10000).toFixed(1)}万
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* By owner */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-4">按人分配</div>
            <div className="space-y-3">
              {ownerTotals.map(({ owner, color, text, total }) => {
                const grandTotal = ownerTotals.reduce((s, o) => s + Math.max(o.total, 0), 0);
                const pct = grandTotal > 0 ? (Math.max(total, 0) / grandTotal) * 100 : 0;
                return (
                  <div key={owner}>
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        <span className="text-sm font-semibold text-slate-800">{owner}</span>
                      </div>
                      <span className={`text-sm font-bold font-mono ${text}`}>
                        ¥{(total / 10000).toFixed(1)}万
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-3">系统状态</div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <BadgeCheck size={15} />
                <span className="font-semibold">数据库在线</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>期别数量</span><span className="font-bold text-slate-700">{active.length} 期</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>存储引擎</span><span className="font-bold text-slate-700">{settings.storageMode || 'sqlite'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>最新期别</span><span className="font-bold text-slate-700">{latest.date}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
