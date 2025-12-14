
import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  exchangeRate: number;
  usdRate: number;
}

const AnalysisPanel: React.FC<Props> = ({ transactions, exchangeRate, usdRate }) => {
  
  // Helper: Convert any amount to AUD
  const toAUD = (amount: number, currency: string) => {
    if (currency === 'AUD') return amount;
    if (currency === 'CNY') return amount / exchangeRate;
    if (currency === 'USD') return amount * usdRate;
    return amount;
  };

  // 1. Calculate Current Month Stats
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key === currentMonthKey) {
        const audAmount = toAUD(t.amount, t.currency);
        if (t.type === 'income') income += audAmount;
        else expense += audAmount;
      }
    });

    return { income, expense, net: income - expense };
  }, [transactions, exchangeRate, usdRate]);

  // 2. Calculate Last 6 Months Trend
  const trendData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    // Generate last 6 months keys
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = `${d.getMonth() + 1}月`;
      data.push({ key, label, net: 0, income: 0, expense: 0 });
    }

    // Fill data
    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const entry = data.find(item => item.key === key);
      
      if (entry) {
        const audAmount = toAUD(t.amount, t.currency);
        if (t.type === 'income') {
          entry.income += audAmount;
          entry.net += audAmount;
        } else {
          entry.expense += audAmount;
          entry.net -= audAmount;
        }
      }
    });

    return data;
  }, [transactions, exchangeRate, usdRate]);

  // Find max value for scaling charts
  const maxAbsVal = Math.max(...trendData.map(d => Math.abs(d.net)), 100); // Min scale 100

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-blue-100 text-brand-navy p-1.5 rounded-lg">
          <TrendingUp size={18} />
        </div>
        <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">总资产变化情况 (AUD)</h2>
      </div>

      {/* Section 1: Current Month Overview */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
           <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">本月收入</div>
           <div className="text-lg font-mono font-bold text-emerald-700">
             +${currentMonthStats.income.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
           </div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 border border-red-100">
           <div className="text-[10px] text-red-500 font-bold uppercase mb-1">本月支出</div>
           <div className="text-lg font-mono font-bold text-red-600">
             -${currentMonthStats.expense.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
           </div>
        </div>
        <div className={`rounded-xl p-3 border ${currentMonthStats.net >= 0 ? 'bg-brand-light border-brand-blue/20' : 'bg-orange-50 border-orange-100'}`}>
           <div className={`text-[10px] font-bold uppercase mb-1 ${currentMonthStats.net >= 0 ? 'text-brand-blue' : 'text-orange-500'}`}>本月结余</div>
           <div className={`text-lg font-mono font-bold ${currentMonthStats.net >= 0 ? 'text-brand-navy' : 'text-orange-600'}`}>
             {currentMonthStats.net >= 0 ? '+' : ''}${currentMonthStats.net.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
           </div>
        </div>
      </div>

      {/* Section 2: 6 Month Trend Chart */}
      <div>
        <h3 className="text-[10px] text-slate-400 font-bold uppercase mb-4 text-center">近半年净资产变动趋势 (Net Change)</h3>
        <div className="flex items-end justify-between h-32 px-2 gap-2">
           {trendData.map((item) => {
             const heightPercent = Math.min((Math.abs(item.net) / maxAbsVal) * 100, 100);
             const isPositive = item.net >= 0;
             // Don't render 0 height bars, minimum 2px
             const finalHeight = Math.max(heightPercent, 2); 
             
             return (
               <div key={item.key} className="flex-1 flex flex-col items-center group relative">
                 
                 {/* Tooltip */}
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {isPositive ? '+' : '-'}${Math.abs(item.net).toFixed(0)}
                 </div>

                 {/* Bar */}
                 <div 
                   style={{ height: `${finalHeight}%` }} 
                   className={`w-full sm:w-8 rounded-t-sm transition-all duration-500 ${isPositive ? 'bg-brand-navy/80 hover:bg-brand-navy' : 'bg-orange-400/80 hover:bg-orange-400'}`}
                 ></div>
                 
                 {/* Label */}
                 <div className="text-[10px] text-slate-400 mt-2 font-medium">{item.label}</div>
                 
                 {/* Zero line reference if needed (optional visual tweak) */}
                 {/* <div className="absolute bottom-6 w-full h-px bg-slate-100 -z-10"></div> */}
               </div>
             )
           })}
        </div>
      </div>

    </div>
  );
};

export default AnalysisPanel;
