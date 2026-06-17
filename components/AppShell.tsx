import React from 'react';
import { BarChart3, CalendarDays, Database, LayoutDashboard, ShieldCheck } from 'lucide-react';

export type Page = 'dashboard' | 'snapshots' | 'trends' | 'backup';

const NAV: { page: Page; icon: React.ReactNode; label: string }[] = [
  { page: 'dashboard', icon: <LayoutDashboard size={18} />, label: '总览' },
  { page: 'snapshots', icon: <CalendarDays size={18} />, label: '快照' },
  { page: 'trends', icon: <BarChart3 size={18} />, label: '趋势' },
  { page: 'backup', icon: <ShieldCheck size={18} />, label: '备份' },
];

interface Props {
  page: Page;
  onNav: (p: Page) => void;
  dbLabel: string;
  lastSaved: string;
  children: React.ReactNode;
}

const AppShell: React.FC<Props> = ({ page, onNav, dbLabel, lastSaved, children }) => (
  <div className="flex min-h-screen bg-slate-50/80">
    {/* Sidebar */}
    <nav className="fixed left-0 top-0 flex h-full w-16 flex-col items-center gap-1 bg-slate-900 py-5 z-10">
      <div className="mb-4 text-[10px] font-black tracking-[0.2em] text-emerald-400">OZ</div>
      {NAV.map(({ page: p, icon, label }) => (
        <button
          key={p}
          type="button"
          onClick={() => onNav(p)}
          title={label}
          className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
            page === p ? 'bg-white/15 text-white shadow-inner' : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
          }`}
        >
          {icon}
        </button>
      ))}
      <div className="mt-auto">
        <div title="数据库" className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500">
          <Database size={16} />
        </div>
      </div>
    </nav>

    {/* Main */}
    <div className="ml-16 flex flex-1 flex-col min-w-0">
      {/* Topbar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="font-bold text-slate-900">
          {NAV.find((n) => n.page === page)?.label}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{dbLabel}</span>
          {lastSaved && <span>写入 {lastSaved}</span>}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-6 py-6 lg:px-8">
        {children}
      </main>
    </div>
  </div>
);

export default AppShell;
