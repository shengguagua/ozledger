
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

export interface AssetSnapshot {
  id: string;
  date: string; // YYYY-MM-DD
  totalCNY: number;
  note?: string;
  isDeleted?: boolean; // New field for logical deletion
}

export interface GoogleConfig {
  apiKey: string;
  clientId: string;
  spreadsheetId: string;
}
