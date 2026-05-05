import express from 'express';
import cors from 'cors';
import { dbPath, exportBackup, getBootstrapData, importBackup, listBackupHistory, restoreBackupFile, saveAccounts, saveSettings, saveSnapshots, saveTransactions } from './db.js';

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    storage: 'sqlite',
    dbPath,
    now: new Date().toISOString(),
  });
});

app.get('/api/bootstrap', (_req, res) => {
  res.json(getBootstrapData());
});

app.put('/api/accounts', (req, res) => {
  saveAccounts(req.body.accounts || []);
  res.json(getBootstrapData());
});

app.put('/api/snapshots', (req, res) => {
  saveSnapshots(req.body.snapshots || []);
  res.json(getBootstrapData());
});

app.put('/api/settings', (req, res) => {
  saveSettings(req.body.settings || {});
  res.json(getBootstrapData());
});

app.put('/api/transactions', (req, res) => {
  saveTransactions(req.body.transactions || []);
  res.json(getBootstrapData());
});

app.get('/api/backup/export', (_req, res) => {
  res.json(exportBackup());
});

app.get('/api/backup/history', (_req, res) => {
  res.json(listBackupHistory());
});

app.post('/api/backup/import', (req, res) => {
  res.json(importBackup(req.body || {}));
});

app.post('/api/backup/restore', (req, res) => {
  try {
    res.json(restoreBackupFile(req.body?.fileName || ''));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Restore failed' });
  }
});

app.listen(port, () => {
  console.log(`ozledger api listening on http://127.0.0.1:${port}`);
});
