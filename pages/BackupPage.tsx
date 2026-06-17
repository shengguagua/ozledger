import React from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { BackupHistoryEntry } from '../types';

interface Props {
  backupHistory: BackupHistoryEntry[];
  isRestoringBackup: string;
  onRefresh: () => void;
  onRestore: (fileName?: string) => void;
}

const BackupPage: React.FC<Props> = ({ backupHistory, isRestoringBackup, onRefresh, onRestore }) => (
  <div className="max-w-3xl space-y-5">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
          <ShieldCheck size={13} />备份与回滚
        </div>
        <p className="mt-2 text-sm text-slate-500">每次保存都会自动生成备份，保留最近的版本供回滚。</p>
      </div>
      <button type="button" onClick={onRefresh}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
        刷新列表
      </button>
    </div>

    {backupHistory.length === 0 ? (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
        暂无备份记录
      </div>
    ) : (
      <div className="rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)] overflow-hidden">
        {backupHistory.slice(0, 10).map((entry, idx) => (
          <div key={entry.id}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${idx < backupHistory.length - 1 ? 'border-b border-slate-100' : ''}`}>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">{entry.summary}</div>
              <div className="mt-1 text-xs text-slate-400">
                {new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })}
                {entry.fileName ? ` · ${entry.fileName}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRestore(entry.fileName)}
              disabled={isRestoringBackup === entry.fileName}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">
              <RotateCcw size={13} />
              {isRestoringBackup === entry.fileName ? '回滚中…' : '回滚'}
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default BackupPage;
