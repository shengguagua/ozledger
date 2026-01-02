
import { Transaction, Account, AssetSnapshot, HistoricalAccountDetail } from '../types';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGoogleClient = (apiKey: string, clientId: string, onInitComplete: (success: boolean) => void) => {
  if (!apiKey || !clientId) {
    console.error("Missing API Key or Client ID");
    onInitComplete(false);
    return;
  }

  const gapiLoaded = () => {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        checkInit();
      } catch (err) {
        console.error("GAPI Init Error", err);
        onInitComplete(false);
      }
    });
  };

  const gisLoaded = () => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '', // defined at request time
      });
      gisInited = true;
      checkInit();
    } catch (err) {
      console.error("GIS Init Error", err);
      onInitComplete(false);
    }
  };

  const checkInit = () => {
    if (gapiInited && gisInited) {
      onInitComplete(true);
    }
  };

  if (window.gapi) gapiLoaded();
  if (window.google) gisLoaded();
};

export const handleAuthClick = (callback: (token: any) => void) => {
  if (!tokenClient) return;
  tokenClient.callback = async (resp: any) => {
    if (resp.error) {
      throw resp;
    }
    callback(resp);
  };

  if (window.gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
};

const ensureSheetsExist = async (spreadsheetId: string) => {
  try {
    const meta = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId
    });
    
    const existingTitles = meta.result.sheets.map((s: any) => s.properties.title);
    const requiredSheets = ['Transactions', 'Accounts', 'Settings', 'Snapshots', 'SnapshotDetails'];
    const requests: any[] = [];

    requiredSheets.forEach(title => {
      if (!existingTitles.includes(title)) {
        requests.push({
          addSheet: {
            properties: { title }
          }
        });
      }
    });

    if (requests.length > 0) {
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });
    }
  } catch (e) {
    console.error("Error ensuring sheets exist", e);
    throw e;
  }
};

export const saveToCloud = async (
  spreadsheetId: string, 
  transactions: Transaction[], 
  accounts: Account[],
  snapshots: AssetSnapshot[],
  settings: { exchangeRate: number; usdRate: number; note: string }
) => {
  try {
    await ensureSheetsExist(spreadsheetId);

    const txHeaders = ['ID', 'Date', 'Type', 'Amount', 'Currency', 'Category', 'Account', 'ToAccount', 'Note'];
    const txRows = transactions.map(t => [
      t.id, t.date, t.type, t.amount, t.currency, t.categoryId, t.accountId, t.toAccountId || '', t.note || ''
    ]);
    const txData = [txHeaders, ...txRows];

    const accHeaders = ['ID', 'Name', 'Owner', 'Type', 'Currency', 'InitialBalance', 'IconName', 'Color'];
    const accRows = accounts.map(a => [
      a.id, a.name, a.owner, a.type, a.currency, a.initialBalance, a.iconName, a.color || ''
    ]);
    const accData = [accHeaders, ...accRows];

    const snapHeaders = ['ID', 'Date', 'TotalCNY', 'Note', 'IsDeleted'];
    const snapRows = snapshots.map(s => [
      s.id, s.date, s.totalCNY, s.note || '', s.isDeleted ? 'TRUE' : 'FALSE'
    ]);
    const snapData = [snapHeaders, ...snapRows];

    const detailHeaders = ['SnapshotID', 'AccountName', 'Owner', 'Balance', 'Currency'];
    const detailRows: any[] = [];
    snapshots.forEach(s => {
      if (s.accountDetails) {
        s.accountDetails.forEach(d => {
          detailRows.push([s.id, d.name, d.owner, d.balance, d.currency]);
        });
      }
    });
    const detailData = [detailHeaders, ...detailRows];

    const setHeaders = ['Key', 'Value'];
    const setRows = [
      ['ExchangeRate', settings.exchangeRate],
      ['USDRate', settings.usdRate],
      ['Note', settings.note]
    ];
    const setData = [setHeaders, ...setRows];

    const body = {
      data: [
        { range: 'Transactions!A1', values: txData },
        { range: 'Accounts!A1', values: accData },
        { range: 'Snapshots!A1', values: snapData },
        { range: 'SnapshotDetails!A1', values: detailData },
        { range: 'Settings!A1', values: setData }
      ],
      valueInputOption: 'USER_ENTERED'
    };

    await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: spreadsheetId,
      resource: body
    });
    return true;
  } catch (e) {
    console.error("Upload Error", e);
    throw e;
  }
};

export const loadFromCloud = async (spreadsheetId: string) => {
  try {
    await ensureSheetsExist(spreadsheetId);

    const response = await window.gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId,
      ranges: ['Transactions!A2:I', 'Accounts!A2:H', 'Settings!A2:B', 'Snapshots!A2:E', 'SnapshotDetails!A2:E']
    });

    const valueRanges = response.result.valueRanges;
    
    const txData = valueRanges[0].values || [];
    const transactions: Transaction[] = txData.map((row: any[]) => ({
      id: row[0],
      date: row[1],
      type: row[2] as any,
      amount: parseFloat(row[3]),
      currency: row[4] as any,
      categoryId: row[5],
      accountId: row[6],
      toAccountId: row[7] || undefined,
      note: row[8] || ''
    }));

    const accData = valueRanges[1].values || [];
    const accounts: Account[] = accData.map((row: any[]) => ({
      id: row[0],
      name: row[1],
      owner: row[2] as any,
      type: row[3] as any,
      currency: row[4] as any,
      initialBalance: parseFloat(row[5]),
      iconName: row[6],
      color: row[7] || undefined
    }));

    const detailsData = valueRanges[4] ? (valueRanges[4].values || []) : [];
    const detailsMap: Record<string, HistoricalAccountDetail[]> = {};
    detailsData.forEach((row: any[]) => {
      const snapId = row[0];
      if (!detailsMap[snapId]) detailsMap[snapId] = [];
      detailsMap[snapId].push({
        name: row[1],
        owner: row[2] as any,
        balance: parseFloat(row[3]),
        currency: row[4] as any
      });
    });

    const snapData = valueRanges[3] ? (valueRanges[3].values || []) : [];
    const snapshots: AssetSnapshot[] = snapData.map((row: any[]) => ({
      id: row[0],
      date: row[1],
      totalCNY: parseFloat(row[2]),
      note: row[3] || '',
      isDeleted: row[4] === 'TRUE',
      accountDetails: detailsMap[row[0]] || []
    }));

    const setData = valueRanges[2].values || [];
    const settings = {
      exchangeRate: 4.5,
      usdRate: 1.5,
      note: ''
    };
    
    setData.forEach((row: any[]) => {
      if (row[0] === 'ExchangeRate') settings.exchangeRate = parseFloat(row[1]);
      if (row[0] === 'USDRate') settings.usdRate = parseFloat(row[1]);
      if (row[0] === 'Note') settings.note = row[1] || '';
    });

    return { transactions, accounts, settings, snapshots };

  } catch (e) {
    console.error("Download Error", e);
    throw e;
  }
};
