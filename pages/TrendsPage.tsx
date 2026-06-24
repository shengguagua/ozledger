import React, { useMemo } from 'react';
import { AppSettings, AssetSnapshot } from '../types';
import { toCNY, getCurrencySymbol } from '../utils/snapshot';
import { Card, SectionLabel } from '../components/ui';

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

  if (!latest) return <div className="py-20 text-center font-serif text-ink-300">暂无快照数据。</div>;

  const colorMap: Record<string, string> = { CNY: 'bg-ink-700', AUD: 'bg-qing', USD: 'bg-zhe' };
  const ownerColors: Record<string, string> = { 小盛: 'bg-qing', 大王: 'bg-zhe', 家庭: 'bg-dai' };

  return (
    <div className="max-w-[1400px] space-y-5">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: '近3期月均增长', value: `${avgGrowth3 >= 0 ? '+' : ''}${avgGrowth3.toFixed(2)}%`, pos: avgGrowth3 >= 0 },
          { label: '近6期月均增长', value: `${avgGrowth6 >= 0 ? '+' : ''}${avgGrowth6.toFixed(2)}%`, pos: avgGrowth6 >= 0 },
          { label: '年化增速估算', value: `${(avgGrowth6 * 12) >= 0 ? '+' : ''}${(avgGrowth6 * 12).toFixed(1)}%`, pos: avgGrowth6 >= 0 },
        ].map(({ label, value, pos }) => (
          <Card key={label} className="p-5">
            <SectionLabel>{label}</SectionLabel>
            <div className={`mt-3 font-mono text-2xl font-semibold ${pos ? 'text-gain' : 'text-loss'}`}>{value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Monthly change */}
        <Card className="p-6">
          <SectionLabel className="mb-5">月度变化（人民币）</SectionLabel>
          <div className="space-y-2.5">
            {growthRates.map((r) => {
              const absMax = Math.max(...growthRates.map((x) => Math.abs(x.abs)), 1);
              const pct = (Math.abs(r.abs) / absMax) * 100;
              return (
                <div key={r.date} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-right font-mono text-[11px] text-ink-300">{r.date}</div>
                  <div className="flex h-6 flex-1 items-center gap-1">
                    <div className="flex flex-1 justify-end">
                      {r.abs < 0 && <div className="h-5 rounded-l-full bg-loss/30" style={{ width: `${pct}%` }} />}
                    </div>
                    <div className="h-4 w-px shrink-0 bg-ink-200" />
                    <div className="flex-1">
                      {r.abs >= 0 && <div className="h-5 rounded-r-full bg-gain/35" style={{ width: `${pct}%` }} />}
                    </div>
                  </div>
                  <div className={`w-20 shrink-0 text-right font-mono text-[11px] font-semibold ${r.abs >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {r.abs >= 0 ? '+' : ''}¥{(r.abs / 10000).toFixed(1)}万
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Currency breakdown + spendable */}
        <div className="space-y-5">
          <Card className="p-6">
            <SectionLabel className="mb-5">货币结构（最新期）</SectionLabel>
            <div className="space-y-3.5">
              {currencyBreakdown.map(({ currency, cnyVal, pct }) => (
                <div key={currency}>
                  <div className="mb-1.5 flex justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${colorMap[currency] || 'bg-ink-400'}`} />
                      <span className="font-serif text-sm text-ink-700">{currency}</span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-ink-700">
                      {getCurrencySymbol(currency)}{(cnyVal / (currency === 'CNY' ? 10000 : 1)).toFixed(currency === 'CNY' ? 1 : 0)}{currency === 'CNY' ? '万' : ''} <span className="font-normal text-ink-300">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-ink-100/70">
                    <div className={`h-full rounded-full ${colorMap[currency] || 'bg-ink-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <SectionLabel className="mb-5">可支配澳币走势</SectionLabel>
            <div className="space-y-2.5">
              {spendableTrend.map((t) => (
                <div key={t.date} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-right font-mono text-[11px] text-ink-300">{t.date}</div>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-ink-100/70">
                    <div className="h-full rounded-full bg-qing transition-all" style={{ width: `${(t.aud / maxSpendable) * 100}%` }} />
                  </div>
                  <div className="w-20 shrink-0 text-right font-mono text-[11px] font-semibold text-qing-600">
                    ${t.aud.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Per-owner trend */}
      <Card className="p-6">
        <SectionLabel className="mb-5">各人资产走势（万元 CNY）</SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-serif text-[12px] text-ink-300">
                <th className="pb-3 pr-4 text-left font-medium">期别</th>
                {['小盛', '大王', '家庭'].map((o) => (
                  <th key={o} className="px-3 pb-3 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${ownerColors[o]}`} />{o}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ownerTrend.map((row) => (
                <tr key={row.date} className="border-t border-ink-100">
                  <td className="py-2 pr-4 font-mono text-ink-400">{row.date}</td>
                  {['小盛', '大王', '家庭'].map((o) => (
                    <td key={o} className="px-3 py-2 text-right font-mono font-semibold text-ink-700">
                      ¥{((row as Record<string, number | string>)[o] as number / 10000).toFixed(1)}万
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default TrendsPage;
