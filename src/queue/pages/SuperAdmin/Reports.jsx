import { useEffect, useState } from 'react';
import { auth } from '../../../firebase';
import { getReportsAnalytics } from '../../services/backendApi';

import { 
  Users, 
  Clock, 
  Monitor, 
  Lightbulb, 
  TrendingUp, 
  Calendar 
} from 'lucide-react';

export default function ReportsAnalytics() {
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('Today');
  const [departmentVolume, setDepartmentVolume] = useState([]);
  const [queueDistribution, setQueueDistribution] = useState([]);
  const [hourlyVolume, setHourlyVolume] = useState([]);
  const [departmentWait, setDepartmentWait] = useState([]);
  const [departmentPerformance, setDepartmentPerformance] = useState([]);
const [insights, setInsights] = useState([]);
  // Operational Metrics State
  const [metrics, setMetrics] = useState({
    totalPatientsServed: 512,
    totalWaiting: 145,
    avgWaitTime: '18m',
    activeTerminals: 42,
  });

  // Recent Activity Log State
  const [activities, setActivities] = useState([
    {
      id: '1',
      title: 'Terminal 4 activated',
      subtitle: 'Cardiology Dept • 10 mins ago',
      isPrimary: true,
    },
    {
      id: '2',
      title: 'AI recommendation generated',
      subtitle: 'System • 45 mins ago',
      isPrimary: false,
    },
    {
      id: '3',
      title: 'Queue limit reached',
      subtitle: 'Pediatrics Dept • 2 hours ago',
      isPrimary: false,
    },
  ]);

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
      totalPatientsServed: Number(data?.queue?.completed || 0),
      totalWaiting: Number(data?.queue?.waiting || 0),
      avgWaitTime: `${Number(data?.queue?.averageWaitMinutes || 0)}m`,
      activeTerminals: Number(data?.terminals?.active || 0),
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
    console.error("Failed to load reports analytics:", err);
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  return (
    <div className="space-y-6">
      {/* Page Title & Top Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Report & Analytics</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Track system reports and operational metrics.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
            </select>
            <Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <span className="pointer-events-none absolute right-3 top-2.5 text-[10px] text-slate-400">▼</span>
          </div>

          <button
            type="button"
            onClick={fetchAnalytics}
            className="rounded-lg bg-[#00529B] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#003F75]"
          >
            Apply Filter
          </button>
        </div>
      </div>

      {/* Top 4 Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: TOTAL PATIENTS */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL PATIENTS
            </span>
            <Users size={18} className="text-slate-500" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">{metrics.totalPatientsServed}</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              TOTAL PATIENTS SERVED
            </p>
          </div>
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
            <p className="text-2xl font-bold text-slate-800">{metrics.totalWaiting}</p>
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
            <p className="text-2xl font-bold text-slate-800">{metrics.avgWaitTime}</p>
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
            <p className="text-2xl font-bold text-slate-800">{metrics.activeTerminals}</p>
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
              <h2 className="text-sm font-bold text-slate-800">AI Insights</h2>
            </div>

            {/* Recommendation 1 (Light Blue Banner) */}
            <div className="rounded-lg border border-blue-100 bg-[#EBF3FE] p-4 text-xs">
              <div className="flex items-start gap-3">
                <Lightbulb size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <div className="space-y-2">
                  <p className="text-slate-700 leading-relaxed">
                    Recommend opening an additional terminal during peak hours (10AM - 12 PM) in Pediatrics to reduce wait times.
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

            {/* Recommendation 2 (Light Amber Banner) */}
            <div className="rounded-lg border border-amber-200/80 bg-[#FFFBEB] p-4 text-xs">
              <div className="flex items-start gap-3">
                <TrendingUp size={16} className="mt-0.5 shrink-0 text-amber-700" />
                <p className="text-amber-900/80 leading-relaxed">
                  Laboratory Department experiencing 15% higher volume than yesterday. Consider staff reallocation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Log */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
          <div>
            <h2 className="mb-6 text-sm font-bold text-slate-800">Recent Activity</h2>

            {/* Timeline List */}
            <div className="space-y-6">
              {activities.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-1.5">
                    <span
                      className={`block h-2.5 w-2.5 rounded-full ${
                        item.isPrimary ? 'bg-[#00529B]' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <button
              type="button"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View Full Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}