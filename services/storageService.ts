
import { Transaction, Account, AssetSnapshot, GoogleConfig } from '../types';
import { DEFAULT_EXCHANGE_RATE, DEFAULT_ACCOUNTS } from '../constants';

const KEY_TRANSACTIONS = 'ozledger_transactions';
const KEY_RATE = 'ozledger_rate';
const KEY_USD_RATE = 'ozledger_usd_rate';
const KEY_ACCOUNTS = 'ozledger_accounts';
const KEY_NOTES = 'ozledger_financial_notes';
const KEY_SNAPSHOTS = 'ozledger_asset_snapshots';
const KEY_GOOGLE_CONFIG = 'ozledger_google_config';

// Seed data from user backup
const SEED_TRANSACTIONS: Transaction[] = [
  {
    "amount": 20000,
    "currency": "CNY",
    "type": "income",
    "categoryId": "remittance",
    "accountId": "sp_reimburse",
    "note": "12月生活费",
    "id": "afca29e7-7f6b-4343-b132-8a77a1d2f74a",
    "date": "2025-12-08T04:12:42.308Z"
  }
];

// Seed data for historical assets
const SEED_SNAPSHOTS: AssetSnapshot[] = [
  { id: 'h1', date: '2024-08-01', totalCNY: 244847.8, note: '初始记录' },
  { id: 'h2', date: '2024-09-23', totalCNY: 331302.70, note: '' },
  { id: 'h3', date: '2024-10-02', totalCNY: 343617.42, note: '' },
  { id: 'h4', date: '2024-10-13', totalCNY: 350077.09, note: '' },
  { id: 'h5', date: '2025-01-24', totalCNY: 368356.6, note: '' },
  { id: 'h6', date: '2025-03-25', totalCNY: 354993.4, note: '' },
  { id: 'h7', date: '2025-04-04', totalCNY: 369088.5, note: '' },
  { id: 'h8', date: '2025-04-17', totalCNY: 368955.5, note: '' },
  { id: 'h9', date: '2025-05-20', totalCNY: 330294.07, note: '' },
  { id: 'h10', date: '2025-07-10', totalCNY: 343928, note: '' },
  { id: 'h11', date: '2025-09-19', totalCNY: 382114, note: '' },
  { id: 'h12', date: '2025-12-08', totalCNY: 379359.50, note: '当前' },
];

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
