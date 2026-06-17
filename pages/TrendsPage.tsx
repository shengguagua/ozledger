import React, { useMemo } from 'react';
import { AppSettings, AssetSnapshot } from '../types';
import { toCNY, getCurrencySymbol } from '../utils/snapshot';

interface Props {
  snapshots: AssetSnapshot[];
  settings: AppSettings;
}

const TrendsPage: React.FC<Props> = ({ snapshots, settings }) => {
  const active = useMemo(
    () => snapshots.filter((s) => !s.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [snapshots],
  );

  const latest = active[0];
  const rate = latest?.exchangeRate ?? settings.exchangeRate;
  const usdRate = latest?.usdRate ?? settings.usdRate;

  // Monthly growth rates
  const growthRates = useMemo(() => {
    if (active.length < 2) return [];
    return active.slice(0, -1).map((s, i) => {
      const prev = active[i + 1];
      const change = prev.totalCNY > 0 ? ((s.totalCNY - prev.totalCNY) / prev.totalCNY) * 100 : 0;
      return { date: s.date.slice(0, 7), change, abs: s.totalCNY - prev.totalCNY };
    }).slice(0, 12).reverse();
  }, [active]);

  const avgGrowth3 = growthRates.slice(-3).reduce((s, r) => s + r.change, 0) / Math.max(growthRates.slice(-3).length, 1);
  const avgGrowth6 = growthRates.slice(-6).reduce((s, r) => s + r.change, 0) / Math.max(growthRates.slice(-6).length, 1);

  // Currency breakdown of latest
  const currencyBreakdown = useMemo(() => {
    if (!latest?.accountDetails) return [];
    const map = new Map<string, number>();
    for (const d of latest.accountDetails) {
      const cnyVal = toCNY(d.balance, d.currency, rate, usdRate);
      map.set(d.currency, (map.get(d.currency) || 0) + cnyVal);
    }
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()].map(([currency, cnyVal]) => ({
      currency, cnyVal, pct: total > 0 ? (cnyVal / total) * 100 : 0,
    })).sort((a, b) => b.cnyVal - a.cnyVal);
  }, [latest, rate, usdRate]);

  // Spendable AUD trend
  const spendableTrend = useMemo(() => {
    const exclude = ['待报销', '机票', '生活费', '美股', 'bond'];
    return active.slice(0, 8).reverse().map((s) => {
      const aud = (s.accountDetails || []).filter(
        (d) => d.currency === 'AUD' && d.owner !== '家庭'
          && !['investment', 'longterm', 'pending'].includes(d.type)
          && !exclude.some((kw) => d.name.includes(kw)),
      ).reduce((sum, d) => sum + d.balance, 0);
      return { date: s.date.slice(0, 7), aud };
    });
  }, [active]);

  const maxSpendable = Math.max(...spendableTrend.map((t) => t.aud), 1);

  // Per-owner trend
  const ownerTrend = useMemo(() => {
    const owners = ['小盛', '大王', '家庭'] as const;
    return active.slice(0, 8).reverse().map((s) => {
      const totals: Record<string, number> = {};
      for (const owner of owners) {
        totals[owner] = (s.accountDetails || [])
          .filter((d) => d.owner === owner)
          .reduce((sum, d) => sum + toCNY(d.balance, d.currency, s.exchangeRate ?? settings.exchangeRate, s.usdRate ?? settings.usdRate), 0);
      }
      return { date: s.date.slice(0, 7), ...totals };
    });
  }, [active, settings]);

  if (!latest) return <div className="text-slate-400 py-20 text-center">暂无快照数据。</div>;

  const colorMap: Record<string, string> = { CNY: 'bg-blue-500', AUD: 'bg-emerald-500', USD: 'bg-amber-500' };
  const ownerColors: Record<string, string> = { 小盛: 'bg-sky-500', 大王: 'bg-violet-500', 家庭: 'bg-amber-500' };

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: '近3期月均增长', value: `${avgGrowth3 >= 0 ? '+' : ''}${avgGrowth3.toFixed(2)}%`, pos: avgGrowth3 >= 0 },
          { label: '近6期月均增长', value: `${avgGrowth6 >= 0 ? '+' : ''}${avgGrowth6.toFixed(2)}%`, pos: avgGrowth6 >= 0 },
          { label: '年化增速估算', value: `${(avgGrowth6 * 12) >= 0 ? '+' : ''}${(avgGrowth6 * 12).toFixed(1)}%`, pos: avgGrowth6 >= 0 },
        ].map(({ label, value, pos }) => (
          <div key={label} className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_50px_-38px_rgba(15,23,42,0.35)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</div>
            <div className={`mt-3 text-2xl font-bold ${pos ? 'text-emerald-700' : 'text-rose-700'}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Monthly change */}
        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-4">月度变化（人民币）</div>
          <div className="space-y-2">
            {growthRates.map((r) => {
              const absMax = Math.max(...growthRates.map((x) => Math.abs(x.abs)), 1);
              const pct = (Math.abs(r.abs) / absMax) * 100;
              return (
                <div key={r.date} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-right text-[11px] font-mono text-slate-400">{r.date}</div>
                  <div className="flex-1 flex items-center gap-1 h-6">
                    <div className="flex-1 flex justify-end">
                      {r.abs < 0 && <div className="h-5 rounded-l-full bg-rose-200" style={{ width: `${pct}%` }} />}
                    </div>
                    <div className="w-px h-4 bg-slate-200 shrink-0" />
                    <div className="flex-1">
                      {r.abs >= 0 && <div className="h-5 rounded-r-full bg-emerald-300" style={{ width: `${pct}%` }} />}
                    </div>
                  </div>
                  <div className={`w-20 shrink-0 text-right text-[11px] font-mono font-bold ${r.abs >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {r.abs >= 0 ? '+' : ''}¥{(r.abs / 10000).toFixed(1)}万
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Currency breakdown */}
        <div className="space-y-5">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-4">货币结构（最新期）</div>
            <div className="space-y-3">
              {currencyBreakdown.map(({ currency, cnyVal, pct }) => (
                <div key={currency}>
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${colorMap[currency] || 'bg-slate-400'}`} />
                      <span className="text-sm font-semibold text-slate-800">{currency}</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-700">
                      {getCurrencySymbol(currency)}{(cnyVal / (currency === 'CNY' ? 10000 : 1)).toFixed(currency === 'CNY' ? 1 : 0)}{currency === 'CNY' ? '万' : ''} <span className="text-slate-400 font-normal">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colorMap[currency] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spendable AUD trend */}
          <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-4">可支配澳币走势</div>
            <div className="space-y-2">
              {spendableTrend.map((t) => (
                <div key={t.date} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-right text-[11px] font-mono text-slate-400">{t.date}</div>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${(t.aud / maxSpendable) * 100}%` }} />
                  </div>
                  <div className="w-20 shrink-0 text-right text-[11px] font-mono font-bold text-sky-700">
                    ${t.aud.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-owner trend */}
      <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-4">各人资产走势（万元 CNY）</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-400 uppercase tracking-wider">
                <th className="text-left pb-3 pr-4">期别</th>
                {['小盛', '大王', '家庭'].map((o) => (
                  <th key={o} className="text-right pb-3 px-3">
                    <span className={`inline-flex items-center gap-1`}>
                      <span className={`h-2 w-2 rounded-full ${ownerColors[o]}`} />{o}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ownerTrend.map((row) => (
                <tr key={row.date} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-mono text-slate-500">{row.date}</td>
                  {['小盛', '大王', '家庭'].map((o) => (
                    <td key={o} className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                      ¥{((row as Record<string, number | string>)[o] as number / 10000).toFixed(1)}万
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrendsPage;
