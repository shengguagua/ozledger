import React, { useEffect, useMemo, useState } from 'react';
import { Account, AssetSnapshot, HistoricalAccountDetail } from '../types';
import { Archive, ArrowUpRight, Camera, History, PencilLine, RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  accounts: Account[];
  exchangeRate: number;
  usdRate: number;
  currentTotalCNY: number;
  getCurrentDetails: () => HistoricalAccountDetail[];
  snapshots: AssetSnapshot[];
  onSnapshotsChange: (snapshots: AssetSnapshot[]) => void;
  onOpenSnapshot: (snapshotId: string) => void;
}

const ownerOrder = ['小盛', '大王', '家庭'] as const;

const AssetHistoryPanel: React.FC<Props> = ({ accounts, exchangeRate, usdRate, currentTotalCNY, getCurrentDetails, snapshots, onSnapshotsChange, onOpenSnapshot }) => {
  const today = new Date().toISOString().split('T')[0];
  const [snapshotDate, setSnapshotDate] = useState(today);
  const [note, setNote] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [entryMode, setEntryMode] = useState<'current' | 'manual'>('current');
  const [manualBalances, setManualBalances] = useState<Record<string, string>>({});
  const [manualSourceSnapshotId, setManualSourceSnapshotId] = useState<string>('current');

  const activeSnapshots = useMemo(
    () => snapshots.filter((snapshot) => !snapshot.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [snapshots]
  );

  const visibleSnapshots = useMemo(
    () => snapshots.filter((snapshot) => showTrash ? snapshot.isDeleted : !snapshot.isDeleted)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [snapshots, showTrash]
  );

  useEffect(() => {
    if (entryMode !== 'manual') return;
    if (Object.keys(manualBalances).length > 0) return;
    setManualBalances(Object.fromEntries(accounts.map((account) => [account.id, account.initialBalance === 0 ? '' : String(account.initialBalance)])));
  }, [accounts, entryMode, manualBalances]);

  const convertToCNY = (amount: number, currency: string) => {
    if (currency === 'CNY') return amount;
    if (currency === 'AUD') return amount * exchangeRate;
    if (currency === 'USD') return amount / usdRate * exchangeRate;
    return amount;
  };

  const manualDetails = useMemo(() => {
    return accounts.map((account) => ({
      accountId: account.id,
      name: account.name,
      owner: account.owner,
      type: account.type,
      currency: account.currency,
      balance: Number(manualBalances[account.id] || 0),
    }));
  }, [accounts, manualBalances]);

  const manualTotalCNY = useMemo(() => {
    return manualDetails.reduce((sum, detail) => {
      const cny = convertToCNY(detail.balance, detail.currency);
      return sum + (detail.type === 'credit' || detail.type === 'huabei' ? -cny : cny);
    }, 0);
  }, [manualDetails, exchangeRate, usdRate]);

  const groupedManualDetails = useMemo(() => {
    return manualDetails.reduce((acc, detail) => {
      if (!acc[detail.owner]) acc[detail.owner] = [];
      acc[detail.owner].push(detail);
      return acc;
    }, {} as Record<string, HistoricalAccountDetail[]>);
  }, [manualDetails]);

  const fillManualFromCurrent = () => {
    setManualBalances(Object.fromEntries(accounts.map((account) => [account.id, account.initialBalance === 0 ? '' : String(account.initialBalance)])));
    setManualSourceSnapshotId('current');
  };

  const fillManualFromSnapshot = (snapshotId: string) => {
    const snapshot = activeSnapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return;
    const detailMap = new Map((snapshot.accountDetails || []).map((detail) => [detail.accountId, detail.balance]));
    setManualBalances(
      Object.fromEntries(accounts.map((account) => {
        const balance = detailMap.get(account.id);
        return [account.id, balance === undefined || balance === 0 ? '' : String(balance)];
      }))
    );
    setManualSourceSnapshotId(snapshotId);
  };

  const clearManualBalances = () => {
    setManualBalances(Object.fromEntries(accounts.map((account) => [account.id, ''])));
    setManualSourceSnapshotId('current');
  };

  const getCurrencySymbol = (currency: string) => {
    if (currency === 'AUD') return '$';
    if (currency === 'USD') return 'U$';
    return '¥';
  };

  const saveSnapshot = () => {
    if (!snapshotDate) {
      alert('请选择日期');
      return;
    }

    const existing = snapshots.find((snapshot) => snapshot.date === snapshotDate && !snapshot.isDeleted);
    if (existing && !window.confirm(`已存在 ${snapshotDate} 的快照，是否覆盖？`)) {
      return;
    }

    const newSnapshot: AssetSnapshot = {
      id: existing?.id || crypto.randomUUID(),
      date: snapshotDate,
      totalCNY: Number((entryMode === 'manual' ? manualTotalCNY : currentTotalCNY).toFixed(2)),
      note: `${note.trim()}${entryMode === 'manual' ? `${note.trim() ? ' | ' : ''}手工补录` : ''}`,
      isDeleted: false,
      accountDetails: entryMode === 'manual' ? manualDetails : getCurrentDetails(),
    };

    const updated = [newSnapshot, ...snapshots.filter((snapshot) => snapshot.id !== existing?.id)]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    onSnapshotsChange(updated);
    setNote('');
  };

  const toggleTrashState = (id: string, isDeleted: boolean) => {
    onSnapshotsChange(snapshots.map((snapshot) => snapshot.id === id ? { ...snapshot, isDeleted } : snapshot));
  };

  return (
    <div className="rounded-[28px] border border-[#e6decd] bg-brand-paper p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-100">
            <History size={12} />
            Snapshot Archive
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-brand-navy">录入一个新的期别</h2>
          <p className="mt-2 max-w-lg text-sm leading-7 text-slate-500">
            更新当前余额或手工补录历史余额，保存成一个时间点。历史只保留期别，不强调交易明细。
          </p>
        </div>

        <button
          onClick={() => setShowTrash((value) => !value)}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${showTrash ? 'bg-rose-100 text-rose-700' : 'bg-[#f0ebde] text-slate-600 hover:bg-[#ebe3d3]'}`}
        >
          <Archive size={15} />
          {showTrash ? '返回快照列表' : '回收站'}
        </button>
      </div>

      {!showTrash && (
        <div className="mt-6 rounded-[28px] border border-[#e8dfcf] bg-white p-5">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEntryMode('current')}
                  className={`rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${entryMode === 'current' ? 'bg-brand-navy text-white' : 'bg-[#f4efe4] text-slate-600'}`}
                >
                  保存当前期
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('manual')}
                  className={`rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${entryMode === 'manual' ? 'bg-brand-gold text-slate-900' : 'bg-[#f4efe4] text-slate-600'}`}
                >
                  手工补录
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr]">
                <input
                  type="date"
                  value={snapshotDate}
                  onChange={(e) => setSnapshotDate(e.target.value)}
                  className="rounded-2xl border border-[#e5dbc8] bg-[#fcfaf4] px-4 py-3 text-sm text-slate-700 outline-none focus:border-brand-primary"
                />
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={entryMode === 'manual' ? '例如：按 2026-03-05 截图补录' : '例如：发工资后 / 月中盘点 / 旅行后'}
                  className="rounded-2xl border border-[#e5dbc8] bg-[#fcfaf4] px-4 py-3 text-sm text-slate-700 outline-none focus:border-brand-primary"
                />
              </div>

              {entryMode === 'manual' && (
                <div className="mt-5 rounded-[24px] border border-[#ece2d0] bg-[#fcfaf4] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">先选一个接近的期别，再微调不同账户。</div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={fillManualFromCurrent} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 border border-[#e7dcc7]">
                        带入当前
                      </button>
                      <div className="flex items-center gap-2 rounded-xl border border-[#e7dcc7] bg-white px-2 py-1.5">
                        <select
                          value={manualSourceSnapshotId}
                          onChange={(e) => setManualSourceSnapshotId(e.target.value)}
                          className="bg-transparent text-xs font-bold text-slate-600 outline-none"
                        >
                          <option value="current">选择历史期别</option>
                          {activeSnapshots.map((snapshot) => (
                            <option key={snapshot.id} value={snapshot.id}>{snapshot.date}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => manualSourceSnapshotId !== 'current' && fillManualFromSnapshot(manualSourceSnapshotId)}
                          className="rounded-lg bg-[#f6efe1] px-2.5 py-1.5 text-xs font-bold text-slate-600"
                        >
                          带入
                        </button>
                      </div>
                      <button type="button" onClick={clearManualBalances} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 border border-[#e7dcc7]">
                        清空
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    {ownerOrder.map((owner) => (
                      <div key={owner} className="rounded-[20px] border border-[#e9e1d1] bg-white p-3">
                        <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{owner}</div>
                        <div className="space-y-2">
                          {(groupedManualDetails[owner] || []).map((detail) => (
                            <label key={detail.accountId} className="flex items-center justify-between gap-3 rounded-2xl border border-[#efe6d8] bg-[#fcfaf4] px-3 py-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-700">{detail.name}</div>
                                <div className="mt-1 text-[11px] text-slate-400">{detail.currency}</div>
                              </div>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={manualBalances[detail.accountId] ?? ''}
                                onChange={(e) => setManualBalances((prev) => ({ ...prev, [detail.accountId]: e.target.value }))}
                                className="w-28 rounded-xl border border-[#e5dbc8] bg-white px-3 py-2 text-right font-mono text-sm text-slate-700 outline-none focus:border-brand-gold"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-[#ece2d0] bg-[#163126] p-5 text-white">
              <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/60">
                {entryMode === 'manual' ? '补录后总资产' : '当前期总资产'}
              </div>
              <div className="mt-3 font-display text-4xl font-bold">
                ¥{(entryMode === 'manual' ? manualTotalCNY : currentTotalCNY).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
              </div>
              <p className="mt-3 text-sm leading-7 text-emerald-50/72">
                {entryMode === 'manual'
                  ? '适合补图片页或旧表格。你只需要补每个账户在那个时间点的余额。'
                  : '当前期代表你正在维护的最新余额状态，保存后就进入时间轴。'}
              </p>
              <button
                onClick={saveSnapshot}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#f6edd8] px-4 py-3 text-sm font-bold text-brand-navy transition-colors hover:bg-[#fff5df]"
              >
                {entryMode === 'manual' ? <PencilLine size={16} /> : <Camera size={16} />}
                {entryMode === 'manual' ? '保存补录期别' : '保存当前期别'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-brand-navy">{showTrash ? '回收站中的期别' : '历史期别列表'}</h3>
            <p className="mt-1 text-sm text-slate-500">{showTrash ? '可以恢复被移入回收站的期别。' : '这里是紧凑历史列表。点开后进入单独详情页。'}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-[#e7ddcd] bg-white shadow-soft">
          {!showTrash && (
            <div className="grid grid-cols-[108px_minmax(0,1fr)_132px_128px_64px] gap-3 border-b border-[#eee3cf] bg-[#f7f1e4] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <div>日期</div>
              <div>备注</div>
              <div className="text-right">总资产</div>
              <div className="text-right">较上一期</div>
              <div className="text-right">详情</div>
            </div>
          )}

          <div className={`${showTrash ? 'space-y-2 p-3' : 'max-h-[420px] overflow-y-auto'}`}>
          {visibleSnapshots.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              暂无期别记录
            </div>
          )}

          {visibleSnapshots.map((snapshot, index) => {
            const nextSnapshot = visibleSnapshots[index + 1];
            const delta = !showTrash && nextSnapshot ? snapshot.totalCNY - nextSnapshot.totalCNY : 0;
            const isPositive = delta >= 0;
            return (
              <div
                key={snapshot.id}
                className={`${showTrash ? 'rounded-[22px] border border-[#e7ddcd] bg-[#fcfaf4] px-4 py-3' : 'grid grid-cols-[108px_minmax(0,1fr)_132px_128px_64px] items-center gap-3 border-b border-[#f1e8d8] px-4 py-3 transition-colors hover:bg-[#fcfaf4]'}`}
              >
                {showTrash ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-bold text-brand-navy">{snapshot.date}</div>
                      <div className="mt-1 text-xs text-slate-400">{snapshot.note || '无备注'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTrashState(snapshot.id, !showTrash)}
                      className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => onOpenSnapshot(snapshot.id)} className="text-left">
                      <div className="font-mono text-sm font-bold text-brand-navy">{snapshot.date}</div>
                    </button>
                    <button type="button" onClick={() => onOpenSnapshot(snapshot.id)} className="min-w-0 text-left">
                      <div className="truncate text-sm text-slate-600">{snapshot.note || '无备注'}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{(snapshot.accountDetails || []).length} 个余额项</div>
                    </button>
                    <button type="button" onClick={() => onOpenSnapshot(snapshot.id)} className="text-right">
                      <div className="font-mono text-sm font-bold text-slate-800">
                        ¥{snapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                      </div>
                    </button>
                    <button type="button" onClick={() => onOpenSnapshot(snapshot.id)} className="text-right">
                      <div className={`text-sm font-bold ${nextSnapshot ? (isPositive ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-300'}`}>
                        {nextSnapshot ? `${isPositive ? '+' : ''}¥${delta.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}` : '首期'}
                      </div>
                    </button>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSnapshot(snapshot.id)}
                        className="rounded-2xl border border-[#dfd2bd] bg-[#f8f2e5] p-2.5 text-brand-navy hover:bg-[#f2e9d7]"
                        aria-label={`查看 ${snapshot.date} 详情`}
                      >
                        <ArrowUpRight size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTrashState(snapshot.id, !showTrash)}
                        className="rounded-2xl bg-rose-50 p-2.5 text-rose-600"
                        aria-label={`删除 ${snapshot.date}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetHistoryPanel;
