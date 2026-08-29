import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Info,
  Monitor,
  MoreHorizontal,
  RefreshCw,
  Users,
} from 'lucide-react';

const TERMINALS = [
  { id: 'T-01', staff: 'Sarah J.', queue: 'B-198', status: 'Online' },
  { id: 'T-02', staff: 'Michael C.', queue: 'B-200', status: 'Online', selected: true },
  { id: 'T-03', staff: 'Emily D.', queue: 'B-199', status: 'Online' },
  { id: 'T-04', staff: 'Offline', queue: '--', status: 'Offline' },
  { id: 'T-05', staff: 'Robert W.', queue: 'B-195', status: 'Online' },
  { id: 'T-06', staff: 'Lisa M.', queue: 'B-197', status: 'Online' },
];

const ALERTS = [
  { type: 'critical', title: 'Terminal 04 is offline', detail: 'Connection lost 15m ago.' },
  { type: 'warning', title: 'Long wait time detected', detail: 'Avg wait exceeded 20m in Billing.' },
  { type: 'info', title: 'Shift change in 30m', detail: '2 staff members ending shift.' },
];

const DISTRIBUTION = [
  { label: 'Serving', value: 25, color: '#172333' },
  { label: 'Waiting', value: 45, color: '#68717a' },
  { label: 'Completed', value: 40, color: '#0765a8' },
];

function DonutChart() {
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90" aria-label="Queue status distribution">
      {DISTRIBUTION.map((slice) => {
        const length = (slice.value / 110) * circumference;
        const circle = (
          <circle
            key={slice.label}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="13"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
          />
        );
        offset += length;
        return circle;
      })}
    </svg>
  );
}

function StatCard({ label, value, caption, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon size={16} className="text-slate-500" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{caption}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [range, setRange] = useState('Today');
  const [refreshing, setRefreshing] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 500);
  }

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Overview</h1>
          <p className="mt-0.5 text-xs text-slate-500">Today &middot; {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <CalendarDays size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" />
            <select value={range} onChange={(event) => setRange(event.target.value)} className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs text-slate-600 outline-none focus:border-blue-500">
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-3 text-slate-400" />
          </label>
          <input type="date" className="h-9 rounded-md border border-slate-200 px-2 text-xs text-slate-600 outline-none focus:border-blue-500" aria-label="Date range" />
          <button type="button" onClick={handleRefresh} className="flex h-9 items-center gap-2 rounded-md bg-[#075b9f] px-4 text-xs font-semibold text-white hover:bg-[#064b83]">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Apply Filter
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <StatCard label="Total Waiting" value="145" caption="Across all department" icon={Users} />
        <StatCard label="Average Wait" value="18m" caption="Average wait time" icon={Clock3} />
        <StatCard label="Completed" value="255" caption="Completed queuing" icon={CheckCircle2} />
        <StatCard label="Skipped" value="255" caption="Skipped queuing" icon={RefreshCw} />
        <StatCard label="Staff" value="6/8" caption="Staff on duty" icon={Users} />
        <StatCard label="Terminal" value="3/4" caption="Active terminals" icon={Monitor} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Terminal Status</h2>
            <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-slate-500">6/8 Online</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TERMINALS.map((terminal) => (
              <div key={terminal.id} className={`rounded-md border px-2.5 py-2 ${terminal.selected ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-700">{terminal.id}</p>
                  <span className={`h-1.5 w-1.5 rounded-full ${terminal.status === 'Online' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{terminal.staff}</p>
                <p className={`mt-1 text-[10px] font-semibold ${terminal.status === 'Online' ? 'text-blue-700' : 'text-slate-400'}`}>{terminal.queue}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-700">Queue Status Distribution</h2>
          <div className="flex items-center justify-center gap-5 py-3">
            <DonutChart />
            <div className="space-y-3 text-[11px] font-semibold text-slate-600">
              {DISTRIBUTION.map((slice) => (
                <div key={slice.label} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                  {slice.label} ({slice.value}%)
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Recent Alerts</h2>
            <button type="button" className="text-slate-400 hover:text-slate-700" aria-label="More alerts"><MoreHorizontal size={17} /></button>
          </div>
          <div className="space-y-2">
            {ALERTS.map((alert) => {
              const Icon = alert.type === 'critical' ? CircleAlert : alert.type === 'warning' ? AlertTriangle : Info;
              const colors = alert.type === 'critical' ? 'border-red-100 bg-red-50 text-red-600' : alert.type === 'warning' ? 'border-amber-100 bg-amber-50 text-amber-600' : 'border-blue-100 bg-blue-50 text-blue-600';
              return (
                <div key={alert.title} className={`flex gap-2 rounded-md border px-2.5 py-2 ${colors}`}>
                  <Icon size={13} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold">{alert.title}</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">{alert.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400">
        <Bell size={12} /> Dashboard data is currently shown from the configured admin overview.
      </div>
    </div>
  );
}
