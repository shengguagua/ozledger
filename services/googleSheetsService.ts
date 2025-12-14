
import { Transaction, Account } from '../types';

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
    // Prompt the user to select a Google Account and ask for consent to share their data
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // Skip display of account chooser and consent dialog for an existing session
    tokenClient.requestAccessToken({ prompt: '' });
  }
};

const ensureSheetsExist = async (spreadsheetId: string) => {
  try {
    // 1. Get current spreadsheet structure
    const meta = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId
    });
    
    const existingTitles = meta.result.sheets.map((s: any) => s.properties.title);
    const requiredSheets = ['Transactions', 'Accounts', 'Settings'];
    const requests: any[] = [];

    // 2. Check for missing sheets
    requiredSheets.forEach(title => {
      if (!existingTitles.includes(title)) {
        requests.push({
          addSheet: {
            properties: { title }
          }
        });
      }
    });

    // 3. Create missing sheets if necessary
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
  settings: { exchangeRate: number; usdRate: number; note: string }
) => {
  try {
    // Step 0: Ensure tabs exist
    await ensureSheetsExist(spreadsheetId);

    // Step 1: Prepare Data for Transactions Sheet
    const txHeaders = ['ID', 'Date', 'Type', 'Amount', 'Currency', 'Category', 'Account', 'ToAccount', 'Note'];
    const txRows = transactions.map(t => [
      t.id, t.date, t.type, t.amount, t.currency, t.categoryId, t.accountId, t.toAccountId || '', t.note || ''
    ]);
    const txData = [txHeaders, ...txRows];

    // Step 2: Prepare Data for Accounts Sheet
    const accHeaders = ['ID', 'Name', 'Owner', 'Type', 'Currency', 'InitialBalance', 'IconName', 'Color'];
    const accRows = accounts.map(a => [
      a.id, a.name, a.owner, a.type, a.currency, a.initialBalance, a.iconName, a.color || ''
    ]);
    const accData = [accHeaders, ...accRows];

    // Step 3: Prepare Data for Settings Sheet
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
    // Check if sheets exist first to avoid 400 error on download from blank sheet
    await ensureSheetsExist(spreadsheetId);

    const response = await window.gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: spreadsheetId,
      ranges: ['Transactions!A2:I', 'Accounts!A2:H', 'Settings!A2:B']
    });

    const valueRanges = response.result.valueRanges;
    
    // Parse Transactions
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

    // Parse Accounts
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

    // Parse Settings
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

    return { transactions, accounts, settings };

  } catch (e) {
    console.error("Download Error", e);
    throw e;
  }
};
