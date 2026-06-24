import React, { useEffect, useState } from 'react';
import { Loader2, ServerCrash } from 'lucide-react';
import { AppMeta, AppSettings, AssetSnapshot, BackupHistoryEntry } from './types';
import * as api from './services/apiService';
import { ApiRequestError } from './services/apiService';
import AppShell, { Page } from './components/AppShell';
import DashboardPage from './pages/DashboardPage';
import SnapshotPage from './pages/SnapshotPage';
import TrendsPage from './pages/TrendsPage';
import BackupPage from './pages/BackupPage';
import { useSnapshotEditor } from './hooks/useSnapshotEditor';
import { formatLocalDateTime } from './utils/snapshot';

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('dashboard');
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ exchangeRate: 4.5, usdRate: 1.5, financialNote: '', storageMode: 'sqlite' });
  const [meta, setMeta] = useState<AppMeta>({});
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');

  const loadData = async () => {
    try {
      setServerError('');
      const [payload, backups] = await Promise.all([api.getBootstrapData(), api.getBackupHistory()]);
      setSnapshots(payload.snapshots || []);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(backups);
    } catch {
      setServerError('无法连接数据库服务，请先运行 `npm run dev`。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!saveSuccess) return;
    const t = window.setTimeout(() => setSaveSuccess(''), 2600);
    return () => window.clearTimeout(t);
  }, [saveSuccess]);

  useEffect(() => {
    if (!saveError) return;
    const t = window.setTimeout(() => setSaveError(''), 5200);
    return () => window.clearTimeout(t);
  }, [saveError]);

  const handleApiError = async (error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 409) {
      setSaveError('检测到并发更新，已拦截本次保存，页面将刷新。');
      await loadData();
      return;
    }
    setSaveError(error instanceof Error ? error.message : '操作失败，请重试。');
  };

  const refreshData = async (payload: Awaited<ReturnType<typeof api.getBootstrapData>>) => {
    setSnapshots(payload.snapshots || []);
    setSettings(payload.settings);
    setMeta(payload.meta || {});
    setBackupHistory(await api.getBackupHistory());
  };

  const handleSaveEdit = async (updated: AssetSnapshot, editor: ReturnType<typeof useSnapshotEditor>) => {
    try {
      setIsSaving(true); setSaveError('');
      const nextSnapshots = snapshots.map((s) => s.id === updated.id ? updated : s);
      const payload = await api.saveSnapshots(nextSnapshots, settings.lastSavedAt);
      await refreshData(payload);
      editor.cancel();
      setSaveSuccess(`已保存 ${updated.date}`);
    } catch (e) { await handleApiError(e); } finally { setIsSaving(false); }
  };

  const handleSaveCreate = async (next: AssetSnapshot, editor: ReturnType<typeof useSnapshotEditor>) => {
    try {
      setIsSaving(true); setSaveError('');
      const nextSnapshots = [...snapshots.filter((s) => s.date !== next.date), next]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const payload = await api.saveSnapshots(nextSnapshots, settings.lastSavedAt);
      await refreshData(payload);
      setSelectedSnapshotId(next.id);
      editor.cancel();
      setSaveSuccess(`已保存 ${next.date}`);
    } catch (e) { await handleApiError(e); } finally { setIsSaving(false); }
  };

  const handleRestoreBackup = async (fileName?: string) => {
    if (!fileName) return;
    if (!window.confirm(`确认回滚到备份 ${fileName}？当前最新数据会被覆盖。`)) return;
    try {
      setIsRestoringBackup(fileName); setSaveError('');
      const payload = await api.restoreBackup(fileName);
      setSnapshots(payload.snapshots || []);
      setSettings(payload.settings);
      setMeta(payload.meta || {});
      setBackupHistory(await api.getBackupHistory());
      setSaveSuccess(`已回滚到 ${fileName}`);
    } catch (e) { await handleApiError(e); } finally { setIsRestoringBackup(''); }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-ink-200/60 bg-paper-50/95 px-8 py-6 shadow-ink">
          <Loader2 size={20} className="animate-spin text-cinnabar" />
          <span className="font-serif text-ink-600">正在研墨 · 读取快照…</span>
        </div>
      </div>
    );
  }

  if (serverError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-ink-200/60 bg-paper-50/95 p-8 shadow-ink-lg">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cinnabar-100 text-cinnabar-600">
            <ServerCrash size={22} />
          </div>
          <h1 className="font-serif text-xl font-semibold text-ink-900">数据库服务未启动</h1>
          <p className="mt-2 text-sm text-ink-500">{serverError}</p>
          <pre className="mt-4 rounded-xl border border-ink-200/70 bg-paper px-4 py-3 font-mono text-xs text-ink-600">{`npm install\nnpm run dev`}</pre>
          <button type="button" onClick={loadData} className="mt-4 w-full rounded-xl bg-ink-800 py-2.5 text-sm font-medium text-paper-50 transition hover:bg-ink-900">重试</button>
        </div>
      </div>
    );
  }

  const dbLabel = meta.dbTargetHost ? `MySQL · ${meta.dbTargetHost}` : (meta.dbPath || 'SQLite');
  const lastSaved = settings.lastSavedAt ? formatLocalDateTime(settings.lastSavedAt) : '';

  return (
    <AppShell page={page} onNav={setPage} dbLabel={dbLabel} lastSaved={lastSaved}>
      {page === 'dashboard' && (
        <DashboardPage snapshots={snapshots} settings={settings} meta={meta} />
      )}
      {page === 'snapshots' && (
        <SnapshotPage
          snapshots={snapshots} settings={settings}
          saveError={saveError} saveSuccess={saveSuccess} isSaving={isSaving}
          onSaveEdit={handleSaveEdit} onSaveCreate={handleSaveCreate}
          selectedSnapshotId={selectedSnapshotId} onSelectSnapshot={setSelectedSnapshotId}
        />
      )}
      {page === 'trends' && (
        <TrendsPage snapshots={snapshots} settings={settings} />
      )}
      {page === 'backup' && (
        <BackupPage
          backupHistory={backupHistory}
          isRestoringBackup={isRestoringBackup}
          onRefresh={() => api.getBackupHistory().then(setBackupHistory)}
          onRestore={handleRestoreBackup}
        />
      )}
    </AppShell>
  );
};

export default App;
