import React, { useState, useEffect } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import SkipQueueModal from '../../components/modals/SkipQueueModal.jsx'
import { useQueue } from '../../context/QueueContext.jsx'
import { useAuth } from '../../services/Authcontext.jsx'
import { isSupabaseConfigured, supabase } from '../../../supabase'

function formatSeconds(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function matchesStaffDepartment(patientId, staffPrefix) {
  if (!patientId || !staffPrefix) return false

  const cleanId = patientId.startsWith('P-')
    ? patientId.slice(2)
    : patientId

  return cleanId.startsWith(`${staffPrefix}-`)
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

  const { user, loading: authLoading } = useAuth()

  const [staffPrefix, setStaffPrefix] = useState('')
  const [showSkip, setShowSkip] = useState(false)

  // --------------------------------------------------
  // GET DEPARTMENT PREFIX
  // --------------------------------------------------

  useEffect(() => {
    async function getDepartmentPrefix() {
      if (!user?.department) return

      if (!isSupabaseConfigured) {
        setStaffPrefix(user.department_prefix || 'BP')
        return
      }

      const { data, error } = await supabase
        .from('departments')
        .select('prefix')
        .eq('name', user.department)
        .maybeSingle()

      if (data?.prefix) {
        setStaffPrefix(data.prefix)
      } else {
        console.error(
          'Could not find prefix for department:',
          user.department,
          error
        )
      }
    }

    getDepartmentPrefix()
  }, [user])

  // --------------------------------------------------
  // REFRESH QUEUE
  // --------------------------------------------------

  useEffect(() => {
    if (staffPrefix) {
      refresh(staffPrefix)
    }
  }, [staffPrefix, refresh])

  // --------------------------------------------------
  // REALTIME QUEUE UPDATES
  // --------------------------------------------------

  useEffect(() => {
    if (!staffPrefix || !isSupabaseConfigured) return

    const channel = supabase
      .channel('public:queue_ticket')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_ticket',
        },
        () => {
          refresh(staffPrefix)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [staffPrefix, refresh])

  // --------------------------------------------------
  // FILTER QUEUE BY STAFF DEPARTMENT
  // --------------------------------------------------

  const filteredWaitingQueue = waitingQueue.filter((patient) =>
    matchesStaffDepartment(patient.id, staffPrefix)
  )

  const isCurrentForStaff = currentlyServing
    ? matchesStaffDepartment(
        currentlyServing.id,
        staffPrefix
      )
    : false

  const activeServing = isCurrentForStaff
    ? currentlyServing
    : null

  // --------------------------------------------------
  // SKIP
  // --------------------------------------------------

  const handleConfirmSkip = async (reason) => {
    await skipCurrentPatient(
      reason,
      staffPrefix
    )

    refresh(staffPrefix)
    setShowSkip(false)
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (
    authLoading ||
    (user?.department && !staffPrefix)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eaf5fc] text-sm font-medium text-slate-500">
        Loading staff profile & department...
      </div>
    )
  }

  // --------------------------------------------------
  // NEXT PATIENT
  // --------------------------------------------------

  const nextPatient = filteredWaitingQueue[0]

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <div className="staff-shell flex min-h-screen w-full bg-[#eaf5fc]">

      <Sidebar />

      <main className="min-h-screen min-w-0 flex-1">

        {/* TOPBAR */}
        <Topbar
          title={`Staff · ${
            user?.department || 'Department'
          }`}
          subtitle={`Managing queue for department: ${
            user?.department || 'General'
          } (${staffPrefix})`}
        />

        {/* CONTENT
            Keep this padding identical on Dashboard
            and Queue History.
        */}
        <div className="px-4 pb-8 pt-5">

          {/* PAGE TITLE */}
          <div className="mb-5">
            <h1 className="text-[25px] font-extrabold leading-none text-[#16283b]">
              Today's Queue
            </h1>

            <p className="mt-1 text-[10px] text-slate-500">
              Manage and monitor the queue assigned
              to your department.
            </p>
          </div>

          {/* ---------------------------------------- */}
          {/* STAT CARDS */}
          {/* ---------------------------------------- */}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">

            {/* WAITING */}
            <div className="flex h-[78px] items-center justify-between rounded-[9px] border border-[#73add4] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

              <div>
                <p className="text-[8px] font-bold uppercase tracking-wide text-[#536170]">
                  WAITING
                </p>

                <p className="mt-1 text-[20px] font-extrabold leading-none text-[#263445]">
                  {filteredWaitingQueue.length}
                </p>
              </div>

            </div>

            {/* CURRENTLY SERVING */}
            <div className="flex h-[78px] items-center justify-between rounded-[9px] border border-[#73add4] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

              <div>
                <p className="text-[8px] font-bold uppercase tracking-wide text-[#536170]">
                  CURRENTLY SERVING
                </p>

                <p className="mt-1 text-[20px] font-extrabold leading-none text-[#263445]">
                  {activeServing ? 1 : 0}
                </p>
              </div>

            </div>

            {/* COMPLETED */}
            <div className="flex h-[78px] items-center justify-between rounded-[9px] border border-[#73add4] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

              <div>
                <p className="text-[8px] font-bold uppercase tracking-wide text-[#536170]">
                  TODAY'S COMPLETED
                </p>

                <p className="mt-1 text-[20px] font-extrabold leading-none text-[#263445]">
                  {stats.completed}
                </p>
              </div>

              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-slate-500"
              >
                <path
                  d="M9 12l2 2 4-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <circle
                  cx="12"
                  cy="12"
                  r="9"
                />
              </svg>

            </div>

            {/* SKIPPED */}
            <div className="flex h-[78px] items-center justify-between rounded-[9px] border border-[#73add4] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

              <div>
                <p className="text-[8px] font-bold uppercase tracking-wide text-[#536170]">
                  TODAY'S SKIPPED
                </p>

                <p className="mt-1 text-[20px] font-extrabold leading-none text-[#263445]">
                  {stats.skipped}
                </p>
              </div>

              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-slate-500"
              >
                <rect
                  x="4"
                  y="5"
                  width="16"
                  height="14"
                  rx="2"
                />

                <path
                  d="M9 9l6 6M15 9l-6 6"
                  strokeLinecap="round"
                />
              </svg>

            </div>

          </div>

          {/* ---------------------------------------- */}
          {/* QUEUE AREA */}
          {/* ---------------------------------------- */}

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">

            {/* LEFT */}
            <div className="space-y-4">

              {/* CURRENTLY SERVING */}
              <div className="rounded-[9px] border border-[#d8e5ed] bg-white p-6 text-center shadow-[0_1px_4px_rgba(0,0,0,0.07)]">

                {queueLoading ? (

                  <p className="text-sm text-slate-400">
                    Loading queue...
                  </p>

                ) : activeServing ? (

                  <>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                      CURRENTLY SERVING
                    </p>

                    <p className="mt-2 text-[30px] font-extrabold text-[#005b9f]">
                      {activeServing.id}
                    </p>

                    <p className="mt-2 text-[10px] text-slate-500">
                      Service:{' '}
                      {activeServing.service}
                      {' '}|{' '}
                      Terminal:{' '}
                      {activeServing.terminal}
                    </p>

                    {activeServing.service ===
                      'Priority' && (
                      <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-800">
                        Priority
                      </span>
                    )}

                    <div className="mt-4 flex items-center justify-center gap-2">

                      <span
                        className="h-7 w-7 rounded-full bg-slate-200 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(https://api.dicebear.com/7.x/avataaars/svg?seed=${activeServing.avatarSeed})`,
                        }}
                      />

                      <button
                        onClick={async () => {
                          await markPatientArrived(
                            staffPrefix
                          )

                          refresh(staffPrefix)
                        }}
                        disabled={
                          activeServing.status ===
                          'serving'
                        }
                        className={`text-[9px] font-semibold ${
                          activeServing.status ===
                          'waiting'
                            ? 'text-amber-600 hover:underline'
                            : 'cursor-default text-blue-700'
                        }`}
                      >
                        {activeServing.status ===
                        'waiting'
                          ? 'Waiting for patient · Mark arrived'
                          : 'Serving'}
                      </button>

                    </div>

                    <div className="mx-auto mt-3 w-fit rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
                      ⏱{' '}
                      {formatSeconds(
                        activeServing.secondsElapsed
                      )}
                    </div>

                    <div className="mt-5 flex justify-center gap-2">

                      <button
                        onClick={async () => {
                          await recallCurrentPatient(
                            staffPrefix
                          )

                          refresh(staffPrefix)
                        }}
                        className="rounded-[6px] border border-slate-200 px-4 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Recall
                      </button>

                      <button
                        onClick={async () => {
                          await completeCurrentPatient(
                            staffPrefix
                          )

                          refresh(staffPrefix)
                        }}
                        className="rounded-[6px] bg-[#005b9f] px-4 py-2 text-[9px] font-semibold text-white hover:bg-[#00477c]"
                      >
                        Complete
                      </button>

                      <button
                        onClick={() =>
                          setShowSkip(true)
                        }
                        className="rounded-[6px] border border-rose-200 px-4 py-2 text-[9px] font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Skip
                      </button>

                    </div>
                  </>

                ) : (

                  <div className="py-8">

                    <p className="text-sm text-slate-500">
                      No patient is currently being
                      served in your department.
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      Call the next patient in line
                      to begin.
                    </p>

                    <button
                      onClick={async () => {
                        await callNextPatient(
                          staffPrefix
                        )

                        refresh(staffPrefix)
                      }}
                      disabled={!nextPatient}
                      className="mt-5 rounded-[6px] bg-[#005b9f] px-5 py-2.5 text-[10px] font-semibold text-white hover:bg-[#00477c] disabled:opacity-40"
                    >
                      ▶ Call Patient
                    </button>

                  </div>

                )}

              </div>

              {/* NEXT PATIENT */}
              <div className="flex items-center justify-between rounded-[9px] border border-[#d8e5ed] bg-white px-5 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">

                <div>

                  <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
                    NEXT PATIENT
                  </p>

                  <div className="mt-1 flex items-center gap-2">

                    <p className="text-[17px] font-bold text-slate-800">
                      {nextPatient
                        ? nextPatient.id
                        : '—'}
                    </p>

                    {nextPatient?.service ===
                      'Priority' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-bold text-amber-800">
                        Priority
                      </span>
                    )}

                  </div>

                </div>

              </div>

            </div>

            {/* WAITING QUEUE */}
            <div className="flex h-[390px] flex-col overflow-hidden rounded-[9px] border border-[#d8e5ed] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.07)]">

              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">

                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-700">
                  Waiting Queue
                </p>

                <span className="rounded bg-blue-50 px-2 py-0.5 text-[8px] font-bold text-[#005b9f]">
                  {filteredWaitingQueue.length}{' '}
                  Patients
                </span>

              </div>

              <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-hidden">

                {filteredWaitingQueue.map(
                  (patient, index) => (
                    <div
                      key={
                        patient.uniqueKey ||
                        patient.id
                      }
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                    >

                      <div className="flex items-center gap-2">

                        <p className="text-[10px] font-bold text-slate-800">
                          {patient.id}
                        </p>

                        {patient.service ===
                          'Priority' && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[7px] font-bold text-amber-800">
                            Priority
                          </span>
                        )}

                      </div>

                      <p className="text-[8px] text-slate-400">
                        ~{patient.etaMinutes}{' '}
                        min
                        {index > 0
                          ? ` (${index} ahead)`
                          : ''}
                      </p>

                    </div>
                  )
                )}

                {filteredWaitingQueue.length ===
                  0 && (
                  <p className="px-5 py-6 text-center text-[9px] text-slate-400">
                    No patients waiting.
                  </p>
                )}

              </div>

              <div className="border-t border-slate-100 px-5 py-3 text-center">

                <button className="text-[9px] font-semibold text-[#005b9f] hover:underline">
                  View Full Queue
                </button>

              </div>

            </div>

          </div>

        </div>

      </main>

      {/* SKIP MODAL */}
      {showSkip && activeServing && (
        <SkipQueueModal
          patient={activeServing}
          onCancel={() =>
            setShowSkip(false)
          }
          onConfirm={handleConfirmSkip}
        />
      )}

    </div>
  )
}