let storageModule;
let currentStorageName = 'sqlite';

const isMysqlConnectionError = (error) => {
  const code = error?.code;
  return code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH';
};

const switchToSqliteFallback = async (error) => {
  if (currentStorageName === 'sqlite') throw error;
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
