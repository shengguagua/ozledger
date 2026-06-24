import React from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { BackupHistoryEntry } from '../types';
import { Card, SectionLabel } from '../components/ui';

interface Props {
  backupHistory: BackupHistoryEntry[];
  isRestoringBackup: string;
  onRefresh: () => void;
  onRestore: (fileName?: string) => void;
}

const BackupPage: React.FC<Props> = ({ backupHistory, isRestoringBackup, onRefresh, onRestore }) => (
  <div className="max-w-3xl space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <SectionLabel icon={<ShieldCheck size={14} />}>备份与回滚</SectionLabel>
        <p className="mt-2 text-sm leading-6 text-ink-400">每次保存都会自动生成备份，保留最近的版本供回滚。</p>
      </div>
      <button type="button" onClick={onRefresh}
        className="shrink-0 rounded-xl border border-ink-200 bg-paper-50 px-4 py-2 text-xs font-medium text-ink-600 transition hover:border-ink-300 hover:bg-paper">
        刷新列表
      </button>
    </div>

    {backupHistory.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-paper-50/60 py-16 text-center font-serif text-ink-300">
        暂无备份记录
      </div>
    ) : (
      <Card className="overflow-hidden">
        {backupHistory.slice(0, 10).map((entry, idx) => (
          <div key={entry.id}
            className={`flex items-center justify-between gap-4 px-5 py-4 ${idx < Math.min(backupHistory.length, 10) - 1 ? 'border-b border-ink-100' : ''}`}>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink-700">{entry.summary}</div>
              <div className="mt-1 font-mono text-xs text-ink-300">
                {new Date(entry.createdAt).toLocaleString('zh-CN', { hour12: false })}
                {entry.fileName ? ` · ${entry.fileName}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRestore(entry.fileName)}
              disabled={isRestoringBackup === entry.fileName}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-ink-800 px-3.5 py-2 text-xs font-medium text-paper-50 transition hover:bg-ink-900 disabled:opacity-50">
              <RotateCcw size={13} />
              {isRestoringBackup === entry.fileName ? '回滚中…' : '回滚'}
            </button>
          </div>
        ))}
      </Card>
    )}
  </div>
);

export default BackupPage;
