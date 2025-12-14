
import React from 'react';
import { Transaction, Account } from '../types';
import { CATEGORIES, getIconComponent } from '../constants';
import { Trash2, ArrowRightLeft } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  onDelete: (id: string) => void;
}

const TransactionList: React.FC<Props> = ({ transactions, accounts, onDelete }) => {
  const sorted = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (sorted.length === 0) {
    return <div className="py-12 text-center text-slate-300 text-sm italic">No recent transactions</div>;
  }

  return (
    <div className="space-y-1">
      {sorted.map((t) => {
        const category = CATEGORIES.find(c => c.id === t.categoryId);
        const Icon = t.type === 'transfer' ? ArrowRightLeft : getIconComponent(category?.iconName || 'ShoppingCart');
        const account = accounts.find(a => a.id === t.accountId);
        const toAccount = t.toAccountId ? accounts.find(a => a.id === t.toAccountId) : null;
        const isTransfer = t.type === 'transfer';

        return (
          <div key={t.id} className="group relative flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all duration-200">
            <div className="flex items-center gap-4 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isTransfer ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all'
              }`}>
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                   <span className="font-bold text-slate-700 text-sm truncate">
                     {isTransfer ? 'Transfer' : category?.name}
                   </span>
                   {isTransfer && (
                     <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-white px-1.5 rounded border border-slate-100">
                        {account?.name} &rarr; {toAccount?.name}
                     </span>
                   )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                   <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{formatDate(t.date)}</span>
                   {t.note && <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{t.note}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`font-mono font-bold text-sm ${
                  isTransfer ? 'text-slate-700' : (t.type === 'expense' ? 'text-slate-900' : 'text-emerald-600')
              }`}>
                {isTransfer ? '' : (t.type === 'expense' ? '-' : '+')}
                {t.currency === 'AUD' ? '$' : '¥'}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <button 
                 onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                 className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                 <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
export default TransactionList;
