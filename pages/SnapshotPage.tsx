import React, { useMemo } from 'react';
import { CalendarDays, Layers3, NotebookPen, PencilLine, Save, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import { AppSettings, AssetSnapshot, HistoricalAccountDetail } from '../types';
import { ActionButton, ChangeList, MetricCard } from '../components/ui';
import DetailSection from '../components/DetailSection';
import { useSnapshotEditor } from '../hooks/useSnapshotEditor';
import {
  getLogicalAccountKey, isCommonAccountDetail, normalizeLogicalAccountName,
  normalizeDisplayName, parseLooseNumber, hasPositiveRate, hasMatchingManualTotal,
} from '../utils/snapshot';

interface Props {
  snapshots: AssetSnapshot[];
  settings: AppSettings;
  saveError: string;
  saveSuccess: string;
  isSaving: boolean;
  onSaveEdit: (updated: AssetSnapshot, editor: ReturnType<typeof useSnapshotEditor>) => Promise<void>;
  onSaveCreate: (next: AssetSnapshot, editor: ReturnType<typeof useSnapshotEditor>) => Promise<void>;
  selectedSnapshotId: string;
  onSelectSnapshot: (id: string) => void;
}

const SnapshotPage: React.FC<Props> = ({
  snapshots, settings, saveError, saveSuccess, isSaving,
  onSaveEdit, onSaveCreate, selectedSnapshotId, onSelectSnapshot,
}) => {
  const active = useMemo(
    () => snapshots.filter((s) => !s.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [snapshots],
  );

  const selectedSnapshot = active.find((s) => s.id === selectedSnapshotId) ?? active[0];
  const selectedIndex = active.findIndex((s) => s.id === selectedSnapshot?.id);
  const previousSnapshot = selectedIndex >= 0 ? active[selectedIndex + 1] : undefined;

  const editor = useSnapshotEditor(settings);
  const { editor: ed, setField, cancel, startEdit, startCreate } = editor;

  const commonAccountKeys = useMemo(() => {
    if (!active.length) return new Set<string>();
    const recent = active.slice(0, Math.min(active.length, 6));
    const freq = new Map<string, number>();
    for (const s of recent) {
      const seen = new Set<string>();
      for (const d of s.accountDetails || []) {
        const k = getLogicalAccountKey(d);
        if (!seen.has(k)) { seen.add(k); freq.set(k, (freq.get(k) || 0) + 1); }
      }
    }
    const threshold = Math.min(3, recent.length);
    return new Set(
      [...freq.entries()].filter(([k, count]) => {
        const latestDetail = active[0]?.accountDetails?.find((d) => getLogicalAccountKey(d) === k);
        const forced = latestDetail?.owner === '家庭' && ['BOND', '美股'].includes(normalizeLogicalAccountName(latestDetail.name, latestDetail.currency));
        return count >= threshold || Boolean(forced);
      }).map(([k]) => k),
    );
  }, [active]);

  const sourceSnapshot = ed.mode === 'create' ? selectedSnapshot : selectedSnapshot;

  const commonDetails = useMemo(
    () => (selectedSnapshot?.accountDetails || []).filter((d) => isCommonAccountDetail(d, commonAccountKeys)),
    [selectedSnapshot, commonAccountKeys],
  );

  const baseNote = useMemo(() => {
    if (!selectedSnapshot?.note) return '';
    return selectedSnapshot.note.split('已折叠一次性项目:')[0].replace(/\|\s*$/, '').trim();
  }, [selectedSnapshot]);

  // Details for display in view mode
  const foldedSpecific = useMemo(() => {
    const note = selectedSnapshot?.note;
    if (!note) return [];
    const marker = '已折叠一次性项目:';
    const idx = note.indexOf(marker);
    if (idx === -1) return [];
    return note.slice(idx + marker.length).trim()
      .split(/[；;]+/).map((item, i) => {
        const m = item.trim().match(/^(小盛|大王|家庭)-(.+)\s(-?\d+(?:\.\d+)?)\s(AUD|CNY|USD)$/);
        if (!m) return null;
        const [, owner, name, amount, currency] = m;
        return { accountId: `folded-${owner}-${i}-${name}`, name, owner, type: 'pending' as const, currency, balance: Number(amount) } as HistoricalAccountDetail;
      }).filter((d): d is HistoricalAccountDetail => d !== null);
  }, [selectedSnapshot]);

  const specificDetails = useMemo(() => [
    ...((selectedSnapshot?.accountDetails || []).filter((d) => !isCommonAccountDetail(d, commonAccountKeys))),
    ...foldedSpecific,
  ], [selectedSnapshot, commonAccountKeys, foldedSpecific]);

  // Editor display details (edit or create mode)
  const editorCommonDetails = useMemo(() => ed.accountDetails.filter((d) => isCommonAccountDetail(d, commonAccountKeys))
    .map((d) => ({ ...d, balance: parseLooseNumber(ed.balances[d.accountId], d.balance) })),
    [ed.accountDetails, ed.balances, commonAccountKeys]);

  const editorSpecificDetails = useMemo(() => [
    ...ed.accountDetails.filter((d) => !isCommonAccountDetail(d, commonAccountKeys)).map((d) => ({ ...d, balance: parseLooseNumber(ed.balances[d.accountId], d.balance) })),
    ...ed.specialItems.map((d) => ({ ...d, balance: parseLooseNumber(ed.specialBalances[d.accountId], d.balance) })),
  ], [ed.accountDetails, ed.balances, ed.specialItems, ed.specialBalances, commonAccountKeys]);

  const overallChange = useMemo(() => {
    if (!selectedSnapshot || !previousSnapshot) return null;
    const cur = new Map((selectedSnapshot.accountDetails || []).map((d) => [d.accountId, d]));
    const prev = new Map((previousSnapshot.accountDetails || []).map((d) => [d.accountId, d]));
    const ids = [...new Set([...cur.keys(), ...prev.keys()])];
    const changes = ids.map((id) => {
      const c = cur.get(id), p = prev.get(id);
      const diff = (c?.balance || 0) - (p?.balance || 0);
      return { accountId: id, name: c?.name || p?.name || id, owner: c?.owner || p?.owner || '家庭', currency: c?.currency || p?.currency || 'CNY', currentBalance: c?.balance || 0, previousBalance: p?.balance || 0, diff };
    }).filter((x) => Math.abs(x.diff) > 0.0001);
    return {
      totalCNY: Number((selectedSnapshot.totalCNY - previousSnapshot.totalCNY).toFixed(2)),
      added: changes.filter((x) => Math.abs(x.previousBalance) < 0.0001).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 6),
      removed: changes.filter((x) => Math.abs(x.currentBalance) < 0.0001).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 6),
      changed: changes.filter((x) => Math.abs(x.currentBalance) > 0.0001 && Math.abs(x.previousBalance) > 0.0001).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 8),
    };
  }, [selectedSnapshot, previousSnapshot]);

  const handleSaveEdit = async () => {
    if (!selectedSnapshot) return;
    if (!hasPositiveRate(ed.exchangeRate, settings.exchangeRate) || !hasPositiveRate(ed.usdRate, settings.usdRate)) return;
    const next = editor.buildSnapshot(selectedSnapshot.id);
    await onSaveEdit({ ...selectedSnapshot, ...next }, editor);
  };

  const handleSaveCreate = async () => {
    if (!ed.date) return;
    if (!hasPositiveRate(ed.exchangeRate, settings.exchangeRate) || !hasPositiveRate(ed.usdRate, settings.usdRate)) return;
    if (ed.kind === 'backfill' && !hasMatchingManualTotal(ed.manualTotal, editor.computedTotal)) return;
    const next = editor.buildSnapshot();
    await onSaveCreate(next, editor);
  };

  const isEditing = ed.mode === 'edit';
  const isCreating = ed.mode === 'create';
  const rate = selectedSnapshot?.exchangeRate ?? settings.exchangeRate;
  const usdRate = selectedSnapshot?.usdRate ?? settings.usdRate;

  if (!selectedSnapshot) return <div className="text-slate-400 py-20 text-center">暂无快照数据。</div>;

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Feedback */}
      {(saveError || saveSuccess) && (
        <div className={`rounded-[20px] border px-4 py-3 text-sm ${saveError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {saveError || saveSuccess}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="选中期别" value={selectedSnapshot.date} hint="当前工作上下文" icon={<CalendarDays size={18} />} />
        <MetricCard label="期别总额" value={`¥${selectedSnapshot.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`}
          hint={isEditing ? `编辑中: ¥${editor.computedTotal.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}` : undefined}
          icon={<Sparkles size={18} />} tone={isEditing ? 'success' : 'default'} />
        <MetricCard label="通用账户" value={`${commonDetails.length} 项`} hint="长期重复出现的核心账户" icon={<Layers3 size={18} />} />
        <MetricCard label="当期特有" value={`${specificDetails.length} 项`} hint="一次性项目与折叠明细" icon={<NotebookPen size={18} />} />
      </div>

      {/* Snapshot timeline */}
      <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">历史期别导航</div>
        </div>
        <div className="overflow-x-auto px-5 py-4">
          <div className="flex min-w-max gap-3">
            {active.map((s) => {
              const isActive = s.id === selectedSnapshot.id;
              return (
                <button key={s.id} type="button" onClick={() => { cancel(); onSelectSnapshot(s.id); }}
                  className={`min-w-[160px] rounded-[22px] border px-4 py-3 text-left transition-all ${
                    isActive ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-slate-50/90 text-slate-700 hover:-translate-y-0.5 hover:bg-white'
                  }`}>
                  <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Snapshot</div>
                  <div className="mt-1.5 font-bold">{s.date}</div>
                  <div className={`mt-2 text-xs ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                    ¥{s.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Note + actions */}
      <div className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex-1 rounded-[22px] border border-slate-200 bg-slate-50/60 p-4">
            {isEditing || isCreating ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input type="text" inputMode="decimal" value={ed.exchangeRate} onChange={(e) => setField('exchangeRate', e.target.value)}
                    placeholder="AUD/CNY" className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none" />
                  <input type="text" inputMode="decimal" value={ed.usdRate} onChange={(e) => setField('usdRate', e.target.value)}
                    placeholder="USD/AUD" className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none" />
                </div>
                {isCreating && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input type="date" value={ed.date} onChange={(e) => setField('date', e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none" />
                    {ed.kind === 'backfill' ? (
                      <input type="text" inputMode="decimal" value={ed.manualTotal} onChange={(e) => setField('manualTotal', e.target.value)}
                        placeholder="手填总资产（补录校验用）" className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-700 outline-none" />
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">自动计算</div>
                        <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                          ¥{editor.computedTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {isCreating && ed.kind === 'backfill' && ed.manualTotal && (
                  <div className={`rounded-xl border px-3 py-2 text-sm ${hasMatchingManualTotal(ed.manualTotal, editor.computedTotal) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    明细自动计算：¥{editor.computedTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                    {!hasMatchingManualTotal(ed.manualTotal, editor.computedTotal) && '，请对齐后再保存。'}
                  </div>
                )}
                <textarea value={ed.baseNote} onChange={(e) => setField('baseNote', e.target.value)}
                  placeholder="补充说明（可留空）" rows={2}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600 outline-none" />
              </div>
            ) : (
              <div className="text-sm leading-7 text-slate-600">{selectedSnapshot.note || '无备注'}</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:w-auto xl:flex-col xl:items-stretch">
            {isEditing || isCreating ? (
              <>
                <ActionButton label={isSaving ? '保存中…' : '保存'} icon={<Save size={15} />}
                  onClick={isEditing ? handleSaveEdit : handleSaveCreate} disabled={isSaving} variant="primary" />
                <ActionButton label="取消" icon={<X size={15} />} onClick={cancel} variant="ghost" />
              </>
            ) : (
              <>
                <ActionButton label="新增新一期" icon={<CalendarDays size={15} />} onClick={() => startCreate('new', selectedSnapshot)} variant="primary" />
                <ActionButton label="手动补录" icon={<NotebookPen size={15} />} onClick={() => startCreate('backfill', selectedSnapshot)} />
                <ActionButton label="修改此期" icon={<PencilLine size={15} />} onClick={() => startEdit(selectedSnapshot)} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit/Create — add common account row */}
      {(isEditing || isCreating) && (
        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.3)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-3">通用账户管理</div>
          <div className="grid gap-3 md:grid-cols-[120px_120px_1fr_80px]">
            <select value={editor.commonDraftOwner} onChange={(e) => editor.setCommonDraftOwner(e.target.value as HistoricalAccountDetail['owner'])}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
              <option>小盛</option><option>大王</option><option>家庭</option>
            </select>
            <select value={editor.commonDraftCurrency} onChange={(e) => editor.setCommonDraftCurrency(e.target.value as 'CNY' | 'AUD' | 'USD')}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
              <option value="CNY">CNY</option><option value="AUD">AUD</option><option value="USD">USD</option>
            </select>
            <input value={editor.commonDraftName} onChange={(e) => editor.setCommonDraftName(e.target.value)}
              placeholder="账户名称" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none" />
            <button type="button" onClick={editor.addCommonAccount}
              className="rounded-2xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800">新增</button>
          </div>
        </div>
      )}

      {/* Detail sections */}
      {(isEditing || isCreating) ? (
        <div className="space-y-5">
          <DetailSection title="通用账户" description="直接在这里改余额。" details={editorCommonDetails} emptyText="没有通用账户"
            editable onBalanceChange={editor.handleBalanceChange} onNameChange={editor.handleNameChange}
            onDeleteDetail={editor.handleDeleteDetail} onMoveDetail={editor.handleMoveDetail}
            balanceInputMap={ed.balances} specialBalanceInputMap={ed.specialBalances}
            exchangeRate={editor.effectiveRate} usdRate={editor.effectiveUsdRate} />
          <DetailSection title="当期特有" description="一次性项目与折叠明细。" details={editorSpecificDetails} emptyText="无特有项目"
            flatten editable onBalanceChange={editor.handleBalanceChange} onNameChange={editor.handleNameChange}
            onCurrencyChange={editor.handleCurrencyChange} onDeleteDetail={editor.handleDeleteDetail} onMoveDetail={editor.handleMoveDetail}
            balanceInputMap={ed.balances} specialBalanceInputMap={ed.specialBalances}
            exchangeRate={editor.effectiveRate} usdRate={editor.effectiveUsdRate} />
          <div className="flex justify-end">
            <button type="button" onClick={editor.addSpecialItem}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
              新增一次性项目
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <DetailSection title="通用账户" description="长期重复出现的核心账户。" details={commonDetails} emptyText="没有通用账户"
            exchangeRate={rate} usdRate={usdRate} />
          <DetailSection title="当期特有" description="一次性项目与折叠明细。" details={specificDetails} emptyText="无特有项目"
            flatten exchangeRate={rate} usdRate={usdRate} />
        </div>
      )}

      {/* Change diff */}
      {overallChange && !isEditing && !isCreating && (
        <div className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">对比上期 {previousSnapshot?.date}</div>
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${overallChange.totalCNY >= 0 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'}`}>
              {overallChange.totalCNY >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {overallChange.totalCNY >= 0 ? '+' : ''}¥{overallChange.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-3">
            <ChangeList title="新增项目" emptyText="无新增" items={overallChange.added} />
            <ChangeList title="消失项目" emptyText="无消失" items={overallChange.removed} />
            <ChangeList title="余额变化" emptyText="无变化" items={overallChange.changed} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapshotPage;
