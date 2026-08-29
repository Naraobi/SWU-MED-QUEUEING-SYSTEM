import { Sparkles } from 'lucide-react';

const VOLUME = [
  { label: 'CSH', value: 62 },
  { label: 'LAB', value: 44 },
  { label: 'PHA', value: 51 },
  { label: 'RAD', value: 22 },
];

const STAFF = [
  { name: 'Cashier 1', avgTime: '2m 15s', ratio: '98%' },
  { name: 'Cashier 4', avgTime: '4m 30s', ratio: '85%' },
  { name: 'Lab Tech 2', avgTime: '5m 00s', ratio: '100%' },
];

const QUEUE_LOG = [
  { id: 'Q-1042', dept: 'Cashier', status: 'Completed', wait: '12m', process: '2m' },
  { id: 'Q-1043', dept: 'Laboratory', status: 'Waiting', wait: '45m', process: '--' },
  { id: 'Q-1044', dept: 'Pharmacy', status: 'Skipped', wait: '5m', process: '--' },
];

const statusStyles = {
  Completed: 'bg-emerald-50 text-emerald-700',
  Waiting: 'bg-blue-50 text-blue-700',
  Skipped: 'bg-slate-100 text-slate-500',
};

export default function Reports() {
  const maxVolume = Math.max(...VOLUME.map((v) => v.value));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">System Reports &amp; Analytics</h1>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Date Range</label>
          <input type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0B2447] focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0B2447] focus:outline-none">
            <option>All Departments</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Staff Member</label>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0B2447] focus:outline-none">
            <option>All Staff</option>
          </select>
        </div>
        <button type="button" className="ml-auto rounded-lg bg-[#0B2447] px-4 py-2 text-xs font-medium text-white hover:bg-[#0B2447]/90">
          Apply Filters
        </button>
      </div>

      {/* AI insights */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-[#0B1524]" />
          <h2 className="text-sm font-semibold text-slate-800">AI Performance Insights</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-slate-700">Observation: Cashier 1 has demonstrated high efficiency this week.</p>
            <p className="mt-1 text-xs text-slate-400">Average transaction time reduced by 15% compared to baseline.</p>
          </div>
          <div>
            <p className="text-sm text-slate-700">Recommendation: Recommend reassigning Cashier 4 to Laboratory during peak volume (2PM-4PM).</p>
            <p className="mt-1 text-xs text-slate-400">Predictive model shows a 30% surge in Lab queues today.</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Volume chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Department Volume (Today)</h2>
          <div className="flex h-40 items-end gap-6 px-2">
            {VOLUME.map((v) => (
              <div key={v.label} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-[#0B2447]"
                  style={{ height: `${(v.value / maxVolume) * 100}%` }}
                />
                <span className="text-xs text-slate-500">{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Staff efficiency */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Staff Efficiency Highlights</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Staff</th>
                <th className="pb-2 font-medium">Avg Time</th>
                <th className="pb-2 text-right font-medium">C/S Ratio</th>
              </tr>
            </thead>
            <tbody>
              {STAFF.map((s) => (
                <tr key={s.name} className="border-t border-slate-100">
                  <td className="py-2.5 text-slate-700">{s.name}</td>
                  <td className="py-2.5 text-slate-600">{s.avgTime}</td>
                  <td className="py-2.5 text-right text-slate-600">{s.ratio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily queue log */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Daily Queue Detailed Report</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">Queue ID</th>
              <th className="px-5 py-2.5 font-medium">Department</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium">Wait Time</th>
              <th className="px-5 py-2.5 font-medium">Process Time</th>
            </tr>
          </thead>
          <tbody>
            {QUEUE_LOG.map((q) => (
              <tr key={q.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-5 py-3 font-mono text-slate-700">{q.id}</td>
                <td className="px-5 py-3 text-slate-600">{q.dept}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[q.status]}`}>{q.status}</span>
                </td>
                <td className="px-5 py-3 text-slate-600">{q.wait}</td>
                <td className="px-5 py-3 text-slate-600">{q.process}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}