
import React, { useState } from 'react';
import { AssetSnapshot, HistoricalAccountDetail } from '../types';
import { LineChart, Camera, ArrowUpRight, ArrowDownRight, Trash2, RotateCcw, Eye, EyeOff, ChevronDown } from 'lucide-react';

interface Props {
  currentTotalCNY: number;
  getCurrentDetails: () => HistoricalAccountDetail[];
  snapshots: AssetSnapshot[];
  onSnapshotsChange: (snapshots: AssetSnapshot[]) => void;
}

const AssetHistoryPanel: React.FC<Props> = ({ currentTotalCNY, getCurrentDetails, snapshots, onSnapshotsChange }) => {
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [expandedSnapId, setExpandedSnapId] = useState<string | null>(null);

  const handleSnapshot = () => {
    const today = new Date().toISOString().split('T')[0];
    const newSnapshot: AssetSnapshot = {
      id: crypto.randomUUID(), 
      date: today, 
      totalCNY: currentTotalCNY, 
      note: note || 'Snapshot', 
      isDeleted: false,
      accountDetails: getCurrentDetails()
    };
    
    // Replace today's active snapshot or add new
    const filtered = snapshots.filter(s => s.date !== today || s.isDeleted);
    const updated = [newSnapshot, ...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onSnapshotsChange(updated);
    setNote('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Move to trash?')) {
      const updated = snapshots.map(s => s.id === id ? { ...s, isDeleted: true } : s);
      onSnapshotsChange(updated);
    }
  };

  const handleRestore = (id: string) => {
    const updated = snapshots.map(s => s.id === id ? { ...s, isDeleted: false } : s);
    onSnapshotsChange(updated);
  };

  const toggleSnapExpand = (id: string) => {
    setExpandedSnapId(expandedSnapId === id ? null : id);
  };

  const visibleSnapshots = snapshots
    .filter(s => showTrash ? s.isDeleted : !s.isDeleted)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
            <LineChart size={18} />
          </div>
          <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Asset History (CNY)</h2>
        </div>
        <button onClick={() => setShowTrash(!showTrash)} className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${showTrash ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
          {showTrash ? <Eye size={12}/> : <Trash2 size={12}/>}
          {showTrash ? 'View Active' : 'Trash'}
        </button>
      </div>

      {!showTrash && (
        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mb-6">
          <div className="flex justify-between items-center mb-3">
             <div>
               <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Current Total</div>
               <div className="text-xl font-mono font-bold text-slate-800">
                 ¥{currentTotalCNY.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
               </div>
             </div>
             <button onClick={handleSnapshot} className="bg-brand-navy hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-900/20">
               <Camera size={14} /> Snap
             </button>
          </div>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..." className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-all"/>
        </div>
      )}

      <div className="space-y-1 relative">
        {visibleSnapshots.length === 0 && <div className="text-center py-8 text-slate-300 text-xs italic">No history data</div>}

        {visibleSnapshots.slice(0, (isExpanded || showTrash) ? undefined : 5).map((snap, index) => {
          const nextSnap = visibleSnapshots[index + 1];
          let diff = 0; let percent = 0; let isGrowth = true;
          if (nextSnap && !showTrash) {
            diff = snap.totalCNY - nextSnap.totalCNY;
            percent = (diff / nextSnap.totalCNY) * 100;
            isGrowth = diff >= 0;
          }

          const isHistoricalExpanded = expandedSnapId === snap.id;

          return (
            <div key={snap.id} className="group border-b border-slate-50 last:border-0">
               <div className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer hover:bg-slate-50 ${isHistoricalExpanded ? 'bg-slate-50' : ''}`} onClick={() => toggleSnapExpand(snap.id)}>
                 <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg transition-transform ${isHistoricalExpanded ? 'rotate-180 bg-white shadow-sm' : 'text-slate-300'}`}>
                       <ChevronDown size={14} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-slate-700 text-xs">{snap.date}</span>
                        {snap.note && <span className="text-[10px] bg-white text-slate-500 px-1.5 py-0.5 rounded border border-slate-100 truncate max-w-[100px]">{snap.note}</span>}
                      </div>
                      <div className="text-sm font-bold text-slate-800 font-mono">¥{snap.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div>
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                   {!showTrash && nextSnap && (
                     <div className={`text-right ${isGrowth ? 'text-emerald-600' : 'text-red-500'}`}>
                        <div className="flex items-center justify-end gap-0.5 text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-100">
                          {isGrowth ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
                          {Math.abs(percent).toFixed(1)}%
                        </div>
                     </div>
                   )}
                   <button onClick={(e) => { e.stopPropagation(); showTrash ? handleRestore(snap.id) : handleDelete(snap.id); }} className={`opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all ${showTrash ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}>
                     {showTrash ? <RotateCcw size={14}/> : <Trash2 size={14} />}
                   </button>
                 </div>
               </div>

               {/* Snapshot Details Expansion */}
               {isHistoricalExpanded && snap.accountDetails && (
                 <div className="p-4 bg-slate-50/50 rounded-b-xl border-t border-slate-100 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-3">
                       {['小盛', '大王', '家庭'].map(owner => {
                          const ownerDetails = snap.accountDetails?.filter(d => d.owner === owner) || [];
                          if (ownerDetails.length === 0) return null;
                          return (
                            <div key={owner}>
                               <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">{owner}</h5>
                               <div className="grid grid-cols-1 gap-1.5">
                                  {ownerDetails.map((d, i) => {
                                     const isLiability = d.name.includes('花呗') || d.name.includes('信用卡'); // Simplistic check for historical display
                                     const currencySymbol = d.currency === 'AUD' ? '$' : d.currency === 'CNY' ? '¥' : 'U$';
                                     return (
                                        <div key={i} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-100/50 text-[11px]">
                                           <span className="text-slate-600 font-medium">{d.name}</span>
                                           <span className={`font-mono font-bold ${isLiability && d.balance > 0 ? 'text-red-400' : 'text-slate-700'}`}>
                                              {currencySymbol}{d.balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                           </span>
                                        </div>
                                     )
                                  })}
                               </div>
                            </div>
                          )
                       })}
                    </div>
                 </div>
               )}
            </div>
          )
        })}

        {!showTrash && visibleSnapshots.length > 5 && (
          <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-center text-xs text-slate-400 hover:text-indigo-600 py-3 font-medium mt-2 border-t border-slate-50">
            {isExpanded ? 'Collapse' : `View All (${visibleSnapshots.length})`}
          </button>
        )}
      </div>
    </div>
  );
};
export default AssetHistoryPanel;
