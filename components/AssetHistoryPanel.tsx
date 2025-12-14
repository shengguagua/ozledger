
import React, { useState, useEffect } from 'react';
import { AssetSnapshot } from '../types';
import * as storage from '../services/storageService';
import { LineChart, Camera, ArrowUpRight, ArrowDownRight, Trash2, RotateCcw, Eye, EyeOff } from 'lucide-react';

interface Props {
  currentTotalCNY: number;
}

const AssetHistoryPanel: React.FC<Props> = ({ currentTotalCNY }) => {
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([]);
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  useEffect(() => { setSnapshots(storage.getStoredSnapshots()); }, []);

  const handleSnapshot = () => {
    const today = new Date().toISOString().split('T')[0];
    const newSnapshot: AssetSnapshot = {
      id: crypto.randomUUID(), date: today, totalCNY: currentTotalCNY, note: note || 'Snapshot', isDeleted: false
    };
    const filtered = snapshots.filter(s => s.date !== today || s.isDeleted);
    const updated = [newSnapshot, ...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSnapshots(updated);
    storage.saveStoredSnapshots(updated);
    setNote('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Move to trash?')) {
      const updated = snapshots.map(s => s.id === id ? { ...s, isDeleted: true } : s);
      setSnapshots(updated);
      storage.saveStoredSnapshots(updated);
    }
  };

  const handleRestore = (id: string) => {
    const updated = snapshots.map(s => s.id === id ? { ...s, isDeleted: false } : s);
    setSnapshots(updated);
    storage.saveStoredSnapshots(updated);
  };

  const visibleSnapshots = snapshots.filter(s => showTrash ? s.isDeleted : !s.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

          return (
            <div key={snap.id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0">
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <span className="font-mono font-bold text-slate-700 text-xs">{snap.date}</span>
                   {snap.note && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded truncate max-w-[100px]">{snap.note}</span>}
                 </div>
                 <div className="text-sm font-bold text-slate-800 font-mono">¥{snap.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</div>
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
                 <button onClick={() => showTrash ? handleRestore(snap.id) : handleDelete(snap.id)} className={`opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all ${showTrash ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}>
                   {showTrash ? <RotateCcw size={14}/> : <Trash2 size={14} />}
                 </button>
               </div>
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
