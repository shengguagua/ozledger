import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ConflictError, ValidationError, exportBackup, getBootstrapData, getStorageStatus, importBackup, listBackupHistory, restoreBackupFile, saveAccounts, saveSettings, saveSnapshots, saveTransactions } from './db.js';

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (_req, res) => {
  const status = await getStorageStatus();
  res.json({
    ok: true,
    storage: status.storageName,
    dbPath: status.dbPath,
    dbTargetHost: status.dbTargetHost,
    now: new Date().toISOString(),
  });
});

app.get('/api/bootstrap', async (_req, res, next) => {
  try {
    res.json(await getBootstrapData());
  } catch (error) {
    next(error);
  }
});

app.put('/api/accounts', async (req, res, next) => {
  try {
    await saveAccounts(req.body.accounts || [], req.body.baseRevision);
    res.json(await getBootstrapData());
  } catch (error) {
    next(error);
  }
});

app.put('/api/snapshots', async (req, res, next) => {
  try {
    await saveSnapshots(req.body.snapshots || [], req.body.baseRevision);
    res.json(await getBootstrapData());
  } catch (error) {
    next(error);
  }
});

app.put('/api/settings', async (req, res, next) => {
  try {
    await saveSettings(req.body.settings || {}, req.body.baseRevision);
    res.json(await getBootstrapData());
  } catch (error) {
    next(error);
  }
});

app.put('/api/transactions', async (req, res, next) => {
  try {
    await saveTransactions(req.body.transactions || [], req.body.baseRevision);
    res.json(await getBootstrapData());
  } catch (error) {
    next(error);
  }
});

app.get('/api/backup/export', async (_req, res, next) => {
  try {
    res.json(await exportBackup());
  } catch (error) {
    next(error);
  }
});

app.get('/api/backup/history', async (_req, res, next) => {
  try {
    res.json(await listBackupHistory());
  } catch (error) {
    next(error);
  }
});

app.post('/api/backup/import', async (req, res, next) => {
  try {
    res.json(await importBackup(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.post('/api/backup/restore', async (req, res, next) => {
  try {
    res.json(await restoreBackupFile(req.body?.fileName || ''));
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof ConflictError || error instanceof ValidationError) {
    res.status(error.status).json({ error: error.message, code: error.code, currentRevision: error.currentRevision });
    return;
  }
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
});

app.listen(port, () => {
  console.log(`ozledger api listening on http://127.0.0.1:${port}`);
});
