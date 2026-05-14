import { Account, AppSettings, AppStatePayload, AssetSnapshot, BackupHistoryEntry, Transaction } from '../types';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  currentRevision?: string;

  constructor(message: string, status: number, code?: string, currentRevision?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.currentRevision = currentRevision;
  }
}

const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiRequestError(
      payload?.error || `Request failed: ${response.status}`,
      response.status,
      payload?.code,
      payload?.currentRevision
    );
  }
  return response.json();
};

export const getBootstrapData = () => request<AppStatePayload>('/api/bootstrap');

export const saveAccounts = (accounts: Account[], baseRevision?: string) =>
  request<AppStatePayload>('/api/accounts', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ accounts, baseRevision }),
  });

export const saveSnapshots = (snapshots: AssetSnapshot[], baseRevision?: string) =>
  request<AppStatePayload>('/api/snapshots', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ snapshots, baseRevision }),
  });

export const saveSettings = (settings: Partial<AppSettings>, baseRevision?: string) =>
  request<AppStatePayload>('/api/settings', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ settings, baseRevision }),
  });

export const saveTransactions = (transactions: Transaction[], baseRevision?: string) =>
  request<AppStatePayload>('/api/transactions', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ transactions, baseRevision }),
  });

export const exportBackup = () => request<any>('/api/backup/export');

export const importBackup = (payload: Record<string, unknown>, baseRevision?: string) =>
  request<AppStatePayload>('/api/backup/import', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ ...payload, baseRevision }),
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
