let storageModule;
let currentStorageName = 'sqlite';

// Production must fail closed if MySQL is unavailable. Falling back to a
// second database can make a successful-looking write disappear from the
// real ledger. SQLite fallback is opt-in for local development only.
const allowSqliteFallback = process.env.NODE_ENV !== 'production'
  && process.env.ALLOW_SQLITE_FALLBACK === 'true';

if (process.env.NODE_ENV === 'production' && process.env.DB_CLIENT !== 'mysql') {
  throw new Error('Production requires DB_CLIENT=mysql; refusing to run against SQLite.');
}

const isMysqlConnectionError = (error) => {
  const code = error?.code;
  return code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH';
};

const switchToSqliteFallback = async (error) => {
  if (currentStorageName === 'sqlite' || !allowSqliteFallback) throw error;
  console.warn(
    `mysql runtime unavailable, falling back to sqlite: ${error instanceof Error ? error.message : error}`
  );
  storageModule = await import('./sqlite-db.js');
  currentStorageName = 'sqlite';
  storageName = storageModule.storageName;
  dbPath = storageModule.dbPath;
  dbTargetHost = storageModule.dbTargetHost;
  return storageModule;
};

if (process.env.DB_CLIENT === 'mysql') {
  try {
    storageModule = await import('./mysql-db.js');
    currentStorageName = 'mysql';
  } catch (error) {
    if (!allowSqliteFallback) throw error;
    console.warn(
      `mysql storage unavailable, falling back to sqlite: ${error instanceof Error ? error.message : error}`
    );
    storageModule = await import('./sqlite-db.js');
    currentStorageName = 'sqlite';
  }
} else {
  storageModule = await import('./sqlite-db.js');
  currentStorageName = 'sqlite';
}

export const ValidationError = storageModule.ValidationError;
export const ConflictError = storageModule.ConflictError;
export let dbPath = storageModule.dbPath;
export let dbTargetHost = storageModule.dbTargetHost;
export let storageName = currentStorageName;

const callWithFallback = async (method, ...args) => {
  try {
    return await storageModule[method](...args);
  } catch (error) {
    if (!isMysqlConnectionError(error)) throw error;
    await switchToSqliteFallback(error);
    return storageModule[method](...args);
  }
};

export const getBootstrapData = (...args) => callWithFallback('getBootstrapData', ...args);
export const saveAccounts = (...args) => callWithFallback('saveAccounts', ...args);
export const saveSnapshots = (...args) => callWithFallback('saveSnapshots', ...args);
export const saveTransactions = (...args) => callWithFallback('saveTransactions', ...args);
export const saveSettings = (...args) => callWithFallback('saveSettings', ...args);
export const saveAll = (...args) => callWithFallback('saveAll', ...args);
export const exportBackup = (...args) => callWithFallback('exportBackup', ...args);
export const importBackup = (...args) => callWithFallback('importBackup', ...args);
export const listBackupHistory = (...args) => callWithFallback('listBackupHistory', ...args);
export const restoreBackupFile = (...args) => callWithFallback('restoreBackupFile', ...args);
export const getStorageStatus = async () => {
  if (process.env.DB_CLIENT === 'mysql' && currentStorageName === 'mysql') {
    try {
      await storageModule.getBootstrapData();
    } catch (error) {
      if (!isMysqlConnectionError(error)) throw error;
      await switchToSqliteFallback(error);
    }
  }

  return {
    storageName,
    dbPath,
    dbTargetHost,
  };
};
