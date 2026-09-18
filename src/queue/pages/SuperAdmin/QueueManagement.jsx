import { useEffect, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  History,
  MonitorPlay,
  Plus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  fetchQueueState,
  getDepartments,
} from '../../services/backendApi';

const LINKS = [
  {
    title: 'Staff Queue Terminal',
    description: 'Open the SWUMed staff terminal to call, serve, complete, or skip patients.',
    href: '/staff',
    icon: ClipboardList,
  },
  {
    title: 'Queue History',
    description: 'Review completed and skipped transactions handled by the staff terminal.',
    href: '/staff/history',
    icon: History,
  },
  {
    title: 'TV Queue Display',
    description: 'Open the public display used to show the current queue number.',
    href: '/display',
    icon: MonitorPlay,
  },
];

const EMPTY_QUEUE_STATE = {
  waitingQueue: [],
  currentlyServing: null,
  stats: {
    waiting: 0,
    currentlyServing: 0,
    completed: 0,
    skipped: 0,
  },
};

export default function QueueManagement() {
  const [departments, setDepartments] = useState([]);
  const [queueStateMap, setQueueStateMap] = useState({});
  const [expandedDepartment, setExpandedDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadQueueData() {
      try {
        setLoading(true);
        setError(null);

        const departmentData = await getDepartments();

        if (!mounted) return;

        const formattedDepartments = (departmentData || []).map((department) => ({
          department_id: department.department_id,
          name: department.name || 'Untitled Department',
          prefix: department.prefix || '',
          status: department.status || 'active',
          kiosk_id: department.kiosk_id || '',
        }));

        setDepartments(formattedDepartments);

        const queueStateResults = await Promise.all(
          formattedDepartments.map(async (department) => {
            if (!department.prefix) {
              return {
                departmentId: department.department_id,
                state: EMPTY_QUEUE_STATE,
              };
            }

            try {
              const state = await fetchQueueState(department.prefix);

              return {
                departmentId: department.department_id,
                state: {
                  waitingQueue: Array.isArray(state?.waitingQueue) ? state.waitingQueue : [],
                  currentlyServing: state?.currentlyServing || null,
                  stats: {
                    waiting: Number(state?.stats?.waiting) || 0,
                    currentlyServing: Number(state?.stats?.currentlyServing) || 0,
                    completed: Number(state?.stats?.completed) || 0,
                    skipped: Number(state?.stats?.skipped) || 0,
                  },
                },
              };
            } catch (loadError) {
              console.error(`Queue state load failed for ${department.name}:`, loadError);

              return {
                departmentId: department.department_id,
                state: EMPTY_QUEUE_STATE,
              };
            }
          })
        );

        if (!mounted) return;

        const nextQueueStateMap = {};

        queueStateResults.forEach(({ departmentId, state }) => {
          nextQueueStateMap[departmentId] = state;
        });

        setQueueStateMap(nextQueueStateMap);
        setExpandedDepartment((current) => {
          if (!current && formattedDepartments.length > 0) {
            return formattedDepartments[0].department_id;
          }

          return current;
        });
      } catch (err) {
        console.error('LOAD QUEUE MANAGEMENT DATA ERROR:', err);

        if (mounted) {
          setError(err.message || 'Failed to load queue management data.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadQueueData();

    return () => {
      mounted = false;
    };
  }, []);

  function toggleDepartment(departmentId) {
    setExpandedDepartment((current) => (current === departmentId ? null : departmentId));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Queue Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor each department queue and its current service state.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs font-medium text-[#9D0A0E]">
          <Plus size={14} />
          Department overview
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading departments and queue status...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {departments.length > 0 ? (
            departments.map((department) => {
              const state = queueStateMap[department.department_id] || EMPTY_QUEUE_STATE;
              const isExpanded = expandedDepartment === department.department_id;
              const waitingCount = state.stats?.waiting || state.waitingQueue?.length || 0;
              const currentlyServing = state.currentlyServing;

              return (
                <div
                  key={department.department_id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleDepartment(department.department_id)}
                    className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FBF1F1] text-[#9D0A0E]">
                      <Building2 size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-800">{department.name}</h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            department.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {department.status}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span>Prefix: {department.prefix || 'Not set'}</span>
                        <span>•</span>
                        <span>{waitingCount} waiting</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {state.stats?.currentlyServing || 0} serving
                      </span>

                      <div className="text-slate-400">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Users size={14} className="text-[#9D0A0E]" />
                            Waiting
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-slate-800">{state.stats?.waiting || 0}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Clock3 size={14} className="text-amber-600" />
                            Serving
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-slate-800">{state.stats?.currentlyServing || 0}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <History size={14} className="text-emerald-600" />
                            Completed
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-slate-800">{state.stats?.completed || 0}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <MonitorPlay size={14} className="text-rose-600" />
                            Skipped
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-slate-800">{state.stats?.skipped || 0}</p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800">Current queue status</h3>
                            <span className="text-xs text-slate-500">Today</span>
                          </div>

                          {currentlyServing ? (
                            <div className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-[#9D0A0E]">
                                Currently serving
                              </p>
                              <p className="mt-2 text-xl font-semibold text-slate-800">
                                #{currentlyServing.queue_number || currentlyServing.queue_number || 'N/A'}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {currentlyServing.patient_number ? `Patient ${currentlyServing.patient_number}` : 'Patient in service'}
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                              No patient is currently being served in this department.
                            </div>
                          )}

                          <div className="mt-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Waiting queue
                            </h4>

                            <div className="mt-3 space-y-2">
                              {state.waitingQueue && state.waitingQueue.length > 0 ? (
                                state.waitingQueue.slice(0, 6).map((ticket) => (
                                  <div
                                    key={ticket.queue_id}
                                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">#{ticket.queue_number}</p>
                                      <p className="text-xs text-slate-500">
                                        {ticket.is_priority ? 'Priority queue' : 'Regular queue'}
                                      </p>
                                    </div>
                                    <span className="text-xs text-slate-500">
                                      {ticket.queue_sequence || 'Queued'}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                                  No patients are waiting in this department.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-semibold text-slate-800">Department actions</h3>
                          <div className="mt-4 space-y-2">
                            {LINKS.map(({ title, description, href, icon: Icon }) => (
                              <Link
                                key={href}
                                to={href}
                                className="group flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-[#F0DADA] hover:bg-[#FBF1F1]/40"
                              >
                                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
                                  <Icon size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-800">{title}</p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No departments found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
