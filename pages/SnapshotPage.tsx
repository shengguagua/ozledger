import React, { useEffect, useMemo, useRef } from 'react';
import { CalendarDays, Layers3, NotebookPen, PencilLine, Save, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import { AppSettings, AssetSnapshot, HistoricalAccountDetail } from '../types';
import { ActionButton, ChangeList, MetricCard, Card, SectionLabel } from '../components/ui';
import DetailSection from '../components/DetailSection';
import { useSnapshotEditor } from '../hooks/useSnapshotEditor';
import {
  getLogicalAccountKey, isCommonAccountDetail, normalizeLogicalAccountName,
  normalizeDisplayName, parseLooseNumber, hasPositiveRate,
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

const inputCls = 'rounded-xl border border-ink-200 bg-paper-50 px-3 py-2.5 text-sm text-ink-700 outline-none transition focus:border-ink-400';

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
    const next = editor.buildSnapshot();
    await onSaveCreate(next, editor);
  };

  const isEditing = ed.mode === 'edit';
  const isCreating = ed.mode === 'create';
  const rate = selectedSnapshot?.exchangeRate ?? settings.exchangeRate;
  const usdRate = selectedSnapshot?.usdRate ?? settings.usdRate;

  // ⌘/Ctrl+S 保存，Esc 取消（仅在编辑/新增时生效）
  useEffect(() => {
    if (!isEditing && !isCreating) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isSaving) return;
        if (isEditing) handleSaveEdit(); else handleSaveCreate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEditing, isCreating, isSaving, handleSaveEdit, handleSaveCreate, cancel]);

  // 选中期别后，自动把对应卡片滚动到可见区域
  const activeCardRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedSnapshot?.id]);

  // 编辑/新增进行中时，切换期别前先确认，避免误丢未保存的修改
  const selectSnapshot = (id: string) => {
    if (id === selectedSnapshot?.id) return;
    if ((isEditing || isCreating) && !window.confirm('当前有未保存的修改，确定要切换期别并放弃修改吗？')) return;
    cancel();
    onSelectSnapshot(id);
  };

  if (!selectedSnapshot) return <div className="py-20 text-center font-serif text-ink-300">暂无快照数据。</div>;

  return (
    <div className="max-w-[1400px] space-y-5">
      {/* Feedback */}
      {(saveError || saveSuccess) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${saveError ? 'border-loss/30 bg-loss-100 text-loss-600' : 'border-gain/30 bg-gain-100 text-gain-600'}`}>
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
      <Card className="overflow-hidden">
        <div className="border-b border-ink-100 bg-paper/50 px-5 py-3">
          <SectionLabel>历史期别导航</SectionLabel>
        </div>
        <div className="overflow-x-auto px-5 py-4">
          <div className="flex min-w-max gap-3">
            {active.map((s, i) => {
              const isActive = s.id === selectedSnapshot.id;
              const isLatest = i === 0;
              return (
                <button key={s.id} type="button" ref={isActive ? activeCardRef : undefined} onClick={() => selectSnapshot(s.id)}
                  className={`min-w-[160px] rounded-xl border px-4 py-3 text-left transition-all ${
                    isActive ? 'border-ink-800 bg-ink-800 text-paper-50 shadow-ink' : 'border-ink-200 bg-paper-50 text-ink-600 hover:-translate-y-0.5 hover:border-ink-300'
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-serif text-[10px] tracking-[0.18em] opacity-60">快照</div>
                    {isLatest && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isActive ? 'bg-cinnabar text-paper-50' : 'bg-cinnabar-100 text-cinnabar-600'}`}>最新</span>
                    )}
                  </div>
                  <div className="mt-1.5 font-serif font-semibold">{s.date}</div>
                  <div className={`mt-2 font-mono text-xs ${isActive ? 'text-paper-300' : 'text-ink-400'}`}>
                    ¥{s.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Note + actions */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex-1 rounded-xl border border-ink-100 bg-paper/50 p-4">
            {isEditing || isCreating ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input type="text" inputMode="decimal" value={ed.exchangeRate} onChange={(e) => setField('exchangeRate', e.target.value)}
                    placeholder="AUD/CNY" className={`${inputCls} font-mono`} />
                  <input type="text" inputMode="decimal" value={ed.usdRate} onChange={(e) => setField('usdRate', e.target.value)}
                    placeholder="USD/AUD" className={`${inputCls} font-mono`} />
                </div>
                {isCreating && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input type="date" value={ed.date} onChange={(e) => setField('date', e.target.value)}
                      className={inputCls} />
                    <div className="rounded-xl border border-gain/30 bg-gain-100/50 px-3 py-2.5">
                      <div className="font-serif text-[11px] text-ink-400">总资产（按明细自动计算）</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-ink-900">
                        ¥{editor.computedTotal.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                )}
                <textarea value={ed.baseNote} onChange={(e) => setField('baseNote', e.target.value)}
                  placeholder="补充说明（可留空）" rows={2}
                  className="w-full rounded-xl border border-ink-200 bg-paper-50 px-4 py-3 text-sm leading-6 text-ink-600 outline-none transition focus:border-ink-400" />
              </div>
            ) : (
              <div className="text-sm leading-7 text-ink-600">{selectedSnapshot.note || '无备注'}</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:w-auto xl:flex-col xl:items-stretch">
            {isEditing || isCreating ? (
              <>
                <ActionButton label={isSaving ? '保存中…' : '保存'} icon={<Save size={15} />}
                  onClick={isEditing ? handleSaveEdit : handleSaveCreate} disabled={isSaving} variant="primary" />
                <ActionButton label="取消" icon={<X size={15} />} onClick={cancel} variant="ghost" />
                <div className="font-mono text-[11px] text-ink-300 xl:text-center">⌘/Ctrl+S 保存 · Esc 取消</div>
              </>
            ) : (
              <>
                <ActionButton label="新增一期" icon={<CalendarDays size={15} />} onClick={() => startCreate(selectedSnapshot)} variant="primary" />
                <ActionButton label="修改此期" icon={<PencilLine size={15} />} onClick={() => startEdit(selectedSnapshot)} />
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Edit/Create — add common account row */}
      {(isEditing || isCreating) && (
        <Card className="p-4">
          <SectionLabel className="mb-3">通用账户管理</SectionLabel>
          <div className="grid gap-3 md:grid-cols-[120px_120px_1fr_80px]">
            <select value={editor.commonDraftOwner} onChange={(e) => editor.setCommonDraftOwner(e.target.value as HistoricalAccountDetail['owner'])}
              className={inputCls.replace('py-2.5', 'py-2')}>
              <option>小盛</option><option>大王</option><option>家庭</option>
            </select>
            <select value={editor.commonDraftCurrency} onChange={(e) => editor.setCommonDraftCurrency(e.target.value as 'CNY' | 'AUD' | 'USD')}
              className={inputCls.replace('py-2.5', 'py-2')}>
              <option value="CNY">CNY</option><option value="AUD">AUD</option><option value="USD">USD</option>
            </select>
            <input value={editor.commonDraftName} onChange={(e) => editor.setCommonDraftName(e.target.value)}
              placeholder="账户名称" className={inputCls.replace('py-2.5', 'py-2')} />
            <button type="button" onClick={editor.addCommonAccount}
              className="rounded-xl bg-ink-800 px-3 py-2 text-sm font-medium text-paper-50 transition hover:bg-ink-900">新增</button>
          </div>
        </Card>
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
              className="rounded-xl border border-ink-200 bg-paper-50 px-3.5 py-2 text-xs font-medium text-ink-600 transition hover:border-ink-300 hover:bg-paper">
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
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <SectionLabel>对比上期 {previousSnapshot?.date}</SectionLabel>
            <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${overallChange.totalCNY >= 0 ? 'bg-gain-100 text-gain-600 ring-gain/20' : 'bg-loss-100 text-loss-600 ring-loss/20'}`}>
              {overallChange.totalCNY >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              <span className="font-mono">{overallChange.totalCNY >= 0 ? '+' : ''}¥{overallChange.totalCNY.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-3">
            <ChangeList title="新增项目" emptyText="无新增" items={overallChange.added} />
            <ChangeList title="消失项目" emptyText="无消失" items={overallChange.removed} />
            <ChangeList title="余额变化" emptyText="无变化" items={overallChange.changed} />
          </div>
        </Card>
      )}
    </div>
  );
};

export default SnapshotPage;
