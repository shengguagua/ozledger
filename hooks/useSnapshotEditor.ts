import { useState, useMemo } from 'react';
import { AssetSnapshot, AppSettings, HistoricalAccountDetail } from '../types';
import {
  parseFoldedItemsFromNote, parseLooseNumber, buildSnapshotNote,
  calculateSnapshotTotalCNY, insertCommonDetailAtPreferredPosition, moveDetailInList,
} from '../utils/snapshot';

export type EditorMode = 'edit' | 'create' | null;

interface EditorState {
  mode: EditorMode;
  kind: 'new' | 'backfill';
  date: string;
  manualTotal: string;
  baseNote: string;
  accountDetails: HistoricalAccountDetail[];
  balances: Record<string, string>;
  specialItems: HistoricalAccountDetail[];
  specialBalances: Record<string, string>;
  exchangeRate: string;
  usdRate: string;
}

const BLANK: EditorState = {
  mode: null, kind: 'new', date: '', manualTotal: '', baseNote: '',
  accountDetails: [], balances: {}, specialItems: [], specialBalances: {},
  exchangeRate: '', usdRate: '',
};

export const useSnapshotEditor = (settings: AppSettings) => {
  const [editor, setEditor] = useState<EditorState>(BLANK);
  const [commonDraftOwner, setCommonDraftOwner] = useState<HistoricalAccountDetail['owner']>('小盛');
  const [commonDraftCurrency, setCommonDraftCurrency] = useState<'CNY' | 'AUD' | 'USD'>('CNY');
  const [commonDraftName, setCommonDraftName] = useState('');

  const effectiveRate = parseLooseNumber(editor.exchangeRate, settings.exchangeRate);
  const effectiveUsdRate = parseLooseNumber(editor.usdRate, settings.usdRate);

  const computedTotal = useMemo(() => {
    const accts = editor.accountDetails.map((d) => ({ ...d, balance: parseLooseNumber(editor.balances[d.accountId], d.balance) }));
    const special = editor.specialItems.map((d) => ({ ...d, balance: parseLooseNumber(editor.specialBalances[d.accountId], d.balance) }));
    return calculateSnapshotTotalCNY(accts, special, effectiveRate, effectiveUsdRate);
  }, [editor, effectiveRate, effectiveUsdRate]);

  const startEdit = (snapshot: AssetSnapshot) => {
    const folded = parseFoldedItemsFromNote(snapshot.note);
    const base = snapshot.note ? snapshot.note.split('已折叠一次性项目:')[0].replace(/\|\s*$/, '').trim() : '';
    setEditor({
      mode: 'edit', kind: 'new', date: snapshot.date, manualTotal: String(snapshot.totalCNY), baseNote: base,
      accountDetails: (snapshot.accountDetails || []).map((d) => ({ ...d })),
      balances: Object.fromEntries((snapshot.accountDetails || []).map((d) => [d.accountId, String(d.balance)])),
      specialItems: folded.map((d) => ({ ...d })),
      specialBalances: Object.fromEntries(folded.map((d) => [d.accountId, String(d.balance)])),
      exchangeRate: String(snapshot.exchangeRate ?? settings.exchangeRate),
      usdRate: String(snapshot.usdRate ?? settings.usdRate),
    });
  };

  const startCreate = (snapshot: AssetSnapshot) => {
    const folded = parseFoldedItemsFromNote(snapshot.note).map((d, i) => ({ ...d, accountId: `${d.accountId}-${Date.now()}-${i}` }));
    setEditor({
      mode: 'create', kind: 'new', date: new Date().toISOString().split('T')[0],
      manualTotal: String(snapshot.totalCNY), baseNote: '',
      accountDetails: (snapshot.accountDetails || []).map((d) => ({ ...d })),
      balances: Object.fromEntries((snapshot.accountDetails || []).map((d) => [d.accountId, String(d.balance)])),
      specialItems: folded,
      specialBalances: Object.fromEntries(folded.map((d) => [d.accountId, String(d.balance)])),
      exchangeRate: String(snapshot.exchangeRate ?? settings.exchangeRate),
      usdRate: String(snapshot.usdRate ?? settings.usdRate),
    });
  };

  const cancel = () => setEditor(BLANK);

  const setField = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    setEditor((prev) => ({ ...prev, [key]: value }));

  const handleBalanceChange = (detail: HistoricalAccountDetail, value: string) => {
    if (detail.accountId.startsWith('folded-')) {
      setEditor((p) => ({ ...p, specialBalances: { ...p.specialBalances, [detail.accountId]: value } }));
    } else {
      setEditor((p) => ({ ...p, balances: { ...p.balances, [detail.accountId]: value } }));
    }
  };

  const handleNameChange = (detail: HistoricalAccountDetail, value: string) => {
    if (detail.accountId.startsWith('folded-')) {
      setEditor((p) => ({ ...p, specialItems: p.specialItems.map((i) => i.accountId === detail.accountId ? { ...i, name: value } : i) }));
    } else {
      setEditor((p) => ({ ...p, accountDetails: p.accountDetails.map((i) => i.accountId === detail.accountId ? { ...i, name: value } : i) }));
    }
  };

  const handleCurrencyChange = (detail: HistoricalAccountDetail, value: string) => {
    setEditor((p) => ({ ...p, specialItems: p.specialItems.map((i) => i.accountId === detail.accountId ? { ...i, currency: value as HistoricalAccountDetail['currency'] } : i) }));
  };

  const handleMoveDetail = (detail: HistoricalAccountDetail, dir: 'up' | 'down') => {
    if (detail.accountId.startsWith('folded-')) {
      setEditor((p) => ({ ...p, specialItems: moveDetailInList(p.specialItems, detail.accountId, dir) }));
    } else {
      setEditor((p) => ({ ...p, accountDetails: moveDetailInList(p.accountDetails, detail.accountId, dir) }));
    }
  };

  const handleDeleteDetail = (detail: HistoricalAccountDetail) => {
    if (detail.accountId.startsWith('folded-')) {
      setEditor((p) => {
        const next = { ...p.specialBalances };
        delete next[detail.accountId];
        return { ...p, specialItems: p.specialItems.filter((i) => i.accountId !== detail.accountId), specialBalances: next };
      });
    } else {
      setEditor((p) => {
        const next = { ...p.balances };
        delete next[detail.accountId];
        return { ...p, accountDetails: p.accountDetails.filter((i) => i.accountId !== detail.accountId), balances: next };
      });
    }
  };

  const addCommonAccount = () => {
    if (!commonDraftName.trim()) return;
    const nextDetail: HistoricalAccountDetail = {
      accountId: `custom-${commonDraftOwner}-${commonDraftCurrency}-${Date.now()}`,
      name: commonDraftName.trim(), owner: commonDraftOwner, type: 'bank', currency: commonDraftCurrency, balance: 0,
    };
    setEditor((p) => ({
      ...p,
      accountDetails: insertCommonDetailAtPreferredPosition(p.accountDetails, nextDetail),
      balances: { ...p.balances, [nextDetail.accountId]: '0' },
    }));
    setCommonDraftName('');
  };

  const addSpecialItem = () => {
    const accountId = `folded-家庭-${Date.now()}`;
    setEditor((p) => ({
      ...p,
      specialItems: [...p.specialItems, { accountId, name: '', owner: '家庭', type: 'pending' as const, currency: 'CNY', balance: 0 }],
      specialBalances: { ...p.specialBalances, [accountId]: '0' },
    }));
  };

  const buildSnapshot = (baseId?: string): Omit<AssetSnapshot, 'id'> & { id: string } => {
    const accts = editor.accountDetails.map((d) => ({ ...d, balance: parseLooseNumber(editor.balances[d.accountId], d.balance) }));
    const special = editor.specialItems.map((d) => ({ ...d, balance: parseLooseNumber(editor.specialBalances[d.accountId], d.balance) }));
    return {
      id: baseId ?? crypto.randomUUID(),
      date: editor.date,
      totalCNY: computedTotal,
      exchangeRate: effectiveRate,
      usdRate: effectiveUsdRate,
      note: buildSnapshotNote(editor.baseNote, special.filter((i) => i.name.trim())),
      isDeleted: false,
      accountDetails: accts,
    };
  };

  return {
    editor, setField, cancel, startEdit, startCreate,
    computedTotal, effectiveRate, effectiveUsdRate,
    handleBalanceChange, handleNameChange, handleCurrencyChange, handleMoveDetail, handleDeleteDetail,
    addCommonAccount, addSpecialItem, buildSnapshot,
    commonDraftOwner, setCommonDraftOwner,
    commonDraftCurrency, setCommonDraftCurrency,
    commonDraftName, setCommonDraftName,
  };
};
