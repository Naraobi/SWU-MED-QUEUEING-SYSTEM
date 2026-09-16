import React, { useState, useEffect } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import SkipQueueModal from '../../components/modals/SkipQueueModal.jsx'
import { useQueue } from '../../context/QueueContext.jsx'
import { useAuth } from '../../services/Authcontext.jsx'

function formatSeconds(totalSeconds) {
  const seconds = Number(totalSeconds) || 0

  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function matchesStaffDepartment(patientId, staffPrefix) {
  if (!patientId || !staffPrefix) return false

  const cleanId = String(patientId).startsWith('P-')
    ? String(patientId).slice(2)
    : String(patientId)

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
    startService,
    recallCurrentPatient,
    completeCurrentPatient,
    skipCurrentPatient,
  } = useQueue()

  const { user, loading: authLoading } = useAuth()

  const [staffPrefix, setStaffPrefix] = useState('')
  const [showSkip, setShowSkip] = useState(false)
  const [startingService, setStartingService] = useState(false)
  const [departmentLoading, setDepartmentLoading] = useState(true)

  // --------------------------------------------------
  // GET STAFF DEPARTMENT PREFIX
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function getDepartmentPrefix() {
      if (!user) {
        if (!cancelled) {
          setStaffPrefix('')
          setDepartmentLoading(false)
        }
        return
      }

      setDepartmentLoading(true)

      // ------------------------------------------------
      // BEST OPTION:
      // Use the department_id stored on the logged-in user.
      // ------------------------------------------------

      if (user.department_id && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('departments')
          .select('department_id, name, prefix')
          .eq('department_id', user.department_id)
          .maybeSingle()

        if (cancelled) return

        if (error) {
          console.error(
            'Failed to retrieve staff department:',
            error
          )
        }

        if (data?.prefix) {
          setStaffPrefix(String(data.prefix).trim())
          setDepartmentLoading(false)
          return
        }

        console.error(
          'Could not find department prefix for department ID:',
          user.department_id
        )

        setStaffPrefix('')
        setDepartmentLoading(false)
        return
      }

      // ------------------------------------------------
      // FALLBACK:
      // If Supabase is not configured, use the prefix
      // already stored on the authenticated user.
      // ------------------------------------------------

      if (user.department_prefix) {
        if (!cancelled) {
          setStaffPrefix(
            String(user.department_prefix).trim()
          )
          setDepartmentLoading(false)
        }

        return
      }

      // ------------------------------------------------
      // LEGACY FALLBACK:
      // Use department name only if department_id is
      // unavailable.
      // ------------------------------------------------

      if (
        user.department &&
        isSupabaseConfigured
      ) {
        const { data, error } = await supabase
          .from('departments')
          .select('prefix')
          .eq('name', user.department)
          .maybeSingle()

        if (cancelled) return

        if (error) {
          console.error(
            'Failed to retrieve department prefix:',
            error
          )
        }

        if (data?.prefix) {
          setStaffPrefix(
            String(data.prefix).trim()
          )
        } else {
          console.error(
            'Could not find prefix for department:',
            user.department
          )

          setStaffPrefix('')
        }

        setDepartmentLoading(false)
        return
      }

      if (!cancelled) {
        setStaffPrefix('')
        setDepartmentLoading(false)
      }
    }

    getDepartmentPrefix()

    return () => {
      cancelled = true
    }
  }, [
    user?.department_id,
    user?.department,
    user?.department_prefix,
  ])

  // --------------------------------------------------
  // INITIAL QUEUE LOAD
  // --------------------------------------------------

  useEffect(() => {
    if (!staffPrefix) return

    refresh(staffPrefix)
  }, [staffPrefix, refresh])

  // --------------------------------------------------
  // AUTOMATIC QUEUE REFRESH
  //
  // Queue data is now handled by Node.js.
  // Therefore, do not depend on Supabase Realtime here.
  //
  // Poll every 5 seconds so newly issued tickets appear
  // on the staff dashboard.
  // --------------------------------------------------

  useEffect(() => {
    if (!staffPrefix) return

    const interval = setInterval(() => {
      refresh(staffPrefix)
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [staffPrefix, refresh])

  // --------------------------------------------------
  // FILTER QUEUE BY STAFF DEPARTMENT
  //
  // The Node API should already return the correct
  // department queue. This is an additional frontend
  // safety filter so staff cannot accidentally see
  // another department's tickets.
  // --------------------------------------------------

  const filteredWaitingQueue = waitingQueue.filter(
    (patient) =>
      matchesStaffDepartment(
        patient.id,
        staffPrefix
      )
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
  // START SERVICE
  //
  // IMPORTANT:
  // Call Patient does NOT start the service timer.
  // The timer starts only after this action.
  // --------------------------------------------------

  const handleStartService = async () => {
    if (!activeServing || startingService) return

    try {
      setStartingService(true)

      await startService(staffPrefix)

      await refresh(staffPrefix)
    } catch (error) {
      console.error(
        'Failed to start service:',
        error
      )
    } finally {
      setStartingService(false)
    }
  }

  // --------------------------------------------------
  // SKIP PATIENT
  // --------------------------------------------------

  const handleConfirmSkip = async (reason) => {
    if (!staffPrefix) return

    try {
      await skipCurrentPatient(
        reason,
        staffPrefix
      )

      await refresh(staffPrefix)

      setShowSkip(false)
    } catch (error) {
      console.error(
        'Failed to skip patient:',
        error
      )
    }
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (
    authLoading ||
    departmentLoading ||
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
  // DETERMINE SERVICE STATE
  //
  // Only service_began_at/serviceBeganAt should mean
  // the actual service has started.
  //
  // Do NOT use status === "serving" by itself because
  // the patient can be called before Start Service.
  // --------------------------------------------------

  const serviceHasStarted = Boolean(
    activeServing?.serviceBeganAt ||
      activeServing?.service_began_at
  )

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

                    {/* PATIENT STATUS */}
                    <div className="mx-auto mt-4">

                      <div className="flex items-center justify-center gap-2">

                        <span
                          className="h-7 w-7 rounded-full bg-slate-200 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(https://api.dicebear.com/7.x/avataaars/svg?seed=${activeServing.avatarSeed})`,
                          }}
                        />

                        <button
                          onClick={async () => {
                            try {
                              await markPatientArrived(
                                staffPrefix
                              )

                              await refresh(
                                staffPrefix
                              )
                            } catch (error) {
                              console.error(
                                'Failed to mark patient arrived:',
                                error
                              )
                            }
                          }}
                          disabled={
                            activeServing.status ===
                              'arrived' ||
                            serviceHasStarted
                          }
                          className={`text-[9px] font-semibold ${
                            activeServing.status !==
                              'arrived' &&
                            !serviceHasStarted
                              ? 'text-amber-600 hover:underline'
                              : 'cursor-default text-blue-700'
                          }`}
                        >
                          {activeServing.status !==
                            'arrived' &&
                          !serviceHasStarted
                            ? 'Waiting for patient · Mark arrived'
                            : serviceHasStarted
                            ? 'Service in progress'
                            : 'Patient arrived'}
                        </button>

                      </div>

                    </div>

                    {/* START SERVICE */}
                    {!serviceHasStarted && (
                      <div className="mt-5">

                        <p className="mb-2 text-[9px] text-slate-400">
                          Patient has been called.
                          Start the service when you
                          are ready.
                        </p>

                        <button
                          onClick={
                            handleStartService
                          }
                          disabled={
                            startingService
                          }
                          className="rounded-[6px] bg-[#00854a] px-6 py-2.5 text-[10px] font-semibold text-white hover:bg-[#006f3d] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {startingService
                            ? 'Starting...'
                            : '▶ Start Service'}
                        </button>

                      </div>
                    )}

                    {/* SERVICE TIMER */}
                    {serviceHasStarted && (
                      <div className="mx-auto mt-4 w-fit rounded-full bg-slate-100 px-4 py-1.5 text-[10px] font-semibold text-slate-600">
                        ⏱{' '}
                        {formatSeconds(
                          activeServing.secondsElapsed
                        )}
                      </div>
                    )}

                    {/* ACTIONS */}
                    <div className="mt-5 flex justify-center gap-2">

                      <button
                        onClick={async () => {
                          try {
                            await recallCurrentPatient(
                              staffPrefix
                            )

                            await refresh(
                              staffPrefix
                            )
                          } catch (error) {
                            console.error(
                              'Failed to recall patient:',
                              error
                            )
                          }
                        }}
                        className="rounded-[6px] border border-slate-200 px-4 py-2 text-[9px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Recall
                      </button>

                      {serviceHasStarted && (
                        <button
                          onClick={async () => {
                            try {
                              await completeCurrentPatient(
                                staffPrefix
                              )

                              await refresh(
                                staffPrefix
                              )
                            } catch (error) {
                              console.error(
                                'Failed to complete patient:',
                                error
                              )
                            }
                          }}
                          className="rounded-[6px] bg-[#005b9f] px-4 py-2 text-[9px] font-semibold text-white hover:bg-[#00477c]"
                        >
                          Complete
                        </button>
                      )}

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
                        if (!staffPrefix) return

                        try {
                          await callNextPatient(
                            staffPrefix
                          )

                          await refresh(
                            staffPrefix
                          )
                        } catch (error) {
                          console.error(
                            'Failed to call next patient:',
                            error
                          )
                        }
                      }}
                      disabled={
                        !nextPatient ||
                        !staffPrefix
                      }
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