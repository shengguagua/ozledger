
import React, { useState } from 'react';
import { Account, AccountOwner } from '../types';
import { getIconComponent } from '../constants';
import { Save, X } from 'lucide-react';

interface Props {
  accounts: Account[];
  onSave: (accounts: Account[]) => void;
  onClose: () => void;
}

const AssetManager: React.FC<Props> = ({ accounts, onSave, onClose }) => {
  const [editedAccounts, setEditedAccounts] = useState<Account[]>(accounts);

  const handleChange = (id: string, value: string) => {
    const numValue = parseFloat(value);
    setEditedAccounts(prev => prev.map(acc => 
      acc.id === id ? { ...acc, initialBalance: isNaN(numValue) ? 0 : numValue } : acc
    ));
  };

  const handleSave = () => {
    onSave(editedAccounts);
    onClose();
  };

  const groupedAccounts = editedAccounts.reduce((acc, account) => {
    const owner = account.owner;
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const renderAccountRow = (acc: Account) => {
    const Icon = getIconComponent(acc.iconName);
    const getCurrencySymbol = (c: string) => {
      if (c === 'AUD') return '$';
      if (c === 'CNY') return '¥';
      if (c === 'USD') return 'U$';
      return '$';
    };
    
    // Visual logic: 
    // For liabilities: Positive = Debt (Red)
    // For assets: Negative = Debt (Red)
    const isRed = (acc.type === 'credit' || acc.type === 'huabei') ? acc.initialBalance > 0 : acc.initialBalance < 0;

    return (
      <div key={acc.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm text-xs ${acc.color || 'bg-slate-200 text-slate-600'}`}>
          <Icon size={14} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-700 truncate text-sm">{acc.name}</div>
          {(acc.type === 'credit' || acc.type === 'huabei') && (
             <div className="text-[10px] text-red-500 font-bold">
               {acc.type === 'huabei' ? '花呗 / 负债' : '信用卡 / 负债'}
             </div>
          )}
          {(acc.type === 'investment' || acc.type === 'pending' || acc.type === 'longterm') && (
             <div className="text-[10px] text-indigo-500 font-bold">
               {acc.type === 'investment' ? '投资' : acc.type === 'pending' ? '待处理' : '长期/押金'}
             </div>
          )}
        </div>

        <div className="relative w-28 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
              {getCurrencySymbol(acc.currency)}
            </span>
            <input
              type="number"
              step="0.01"
              value={acc.initialBalance}
              onChange={(e) => handleChange(acc.id, e.target.value)}
              placeholder="0.00"
              className={`w-full pl-8 pr-2 py-1.5 bg-white rounded border text-right font-mono font-bold text-sm outline-none focus:ring-1 focus:ring-brand-navy ${isRed ? 'text-red-500' : 'text-slate-700'}`}
            />
        </div>
      </div>
    );
  }

  const renderOwnerSection = (owner: AccountOwner, title: string) => {
    const group = groupedAccounts[owner] || [];
    if (group.length === 0) return null;

    // Special logic for Family/Special assets
    if (owner === '家庭') {
      return (
        <div key={owner}>
           <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
              <div className="w-1 h-4 rounded-full bg-indigo-500"></div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
           </div>
           <div className="space-y-2">
             {group.map(renderAccountRow)}
           </div>
        </div>
      );
    }

    const assets = group.filter(a => ['bank', 'cash', 'alipay', 'wechat'].includes(a.type));
    const liabilities = group.filter(a => ['credit', 'huabei'].includes(a.type));
    
    return (
       <div key={owner}>
         <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
            <div className={`w-1 h-4 rounded-full ${owner === '小盛' ? 'bg-brand-navy' : 'bg-pink-500'}`}></div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
         </div>
         
         {assets.length > 0 && (
           <div className="mb-4">
             <h4 className="text-[10px] text-slate-400 font-bold uppercase mb-2">日常资产</h4>
             <div className="space-y-2">
               {assets.map(renderAccountRow)}
             </div>
           </div>
         )}

         {liabilities.length > 0 && (
           <div>
             <h4 className="text-[10px] text-slate-400 font-bold uppercase mb-2">负债账户</h4>
             <div className="space-y-2">
               {liabilities.map(renderAccountRow)}
             </div>
           </div>
         )}
       </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">更新当前余额</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="text-sm text-slate-500 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <p>这里维护的是“当前余额”。每次盘点完账户后先在这里更新，再去保存一次快照。</p>
          <div className="mt-2 text-xs flex flex-col gap-1">
             <div className="flex items-center gap-1 text-slate-600">
               <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
               <span>普通资产：正数代表资产余额</span>
             </div>
             <div className="flex items-center gap-1 text-red-500 font-bold">
               <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
               <span>信用卡/花呗：正数代表欠款 (负债)</span>
             </div>
          </div>
        </div>

        <div className="space-y-8">
          {renderOwnerSection('小盛', '小盛')}
          {renderOwnerSection('大王', '大王')}
          {renderOwnerSection('家庭', '特殊资产 (投资/待处理/押金)')}
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-8 py-3 bg-brand-navy text-white font-bold rounded-xl shadow-lg hover:bg-blue-800 flex items-center justify-center gap-2 transition-colors"
        >
          <Save size={18} /> 保存当前余额
        </button>
      </div>
    </div>
  );
};

export default AssetManager;
