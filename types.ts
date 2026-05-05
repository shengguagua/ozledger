
export type Currency = 'AUD' | 'CNY' | 'USD';

export type TransactionType = 'expense' | 'income' | 'transfer';

export type AccountType = 'bank' | 'credit' | 'huabei' | 'alipay' | 'wechat' | 'cash' | 'investment' | 'pending' | 'longterm';

export type AccountOwner = '小盛' | '大王' | '家庭';

export interface Account {
  id: string;
  name: string;
  owner: AccountOwner;
  type: AccountType;
  currency: Currency;
  initialBalance: number;
  iconName: string;
  color?: string; // Optional custom color class
}

export interface CategoryItem {
  id: string;
  name: string;
  iconName: string; 
  color: string;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  categoryId: string;
  accountId: string; // From Account (Source)
  toAccountId?: string; // To Account (Destination) - for transfers
  note: string;
  date: string; // ISO string
}

export interface HistoricalAccountDetail {
  accountId: string;
  name: string;
  balance: number;
  currency: Currency;
  owner: AccountOwner;
  type: AccountType;
  sortIndex?: number;
}

export interface AssetSnapshot {
  id: string;
  date: string; // YYYY-MM-DD
  totalCNY: number;
  exchangeRate?: number;
  usdRate?: number;
  note?: string;
  isDeleted?: boolean;
  accountDetails?: HistoricalAccountDetail[];
}

export interface GoogleConfig {
  apiKey: string;
  clientId: string;
  spreadsheetId: string;
}

export type SyncDirection = 'upload' | 'download';

export interface SyncMetadata {
  lastSyncedAt?: string;
  lastDirection?: SyncDirection;
  spreadsheetId?: string;
}

export interface PersistenceSettings {
  cloudPreferred: boolean;
}

export interface AppSettings {
  exchangeRate: number;
  usdRate: number;
  financialNote: string;
  lastSavedAt?: string;
  storageMode?: string;
}

export interface AppMeta {
  dbPath?: string;
  accountCount?: number;
  snapshotCount?: number;
}

export interface AppStatePayload {
  accounts: Account[];
  snapshots: AssetSnapshot[];
  transactions: Transaction[];
  settings: AppSettings;
  meta?: AppMeta;
}

export interface BackupHistoryEntry {
  id: string;
  createdAt: string;
  actionType: string;
  summary: string;
  backupPath?: string;
  fileName?: string;
}
