
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Account, AccountOwner, GoogleConfig, AssetSnapshot } from './types';
import { DEFAULT_EXCHANGE_RATE, getIconComponent } from './constants';
import * as storage from './services/storageService';
import * as googleSheetService from './services/googleSheetsService';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import TopDashboard from './components/SummaryBar';
import AssetManager from './components/AssetManager';
import AssetHistoryPanel from './components/AssetHistoryPanel';
import { Download, Plus, RotateCcw, Wallet, ChevronDown, ChevronUp, FileText, Upload, Cloud, Loader2, Key, Settings, X, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  const [usdRate, setUsdRate] = useState<number>(1.5);
  const [financialNote, setFinancialNote] = useState<string>('');
  
  // UI States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(false);
  const [isTxFormOpen, setIsTxFormOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  
  // Google Sync States
  const [googleConfig, setGoogleConfig] = useState<GoogleConfig>({ apiKey: '', clientId: '', spreadsheetId: '' });
  const [isGapiInitialized, setIsGapiInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  const [expandedOwner, setExpandedOwner] = useState<string | null>('小盛');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    setTransactions(storage.getStoredTransactions());
    setExchangeRate(storage.getStoredRate());
    setUsdRate(storage.getStoredUSDRate());
    setAccounts(storage.getStoredAccounts());
    setSnapshots(storage.getStoredSnapshots());
    setFinancialNote(storage.getStoredNotes());
    setGoogleConfig(storage.getGoogleConfig());
  }, []);

  // Initialize Google Client if config exists
  useEffect(() => {
    if (googleConfig.apiKey && googleConfig.clientId) {
      googleSheetService.initGoogleClient(
        googleConfig.apiKey, 
        googleConfig.clientId, 
        (success) => {
          setIsGapiInitialized(success);
          if (success) setSyncStatus('Google 服务已就绪');
          else setSyncStatus('连接失败，请检查配置');
        }
      );
    }
  }, [googleConfig.apiKey, googleConfig.clientId]);

  // Actions
  const handleAddTransaction = (newTx: Omit<Transaction, 'id' | 'date'>) => {
    const tx: Transaction = {
      ...newTx,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    const updated = [tx, ...transactions];
    setTransactions(updated);
    storage.saveStoredTransactions(updated);
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    storage.saveStoredTransactions(updated);
  };

  const handleRateChange = (newRate: number) => {
    setExchangeRate(newRate);
    storage.saveStoredRate(newRate);
  };

  const handleUsdRateChange = (newRate: number) => {
    setUsdRate(newRate);
    storage.saveStoredUSDRate(newRate);
  };

  const handleSaveAccounts = (updatedAccounts: Account[]) => {
    setAccounts(updatedAccounts);
    storage.saveStoredAccounts(updatedAccounts);
  };

  const handleSaveSnapshots = (updatedSnapshots: AssetSnapshot[]) => {
    setSnapshots(updatedSnapshots);
    storage.saveStoredSnapshots(updatedSnapshots);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setFinancialNote(val);
    storage.saveStoredNotes(val);
  };

  const handleGoogleConfigChange = (key: keyof GoogleConfig, val: string) => {
    let value = val;
    if (key === 'spreadsheetId') {
       const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
       if (match) value = match[1];
       value = value.trim();
    }
    const newConfig = { ...googleConfig, [key]: value };
    setGoogleConfig(newConfig);
    storage.saveGoogleConfig(newConfig);
  };

  const handleCloudUpload = async () => {
    if (!isGapiInitialized) return alert('请先配置并连接 Google 服务');
    if (!googleConfig.spreadsheetId) return alert('请输入表格 ID (Spreadsheet ID)');
    try {
      setIsSyncing(true);
      setSyncStatus('正在登录...');
      await googleSheetService.handleAuthClick(async () => {
         setSyncStatus('正在同步...');
         await googleSheetService.saveToCloud(
           googleConfig.spreadsheetId, transactions, accounts, snapshots, { exchangeRate, usdRate, note: financialNote }
         );
         setSyncStatus('上传成功');
         setTimeout(() => setSyncStatus('Google 服务已就绪'), 3000);
      });
    } catch (error: any) {
      setSyncStatus('上传失败: ' + (error.result?.error?.message || '请检查 ID 和权限'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudDownload = async () => {
    if (!isGapiInitialized) return alert('请先配置并连接 Google 服务');
    if (!googleConfig.spreadsheetId) return alert('请输入表格 ID (Spreadsheet ID)');
    if (!window.confirm('确定从云端下载吗？这将覆盖当前的本地数据。')) return;
    try {
      setIsSyncing(true);
      setSyncStatus('正在登录...');
      await googleSheetService.handleAuthClick(async () => {
        setSyncStatus('正在同步...');
        const data = await googleSheetService.loadFromCloud(googleConfig.spreadsheetId);
        
        setTransactions(data.transactions);
        setAccounts(data.accounts);
        setSnapshots(data.snapshots);
        setExchangeRate(data.settings.exchangeRate);
        setUsdRate(data.settings.usdRate);
        setFinancialNote(data.settings.note);
        
        storage.saveStoredTransactions(data.transactions);
        storage.saveStoredAccounts(data.accounts);
        storage.saveStoredSnapshots(data.snapshots);
        storage.saveStoredRate(data.settings.exchangeRate);
        storage.saveStoredUSDRate(data.settings.usdRate);
        storage.saveStoredNotes(data.settings.note);
        
        setSyncStatus('同步成功');
        setTimeout(() => setSyncStatus('Google 服务已就绪'), 3000);
      });
    } catch (error: any) {
      setSyncStatus('下载失败: ' + (error.result?.error?.message || '请检查 ID 和权限'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetData = () => {
     if (window.confirm('警告：确定要重置所有数据吗？所有交易记录将丢失。')) {
       setTransactions([]);
       storage.saveStoredTransactions([]);
       setFinancialNote('');
       storage.saveStoredNotes('');
       setIsSettingsOpen(false);
     }
  };

  const handleExportJSON = () => {
    const data = { transactions, accounts, snapshots, exchangeRate, usdRate, financialNote, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ozledger_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (window.confirm(`确认导入 ${json.transactions.length} 条交易记录和账户配置吗？当前数据将被覆盖。`)) {
          setTransactions(json.transactions);
          setAccounts(json.accounts);
          if (json.snapshots) setSnapshots(json.snapshots);
          if (json.exchangeRate) setExchangeRate(json.exchangeRate);
          if (json.usdRate) setUsdRate(json.usdRate);
          if (json.financialNote) setFinancialNote(json.financialNote);
          
          storage.saveStoredTransactions(json.transactions);
          storage.saveStoredAccounts(json.accounts);
          if (json.snapshots) storage.saveStoredSnapshots(json.snapshots);
          if (json.exchangeRate) storage.saveStoredRate(json.exchangeRate);
          if (json.usdRate) storage.saveStoredUSDRate(json.usdRate);
          if (json.financialNote) storage.saveStoredNotes(json.financialNote);
          alert('导入成功！');
          setIsSettingsOpen(false);
        }
      } catch (error) { alert('导入失败：无法解析 JSON 文件'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

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

  const getAccountBalance = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    const txs = transactions.filter(t => t.accountId === accountId);
    const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const transfersOut = txs.filter(t => t.type === 'transfer').reduce((sum, t) => sum + t.amount, 0);
    const incomingTxs = transactions.filter(t => t.type === 'transfer' && t.toAccountId === accountId);
    const transfersIn = incomingTxs.reduce((sum, t) => {
        return sum + convertAmount(t.amount, t.currency, acc.currency);
    }, 0);
    if (acc.type === 'credit' || acc.type === 'huabei') {
       return acc.initialBalance + expenses + transfersOut - income - transfersIn;
    }
    return acc.initialBalance + income + transfersIn - expenses - transfersOut;
  };

  const groupedAccounts = accounts.reduce((acc, account) => {
    const owner = account.owner;
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const getOwnerNetWorth = (owner: AccountOwner) => {
    const ownerAccounts = groupedAccounts[owner] || [];
    return ownerAccounts.reduce((total, acc) => {
      const balance = getAccountBalance(acc.id);
      let audValue = 0;
      if (acc.currency === 'AUD') audValue = balance;
      else if (acc.currency === 'CNY') audValue = balance / exchangeRate;
      else if (acc.currency === 'USD') audValue = balance * usdRate;
      if (acc.type === 'credit' || acc.type === 'huabei') return total - audValue;
      return total + audValue;
    }, 0);
  };

  const calculateTotalCNY = () => {
    let totalAUD = 0;
    accounts.forEach(acc => {
       const balance = getAccountBalance(acc.id);
       let audVal = 0;
       if (acc.currency === 'AUD') audVal = balance;
       else if (acc.currency === 'CNY') audVal = (balance / exchangeRate);
       else if (acc.currency === 'USD') audVal = (balance * usdRate);
       if (acc.type === 'credit' || acc.type === 'huabei') totalAUD -= audVal;
       else totalAUD += audVal;
    });
    return totalAUD * exchangeRate;
  }

  const openFormForAccount = (accId: string) => { setSelectedAccountId(accId); setIsTxFormOpen(true); };
  const toggleAccordion = (owner: string) => { setExpandedOwner(expandedOwner === owner ? null : owner); };

  const renderAccountGrid = (accList: Account[], label: string) => {
    if (!accList || accList.length === 0) return null;
    return (
      <div className="mb-6">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            {label}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {accList.map(acc => {
              const balance = getAccountBalance(acc.id);
              const Icon = getIconComponent(acc.iconName);
              const isLiability = acc.type === 'credit' || acc.type === 'huabei';
              const isRed = isLiability ? balance > 0 : balance < 0;
              const currencySymbol = acc.currency === 'AUD' ? '$' : acc.currency === 'CNY' ? '¥' : 'U$';

              return (
                <button 
                  key={acc.id}
                  onClick={() => openFormForAccount(acc.id)}
                  className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300 relative overflow-hidden text-left active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-3 relative z-10">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs shadow-sm transition-transform group-hover:scale-110 ${acc.color || 'bg-slate-300'}`}>
                          <Icon size={18} strokeWidth={2} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-full group-hover:text-indigo-400 group-hover:bg-indigo-50 transition-colors">
                        {acc.currency}
                      </span>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="text-xs text-slate-500 font-medium truncate mb-1">{acc.name}</div>
                    <div className={`font-mono font-bold text-lg truncate tracking-tight ${isRed ? 'text-red-500' : 'text-slate-800'}`}>
                      {isLiability && balance > 0 ? '-' : ''}{currencySymbol}{Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </button>
              )
            })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-32">
      <TopDashboard 
        transactions={transactions} accounts={accounts} 
        exchangeRate={exchangeRate} usdRate={usdRate}
        onRateChange={handleRateChange} onUsdRateChange={handleUsdRateChange}
        onOpenSettings={() => setIsSettingsOpen(!isSettingsOpen)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                    <h3 className="font-bold text-slate-800 text-lg">设置 & 备份</h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100">
                        <div className="flex items-center gap-3 mb-4 text-brand-navy">
                            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700"><Cloud size={20} /></div>
                            <h4 className="font-bold text-sm">Google Sheets Sync</h4>
                        </div>
                        <div className="space-y-3 mb-4">
                            <input type="password" placeholder="API Key" value={googleConfig.apiKey} onChange={(e) => handleGoogleConfigChange('apiKey', e.target.value)} className="w-full text-xs bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all"/>
                            <input type="text" placeholder="Client ID" value={googleConfig.clientId} onChange={(e) => handleGoogleConfigChange('clientId', e.target.value)} className="w-full text-xs bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all"/>
                            <input type="text" placeholder="Spreadsheet ID" value={googleConfig.spreadsheetId} onChange={(e) => handleGoogleConfigChange('spreadsheetId', e.target.value)} className="w-full text-xs bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all"/>
                        </div>
                        <div className={`text-xs text-center mb-4 font-medium flex items-center justify-center gap-2 ${isGapiInitialized ? 'text-emerald-600' : 'text-slate-400'}`}>
                             <div className={`w-2 h-2 rounded-full ${isGapiInitialized ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                             {syncStatus || (isGapiInitialized ? '服务已连接' : '等待配置...')}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <button onClick={handleCloudUpload} disabled={isSyncing || !isGapiInitialized} className="flex items-center justify-center gap-2 py-3 bg-brand-navy text-white rounded-xl text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95">{isSyncing ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} 上传</button>
                           <button onClick={handleCloudDownload} disabled={isSyncing || !isGapiInitialized} className="flex items-center justify-center gap-2 py-3 bg-white text-brand-navy border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-all active:scale-95">{isSyncing ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} 下载</button>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Data Management</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { setIsAssetManagerOpen(true); setIsSettingsOpen(false); }} className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all">
                                <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Wallet size={18} /></div>
                                <span className="text-xs font-bold text-slate-700">初始余额</span>
                            </button>
                            <button onClick={handleExportJSON} className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Download size={18} /></div>
                                <span className="text-xs font-bold text-slate-700">备份 JSON</span>
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Upload size={18} /></div>
                                <span className="text-xs font-bold text-slate-700">恢复 JSON</span>
                            </button>
                            <button onClick={handleResetData} className="flex flex-col items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all">
                                <div className="p-2 bg-white text-red-500 rounded-lg"><RotateCcw size={18} /></div>
                                <span className="text-xs font-bold text-red-600">重置所有</span>
                            </button>
                        </div>
                    </div>
                </div>
                <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Assets */}
          <div className="lg:col-span-8 space-y-8">
             {(['小盛', '大王'] as AccountOwner[]).map(owner => {
               const isExpanded = expandedOwner === owner || window.innerWidth >= 1024;
               const totalNetWorth = getOwnerNetWorth(owner);
               const ownerAccounts = groupedAccounts[owner] || [];
               const assets = ownerAccounts.filter(a => ['bank', 'cash', 'alipay', 'wechat'].includes(a.type));
               const assetsCNY = assets.filter(a => a.currency === 'CNY');
               const assetsAUD = assets.filter(a => a.currency === 'AUD');
               const liabilities = ownerAccounts.filter(a => ['credit', 'huabei'].includes(a.type));

               return (
                <div key={owner} className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                    <button onClick={() => toggleAccordion(owner)} className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg ${owner === '小盛' ? 'bg-gradient-to-br from-slate-700 to-slate-900' : 'bg-gradient-to-br from-pink-400 to-pink-600'}`}>
                           {owner.charAt(0)}
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-800 text-xl tracking-tight">{owner}</h3>
                            <div className="text-sm text-slate-400 font-medium mt-1 bg-slate-50 inline-block px-2 py-0.5 rounded-lg">
                              Net Worth: ${totalNetWorth.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                            </div>
                        </div>
                      </div>
                      <div className={`p-2 rounded-full bg-slate-50 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={20} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-6 pb-8 pt-2 animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="h-px bg-slate-100 mb-6"></div>
                        {renderAccountGrid(assetsCNY, 'CNY Assets')}
                        {renderAccountGrid(assetsAUD, 'AUD Assets')}
                        {renderAccountGrid(liabilities, 'Liabilities')}
                      </div>
                    )}
                </div>
               );
             })}

             {/* Special Assets */}
             {(() => {
               const owner = '家庭';
               const isExpanded = expandedOwner === owner || window.innerWidth >= 1024;
               const totalNetWorth = getOwnerNetWorth(owner);
               const familyAccounts = groupedAccounts['家庭'] || [];
               const assetsCNY = familyAccounts.filter(a => a.currency === 'CNY');
               const assetsAUD = familyAccounts.filter(a => a.currency === 'AUD');
               const assetsUSD = familyAccounts.filter(a => a.currency === 'USD');

               return (
                 <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                    <button onClick={() => toggleAccordion(owner)} className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg bg-gradient-to-br from-indigo-500 to-indigo-700">
                           <ShieldCheck size={28} />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-800 text-xl tracking-tight">Family Special Assets</h3>
                            <div className="text-sm text-slate-400 font-medium mt-1 bg-slate-50 inline-block px-2 py-0.5 rounded-lg">
                              Value: ${totalNetWorth.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                            </div>
                        </div>
                      </div>
                      <div className={`p-2 rounded-full bg-slate-50 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={20} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-6 pb-8 pt-2 animate-in slide-in-from-top-2 fade-in duration-300">
                         <div className="h-px bg-slate-100 mb-6"></div>
                         {renderAccountGrid(assetsCNY, 'CNY Special')}
                         {renderAccountGrid(assetsAUD, 'AUD Special')}
                         {renderAccountGrid(assetsUSD, 'USD Assets')}
                      </div>
                    )}
                 </div>
               )
             })()}
          </div>

          {/* RIGHT: Sidebar */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
              <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden">
                  <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                      <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Recent Activity</h2>
                  </div>
                  <div className="p-2">
                    <TransactionList transactions={transactions} accounts={accounts} onDelete={handleDeleteTransaction}/>
                  </div>
              </div>

              <AssetHistoryPanel 
                currentTotalCNY={calculateTotalCNY()} 
                snapshots={snapshots}
                onSnapshotsChange={handleSaveSnapshots}
              />

              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-soft">
                 <div className="flex items-center gap-2 mb-4 text-slate-500">
                   <FileText size={18} />
                   <h2 className="font-bold text-xs uppercase tracking-wider">Monthly Memo</h2>
                 </div>
                 <textarea
                   value={financialNote} onChange={handleNoteChange}
                   placeholder="Write down your financial thoughts..."
                   className="w-full bg-slate-50 rounded-2xl border border-slate-100 p-4 text-sm text-slate-700 min-h-[120px] focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all resize-none leading-relaxed"
                 />
              </div>
          </div>
        </div>
      </div>

      <button onClick={() => { setSelectedAccountId(undefined); setIsTxFormOpen(true); }} className="fixed bottom-8 right-6 lg:bottom-12 lg:right-12 w-16 h-16 bg-brand-navy rounded-full shadow-2xl shadow-slate-900/40 flex items-center justify-center text-white z-30 hover:scale-110 active:scale-95 transition-all group">
        <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      <TransactionForm accounts={accounts} onAdd={handleAddTransaction} isOpen={isTxFormOpen} onClose={() => setIsTxFormOpen(false)} preselectedAccountId={selectedAccountId} />
      {isAssetManagerOpen && <AssetManager accounts={accounts} onSave={handleSaveAccounts} onClose={() => setIsAssetManagerOpen(false)} />}
    </div>
  );
};
export default App;
