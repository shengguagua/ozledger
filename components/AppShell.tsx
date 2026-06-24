import React from 'react';
import { BarChart3, CalendarDays, Database, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { Seal } from './ui';

export type Page = 'dashboard' | 'snapshots' | 'trends' | 'backup';

const NAV: { page: Page; icon: React.ReactNode; label: string }[] = [
  { page: 'dashboard', icon: <LayoutDashboard size={19} />, label: '总览' },
  { page: 'snapshots', icon: <CalendarDays size={19} />, label: '快照' },
  { page: 'trends', icon: <BarChart3 size={19} />, label: '趋势' },
  { page: 'backup', icon: <ShieldCheck size={19} />, label: '备份' },
];

interface Props {
  page: Page;
  onNav: (p: Page) => void;
  dbLabel: string;
  lastSaved: string;
  children: React.ReactNode;
}

const AppShell: React.FC<Props> = ({ page, onNav, dbLabel, lastSaved, children }) => (
  <div className="flex min-h-screen">
    {/* 墨色侧栏 */}
    <nav className="fixed left-0 top-0 z-20 flex h-full w-[76px] flex-col items-center gap-1.5 bg-gradient-to-b from-ink-900 to-ink-800 py-5 shadow-[6px_0_28px_-20px_rgba(27,26,22,0.85)]">
      <div className="mb-4 flex flex-col items-center gap-2">
        <Seal char="账" size={44} />
        <span className="font-serif text-[10px] tracking-[0.32em] text-paper-300/60">墨記</span>
      </div>
      {NAV.map(({ page: p, icon, label }) => {
        const isActive = page === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onNav(p)}
            title={label}
            className={`flex w-14 flex-col items-center justify-center gap-1 rounded-xl py-2.5 transition-all ${
              isActive
                ? 'bg-paper-50 text-ink-900 shadow-ink-sm'
                : 'text-paper-300/75 hover:bg-white/[0.06] hover:text-paper-100'
            }`}
          >
            {icon}
            <span className="font-serif text-[11px] tracking-wide">{label}</span>
          </button>
        );
      })}
      <div className="mt-auto flex h-10 w-10 items-center justify-center rounded-xl text-paper-300/45" title="数据库">
        <Database size={17} />
      </div>
    </nav>

    {/* 主区 */}
    <div className="ml-[76px] flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-ink-200/50 bg-paper/85 px-6 py-3.5 backdrop-blur-md lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-serif text-xl font-semibold tracking-wide text-ink-900">
            {NAV.find((n) => n.page === page)?.label}
          </h1>
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200/60 bg-paper-50 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gain" />
              {dbLabel}
            </span>
            {lastSaved && (
              <span className="hidden rounded-full border border-ink-200/60 bg-paper-50 px-2.5 py-1 font-mono sm:inline">
                写入 {lastSaved}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 py-6 lg:px-8">{children}</main>
    </div>
  </div>
);

export default AppShell;
