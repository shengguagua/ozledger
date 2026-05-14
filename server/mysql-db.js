import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { defaultAccounts, defaultSnapshots, defaultTransactions, DEFAULT_EXCHANGE_RATE, DEFAULT_USD_RATE } from './seed.js';

const dataDir = path.resolve(process.cwd(), 'data');
const backupDir = path.join(dataDir, 'backups');
const changeLogPath = path.join(dataDir, 'change-log.md');
const dbClient = process.env.DB_CLIENT || 'mysql';
export const dbTargetHost = process.env.DB_HOST || process.env.OZ_DB_HOST || '43.136.32.239';
const dbPort = Number(process.env.DB_PORT || 3306);
const dbUser = process.env.DB_USER || 'ozledger';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'ozledger';
const dbConnectTimeout = Number(process.env.DB_CONNECT_TIMEOUT || 3000);
export const dbPath = `${dbClient}://${dbUser}@${dbTargetHost}:${dbPort}/${dbName}`;
const sqlitePath = path.join(dataDir, 'ozledger.sqlite');
export const storageName = 'mysql';

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
  }
}

export class ConflictError extends Error {
  constructor(message, currentRevision) {
    super(message);
    this.name = 'ConflictError';
    this.code = 'REVISION_CONFLICT';
    this.status = 409;
    this.currentRevision = currentRevision;
  }
}

const pool = mysql.createPool({
  host: dbTargetHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  connectTimeout: dbConnectTimeout,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false,
});

const createLogId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const roundMoney = (value) => Number(Number(value || 0).toFixed(2));
const normalizeRate = (value, fallback) => {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Number(next.toFixed(6));
};
const validateIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

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

const appendChangeLog = ({ actionType, summary, details, backupPath }) => {
  ensureChangeLogFile();
  const relativeBackupPath = backupPath ? path.relative(process.cwd(), backupPath) : '';
  const block = [
    `## ${new Date().toISOString()}`,
    '',
    `- Action: ${actionType}`,
    `- Summary: ${summary}`,
    `- Backup: ${relativeBackupPath || 'none'}`,
    `- Detail: \`${JSON.stringify(details)}\``,
    '',
  ].join('\n');
  fs.appendFileSync(changeLogPath, block, 'utf8');
};

const mapAccount = (row) => ({
  id: row.id,
  name: row.name,
  owner: row.owner,
  type: row.type,
  currency: row.currency,
  initialBalance: Number(row.initial_balance),
  iconName: row.icon_name,
  color: row.color || undefined,
});

const mapSnapshotDetail = (row) => ({
  accountId: row.account_id,
  name: row.name,
  owner: row.owner,
  type: row.type,
  balance: Number(row.balance),
  currency: row.currency,
  sortIndex: row.sort_index ?? 0,
});

const mapSnapshot = (row, detailsMap) => ({
  id: row.id,
  date: row.date,
  totalCNY: Number(row.total_cny),
  exchangeRate: row.exchange_rate == null ? undefined : Number(row.exchange_rate),
  usdRate: row.usd_rate == null ? undefined : Number(row.usd_rate),
  note: row.note || '',
  isDeleted: Boolean(row.is_deleted),
  accountDetails: detailsMap.get(row.id) || [],
});

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

const queryRows = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

const queryOne = async (sql, params = []) => {
  const rows = await queryRows(sql, params);
  return rows[0];
};

const getCurrentRevision = async () => {
  const row = await queryOne(`SELECT value FROM settings WHERE \`key\` = 'lastSavedAt'`);
  return row?.value || '';
};

const assertRevision = async (baseRevision) => {
  if (!baseRevision) return;
  const currentRevision = await getCurrentRevision();
  if (currentRevision && currentRevision !== baseRevision) {
    throw new ConflictError('检测到有更新的数据写入，已阻止覆盖。请刷新后再试。', currentRevision);
  }
};

const saveSetting = async (conn, key, value) => {
  await conn.execute(
    'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [key, value]
  );
};

const getCurrentSnapshotMap = async () => {
  const snapshotRows = await queryRows('SELECT * FROM snapshots');
  const detailRows = await queryRows('SELECT * FROM snapshot_details');
  const detailsMap = new Map();
  detailRows.forEach((row) => {
    if (!detailsMap.has(row.snapshot_id)) detailsMap.set(row.snapshot_id, []);
    detailsMap.get(row.snapshot_id).push(mapSnapshotDetail(row));
  });
  return new Map(snapshotRows.map((row) => [row.id, mapSnapshot(row, detailsMap)]));
};

const describeSnapshotChanges = async (nextSnapshots) => {
  const beforeMap = await getCurrentSnapshotMap();
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
    if (!afterMap.has(id)) removed.push(snapshot.date);
  }

  return { created, removed, updated };
};

const appendAuditLog = async (conn, { actionType, summary, details, backupPath }) => {
  const createdAt = new Date().toISOString();
  const id = createLogId();
  const relativeBackupPath = backupPath ? path.relative(process.cwd(), backupPath) : '';
  await conn.execute(
    'INSERT INTO audit_logs (id, created_at, action_type, summary, backup_path, detail_json) VALUES (?, ?, ?, ?, ?, ?)',
    [id, createdAt, actionType, summary, relativeBackupPath || null, JSON.stringify(details)]
  );
  appendChangeLog({ actionType, summary, details, backupPath });
};

const exportBackup = async () => {
  const data = await getBootstrapData();
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

const withBackupLog = async (actionType, summary, detailFactory, fn) => {
  const backupPath = writeBackupFile(actionType, await exportBackup());
  const details = await detailFactory();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await appendAuditLog(conn, { actionType, summary, details, backupPath });
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const replaceAccounts = async (conn, accounts) => {
  await conn.execute('DELETE FROM accounts');
  for (const account of accounts.map(normalizeAccount)) {
    await conn.execute(
      'INSERT INTO accounts (id, name, owner, type, currency, initial_balance, icon_name, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [account.id, account.name, account.owner, account.type, account.currency, account.initialBalance, account.iconName, account.color]
    );
  }
};

const replaceSnapshots = async (conn, snapshots) => {
  const normalizedSnapshots = normalizeSnapshots(snapshots);
  await conn.execute('DELETE FROM snapshot_details');
  await conn.execute('DELETE FROM snapshots');
  for (const snapshot of normalizedSnapshots) {
    await conn.execute(
      'INSERT INTO snapshots (id, date, total_cny, exchange_rate, usd_rate, note, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [snapshot.id, snapshot.date, snapshot.totalCNY, snapshot.exchangeRate, snapshot.usdRate, snapshot.note || '', snapshot.isDeleted ? 1 : 0]
    );
    for (const detail of snapshot.accountDetails || []) {
      await conn.execute(
        'INSERT INTO snapshot_details (snapshot_id, account_id, name, owner, type, balance, currency, sort_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [snapshot.id, detail.accountId, detail.name, detail.owner, detail.type, detail.balance, detail.currency, detail.sortIndex ?? 0]
      );
    }
  }
};

const replaceTransactions = async (conn, transactions) => {
  await conn.execute('DELETE FROM transactions');
  for (const transaction of transactions.map(normalizeTransaction)) {
    await conn.execute(
      'INSERT INTO transactions (id, amount, currency, type, category_id, account_id, to_account_id, note, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [transaction.id, transaction.amount, transaction.currency, transaction.type, transaction.categoryId, transaction.accountId, transaction.toAccountId, transaction.note, transaction.date]
    );
  }
};

const ensureSchema = async () => {
  await queryRows(`
    CREATE TABLE IF NOT EXISTS accounts (
      id VARCHAR(191) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      owner VARCHAR(64) NOT NULL,
      type VARCHAR(64) NOT NULL,
      currency VARCHAR(16) NOT NULL,
      initial_balance DOUBLE NOT NULL,
      icon_name VARCHAR(255) NOT NULL,
      color VARCHAR(255) NULL
    )
  `);
  await queryRows(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id VARCHAR(191) PRIMARY KEY,
      date VARCHAR(32) NOT NULL,
      total_cny DOUBLE NOT NULL,
      exchange_rate DOUBLE NULL,
      usd_rate DOUBLE NULL,
      note TEXT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_snapshots_date (date)
    )
  `);
  await queryRows(`
    CREATE TABLE IF NOT EXISTS snapshot_details (
      snapshot_id VARCHAR(191) NOT NULL,
      account_id VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL,
      owner VARCHAR(64) NOT NULL,
      type VARCHAR(64) NOT NULL,
      balance DOUBLE NOT NULL,
      currency VARCHAR(16) NOT NULL,
      sort_index INT NOT NULL DEFAULT 0,
      PRIMARY KEY (snapshot_id, account_id),
      CONSTRAINT fk_snapshot_details_snapshot FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
    )
  `);
  await queryRows(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(191) PRIMARY KEY,
      value TEXT NULL
    )
  `);
  await queryRows(`
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(191) PRIMARY KEY,
      amount DOUBLE NOT NULL,
      currency VARCHAR(16) NOT NULL,
      type VARCHAR(32) NOT NULL,
      category_id VARCHAR(191) NOT NULL,
      account_id VARCHAR(191) NOT NULL,
      to_account_id VARCHAR(191) NULL,
      note TEXT NULL,
      date VARCHAR(64) NOT NULL
    )
  `);
  await queryRows(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(191) PRIMARY KEY,
      created_at VARCHAR(64) NOT NULL,
      action_type VARCHAR(64) NOT NULL,
      summary VARCHAR(255) NOT NULL,
      backup_path VARCHAR(255) NULL,
      detail_json LONGTEXT NOT NULL
    )
  `);

  const countRow = await queryOne('SELECT COUNT(*) AS count FROM accounts');
  if (Number(countRow?.count || 0) > 0) return;

  let seedAccounts = defaultAccounts;
  let seedSnapshots = defaultSnapshots;
  let seedTransactions = defaultTransactions;
  let seedSettings = {
    exchangeRate: DEFAULT_EXCHANGE_RATE,
    usdRate: DEFAULT_USD_RATE,
    financialNote: '',
  };

  if (fs.existsSync(sqlitePath) && process.env.OZ_SKIP_SQLITE_MIGRATION !== '1') {
    try {
      const sqliteStorage = await import('./sqlite-db.js');
      const sqliteBootstrap = await sqliteStorage.getBootstrapData();
      if ((sqliteBootstrap.accounts?.length || 0) > 0) {
        seedAccounts = sqliteBootstrap.accounts;
        seedSnapshots = sqliteBootstrap.snapshots;
        seedTransactions = sqliteBootstrap.transactions;
        seedSettings = {
          exchangeRate: sqliteBootstrap.settings?.exchangeRate ?? DEFAULT_EXCHANGE_RATE,
          usdRate: sqliteBootstrap.settings?.usdRate ?? DEFAULT_USD_RATE,
          financialNote: sqliteBootstrap.settings?.financialNote ?? '',
        };
      }
    } catch (error) {
      console.warn('sqlite bootstrap migration skipped:', error instanceof Error ? error.message : error);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await replaceAccounts(conn, seedAccounts);
    await replaceSnapshots(conn, seedSnapshots);
    await replaceTransactions(conn, seedTransactions);
    await saveSetting(conn, 'exchangeRate', String(seedSettings.exchangeRate));
    await saveSetting(conn, 'usdRate', String(seedSettings.usdRate));
    await saveSetting(conn, 'financialNote', seedSettings.financialNote);
    await saveSetting(conn, 'lastSavedAt', new Date().toISOString());
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

let readyPromise;

const ensureReady = async () => {
  if (!readyPromise) {
    readyPromise = ensureSchema().catch((error) => {
      readyPromise = undefined;
      throw error;
    });
  }

  return readyPromise;
};

export const getBootstrapData = async () => {
  await ensureReady();
  const accounts = (await queryRows('SELECT * FROM accounts ORDER BY owner, name')).map(mapAccount);
  const snapshotRows = await queryRows('SELECT * FROM snapshots ORDER BY date DESC');
  const detailRows = await queryRows('SELECT * FROM snapshot_details ORDER BY snapshot_id, sort_index');
  const detailsMap = new Map();
  detailRows.forEach((row) => {
    if (!detailsMap.has(row.snapshot_id)) detailsMap.set(row.snapshot_id, []);
    detailsMap.get(row.snapshot_id).push(mapSnapshotDetail(row));
  });

  const settingsRows = await queryRows('SELECT * FROM settings');
  const settings = {
    exchangeRate: DEFAULT_EXCHANGE_RATE,
    usdRate: DEFAULT_USD_RATE,
    financialNote: '',
    lastSavedAt: '',
    storageMode: 'mysql',
  };
  settingsRows.forEach((row) => {
    if (row.key === 'exchangeRate') settings.exchangeRate = Number(row.value) || DEFAULT_EXCHANGE_RATE;
    if (row.key === 'usdRate') settings.usdRate = Number(row.value) || DEFAULT_USD_RATE;
    if (row.key === 'financialNote') settings.financialNote = row.value || '';
    if (row.key === 'lastSavedAt') settings.lastSavedAt = row.value || '';
  });

  const transactions = (await queryRows('SELECT * FROM transactions ORDER BY date DESC')).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
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
    snapshots: snapshotRows.map((row) => mapSnapshot(row, detailsMap)),
    transactions,
    settings,
    meta: {
      dbPath,
      accountCount: accounts.length,
      snapshotCount: snapshotRows.length,
      dbDriver: 'mysql',
      dbTargetHost,
    },
  };
};

export const saveAccounts = async (accounts, baseRevision) => {
  await ensureReady();
  await assertRevision(baseRevision);
  await withBackupLog(
    'save-accounts',
    `更新账户列表，共 ${accounts.length} 个账户`,
    async () => ({ accountCount: accounts.length }),
    async (conn) => {
      await replaceAccounts(conn, accounts);
      await saveSetting(conn, 'lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveSnapshots = async (snapshots, baseRevision) => {
  await ensureReady();
  await assertRevision(baseRevision);
  await withBackupLog(
    'save-snapshots',
    `更新快照，共 ${snapshots.length} 期`,
    async () => describeSnapshotChanges(snapshots),
    async (conn) => {
      await replaceSnapshots(conn, snapshots);
      await saveSetting(conn, 'lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveTransactions = async (transactions, baseRevision) => {
  await ensureReady();
  await assertRevision(baseRevision);
  await withBackupLog(
    'save-transactions',
    `更新交易记录，共 ${transactions.length} 条`,
    async () => ({ transactionCount: transactions.length }),
    async (conn) => {
      await replaceTransactions(conn, transactions);
      await saveSetting(conn, 'lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveSettings = async (settings, baseRevision) => {
  await ensureReady();
  await assertRevision(baseRevision);
  await withBackupLog(
    'save-settings',
    '更新系统设置',
    async () => settings,
    async (conn) => {
      if (settings.exchangeRate !== undefined) await saveSetting(conn, 'exchangeRate', String(settings.exchangeRate));
      if (settings.usdRate !== undefined) await saveSetting(conn, 'usdRate', String(settings.usdRate));
      if (settings.financialNote !== undefined) await saveSetting(conn, 'financialNote', settings.financialNote);
      await saveSetting(conn, 'lastSavedAt', new Date().toISOString());
    }
  );
};

export const saveAll = async (payload) => {
  await ensureReady();
  await assertRevision(payload.baseRevision);
  await withBackupLog(
    'save-all',
    '导入或批量覆盖全部数据',
    async () => ({
      accountCount: payload.accounts?.length || 0,
      snapshotCount: payload.snapshots?.length || 0,
      transactionCount: payload.transactions?.length || 0,
    }),
    async (conn) => {
      if (payload.accounts) await replaceAccounts(conn, payload.accounts);
      if (payload.snapshots) await replaceSnapshots(conn, payload.snapshots);
      if (payload.transactions) await replaceTransactions(conn, payload.transactions);
      if (payload.settings?.exchangeRate !== undefined) await saveSetting(conn, 'exchangeRate', String(payload.settings.exchangeRate));
      if (payload.settings?.usdRate !== undefined) await saveSetting(conn, 'usdRate', String(payload.settings.usdRate));
      if (payload.settings?.financialNote !== undefined) await saveSetting(conn, 'financialNote', payload.settings.financialNote);
      await saveSetting(conn, 'lastSavedAt', new Date().toISOString());
    }
  );
};

export const importBackup = async (payload) => {
  await saveAll({
    accounts: payload.accounts || [],
    snapshots: payload.snapshots || [],
    transactions: payload.transactions || [],
    settings: {
      exchangeRate: payload.exchangeRate ?? DEFAULT_EXCHANGE_RATE,
      usdRate: payload.usdRate ?? DEFAULT_USD_RATE,
      financialNote: payload.financialNote ?? '',
    },
    baseRevision: payload.baseRevision,
  });
  return getBootstrapData();
};

export const listBackupHistory = async () => {
  await ensureReady();
  const rows = await queryRows(`
    SELECT id, created_at, action_type, summary, backup_path
    FROM audit_logs
    WHERE backup_path IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 20
  `);
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actionType: row.action_type,
    summary: row.summary,
    backupPath: row.backup_path || undefined,
    fileName: row.backup_path ? path.basename(row.backup_path) : undefined,
  }));
};

export const restoreBackupFile = async (fileName) => {
  await ensureReady();
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
