
import React, { useState } from 'react';
import { Transaction, Account } from '../types';
import { Settings, RefreshCw, Eye, EyeOff, DollarSign, TrendingUp, Wallet } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  exchangeRate: number;
  usdRate: number;
  onRateChange: (rate: number) => void;
  onUsdRateChange: (rate: number) => void;
  onOpenSettings: () => void;
}

const TopDashboard: React.FC<Props> = ({ 
  transactions, 
  accounts, 
  exchangeRate, 
  usdRate,
  onRateChange, 
  onUsdRateChange,
  onOpenSettings 
}) => {
  const [showBalance, setShowBalance] = useState(true);

  const convertAmount = (amount: number, fromCurrency: string, toCurrency: string) => {
    if (fromCurrency === toCurrency) return amount;
    let amountInAUD = amount;
    if (fromCurrency === 'CNY') amountInAUD = amount / exchangeRate;
    else if (fromCurrency === 'USD') amountInAUD = amount * usdRate;

    if (toCurrency === 'AUD') return amountInAUD;
    if (toCurrency === 'CNY') return amountInAUD * exchangeRate;
    if (toCurrency === 'USD') return amountInAUD / usdRate;
    return amount;
  }

  const getAccountBalance = (account: Account) => {
    const txs = transactions.filter(t => t.accountId === account.id);
    const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const transfersOut = txs.filter(t => t.type === 'transfer').reduce((sum, t) => sum + t.amount, 0);
    
    const incomingTxs = transactions.filter(t => t.type === 'transfer' && t.toAccountId === account.id);
    const transfersIn = incomingTxs.reduce((sum, t) => {
        return sum + convertAmount(t.amount, t.currency, account.currency);
    }, 0);

    if (account.type === 'credit' || account.type === 'huabei') {
       return account.initialBalance + expenses + transfersOut - income - transfersIn;
    }
    return account.initialBalance + income + transfersIn - expenses - transfersOut;
  };

  const calculateTotalNetWorthAUD = () => {
    let totalAUD = 0;
    accounts.forEach(acc => {
       const balance = getAccountBalance(acc);
       let audVal = 0;
       if (acc.currency === 'AUD') audVal = balance;
       else if (acc.currency === 'CNY') audVal = (balance / exchangeRate);
       else if (acc.currency === 'USD') audVal = (balance * usdRate);

       if (acc.type === 'credit' || acc.type === 'huabei') {
         totalAUD -= audVal;
       } else {
         totalAUD += audVal;
       }
    });
    return totalAUD;
  };
  
  const grandTotalInAUD = calculateTotalNetWorthAUD();
  const grandTotalInCNY = (grandTotalInAUD * exchangeRate);

  const liquidAccounts = accounts.filter(a => 
    ['bank', 'cash', 'alipay', 'wechat'].includes(a.type)
  );

  const localLiquidAUD = liquidAccounts
    .filter(a => a.currency === 'AUD')
    .reduce((sum, acc) => sum + getAccountBalance(acc), 0);

  const liquidCNY = liquidAccounts
    .filter(a => a.currency === 'CNY')
    .reduce((sum, acc) => sum + getAccountBalance(acc), 0);
  
  const globalLiquidInAUD = localLiquidAUD + (liquidCNY / exchangeRate);

  return (
    <div className="relative mb-8">
      <div className="bg-[#0f172a] pt-6 pb-20 lg:pt-8 lg:pb-24 px-4 relative overflow-hidden">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
         <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-teal-600/10 rounded-full blur-[80px] pointer-events-none"></div>

         <div className="max-w-7xl mx-auto relative z-10 text-white">
            
            <div className="flex justify-between items-center mb-10">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
                     <Wallet size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight leading-none uppercase">Family Wealth</h1>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                   <div className="hidden sm:flex bg-white/5 backdrop-blur-md rounded-full px-1.5 py-1.5 border border-white/5 items-center gap-4">
                       <div className="flex items-center gap-2 pl-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">CNY Rate</span>
                          <input 
                             type="number" step="0.01" value={exchangeRate}
                             onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
                             className="w-10 bg-transparent text-center font-mono font-bold text-sm text-white outline-none border-b border-white/10 focus:border-indigo-400 transition-colors"
                          />
                       </div>
                       <div className="w-px h-4 bg-white/10"></div>
                       <div className="flex items-center gap-2 pr-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">USD Rate</span>
                          <input 
                             type="number" step="0.01" value={usdRate}
                             onChange={(e) => onUsdRateChange(parseFloat(e.target.value) || 0)}
                             className="w-10 bg-transparent text-center font-mono font-bold text-sm text-white outline-none border-b border-white/10 focus:border-indigo-400 transition-colors"
                          />
                       </div>
                   </div>

                   <button onClick={onOpenSettings} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all active:scale-95 border border-white/5">
                      <Settings size={18} />
                   </button>
               </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center space-y-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm text-indigo-200 text-xs font-medium tracking-wide">
                   <TrendingUp size={12} />
                   <span>TOTAL NET WORTH</span>
                   <button onClick={() => setShowBalance(!showBalance)} className="ml-1 hover:text-white transition-colors opacity-70 hover:opacity-100">
                      {showBalance ? <Eye size={12} /> : <EyeOff size={12} />}
                   </button>
                </div>

                {showBalance ? (
                   <div className="animate-in fade-in zoom-in-95 duration-500">
                      <div className="text-5xl sm:text-7xl font-bold tracking-tight text-white drop-shadow-2xl">
                         <span className="opacity-60 text-3xl sm:text-5xl align-top mr-1 font-medium">$</span>
                         {grandTotalInAUD.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                         <span className="text-2xl sm:text-3xl opacity-40 font-medium">.{grandTotalInAUD.toFixed(2).split('.')[1]}</span>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 text-slate-400 text-sm sm:text-base font-medium">
                         <span>≈</span>
                         <span className="font-mono text-white/90">¥{grandTotalInCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                   </div>
                ) : (
                   <div className="text-6xl font-bold opacity-20 tracking-widest my-4">••••••••</div>
                )}
            </div>
         </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-12 relative z-20">
         {showBalance && (
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white rounded-3xl p-5 shadow-soft border border-slate-100 flex items-center justify-between group hover:border-indigo-100 transition-colors">
                  <div>
                     <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Local Liquid (AUD)</p>
                     <p className="text-xl sm:text-2xl font-bold text-slate-800 font-mono tracking-tight group-hover:text-indigo-600 transition-colors">
                        ${localLiquidAUD.toLocaleString()}
                     </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                     <DollarSign size={20} />
                  </div>
               </div>

               <div className="bg-white rounded-3xl p-5 shadow-soft border border-slate-100 flex items-center justify-between group hover:border-emerald-100 transition-colors">
                  <div>
                     <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Global Liquid (Total)</p>
                     <p className="text-xl sm:text-2xl font-bold text-slate-800 font-mono tracking-tight group-hover:text-emerald-600 transition-colors">
                        ${globalLiquidInAUD.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                     </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                     <RefreshCw size={18} />
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default TopDashboard;
