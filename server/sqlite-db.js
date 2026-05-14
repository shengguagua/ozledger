import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { defaultAccounts, defaultSnapshots, defaultTransactions, DEFAULT_EXCHANGE_RATE, DEFAULT_USD_RATE } from './seed.js';

const dataDir = path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'ozledger.sqlite');
const backupDir = path.join(dataDir, 'backups');
const changeLogPath = path.join(dataDir, 'change-log.md');
const dbTargetHost = process.env.OZ_DB_HOST || '43.136.32.239';
export const storageName = 'sqlite';

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
  }
}

class ConflictError extends Error {
  constructor(message, currentRevision) {
    super(message);
    this.name = 'ConflictError';
    this.code = 'REVISION_CONFLICT';
    this.status = 409;
    this.currentRevision = currentRevision;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    type TEXT NOT NULL,
    currency TEXT NOT NULL,
    initial_balance REAL NOT NULL,
    icon_name TEXT NOT NULL,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    total_cny REAL NOT NULL,
    exchange_rate REAL,
    usd_rate REAL,
    note TEXT DEFAULT '',
    is_deleted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS snapshot_details (
    snapshot_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    type TEXT NOT NULL,
    balance REAL NOT NULL,
    currency TEXT NOT NULL,
    sort_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (snapshot_id, account_id),
    FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    type TEXT NOT NULL,
    category_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    to_account_id TEXT,
    note TEXT DEFAULT '',
    date TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    action_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    backup_path TEXT,
    detail_json TEXT NOT NULL
  );
`);

const snapshotColumns = db.prepare(`PRAGMA table_info(snapshots)`).all().map((column) => column.name);
if (!snapshotColumns.includes('exchange_rate')) {
  db.exec('ALTER TABLE snapshots ADD COLUMN exchange_rate REAL');
}
if (!snapshotColumns.includes('usd_rate')) {
  db.exec('ALTER TABLE snapshots ADD COLUMN usd_rate REAL');
}
const snapshotDetailColumns = db.prepare(`PRAGMA table_info(snapshot_details)`).all().map((column) => column.name);
if (!snapshotDetailColumns.includes('sort_index')) {
  db.exec('ALTER TABLE snapshot_details ADD COLUMN sort_index INTEGER NOT NULL DEFAULT 0');
}

const countAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;

if (countAccounts === 0) {
  const insertAccount = db.prepare(`
    INSERT INTO accounts (id, name, owner, type, currency, initial_balance, icon_name, color)
    VALUES (@id, @name, @owner, @type, @currency, @initialBalance, @iconName, @color)
  `);
  const insertSnapshot = db.prepare(`
    INSERT INTO snapshots (id, date, total_cny, exchange_rate, usd_rate, note, is_deleted)
    VALUES (@id, @date, @totalCNY, @exchangeRate, @usdRate, @note, @isDeleted)
  `);
  const insertTransaction = db.prepare(`
    INSERT INTO transactions (id, amount, currency, type, category_id, account_id, to_account_id, note, date)
    VALUES (@id, @amount, @currency, @type, @categoryId, @accountId, @toAccountId, @note, @date)
  `);
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  const seed = db.transaction(() => {
    defaultAccounts.forEach((account) => insertAccount.run(account));
    defaultSnapshots.forEach((snapshot) => insertSnapshot.run({
      ...snapshot,
      exchangeRate: snapshot.exchangeRate ?? DEFAULT_EXCHANGE_RATE,
      usdRate: snapshot.usdRate ?? DEFAULT_USD_RATE,
    }));
    defaultTransactions.forEach((transaction) => insertTransaction.run({ ...transaction, toAccountId: transaction.toAccountId || null }));
    insertSetting.run('exchangeRate', String(DEFAULT_EXCHANGE_RATE));
    insertSetting.run('usdRate', String(DEFAULT_USD_RATE));
    insertSetting.run('financialNote', '');
    insertSetting.run('lastSavedAt', new Date().toISOString());
  });

  seed();
}

const mapAccount = (row) => ({
  id: row.id,
  name: row.name,
  owner: row.owner,
  type: row.type,
  currency: row.currency,
  initialBalance: row.initial_balance,
  iconName: row.icon_name,
  color: row.color || undefined,
});

const mapSnapshotDetail = (row) => ({
  accountId: row.account_id,
  name: row.name,
  owner: row.owner,
  type: row.type,
  balance: row.balance,
  currency: row.currency,
  sortIndex: row.sort_index ?? 0,
});

const mapSnapshot = (row, detailsMap) => ({
  id: row.id,
  date: row.date,
  totalCNY: row.total_cny,
  exchangeRate: row.exchange_rate ?? undefined,
  usdRate: row.usd_rate ?? undefined,
  note: row.note || '',
  isDeleted: Boolean(row.is_deleted),
  accountDetails: detailsMap.get(row.id) || [],
});

const createLogId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const normalizeRate = (value, fallback) => {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Number(next.toFixed(6));
};
const validateIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const getCurrentRevision = () => db.prepare(`SELECT value FROM settings WHERE key = 'lastSavedAt'`).get()?.value || '';

const assertRevision = (baseRevision) => {
  if (!baseRevision) return;
  const currentRevision = getCurrentRevision();
  if (currentRevision && currentRevision !== baseRevision) {
    throw new ConflictError('检测到有更新的数据写入，已阻止覆盖。请刷新后再试。', currentRevision);
  }
};

const normalizeAccount = (account) => {
  if (!account?.id) throw new ValidationError('账户缺少 id');
  if (!account?.name?.trim()) throw new ValidationError(`账户缺少名称（${account.id}）`);
  if (!account?.owner?.trim()) throw new ValidationError(`账户缺少 owner（${account.id}）`);
  if (!account?.type?.trim()) throw new ValidationError(`账户缺少 type（${account.id}）`);
  if (!account?.currency?.trim()) throw new ValidationError(`账户缺少 currency（${account.id}）`);
  const initialBalance = Number(account.initialBalance);
  if (!Number.isFinite(initialBalance)) throw new ValidationError(`账户初始余额不是有效数字（${account.id}）`);

  return {
    id: account.id,
    name: account.name.trim(),
    owner: account.owner,
    type: account.type,
    currency: account.currency,
    initialBalance: roundMoney(initialBalance),
    iconName: account.iconName || 'Wallet',
    color: account.color || null,
  };
};

const normalizeDetail = (detail, index) => {
  if (!detail?.accountId) throw new ValidationError(`快照明细缺少 accountId（第 ${index + 1} 项）`);
  if (!detail?.name?.trim()) throw new ValidationError(`快照明细缺少名称（${detail.accountId}）`);
  if (!detail?.owner?.trim()) throw new ValidationError(`快照明细缺少 owner（${detail.accountId}）`);
  if (!detail?.type?.trim()) throw new ValidationError(`快照明细缺少 type（${detail.accountId}）`);
  if (!detail?.currency?.trim()) throw new ValidationError(`快照明细缺少 currency（${detail.accountId}）`);

  const balance = Number(detail.balance);
  if (!Number.isFinite(balance)) throw new ValidationError(`快照明细余额不是有效数字（${detail.accountId}）`);

  return {
    accountId: detail.accountId,
    name: detail.name.trim(),
    owner: detail.owner,
    type: detail.type,
    balance: roundMoney(balance),
    currency: detail.currency,
    sortIndex: Number.isFinite(Number(detail.sortIndex)) ? Number(detail.sortIndex) : index,
  };
};

const toCNY = (amount, currency, exchangeRate, usdRate) => {
  if (currency === 'CNY') return amount;
  if (currency === 'AUD') return amount * exchangeRate;
  if (currency === 'USD') return amount * exchangeRate / usdRate;
  return amount;
};

const computeSnapshotTotal = (details, exchangeRate, usdRate) =>
  roundMoney(details.reduce((sum, detail) => sum + toCNY(detail.balance, detail.currency, exchangeRate, usdRate), 0));

const normalizeSnapshot = (snapshot) => {
  if (!snapshot?.id) throw new ValidationError('快照缺少 id');
  if (!snapshot?.date || !validateIsoDate(snapshot.date)) {
    throw new ValidationError(`快照日期格式无效（${snapshot?.id || 'unknown'}）`);
  }

  const exchangeRate = normalizeRate(snapshot.exchangeRate, DEFAULT_EXCHANGE_RATE);
  const usdRate = normalizeRate(snapshot.usdRate, DEFAULT_USD_RATE);
  const accountDetails = (snapshot.accountDetails || [])
    .map(normalizeDetail)
    .sort((a, b) => a.sortIndex - b.sortIndex || a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name));
  const totalCNY = accountDetails.length > 0
    ? computeSnapshotTotal(accountDetails, exchangeRate, usdRate)
    : roundMoney(snapshot.totalCNY);

  if (!Number.isFinite(totalCNY)) {
    throw new ValidationError(`快照总资产不是有效数字（${snapshot.id}）`);
  }

  return {
    id: snapshot.id,
    date: snapshot.date,
    totalCNY,
    exchangeRate,
    usdRate,
    note: (snapshot.note || '').trim(),
    isDeleted: Boolean(snapshot.isDeleted),
    accountDetails,
  };
};

const normalizeSnapshots = (snapshots) => {
  const seenIds = new Set();
  return snapshots.map(normalizeSnapshot).map((snapshot) => {
    if (seenIds.has(snapshot.id)) throw new ValidationError(`快照 id 重复：${snapshot.id}`);
    seenIds.add(snapshot.id);
    return snapshot;
  });
};

const normalizeTransaction = (transaction) => {
  if (!transaction?.id) throw new ValidationError('交易缺少 id');
  if (!transaction?.accountId) throw new ValidationError(`交易缺少账户（${transaction.id}）`);
  if (!transaction?.date) throw new ValidationError(`交易缺少日期（${transaction.id}）`);

  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) throw new ValidationError(`交易金额不是有效数字（${transaction.id}）`);

  return {
    ...transaction,
    amount: roundMoney(amount),
    note: (transaction.note || '').trim(),
    toAccountId: transaction.toAccountId || null,
  };
};

const ensureChangeLogFile = () => {
  if (!fs.existsSync(changeLogPath)) {
    fs.writeFileSync(changeLogPath, '# OZLedger Change Log\n\n', 'utf8');
  }
};

const writeBackupFile = (actionType, data) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}-${actionType}.json`;
  const absolutePath = path.join(backupDir, filename);
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), 'utf8');
  return absolutePath;
};

const appendAuditLog = ({ actionType, summary, details, backupPath }) => {
  const createdAt = new Date().toISOString();
  const id = createLogId();
  const relativeBackupPath = backupPath ? path.relative(process.cwd(), backupPath) : '';

  db.prepare(`
    INSERT INTO audit_logs (id, created_at, action_type, summary, backup_path, detail_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, createdAt, actionType, summary, relativeBackupPath || null, JSON.stringify(details));

  ensureChangeLogFile();
  const block = [
    `## ${createdAt}`,
    ``,
    `- Action: ${actionType}`,
    `- Summary: ${summary}`,
    `- Backup: ${relativeBackupPath || 'none'}`,
    `- Detail: \`${JSON.stringify(details)}\``,
    ``,
  ].join('\n');
  fs.appendFileSync(changeLogPath, block, 'utf8');
};

const getCurrentSnapshotMap = () => {
  const snapshotRows = db.prepare('SELECT * FROM snapshots').all();
  const detailRows = db.prepare('SELECT * FROM snapshot_details').all();
  const detailsMap = new Map();
  detailRows.forEach((row) => {
    if (!detailsMap.has(row.snapshot_id)) detailsMap.set(row.snapshot_id, []);
    detailsMap.get(row.snapshot_id).push(mapSnapshotDetail(row));
  });
  return new Map(snapshotRows.map((row) => [row.id, mapSnapshot(row, detailsMap)]));
};

const describeSnapshotChanges = (nextSnapshots) => {
  const beforeMap = getCurrentSnapshotMap();
  const afterMap = new Map(nextSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const created = [];
  const removed = [];
  const updated = [];

  for (const [id, snapshot] of afterMap.entries()) {
    if (!beforeMap.has(id)) {
      created.push(snapshot.date);
      continue;
    }

    const previous = beforeMap.get(id);
    const previousDetailMap = new Map((previous.accountDetails || []).map((detail) => [detail.accountId, detail.balance]));
    const changedDetails = (snapshot.accountDetails || [])
      .filter((detail) => previousDetailMap.get(detail.accountId) !== detail.balance)
      .map((detail) => detail.name);

    if (
      previous.date !== snapshot.date ||
      previous.totalCNY !== snapshot.totalCNY ||
      (previous.exchangeRate ?? DEFAULT_EXCHANGE_RATE) !== (snapshot.exchangeRate ?? DEFAULT_EXCHANGE_RATE) ||
      (previous.usdRate ?? DEFAULT_USD_RATE) !== (snapshot.usdRate ?? DEFAULT_USD_RATE) ||
      (previous.note || '') !== (snapshot.note || '') ||
      changedDetails.length > 0 ||
      Boolean(previous.isDeleted) !== Boolean(snapshot.isDeleted)
    ) {
      updated.push({
        date: snapshot.date,
        changedDetails: changedDetails.slice(0, 10),
        totalChanged: previous.totalCNY !== snapshot.totalCNY,
        rateChanged:
          (previous.exchangeRate ?? DEFAULT_EXCHANGE_RATE) !== (snapshot.exchangeRate ?? DEFAULT_EXCHANGE_RATE) ||
          (previous.usdRate ?? DEFAULT_USD_RATE) !== (snapshot.usdRate ?? DEFAULT_USD_RATE),
        noteChanged: (previous.note || '') !== (snapshot.note || ''),
      });
    }
  }

  for (const [id, snapshot] of beforeMap.entries()) {
    if (!afterMap.has(id)) {
      removed.push(snapshot.date);
    }
  }

  return { created, removed, updated };
};

const withBackupLog = (actionType, summary, detailFactory, fn) => {
  const backupPath = writeBackupFile(actionType, exportBackup());
  const details = detailFactory();
  const result = db.transaction(fn)();
  appendAuditLog({ actionType, summary, details, backupPath });
  return result;
};

export const getBootstrapData = () => {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY owner, name').all().map(mapAccount);
  const snapshotsRows = db.prepare('SELECT * FROM snapshots ORDER BY date DESC').all();
  const detailRows = db.prepare('SELECT * FROM snapshot_details ORDER BY snapshot_id, sort_index, rowid').all();
  const detailsMap = new Map();

  detailRows.forEach((row) => {
    if (!detailsMap.has(row.snapshot_id)) detailsMap.set(row.snapshot_id, []);
    detailsMap.get(row.snapshot_id).push(mapSnapshotDetail(row));
  });

  const settingsRows = db.prepare('SELECT * FROM settings').all();
  const settings = {
    exchangeRate: DEFAULT_EXCHANGE_RATE,
    usdRate: DEFAULT_USD_RATE,
    financialNote: '',
    lastSavedAt: '',
    storageMode: 'sqlite',
  };

  settingsRows.forEach((row) => {
    if (row.key === 'exchangeRate') settings.exchangeRate = Number(row.value) || DEFAULT_EXCHANGE_RATE;
    if (row.key === 'usdRate') settings.usdRate = Number(row.value) || DEFAULT_USD_RATE;
    if (row.key === 'financialNote') settings.financialNote = row.value || '';
    if (row.key === 'lastSavedAt') settings.lastSavedAt = row.value || '';
  });

  const transactions = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all().map((row) => ({
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    type: row.type,
    categoryId: row.category_id,
    accountId: row.account_id,
    toAccountId: row.to_account_id || undefined,
    note: row.note || '',
    date: row.date,
  }));

  return {
    accounts,
    snapshots: snapshotsRows.map((row) => mapSnapshot(row, detailsMap)),
    transactions,
    settings,
    meta: {
      dbPath,
      accountCount: accounts.length,
      snapshotCount: snapshotsRows.length,
      dbDriver: 'sqlite',
      dbTargetHost,
    },
  };
};

const replaceAccounts = (accounts) => {
  const clear = db.prepare('DELETE FROM accounts');
  const insert = db.prepare(`
    INSERT INTO accounts (id, name, owner, type, currency, initial_balance, icon_name, color)
    VALUES (@id, @name, @owner, @type, @currency, @initialBalance, @iconName, @color)
  `);
  clear.run();
  accounts.map(normalizeAccount).forEach((account) => insert.run(account));
};

const replaceSnapshots = (snapshots) => {
  const clearSnapshots = db.prepare('DELETE FROM snapshots');
  const clearDetails = db.prepare('DELETE FROM snapshot_details');
  const insertSnapshot = db.prepare(`
    INSERT INTO snapshots (id, date, total_cny, exchange_rate, usd_rate, note, is_deleted)
    VALUES (@id, @date, @totalCNY, @exchangeRate, @usdRate, @note, @isDeleted)
  `);
  const insertDetail = db.prepare(`
    INSERT INTO snapshot_details (snapshot_id, account_id, name, owner, type, balance, currency, sort_index)
    VALUES (@snapshotId, @accountId, @name, @owner, @type, @balance, @currency, @sortIndex)
  `);

  const normalizedSnapshots = normalizeSnapshots(snapshots);

  clearDetails.run();
  clearSnapshots.run();
  normalizedSnapshots.forEach((snapshot) => {
    insertSnapshot.run({
      id: snapshot.id,
      date: snapshot.date,
      totalCNY: snapshot.totalCNY,
      exchangeRate: snapshot.exchangeRate ?? DEFAULT_EXCHANGE_RATE,
      usdRate: snapshot.usdRate ?? DEFAULT_USD_RATE,
      note: snapshot.note || '',
      isDeleted: snapshot.isDeleted ? 1 : 0,
    });
    (snapshot.accountDetails || []).forEach((detail, index) => {
      insertDetail.run({
        snapshotId: snapshot.id,
        accountId: detail.accountId,
        name: detail.name,
        owner: detail.owner,
        type: detail.type,
        balance: detail.balance,
        currency: detail.currency,
        sortIndex: detail.sortIndex ?? index,
      });
    });
  });
};

const replaceTransactions = (transactions) => {
  const clear = db.prepare('DELETE FROM transactions');
  const insert = db.prepare(`
    INSERT INTO transactions (id, amount, currency, type, category_id, account_id, to_account_id, note, date)
    VALUES (@id, @amount, @currency, @type, @categoryId, @accountId, @toAccountId, @note, @date)
  `);
  clear.run();
  transactions.map(normalizeTransaction).forEach((transaction) => insert.run(transaction));
};

export const saveAccounts = (accounts, baseRevision) => {
  assertRevision(baseRevision);
  withBackupLog(
    'save-accounts',
    `更新账户列表，共 ${accounts.length} 个账户`,
    () => ({ accountCount: accounts.length }),
    () => {
    replaceAccounts(accounts);
    saveSetting('lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveSnapshots = (snapshots, baseRevision) => {
  assertRevision(baseRevision);
  const snapshotChanges = describeSnapshotChanges(snapshots);
  withBackupLog(
    'save-snapshots',
    `更新快照，共 ${snapshots.length} 期`,
    () => snapshotChanges,
    () => {
    replaceSnapshots(snapshots);
    saveSetting('lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveTransactions = (transactions, baseRevision) => {
  assertRevision(baseRevision);
  withBackupLog(
    'save-transactions',
    `更新交易记录，共 ${transactions.length} 条`,
    () => ({ transactionCount: transactions.length }),
    () => {
    replaceTransactions(transactions);
    saveSetting('lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveSettings = (settings, baseRevision) => {
  assertRevision(baseRevision);
  withBackupLog(
    'save-settings',
    '更新系统设置',
    () => settings,
    () => {
    if (settings.exchangeRate !== undefined) saveSetting('exchangeRate', String(settings.exchangeRate));
    if (settings.usdRate !== undefined) saveSetting('usdRate', String(settings.usdRate));
    if (settings.financialNote !== undefined) saveSetting('financialNote', settings.financialNote);
    saveSetting('lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveAll = (payload) => {
  assertRevision(payload.baseRevision);
  withBackupLog(
    'save-all',
    '导入或批量覆盖全部数据',
    () => ({
      accountCount: payload.accounts?.length || 0,
      snapshotCount: payload.snapshots?.length || 0,
      transactionCount: payload.transactions?.length || 0,
    }),
    () => {
    if (payload.accounts) replaceAccounts(payload.accounts);
    if (payload.snapshots) replaceSnapshots(payload.snapshots);
    if (payload.transactions) replaceTransactions(payload.transactions);
    if (payload.settings?.exchangeRate !== undefined) saveSetting('exchangeRate', String(payload.settings.exchangeRate));
    if (payload.settings?.usdRate !== undefined) saveSetting('usdRate', String(payload.settings.usdRate));
    if (payload.settings?.financialNote !== undefined) saveSetting('financialNote', payload.settings.financialNote);
    saveSetting('lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveSetting = (key, value) => {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
};

export const exportBackup = () => {
  const data = getBootstrapData();
  return {
    accounts: data.accounts,
    snapshots: data.snapshots,
    transactions: data.transactions,
    exchangeRate: data.settings.exchangeRate,
    usdRate: data.settings.usdRate,
    financialNote: data.settings.financialNote,
    exportDate: new Date().toISOString(),
  };
};

export const importBackup = (payload) => {
  saveAll({
    accounts: payload.accounts || [],
    snapshots: payload.snapshots || [],
    transactions: payload.transactions || [],
    settings: {
      exchangeRate: payload.exchangeRate ?? DEFAULT_EXCHANGE_RATE,
      usdRate: payload.usdRate ?? DEFAULT_USD_RATE,
      financialNote: payload.financialNote ?? '',
    },
  });
  return getBootstrapData();
};

export const listBackupHistory = () => {
  return db.prepare(`
    SELECT id, created_at, action_type, summary, backup_path
    FROM audit_logs
    WHERE backup_path IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 20
  `).all().map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actionType: row.action_type,
    summary: row.summary,
    backupPath: row.backup_path || undefined,
    fileName: row.backup_path ? path.basename(row.backup_path) : undefined,
  }));
};

export const restoreBackupFile = (fileName) => {
  const safeFileName = path.basename(fileName || '');
  if (!safeFileName.endsWith('.json')) {
    throw new Error('Only JSON backups can be restored');
  }

  const absolutePath = path.join(backupDir, safeFileName);
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Backup file not found');
  }

  const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  return importBackup(payload);
};

export { ConflictError, ValidationError, dbPath, dbTargetHost };
