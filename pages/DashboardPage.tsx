import React, { useMemo } from 'react';
import { BadgeCheck, Building2, CircleDollarSign, Clock3, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { AppMeta, AppSettings, AssetSnapshot } from '../types';
import { MetricCard, Card, SectionLabel } from '../components/ui';
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
      { owner: '小盛', color: 'bg-qing', text: 'text-qing-600', total: map.get('小盛') || 0 },
      { owner: '大王', color: 'bg-zhe', text: 'text-zhe-600', total: map.get('大王') || 0 },
      { owner: '家庭', color: 'bg-dai', text: 'text-dai-600', total: map.get('家庭') || 0 },
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
    return <div className="py-20 text-center font-serif text-ink-300">暂无快照数据。</div>;
  }

  return (
    <div className="max-w-[1400px] space-y-5">
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
        <Card className="p-6 xl:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <SectionLabel>总资产走势</SectionLabel>
              <div className="mt-2 font-mono text-[28px] font-semibold tracking-tight text-ink-900">
                ¥{(latest.totalCNY / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}
                <span className="ml-1 font-serif text-base font-normal text-ink-400">万</span>
              </div>
            </div>
            {recentChange && (
              <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${
                recentChange.amount >= 0 ? 'bg-gain-100 text-gain-600 ring-gain/20' : 'bg-loss-100 text-loss-600 ring-loss/20'
              }`}>
                {recentChange.amount >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                <span className="font-mono">{recentChange.amount >= 0 ? '+' : ''}¥{(recentChange.amount / 10000).toFixed(1)}万</span>
                <span className="text-ink-400">vs {recentChange.date}</span>
              </div>
            )}
          </div>
          <div className="space-y-2.5">
            {trendData.map((item) => (
              <div key={item.date} className="flex items-center gap-3">
                <div className="w-14 shrink-0 text-right font-mono text-[11px] text-ink-300">{item.date}</div>
                <div className="h-6 flex-1 overflow-hidden rounded-full bg-ink-100/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-ink-800 to-ink-400 transition-all duration-500"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <div className="w-20 shrink-0 text-right font-mono text-[11px] font-semibold text-ink-600">
                  ¥{(item.total / 10000).toFixed(1)}万
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          {/* By owner */}
          <Card className="p-6">
            <SectionLabel className="mb-5">按人分配</SectionLabel>
            <div className="space-y-3.5">
              {ownerTotals.map(({ owner, color, text, total }) => {
                const grandTotal = ownerTotals.reduce((s, o) => s + Math.max(o.total, 0), 0);
                const pct = grandTotal > 0 ? (Math.max(total, 0) / grandTotal) * 100 : 0;
                return (
                  <div key={owner}>
                    <div className="mb-1.5 flex justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        <span className="font-serif text-sm text-ink-700">{owner}</span>
                      </div>
                      <span className={`font-mono text-sm font-semibold ${text}`}>
                        ¥{(total / 10000).toFixed(1)}万
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100/70">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Status */}
          <Card className="p-6">
            <SectionLabel className="mb-4">系统状态</SectionLabel>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-gain">
                <BadgeCheck size={15} />
                <span className="font-medium">数据库在线</span>
              </div>
              <div className="flex justify-between text-ink-400">
                <span>期别数量</span><span className="font-mono font-semibold text-ink-700">{active.length} 期</span>
              </div>
              <div className="flex justify-between text-ink-400">
                <span>存储引擎</span><span className="font-mono font-semibold text-ink-700">{settings.storageMode || 'sqlite'}</span>
              </div>
              <div className="flex justify-between text-ink-400">
                <span>最新期别</span><span className="font-mono font-semibold text-ink-700">{latest.date}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
