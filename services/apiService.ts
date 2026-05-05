import { Account, AppSettings, AppStatePayload, AssetSnapshot, BackupHistoryEntry, Transaction } from '../types';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
};

export const getBootstrapData = () => request<AppStatePayload>('/api/bootstrap');

export const saveAccounts = (accounts: Account[]) =>
  request<AppStatePayload>('/api/accounts', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ accounts }),
  });

export const saveSnapshots = (snapshots: AssetSnapshot[]) =>
  request<AppStatePayload>('/api/snapshots', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ snapshots }),
  });

export const saveSettings = (settings: Partial<AppSettings>) =>
  request<AppStatePayload>('/api/settings', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ settings }),
  });

export const saveTransactions = (transactions: Transaction[]) =>
  request<AppStatePayload>('/api/transactions', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ transactions }),
  });

export const exportBackup = () => request<any>('/api/backup/export');

export const importBackup = (payload: Record<string, unknown>) =>
  request<AppStatePayload>('/api/backup/import', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });

export const getBackupHistory = () =>
  request<BackupHistoryEntry[]>('/api/backup/history');

export const restoreBackup = (fileName: string) =>
  request<AppStatePayload>('/api/backup/restore', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ fileName }),
  });

export const getHealth = () =>
  request<{ ok: boolean; storage: string; dbPath?: string; now: string }>('/api/health');
