import React, { useState, useEffect } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import StatCard from '../../components/ui/StatCard.jsx'
import SkipQueueModal from '../../components/modals/SkipQueueModal.jsx'
import { useQueue } from '../../context/QueueContext.jsx'
import { useAuth } from '../../services/Authcontext.jsx'
import { supabase } from '../../../supabase'

function formatSeconds(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function matchesStaffDepartment(patientId, staffPrefix) {
  if (!patientId || !staffPrefix) return false;
  const cleanId = patientId.startsWith('P-') ? patientId.slice(2) : patientId;
  return cleanId.startsWith(`${staffPrefix}-`);
}

export default function DashboardPage() {
  const {
    waitingQueue,
    currentlyServing,
    stats,
    loading: queueLoading,
    refresh,
    callNextPatient,
    markPatientArrived,
    recallCurrentPatient,
    completeCurrentPatient,
    skipCurrentPatient,
  } = useQueue()

  const { user, loading: authLoading } = useAuth();
  
  const [staffPrefix, setStaffPrefix] = useState('');
  const [showSkip, setShowSkip] = useState(false)

  // 1. Fetch the official prefix from the departments table when the user loads
  useEffect(() => {
    async function getDepartmentPrefix() {
      if (user?.department) {
        const { data, error } = await supabase
          .from('departments')
          .select('prefix')
          .eq('name', user.department)
          .maybeSingle();

        if (data?.prefix) {
          setStaffPrefix(data.prefix);
        } else {
          console.error("Could not find prefix for department:", user.department, error);
        }
      }
    }
    getDepartmentPrefix();
  }, [user]);

  // 2. Fetch the queue from the backend immediately using the fetched staffPrefix
  useEffect(() => {
    if (staffPrefix) {
      refresh(staffPrefix);
    }
  }, [staffPrefix, refresh]);

  // 3. Realtime Listener: Automatically refresh when a new queue or status change happens!
  useEffect(() => {
    if (!staffPrefix) return;

    const channel = supabase
      .channel('public:queue_ticket')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, and DELETE
          schema: 'public',
          table: 'queue_ticket',
        },
        (payload) => {
          console.log('Realtime change detected:', payload);
          refresh(staffPrefix);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [staffPrefix, refresh]);

  const filteredWaitingQueue = waitingQueue.filter(p => matchesStaffDepartment(p.id, staffPrefix));
  const isCurrentForStaff = currentlyServing ? matchesStaffDepartment(currentlyServing.id, staffPrefix) : false;
  const activeServing = isCurrentForStaff ? currentlyServing : null;

const handleConfirmSkip = async (reason) => {
    await skipCurrentPatient(reason, staffPrefix);
    refresh(staffPrefix); // Refreshes dashboard so the next user moves into serving
    setShowSkip(false);   // Closes the modal
  }

  if (authLoading || (user?.department && !staffPrefix)) {
    return <div className="flex min-h-screen items-center justify-center">Loading staff profile & department...</div>;
  }

  const nextPatient = filteredWaitingQueue[0];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 px-8 py-6">
        <Topbar 
          title="Today's Queue" 
          subtitle={`Managing queue for department: ${user?.department} (${staffPrefix})`}
        />

        <div className="mt-6 flex gap-4">
          <StatCard label="Waiting" value={filteredWaitingQueue.length} />
          <StatCard label="Currently Serving" value={activeServing ? 1 : 0} />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Skipped" value={stats.skipped} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
              {queueLoading ? (
                <p className="text-sm text-slate-400">Loading queue…</p>
              ) : activeServing ? (
                <>
                  <p className="text-xs font-semibold tracking-wide text-slate-400">CURRENTLY SERVING</p>
                  <p className="mt-2 text-5xl font-extrabold text-brand-blue">{activeServing.id}</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="text-sm text-slate-400">
                      Service: {activeServing.service} &nbsp;|&nbsp; Terminal: {activeServing.terminal}
                    </span>
                    {activeServing.service === 'Priority' && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        Priority
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span
                      className={`h-8 w-8 rounded-full bg-slate-200 bg-center bg-cover ${
                        activeServing.status === 'waiting' ? 'pulse-dot' : ''
                      }`}
                      style={{
                        backgroundImage: `url(https://api.dicebear.com/7.x/avataaars/svg?seed=${activeServing.avatarSeed})`,
                      }}
                    />
                    <button
                      onClick={async () => {
                        await markPatientArrived(staffPrefix);
                        refresh(staffPrefix);
                      }}
                      disabled={activeServing.status === 'serving'}
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        activeServing.status === 'waiting'
                          ? 'text-amber-600 hover:underline'
                          : 'cursor-default text-blue-700'
                      }`}
                    >
                      {activeServing.status === 'waiting' ? 'Waiting for patient · Mark arrived' : 'Serving'}
                    </button>
                  </div>

                  <div className="mx-auto mt-3 w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                    ⏱ {formatSeconds(activeServing.secondsElapsed)}
                  </div>

                  <div className="mt-6 flex justify-center gap-3">
                    <button 
                      onClick={async () => {
                        await recallCurrentPatient(staffPrefix);
                        refresh(staffPrefix);
                      }} 
                      className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Recall
                    </button>
                    <button 
                      onClick={async () => {
                        await completeCurrentPatient(staffPrefix);
                        refresh(staffPrefix);
                      }} 
                      className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Complete
                    </button>
                    <button 
                      onClick={() => setShowSkip(true)} 
                      className="rounded-lg border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Skip
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <p className="text-sm text-slate-400">No patient is currently being served in your department.</p>
                  <p className="mt-1 text-xs text-slate-300">Call the next patient in line to begin.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-card">
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-400">NEXT PATIENT</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xl font-bold text-slate-800">
                    {nextPatient ? nextPatient.id : '—'}
                  </p>
                  {nextPatient?.service === 'Priority' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                      Priority
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={async () => {
                  await callNextPatient(staffPrefix);
                  refresh(staffPrefix);
                }} 
                disabled={!nextPatient || (activeServing && activeServing.status !== 'serving')}
                className="rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Call Next Patient
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">Waiting Queue</p>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue">
                {filteredWaitingQueue.length} Patients
              </span>
            </div>
            <div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
              {filteredWaitingQueue.map((p, i) => (
                <div key={p.uniqueKey || p.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-700">{p.id}</p>
                    {p.service === 'Priority' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Priority
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    ~{p.etaMinutes} min {i > 0 ? `(${i} ahead)` : ''}
                  </p>
                </div>
              ))}
              {filteredWaitingQueue.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-slate-400">No patients waiting.</p>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-center">
              <button className="text-xs font-semibold text-brand-blue hover:underline">View Full Queue</button>
            </div>
          </div>
        </div>
      </main>

      {showSkip && activeServing && (
        <SkipQueueModal
          patient={activeServing}
          onCancel={() => setShowSkip(false)}
          onConfirm={handleConfirmSkip}
        />
      )}
    </div>
  )
}