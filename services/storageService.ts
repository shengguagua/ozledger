
import { Transaction, Account, AssetSnapshot, GoogleConfig, PersistenceSettings, SyncMetadata } from '../types';
import { DEFAULT_EXCHANGE_RATE, DEFAULT_ACCOUNTS } from '../constants';

const KEY_TRANSACTIONS = 'ozledger_transactions';
const KEY_RATE = 'ozledger_rate';
const KEY_USD_RATE = 'ozledger_usd_rate';
const KEY_ACCOUNTS = 'ozledger_accounts';
const KEY_NOTES = 'ozledger_financial_notes';
const KEY_SNAPSHOTS = 'ozledger_asset_snapshots';
const KEY_GOOGLE_CONFIG = 'ozledger_google_config';
const KEY_SYNC_METADATA = 'ozledger_sync_metadata';
const KEY_PERSISTENCE_SETTINGS = 'ozledger_persistence_settings';

const SEED_TRANSACTIONS: Transaction[] = [];

const SEED_SNAPSHOTS: AssetSnapshot[] = [];

export const getStoredTransactions = (): Transaction[] => {
  try {
    const data = localStorage.getItem(KEY_TRANSACTIONS);
    return data ? JSON.parse(data) : SEED_TRANSACTIONS;
  } catch (e) {
    console.error("Failed to load transactions", e);
    return SEED_TRANSACTIONS;
  }
};

export const saveStoredTransactions = (transactions: Transaction[]) => {
  try {
    localStorage.setItem(KEY_TRANSACTIONS, JSON.stringify(transactions));
  } catch (e) {
    console.error("Failed to save transactions", e);
  }
};

export const getStoredRate = (): number => {
  try {
    const data = localStorage.getItem(KEY_RATE);
    return data ? parseFloat(data) : DEFAULT_EXCHANGE_RATE;
  } catch (e) {
    return DEFAULT_EXCHANGE_RATE;
  }
};

export const saveStoredRate = (rate: number) => {
  try {
    localStorage.setItem(KEY_RATE, rate.toString());
  } catch (e) {
    console.error("Failed to save rate", e);
  }
};

export const getStoredUSDRate = (): number => {
  try {
    const data = localStorage.getItem(KEY_USD_RATE);
    return data ? parseFloat(data) : 1.5;
  } catch (e) {
    return 1.5;
  }
};

export const saveStoredUSDRate = (rate: number) => {
  try {
    localStorage.setItem(KEY_USD_RATE, rate.toString());
  } catch (e) {
    console.error("Failed to save USD rate", e);
  }
};

export const getStoredAccounts = (): Account[] => {
  try {
    const data = localStorage.getItem(KEY_ACCOUNTS);
    if (data) {
      return JSON.parse(data);
    }
    return DEFAULT_ACCOUNTS;
  } catch (e) {
    return DEFAULT_ACCOUNTS;
  }
};

export const saveStoredAccounts = (accounts: Account[]) => {
  try {
    localStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
  } catch (e) {
    console.error("Failed to save accounts", e);
  }
};

export const getStoredNotes = (): string => {
  try {
    return localStorage.getItem(KEY_NOTES) || '';
  } catch (e) {
    return '';
  }
};

export const saveStoredNotes = (note: string) => {
  try {
    localStorage.setItem(KEY_NOTES, note);
  } catch (e) {
    console.error("Failed to save notes", e);
  }
};

export const getStoredSnapshots = (): AssetSnapshot[] => {
  try {
    const data = localStorage.getItem(KEY_SNAPSHOTS);
    return data ? JSON.parse(data) : SEED_SNAPSHOTS;
  } catch (e) {
    return SEED_SNAPSHOTS;
  }
};

export const saveStoredSnapshots = (snapshots: AssetSnapshot[]) => {
  try {
    localStorage.setItem(KEY_SNAPSHOTS, JSON.stringify(snapshots));
  } catch (e) {
    console.error("Failed to save snapshots", e);
  }
};

export const getGoogleConfig = (): GoogleConfig => {
  // Hardcoded defaults provided by user
  const defaults = {
    apiKey: 'AIzaSyA9YaZpvefOr8LhCfPCPIAErdCnFXKjYMc',
    clientId: '35205101614-p8vljdjje752iu453frp2inmpd5f90c7.apps.googleusercontent.com', // Updated by user
    spreadsheetId: '1HmWJSP_nSEUGXiuuoiqhmmSkjJ9WPxHG2xzZ-0MasCQ'
  };

  try {
    const data = localStorage.getItem(KEY_GOOGLE_CONFIG);
    if (data) {
        const parsed = JSON.parse(data);
        // If the stored value has empty fields, try to use defaults
        return {
            apiKey: parsed.apiKey || defaults.apiKey,
            clientId: parsed.clientId || defaults.clientId,
            spreadsheetId: parsed.spreadsheetId || defaults.spreadsheetId
        };
    }
    return defaults;
  } catch {
    return defaults;
  }
}

export const saveGoogleConfig = (config: GoogleConfig) => {
  try {
    localStorage.setItem(KEY_GOOGLE_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save google config", e);
  }
}

export const getSyncMetadata = (): SyncMetadata => {
  try {
    const data = localStorage.getItem(KEY_SYNC_METADATA);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

export const saveSyncMetadata = (metadata: SyncMetadata) => {
  try {
    localStorage.setItem(KEY_SYNC_METADATA, JSON.stringify(metadata));
  } catch (e) {
    console.error('Failed to save sync metadata', e);
  }
};

export const getPersistenceSettings = (): PersistenceSettings => {
  try {
    const data = localStorage.getItem(KEY_PERSISTENCE_SETTINGS);
    if (!data) return { cloudPreferred: true };
    const parsed = JSON.parse(data);
    return {
      cloudPreferred: parsed.cloudPreferred !== false,
    };
  } catch {
    return { cloudPreferred: true };
  }
};

export const savePersistenceSettings = (settings: PersistenceSettings) => {
  try {
    localStorage.setItem(KEY_PERSISTENCE_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save persistence settings', e);
  }
};
