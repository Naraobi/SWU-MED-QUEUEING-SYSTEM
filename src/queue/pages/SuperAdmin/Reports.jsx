import { useEffect, useState } from 'react';
import { auth } from '../../../firebase';
import { getReportsAnalytics } from '../../services/backendApi';

import {
  Sparkles,
  Users,
  Clock,
  Monitor,
  Lightbulb,
  TrendingUp,
  Calendar,
} from 'lucide-react';

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
  Waiting: 'bg-[#FBF1F1] text-[#9D0A0E]',
  Skipped: 'bg-slate-100 text-slate-500',
};

export default function Reports() {
  const maxVolume = Math.max(...VOLUME.map((v) => v.value));

  async function fetchAnalytics() {
    setLoading(true);

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("You must be signed in to load reports.");
      }

      const today = new Date();

      const formatDate = (date) =>
        date.toISOString().slice(0, 10);

      let startDate;
      let endDate;

      if (timeFilter === "Today") {
        startDate = today;
        endDate = today;
      } else if (timeFilter === "Yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        startDate = yesterday;
        endDate = yesterday;
      } else if (timeFilter === "This Week") {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);

        startDate = weekStart;
        endDate = today;
      } else if (timeFilter === "This Month") {
        const monthStart = new Date(
          today.getFullYear(),
          today.getMonth(),
          1
        );

        startDate = monthStart;
        endDate = today;
      }

      const data = await getReportsAnalytics(
        user,
        formatDate(startDate),
        formatDate(endDate)
      );

      console.log("REPORTS ANALYTICS DATA:", data);

      setMetrics({
        totalPatientsServed: Number(
          data?.queue?.completed || 0
        ),
        totalWaiting: Number(
          data?.queue?.waiting || 0
        ),
        avgWaitTime: `${Number(
          data?.queue?.averageWaitMinutes || 0
        )}m`,
        activeTerminals: Number(
          data?.terminals?.active || 0
        ),
      });

      setDepartmentVolume(
        Array.isArray(data?.departmentVolume)
          ? data.departmentVolume
          : []
      );

      setQueueDistribution(
        Array.isArray(data?.queueDistribution)
          ? data.queueDistribution
          : []
      );

      setInsights(
        Array.isArray(data?.insights)
          ? data.insights
          : []
      );
    } catch (err) {
      console.error(
        "Failed to load reports analytics:",
        err
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">System Reports &amp; Analytics</h1>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Date Range</label>
          <input type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#9D0A0E] focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#9D0A0E] focus:outline-none">
            <option>All Departments</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Staff Member</label>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#9D0A0E] focus:outline-none">
            <option>All Staff</option>
          </select>
        </div>
        <button type="button" className="ml-auto rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-medium text-white hover:bg-[#7D080B]">
          Apply Filters
        </button>
      </div>

      {/* AI insights */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-[#9D0A0E]" />
          <h2 className="text-sm font-semibold text-slate-800">AI Performance Insights</h2>
        </div>
        {/* Metric 2: TOTAL WAITING */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL WAITING
            </span>
            <Users size={18} className="text-slate-500" />
          </div>

          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">
              {metrics.totalWaiting}
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              ACROSS ALL DEPARTMENT
            </p>
          </div>
        </div>

        {/* Metric 3: AVERAGE WAIT */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              AVERAGE WAIT
            </span>
            <Clock size={18} className="text-slate-500" />
          </div>

          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">
              {metrics.avgWaitTime}
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              AVERAGE WAIT TIME
            </p>
          </div>
        </div>

        {/* Metric 4: TERMINAL */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              TERMINAL
            </span>
            <Monitor size={18} className="text-slate-500" />
          </div>

          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">
              {metrics.activeTerminals}
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              ACTIVE TERMINAL
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* Left Column: AI Insights */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-[#00529B]" />
              <h2 className="text-sm font-bold text-slate-800">
                AI Insights
              </h2>
            </div>

            <div className="rounded-lg border border-blue-100 bg-[#EBF3FE] p-4 text-xs">
              <div className="flex items-start gap-3">
                <Lightbulb
                  size={16}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div className="space-y-2">
                  <p className="text-slate-700 leading-relaxed">
                    Recommend opening an additional terminal during peak hours
                    (10AM - 12 PM) in Pediatrics to reduce wait times.
                  </p>

                  <button
                    type="button"
                    className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Apply Recommendation
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200/80 bg-[#FFFBEB] p-4 text-xs">
              <div className="flex items-start gap-3">
                <TrendingUp
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-700"
                />

                <p className="text-amber-900/80 leading-relaxed">
                  Laboratory Department experiencing 15% higher volume than
                  yesterday. Consider staff reallocation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Log */}
        
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
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
                  className="w-full rounded-t-md bg-[#9D0A0E]"
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