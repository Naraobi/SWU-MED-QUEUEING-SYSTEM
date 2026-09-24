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
} from 'lucide-react';

const STAFF = [
  { name: 'Cashier 1', avgTime: '2m 15s', ratio: '98%' },
  { name: 'Cashier 4', avgTime: '4m 30s', ratio: '85%' },
  { name: 'Lab Tech 2', avgTime: '5m 00s', ratio: '100%' },
];

const QUEUE_LOG = [
  {
    id: 'Q-1042',
    dept: 'Cashier',
    status: 'Completed',
    wait: '12m',
    process: '2m',
  },
  {
    id: 'Q-1043',
    dept: 'Laboratory',
    status: 'Waiting',
    wait: '45m',
    process: '--',
  },
  {
    id: 'Q-1044',
    dept: 'Pharmacy',
    status: 'Skipped',
    wait: '5m',
    process: '--',
  },
];

const statusStyles = {
  Completed: 'bg-emerald-50 text-emerald-700',
  Waiting: 'bg-[#FBF1F1] text-[#9D0A0E]',
  Skipped: 'bg-[#F1F3F5] text-[#4B5563]',
};

export default function Reports() {
  const [timeFilter, setTimeFilter] = useState('Today');
  const [loading, setLoading] = useState(false);

  const [metrics, setMetrics] = useState({
    totalPatientsServed: 0,
    totalWaiting: 0,
    avgWaitTime: '0m',
    activeTerminals: 0,
  });

  const [departmentVolume, setDepartmentVolume] = useState([]);
  const [queueDistribution, setQueueDistribution] = useState([]);
  const [insights, setInsights] = useState([]);

  // Scale the bars against the values actually being drawn, not the
  // placeholder data.
  const maxVolume = Math.max(
    ...departmentVolume.map(
      (d) => Number(d.value) || 0
    ),
    1
  );

  async function fetchAnalytics() {
    setLoading(true);

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error(
          'You must be signed in to load reports.'
        );
      }

      const today = new Date();

      const formatDate = (date) =>
        date.toISOString().slice(0, 10);

      let startDate;
      let endDate;

      if (timeFilter === 'Today') {
        startDate = today;
        endDate = today;
      } else if (timeFilter === 'Yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        startDate = yesterday;
        endDate = yesterday;
      } else if (timeFilter === 'This Week') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);

        startDate = weekStart;
        endDate = today;
      } else if (timeFilter === 'This Month') {
        const monthStart = new Date(
          today.getFullYear(),
          today.getMonth(),
          1
        );

        startDate = monthStart;
        endDate = today;
      } else {
        startDate = today;
        endDate = today;
      }

      const data = await getReportsAnalytics(
        user,
        formatDate(startDate),
        formatDate(endDate)
      );

      console.log(
        'REPORTS ANALYTICS DATA:',
        data
      );

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
        'Failed to load reports analytics:',
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
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1F2937]">
          System Reports &amp; Analytics
        </h1>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#4B5563]">
            Date Range
          </label>

          <input
            type="date"
            className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#9D0A0E] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#4B5563]">
            Department
          </label>

          <select className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#9D0A0E] focus:outline-none">
            <option>All Departments</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#4B5563]">
            Staff Member
          </label>

          <select className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm focus:border-[#9D0A0E] focus:outline-none">
            <option>All Staff</option>
          </select>
        </div>

        <button
          type="button"
          className="ml-auto rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-medium text-white hover:bg-[#7D080B]"
        >
          Apply Filters
        </button>
      </div>

      {/* AI Performance Insights */}
      <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles
            size={16}
            className="text-[#9D0A0E]"
          />

          <h2 className="text-sm font-semibold text-[#1F2937]">
            AI Performance Insights
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Total Waiting */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                TOTAL WAITING
              </span>

              <Users
                size={18}
                className="text-[#4B5563]"
              />
            </div>

            <div className="mt-3">
              <p className="text-2xl font-bold text-[#1F2937]">
                {metrics.totalWaiting}
              </p>

              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                ACROSS ALL DEPARTMENT
              </p>
            </div>
          </div>

          {/* Average Wait */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                AVERAGE WAIT
              </span>

              <Clock
                size={18}
                className="text-[#4B5563]"
              />
            </div>

            <div className="mt-3">
              <p className="text-2xl font-bold text-[#1F2937]">
                {metrics.avgWaitTime}
              </p>

              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                AVERAGE WAIT TIME
              </p>
            </div>
          </div>

          {/* Active Terminals */}
          <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                TERMINAL
              </span>

              <Monitor
                size={18}
                className="text-[#4B5563]"
              />
            </div>

            <div className="mt-3">
              <p className="text-2xl font-bold text-[#1F2937]">
                {metrics.activeTerminals}
              </p>

              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                ACTIVE TERMINAL
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm lg:col-span-7">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb
                size={16}
                className="text-[#9D0A0E]"
              />

              <h2 className="text-sm font-bold text-[#1F2937]">
                AI Insights
              </h2>
            </div>

            {loading ? (
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] p-4 text-xs text-[#4B5563]">
                Loading AI insights...
              </div>
            ) : insights.length > 0 ? (
              insights.map((insight, index) => (
                <div
                  key={insight.id || index}
                  className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] p-4 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <Lightbulb
                      size={16}
                      className="mt-0.5 shrink-0 text-[#9D0A0E]"
                    />

                    <div className="space-y-2">
                      <p className="leading-relaxed text-[#1F2937]">
                        {insight.message ||
                          insight.description ||
                          insight.text ||
                          'No additional insight available.'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] p-4 text-xs">
                  <div className="flex items-start gap-3">
                    <Lightbulb
                      size={16}
                      className="mt-0.5 shrink-0 text-[#9D0A0E]"
                    />

                    <p className="leading-relaxed text-[#1F2937]">
                      No AI performance insights are
                      available for the selected period.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200/80 bg-[#FFFBEB] p-4 text-xs">
                  <div className="flex items-start gap-3">
                    <TrendingUp
                      size={16}
                      className="mt-0.5 shrink-0 text-amber-700"
                    />

                    <p className="leading-relaxed text-amber-900/80">
                      Additional insights will appear
                      when enough queue activity is
                      available for analysis.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm lg:col-span-5">
          <div>
            <h2 className="mb-4 text-sm font-bold text-[#1F2937]">
              Queue Distribution
            </h2>

            {queueDistribution.length > 0 ? (
              <div className="space-y-4">
                {queueDistribution.map(
                  (item, index) => {
                    const percentage = Number(
                      item.pct ??
                        item.percentage ??
                        0
                    );

                    return (
                      <div
                        key={
                          item.label ||
                          item.status ||
                          index
                        }
                      >
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-[#4B5563]">
                            {item.label ||
                              item.status ||
                              'Unknown'}
                          </span>

                          <span className="text-[#9CA3AF]">
                            {percentage}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-[#F1F3F5]">
                          <div
                            className="h-full rounded-full bg-[#9D0A0E]"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  percentage
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8F9FA] p-5 text-center text-xs text-[#4B5563]">
                No queue distribution data
                available for the selected period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department Volume + Staff Efficiency */}
      <div className="mb-6 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Department Volume */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[#1F2937]">
            Department Volume
          </h2>

          {departmentVolume.length > 0 ? (
            <div className="flex h-40 items-end gap-6 px-2">
              {departmentVolume.map(
                (department, index) => {
                  const value = Number(
                    department.value ??
                      department.volume ??
                      department.count ??
                      0
                  );

                  return (
                    <div
                      key={
                        department.label ||
                        department.department_name ||
                        index
                      }
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <div
                        className="w-full rounded-t-md bg-[#9D0A0E]"
                        style={{
                          height: `${
                            maxVolume > 0
                              ? (value /
                                  Math.max(
                                    ...departmentVolume.map(
                                      (item) =>
                                        Number(
                                          item.value ??
                                            item.volume ??
                                            item.count ??
                                            0
                                        )
                                    ),
                                    1
                                  )) *
                                100
                              : 0
                          }%`,
                        }}
                      />

                      <span className="text-xs text-[#4B5563]">
                        {department.label ||
                          department.department_name ||
                          'Department'}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8F9FA]">
              <p className="text-xs text-[#4B5563]">
                No department volume data available.
              </p>
            </div>
          )}
        </div>

        {/* Staff Efficiency */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[#1F2937]">
            Staff Efficiency Highlights
          </h2>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[#9CA3AF]">
                <th className="pb-2 font-medium">
                  Staff
                </th>

                <th className="pb-2 font-medium">
                  Avg Time
                </th>

                <th className="pb-2 text-right font-medium">
                  C/S Ratio
                </th>
              </tr>
            </thead>

            <tbody>
              {STAFF.map((staff) => (
                <tr
                  key={staff.name}
                  className="border-t border-[#E5E7EB]"
                >
                  <td className="py-2.5 text-[#1F2937]">
                    {staff.name}
                  </td>

                  <td className="py-2.5 text-[#4B5563]">
                    {staff.avgTime}
                  </td>

                  <td className="py-2.5 text-right text-[#4B5563]">
                    {staff.ratio}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Queue Detailed Report */}
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="border-b border-[#E5E7EB] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1F2937]">
            Daily Queue Detailed Report
          </h2>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-xs uppercase tracking-wide text-[#9CA3AF]">
              <th className="px-5 py-2.5 font-medium">
                Queue ID
              </th>

              <th className="px-5 py-2.5 font-medium">
                Department
              </th>

              <th className="px-5 py-2.5 font-medium">
                Status
              </th>

              <th className="px-5 py-2.5 font-medium">
                Wait Time
              </th>

              <th className="px-5 py-2.5 font-medium">
                Process Time
              </th>
            </tr>
          </thead>

          <tbody>
            {QUEUE_LOG.map((queue) => (
              <tr
                key={queue.id}
                className="border-b border-[#F1F3F5] last:border-0 hover:bg-[#F8F9FA]"
              >
                <td className="px-5 py-3 font-mono text-[#1F2937]">
                  {queue.id}
                </td>

                <td className="px-5 py-3 text-[#4B5563]">
                  {queue.dept}
                </td>

                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      statusStyles[queue.status]
                    }`}
                  >
                    {queue.status}
                  </span>
                </td>

                <td className="px-5 py-3 text-[#4B5563]">
                  {queue.wait}
                </td>

                <td className="px-5 py-3 text-[#4B5563]">
                  {queue.process}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}