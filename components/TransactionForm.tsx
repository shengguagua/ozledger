
import React, { useState, useEffect } from 'react';
import { CategoryItem, Currency, Transaction, TransactionType, Account, AccountOwner } from '../types';
import { CATEGORIES, getIconComponent } from '../constants';
import { Plus, X, ArrowRight, Wallet, ArrowRightLeft } from 'lucide-react';

interface Props {
  accounts: Account[];
  onAdd: (t: Omit<Transaction, 'id' | 'date'>) => void;
  isOpen: boolean;
  onClose: () => void;
  preselectedAccountId?: string;
}

const TransactionForm: React.FC<Props> = ({ accounts, onAdd, isOpen, onClose, preselectedAccountId }) => {
  const [step, setStep] = useState<'account' | 'details'>('account');
  const [owner, setOwner] = useState<AccountOwner>('小盛');
  
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  
  // For Transfer
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  
  const [note, setNote] = useState('');

  // Initialization logic
  useEffect(() => {
    if (isOpen) {
      if (preselectedAccountId) {
        setFromAccountId(preselectedAccountId);
        setStep('details');
        // Auto set owner based on account
        const acc = accounts.find(a => a.id === preselectedAccountId);
        if (acc) setOwner(acc.owner);
      } else {
        setStep('account');
        setFromAccountId('');
        setOwner('小盛');
      }
      // Reset other fields
      setToAccountId('');
      setAmount('');
      setNote('');
      setType('expense');
      setCategoryId('groceries');
    }
  }, [isOpen, preselectedAccountId, accounts]);

  const fromAccount = accounts.find(a => a.id === fromAccountId);
  const toAccount = accounts.find(a => a.id === toAccountId);
  const currency = fromAccount?.currency || 'AUD';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount))) return;
    if (!fromAccountId) return;
    if (type === 'transfer' && !toAccountId) {
        alert("请选择转入账户");
        return;
    }
    if (type === 'transfer' && fromAccountId === toAccountId) {
        alert("转出和转入账户不能相同");
        return;
    }

    onAdd({
      amount: parseFloat(amount),
      currency,
      type,
      categoryId: type === 'transfer' ? 'transfer' : categoryId,
      accountId: fromAccountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      note,
    });
    onClose();
  };

  const filteredCategories = type === 'expense' 
    ? CATEGORIES.filter(c => c.id !== 'salary' && c.id !== 'remittance' && c.id !== 'other_income' && c.id !== 'investment_return')
    : CATEGORIES.filter(c => c.id === 'salary' || c.id === 'remittance' || c.id === 'other_income' || c.id === 'investment_return');

  const filteredAccounts = accounts.filter(a => a.owner === owner);

  const getCurrencySymbol = (c: string) => {
    if (c === 'AUD') return '$';
    if (c === 'CNY') return '¥';
    if (c === 'USD') return 'U$';
    return '$';
  };

  const renderAccountSelector = (
    label: string, 
    selectedId: string, 
    onSelect: (id: string) => void,
    filterOwner?: boolean
  ) => {
      // For "To Account", we might want to show all accounts, or group them
      // Simplify: show all accounts, sorted by owner
      const list = filterOwner ? filteredAccounts : accounts.sort((a,b) => a.owner.localeCompare(b.owner));
      const selected = accounts.find(a => a.id === selectedId);

      return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>
            {!selected ? (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {list.map(acc => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => onSelect(acc.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs ${acc.id === fromAccountId ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'bg-white border-slate-200 hover:border-brand-navy'}`}
                          disabled={acc.id === fromAccountId}
                        >
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] ${acc.color || 'bg-slate-300'}`}>
                                 {acc.name.charAt(0)}
                             </div>
                             <div className="truncate flex-1">
                                 <div>{acc.name}</div>
                                 <div className="text-[10px] text-slate-400">{acc.owner} · {acc.currency}</div>
                             </div>
                        </button>
                    ))}
                </div>
            ) : (
                <button 
                  type="button"
                  onClick={() => onSelect('')}
                  className="w-full flex items-center justify-between p-3 bg-white border border-brand-navy/30 rounded-xl"
                >
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${selected.color || 'bg-slate-300'}`}>
                            <div className="font-bold">{selected.name.charAt(0)}</div>
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-sm text-slate-700">{selected.name}</div>
                            <div className="text-xs text-slate-400">{selected.owner} · {selected.currency}</div>
                        </div>
                     </div>
                     <div className="text-xs text-brand-blue font-bold px-2 py-1 bg-blue-50 rounded">更换</div>
                </button>
            )}
        </div>
      )
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl p-6 shadow-2xl max-h-[95vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-10 fade-in duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">
            {step === 'account' ? '选择账户' : '记一笔'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* STEP 1: Select Account (Only runs if no preselected account) */}
        {step === 'account' && (
          <div className="space-y-6">
             {/* Owner Toggle */}
             <div className="flex p-1 bg-slate-100 rounded-xl">
               {(['小盛', '大王', '家庭'] as AccountOwner[]).map((o) => (
                 <button
                   key={o}
                   onClick={() => setOwner(o)}
                   className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                     owner === o 
                       ? 'bg-white text-brand-navy shadow-sm' 
                       : 'text-slate-400 hover:text-slate-600'
                   }`}
                 >
                   {o === '家庭' ? '特殊资产' : o}
                 </button>
               ))}
             </div>

             <div className="grid grid-cols-2 gap-3">
               {filteredAccounts.map(acc => {
                 const Icon = getIconComponent(acc.iconName);
                 return (
                   <button
                     key={acc.id}
                     onClick={() => {
                       setFromAccountId(acc.id);
                       setStep('details');
                     }}
                     className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-brand-navy hover:border-brand-navy hover:text-white group transition-all text-left"
                   >
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${acc.color || 'bg-slate-200 text-slate-600'} group-hover:bg-white/20 group-hover:text-white`}>
                        <Icon size={20} />
                     </div>
                     <div>
                       <div className="font-bold text-sm">{acc.name}</div>
                       <div className="text-xs text-slate-400 group-hover:text-blue-100">{acc.currency}</div>
                     </div>
                   </button>
                 )
               })}
             </div>
          </div>
        )}

        {/* STEP 2: Transaction Details */}
        {step === 'details' && fromAccount && (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Type Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
                {(['expense', 'income', 'transfer'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t);
                      if (t === 'income') setCategoryId('salary');
                      else if (t === 'expense') setCategoryId('groceries');
                      // transfer doesn't need category id update
                    }}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                      type === t 
                        ? (t === 'expense' ? 'bg-white text-slate-800 shadow-sm' : t === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'bg-white text-brand-blue shadow-sm')
                        : 'text-slate-400'
                    }`}
                  >
                    {t === 'expense' ? '支出' : t === 'income' ? '收入' : '转账/报销'}
                  </button>
                ))}
            </div>

            {/* Account Display or Selection */}
            {type === 'transfer' ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 relative">
                   {/* Visual Connector */}
                   <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-slate-200 border-l border-dashed border-slate-300 z-0"></div>
                   
                   {renderAccountSelector('从 (From)', fromAccountId, setFromAccountId, false)}
                   
                   <div className="relative z-10 pl-1">
                     <ArrowRightLeft size={16} className="text-brand-blue rotate-90 ml-2 bg-slate-50" />
                   </div>

                   {renderAccountSelector('转入到 (To)', toAccountId, setToAccountId, false)}
                </div>
            ) : (
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                   <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        fromAccount.owner === '小盛' ? 'bg-brand-navy' : 
                        fromAccount.owner === '大王' ? 'bg-pink-500' : 'bg-indigo-500'
                      }`}>
                        {fromAccount.owner.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">当前账户</div>
                        <div className="font-bold text-slate-700 text-sm">{fromAccount.name}</div>
                      </div>
                   </div>
                   {!preselectedAccountId && (
                     <button type="button" onClick={() => setStep('account')} className="text-xs text-brand-blue font-medium px-2 py-1 hover:bg-blue-50 rounded">
                       切换
                     </button>
                   )}
                </div>
            )}

            {/* Amount Input */}
            <div>
              <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xl">
                    {getCurrencySymbol(currency)}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    required
                    placeholder="0.00"
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:bg-white rounded-2xl text-3xl font-bold outline-none transition-all ${
                        type === 'expense' ? 'text-slate-800 focus:border-brand-navy' : 
                        type === 'income' ? 'text-emerald-600 focus:border-emerald-500' :
                        'text-brand-blue focus:border-brand-blue'
                    }`}
                  />
              </div>
              {type === 'transfer' && fromAccount && toAccount && fromAccount.currency !== toAccount.currency && (
                  <div className="text-[10px] text-orange-500 mt-2 px-2 text-center">
                      注意：跨币种转账 ({fromAccount.currency} {'->'} {toAccount.currency}) 将使用当前系统汇率自动折算
                  </div>
              )}
            </div>

            {/* Categories (Hide for Transfer) */}
            {type !== 'transfer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">分类</label>
                  <div className="grid grid-cols-4 gap-3">
                    {filteredCategories.map((cat) => {
                      const Icon = getIconComponent(cat.iconName);
                      const isSelected = categoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryId(cat.id)}
                          className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all ${
                            isSelected ? 'bg-slate-100 scale-105 ring-1 ring-slate-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                             isSelected ? cat.color : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Icon size={18} />
                          </div>
                          <span className={`text-[10px] ${isSelected ? 'font-bold text-slate-700' : 'text-slate-400'}`}>
                            {cat.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
            )}

            {/* Note */}
            <div>
               <input 
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={type === 'transfer' ? "备注 (例如: 报销款到账, 还信用卡...)" : "添加备注..."}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-navy/10 border border-transparent focus:border-brand-navy/20"
               />
            </div>

            <button
              type="submit"
              className={`w-full py-4 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-lg flex items-center justify-center gap-2 ${
                  type === 'expense' ? 'bg-brand-navy hover:bg-blue-900' : 
                  type === 'income' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  'bg-brand-blue hover:bg-blue-600'
              }`}
            >
              确认{type === 'transfer' ? '转账' : ''}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default TransactionForm;
