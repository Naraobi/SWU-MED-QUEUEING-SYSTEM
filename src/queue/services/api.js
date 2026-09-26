const API_URL =
  `${import.meta.env.VITE_API_URL || 'https://lightsteelblue-mandrill-330485.hostingersite.com/'}/api`

/* ============================================================================
   DEMO DATA
   ============================================================================ */

const demoQueue = [
  {
    queue_id: 'demo-1',
    queue_number: 'P-BP-022',
    is_priority: true,
    status: 'waiting',
    issued_at: new Date().toISOString()
  },
  ...Array.from({ length: 7 }, (_, index) => ({
    queue_id: `demo-${index + 2}`,
    queue_number: `BP-${String(index + 23).padStart(3, '0')}`,
    is_priority: false,
    status: 'waiting',
    issued_at: new Date().toISOString()
  }))
]

const demoNextPatient = {
  queue_id: 'demo-next',
  queue_number: 'P-BP-021',
  is_priority: true,
  status: 'waiting',
  issued_at: new Date().toISOString()
}

const demoHistory = [
  {
    queue_number: 'P-BP-018',
    is_priority: false,
    status: 'completed',
    called_at: '2026-09-04T07:42:00',
    service_began_at: '2026-09-04T07:43:00',
    completed_at: '2026-09-04T07:48:00',
    issued_at: '2026-09-04T07:30:00'
  },
  {
    queue_number: 'BP-019',
    is_priority: false,
    status: 'completed',
    called_at: '2026-09-04T07:49:00',
    service_began_at: '2026-09-04T07:50:00',
    completed_at: '2026-09-04T07:55:00',
    issued_at: '2026-09-04T07:35:00'
  },
  {
    queue_number: 'BP-020',
    is_priority: false,
    status: 'skipped',
    called_at: '2026-09-04T07:56:00',
    service_began_at: '2026-09-04T07:57:00',
    completed_at: '2026-09-04T07:58:00',
    issued_at: '2026-09-04T07:40:00',
    skip_reason: 'Patient did not arrive'
  }
]

const demoNotifications = [
  {
    id: 'demo-1',
    type: 'performance',
    title: 'Performance Recognition',
    message:
      'Great job! You completed 18 transactions today with an average time of 4.2 minutes.',
    time: 'Just now',
    unread: true
  },
  {
    id: 'demo-2',
    type: 'queue',
    title: 'Queue Update',
    message: 'Your department currently has 8 patients waiting.',
    time: '2m ago',
    unread: true
  },
  {
    id: 'demo-3',
    type: 'system',
    title: 'System Notice',
    message:
      'A system update is scheduled for later today. Please save your work.',
    time: '4h ago',
    unread: false
  }
]

// Used for Staff Management when Supabase isn't configured.
const DEMO_ROLES = [
  { id: 'demo-role-super', name: 'Super admin' },
  { id: 'demo-role-dept', name: 'Dept Admin' },
  { id: 'demo-role-staff', name: 'Staff' }
]

let demoUsers = [
  {
    id: 'demo-user-1',
    auth_user_id: null,
    first_name: 'Ruth',
    last_name: 'Abella',
    mi: null,
    contact_number: null,
    email: 'staff.demo@swu.local',
    status: 'active',
    role_id: 'demo-role-staff',
    position: null,
    kiosk_id: null,
    kiosk: null,
    department_id: null,
    department: null,
    roles: {
      id: 'demo-role-staff',
      name: 'Staff'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-user-2',
    auth_user_id: null,
    first_name: 'John',
    last_name: 'Doe',
    mi: null,
    contact_number: null,
    email: 'admin.demo@swu.local',
    status: 'active',
    role_id: 'demo-role-super',
    position: null,
    kiosk_id: null,
    kiosk: null,
    department_id: null,
    department: null,
    roles: {
      id: 'demo-role-super',
      name: 'Super admin'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

/* ============================================================================
   HELPERS
   ============================================================================ */

// Calculate seconds elapsed from the actual service start.
function getSecondsElapsed(
  startedAt,
  fallbackCalledAt = null
) {
  const timestamp =
    startedAt || fallbackCalledAt

  if (!timestamp) {
    return 0
  }

  const diff =
    Date.now() -
    new Date(timestamp).getTime()

  if (Number.isNaN(diff)) {
    return 0
  }

  return Math.max(
    0,
    Math.floor(diff / 1000)
  )
}

// Format service duration as MM:SS.
function getServiceDuration(
  startedAtIso,
  completedAtIso
) {
  if (
    !startedAtIso ||
    !completedAtIso
  ) {
    return null
  }

  const startMs =
    new Date(
      startedAtIso
    ).getTime()

  const endMs =
    new Date(
      completedAtIso
    ).getTime()

  if (
    Number.isNaN(startMs) ||
    Number.isNaN(endMs) ||
    endMs < startMs
  ) {
    return null
  }

  const totalSeconds =
    Math.floor(
      (endMs - startMs) / 1000
    )

  const mins =
    Math.floor(
      totalSeconds / 60
    )

  const secs =
    totalSeconds % 60

  return `${mins}:${String(
    secs
  ).padStart(2, '0')}`
}

/* ----------------------------------------------------------------------------
   MAP NODE.JS QUEUE RECORD
   ---------------------------------------------------------------------------- */

function mapQueueItem(
  row,
  index = 0
) {
  if (!row) {
    return null
  }

  const queueNumber =
    row.queue_number ||
    row.queueNumber ||
    ''

  const queueId =
    row.queue_id ||
    row.queueId ||
    null

  const startedAt =
    row.service_began_at ||
    row.serviceBeganAt ||
    null

  const calledAt =
    row.called_at ||
    row.calledAt ||
    null

  const rawCounterNumber =
    row.counter_number ??
    row.counterNumber ??
    null

  const counterNumber =
    rawCounterNumber === null ||
    rawCounterNumber === ''
      ? null
      : rawCounterNumber

  return {
    dbId: queueId,

    id: queueNumber,

    uniqueKey:
      `${queueNumber}-${queueId || index}`,

    service:
      row.department ||
      (
        row.is_priority
          ? 'Priority'
          : 'Regular'
      ),

    department:
      row.department ||
      null,

    departmentId:
      row.department_id ||
      null,

    // counter_id is a generated primary key, never something to show a
    // user. Only counter_number is human-readable, so when it is missing
    // this stays null and each screen falls back to the terminal name it
    // already knows locally.
    terminal:
      counterNumber !== null
        ? `Counter ${counterNumber}`
        : null,

    counterId:
      row.counter_id || null,

    counterNumber,

    status:
      row.status || 'waiting',

    secondsElapsed:
      getSecondsElapsed(
        startedAt,
        calledAt
      ),

    avatarSeed:
      queueNumber,

    etaMinutes:
      Number(
        row.etaMinutes
      ) || 5,

    queue_sequence:
      row.queue_sequence,

    queueSequence:
      row.queue_sequence,

    isPriority:
      Boolean(
        row.is_priority
      ),

    issued_at:
      row.issued_at,

    issuedAt:
      row.issued_at,

    called_at:
      calledAt,

    calledAt,

    service_began_at:
      startedAt,

    serviceBeganAt:
      startedAt,

    completed_at:
      row.completed_at,

    completedAt:
      row.completed_at
  }
}
export async function fetchTicketStatus(ticketId) {
  try {
    if (!ticketId) {
      return {
        error: 'No ticket ID was provided.',
      }
    }

    const response = await fetch(
      `${API_URL}/tracker/${encodeURIComponent(ticketId)}`,
      {
        cache: 'no-store',
      }
    )

    const result = await response.json()

    if (!response.ok || !result.success || !result.data) {
      return {
        error:
          result.message ||
          'The ticket could not be found.',
      }
    }

    // Backend already returns the correct tracker structure.
    // Do not remap the fields here.
    return result.data

  } catch (error) {
    console.error(
      'Ticket status fetch failed:',
      error
    )

    return {
      error:
        'Something went wrong while loading your ticket.',
    }
  }
}

export async function fetchQueueState(
  departmentPrefix,
  { start, end, terminalId } = {}
) {
  if (!departmentPrefix) {
    return {
      waitingQueue: [],
      currentlyServing: null,
      activeTickets: [],
      stats: {
        waiting: 0,
        currentlyServing: 0,
        completed: 0,
        skipped: 0
      }
    }
  }

  try {
    const params =
      new URLSearchParams()

    if (start) {
      params.set('start', start)
    }

    if (end) {
      params.set('end', end)
    }

    if (terminalId) {
      params.set('terminalId', terminalId)
    }

    const queryString =
      params.toString()

    const response =
      await fetch(
        `${API_URL}/staff-queue/state/${encodeURIComponent(
          departmentPrefix
        )}${
          queryString
            ? `?${queryString}`
            : ''
        }`
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to retrieve queue state.'
      )
    }

    /*
     * Current Node.js endpoint returns:
     *
     * {
     *   waitingQueue: [...],
     *   currentlyServing: {...},
     *   stats: {...}
     * }
     *
     * Therefore we do NOT expect
     * result.success / result.data here.
     */

    const waitingQueue =
      Array.isArray(
        result.waitingQueue
      )
        ? result.waitingQueue.map(
            (row, index) =>
              mapQueueItem(
                row,
                index
              )
          )
        : []

    const currentlyServing =
      result.currentlyServing
        ? mapQueueItem(
            result.currentlyServing
          )
        : null

    // One entry per terminal that currently has a called/serving
    // patient — lets a single department-wide view (Admin's Queue
    // Management) show every terminal's own patient at once instead
    // of a single ambiguous "currently serving" value.
    const activeTickets =
      Array.isArray(result.activeTickets)
        ? result.activeTickets.map(
            (row, index) => mapQueueItem(row, index)
          )
        : []

    const stats = {
      waiting:
        Number(
          result.stats?.waiting
        ) || 0,

      currentlyServing:
        Number(
          result.stats?.currentlyServing
        ) || 0,

      completed:
        Number(
          result.stats?.completed
        ) || 0,

      skipped:
        Number(
          result.stats?.skipped
        ) || 0
      ,

      averageServiceMinutes:
        Number(
          result.stats?.averageServiceMinutes
        ) || 0
    }

    return {
      waitingQueue,

      currentlyServing,

      activeTickets,

      stats
    }
  } catch (error) {
    console.error(
      'Node.js queue state error:',
      error
    )

    throw error
  }
}

/* ============================================================================
   STAFF QUEUE ACTIONS
   ============================================================================ */

/* ----------------------------------------------------------------------------
   CALL NEXT PATIENT
   ---------------------------------------------------------------------------- */

export async function callNextPatient(
  departmentPrefix,
  terminalId
) {
  if (!departmentPrefix) {
    throw new Error(
      'Department prefix is required.'
    )
  }

  // Every queue action is scoped to a single physical terminal so
  // multiple terminals in the same department can each serve their
  // own patient simultaneously. Failing fast here (instead of letting
  // the backend fall back to a department-wide match) is what stops
  // this terminal from ever acting on another terminal's patient.
  if (!terminalId) {
    throw new Error(
      'A terminal must be selected before calling a patient.'
    )
  }

  try {
    const response =
      await fetch(
        `${API_URL}/staff-queue/call-next/${encodeURIComponent(
          departmentPrefix
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            terminalId: terminalId || null
          })
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to call next patient.'
      )
    }

    /*
     * The backend call-next endpoint returns
     * the currently called patient.
     *
     * Fetch the complete state afterward so
     * waiting queue + statistics stay synchronized.
     *
     * IMPORTANT: pass terminalId through so this refetch
     * returns THIS terminal's currently-serving patient,
     * not the department's most-recently-called one from
     * some other terminal.
     */

    return fetchQueueState(
      departmentPrefix,
      { terminalId }
    )
  } catch (error) {
    console.error(
      'Call next patient error:',
      error
    )

    throw error
  }
}

/* ----------------------------------------------------------------------------
   MARK PATIENT ARRIVED
   ---------------------------------------------------------------------------- */

export async function markPatientArrived(
  departmentPrefix,
  terminalId
) {
  if (!departmentPrefix) {
    throw new Error(
      'Department prefix is required.'
    )
  }

  if (!terminalId) {
    throw new Error(
      'A terminal must be selected before confirming arrival.'
    )
  }

  try {
    const response =
      await fetch(
        `${API_URL}/staff-queue/arrived/${encodeURIComponent(
          departmentPrefix
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            terminalId: terminalId || null
          })
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to confirm patient arrival.'
      )
    }

    /*
     * IMPORTANT:
     *
     * Arrival does NOT start service.
     *
     * The timer only begins after
     * Start Service is pressed.
     */

    return {
      currentlyServing:
        result.currentlyServing
          ? mapQueueItem(
              result.currentlyServing
            )
          : null
    }
  } catch (error) {
    console.error(
      'Mark patient arrived error:',
      error
    )

    throw error
  }
}

/* ----------------------------------------------------------------------------
   START SERVICE
   ---------------------------------------------------------------------------- */

export async function startService(
  departmentPrefix,
  terminalId
) {
  if (!departmentPrefix) {
    throw new Error(
      'Department prefix is required.'
    )
  }

  if (!terminalId) {
    throw new Error(
      'A terminal must be selected before starting service.'
    )
  }

  try {
    const response =
      await fetch(
        `${API_URL}/staff-queue/start-service/${encodeURIComponent(
          departmentPrefix
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            terminalId: terminalId || null
          })
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to start service.'
      )
    }

    return {
      currentlyServing:
        result.currentlyServing
          ? mapQueueItem(
              result.currentlyServing
            )
          : null
    }
  } catch (error) {
    console.error(
      'Start service error:',
      error
    )

    throw error
  }
}

/* ----------------------------------------------------------------------------
   RECALL CURRENT PATIENT
   ---------------------------------------------------------------------------- */

export async function recallCurrentPatient(
  departmentPrefix,
  terminalId
) {
  if (!departmentPrefix) {
    throw new Error(
      'Department prefix is required.'
    )
  }

  if (!terminalId) {
    throw new Error(
      'A terminal must be selected before recalling a patient.'
    )
  }

  try {
    const response =
      await fetch(
        `${API_URL}/staff-queue/recall/${encodeURIComponent(
          departmentPrefix
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            terminalId: terminalId || null
          })
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to recall patient.'
      )
    }

    return {
      currentlyServing:
        result.currentlyServing
          ? mapQueueItem(
              result.currentlyServing
            )
          : null
    }
  } catch (error) {
    console.error(
      'Recall patient error:',
      error
    )

    throw error
  }
}

/* ----------------------------------------------------------------------------
   COMPLETE CURRENT PATIENT
   ---------------------------------------------------------------------------- */

export async function completeCurrentPatient(
  departmentPrefix,
  terminalId
) {
  if (!departmentPrefix) {
    throw new Error(
      'Department prefix is required.'
    )
  }

  if (!terminalId) {
    throw new Error(
      'A terminal must be selected before completing a patient.'
    )
  }

  try {
    const response =
      await fetch(
        `${API_URL}/staff-queue/complete/${encodeURIComponent(
          departmentPrefix
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            terminalId: terminalId || null
          })
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to complete patient.'
      )
    }

    return {
      currentlyServing:
        null,

      stats: {
        waiting:
          Number(
            result.stats?.waiting
          ) || 0,

        currentlyServing:
          Number(
            result.stats?.currentlyServing
          ) || 0,

        completed:
          Number(
            result.stats?.completed
          ) || 0,

        skipped:
          Number(
            result.stats?.skipped
          ) || 0
      }
    }
  } catch (error) {
    console.error(
      'Complete patient error:',
      error
    )

    throw error
  }
}

/* ----------------------------------------------------------------------------
   SKIP / CANCEL CURRENT PATIENT
   ---------------------------------------------------------------------------- */

export async function skipCurrentPatient(
  reason,
  departmentPrefix,
  terminalId
) {
  if (!departmentPrefix) {
    throw new Error(
      'Department prefix is required.'
    )
  }

  if (!terminalId) {
    throw new Error(
      'A terminal must be selected before skipping a patient.'
    )
  }

  try {
    const response =
      await fetch(
        `${API_URL}/staff-queue/cancel/${encodeURIComponent(
          departmentPrefix
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            reason:
              reason || null,
            terminalId:
              terminalId || null
          })
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to skip patient.'
      )
    }

    return {
      currentlyServing:
        null,

      stats: {
        waiting:
          Number(
            result.stats?.waiting
          ) || 0,

        currentlyServing:
          Number(
            result.stats?.currentlyServing
          ) || 0,

        completed:
          Number(
            result.stats?.completed
          ) || 0,

        skipped:
          Number(
            result.stats?.skipped
          ) || 0
      }
    }
  } catch (error) {
    console.error(
      'Skip patient error:',
      error
    )

    throw error
  }
}

/* ============================================================================
   NOTIFICATIONS
   ============================================================================ */

export async function fetchNotifications(
  departmentPrefix
) {
  if (!departmentPrefix) {
    return []
  }

  /*
   * Node.js notification route is already
   * available, so use it when possible.
   */

  try {
    const response =
      await fetch(
        `${API_URL}/staff-queue/notifications/${encodeURIComponent(
          departmentPrefix
        )}`
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to retrieve notifications.'
      )
    }

    /*
     * If the backend later returns
     * { success: true, data: [...] }
     * this supports that format too.
     */

    return Array.isArray(
      result
    )
      ? result
      : Array.isArray(
          result.data
        )
        ? result.data
        : []
  } catch (error) {
    console.error(
      'Notification fetch error:',
      error
    )

    return []
  }
}

export async function markAllNotificationsRead() {
  try {
    const response =
      await fetch(
        `${API_URL}/staff-queue/notifications/read-all`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json'
          }
        }
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to mark notifications as read.'
      )
    }

    return Array.isArray(
      result
    )
      ? result
      : Array.isArray(
          result.data
        )
        ? result.data
        : []
  } catch (error) {
    console.error(
      'Mark notifications read error:',
      error
    )

    return []
  }
}

/* ============================================================================
   HISTORY
   ============================================================================ */

/*
 * IMPORTANT:
 *
 * Queue History now uses department_id.
 *
 * Signature:
 *
 * fetchQueueHistory(
 *   departmentId,
 *   {
 *     search,
 *     status,
 *     range
 *   }
 * )
 */

export async function fetchQueueHistory(
  departmentId,
  {
    search = '',
    status = 'All Status',
    range = 'Today'
  } = {}
) {
  if (!departmentId) {
    return []
  }

  try {
    const params =
      new URLSearchParams()

    if (search) {
      params.set(
        'search',
        search
      )
    }

    if (
      status &&
      status !== 'All Status'
    ) {
      params.set(
        'status',
        status
      )
    }

    if (range) {
      params.set(
        'range',
        range
      )
    }

    const queryString =
      params.toString()

    const response =
      await fetch(
        `${API_URL}/staff-queue/history/${encodeURIComponent(
          departmentId
        )}${
          queryString
            ? `?${queryString}`
            : ''
        }`
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          'Failed to retrieve queue history.'
      )
    }

    /*
     * Node.js history already formats
     * the records for React.
     */

    if (
      Array.isArray(
        result.data
      )
    ) {
      return result.data
    }

    if (
      Array.isArray(
        result
      )
    ) {
      return result
    }

    return []
  } catch (error) {
    console.error(
      'Node.js history fetch error:',
      error
    )

    return []
  }
}

/* ============================================================================
   DEMO QUEUE STATE
   ============================================================================ */

function getDemoQueueState() {
  const waiting =
    demoQueue.filter(
      row =>
        row.status ===
        'waiting'
    )

  const serving =
    demoQueue.find(
      row =>
        row.status ===
        'serving'
    ) ||
    (
      demoNextPatient.status ===
      'serving'
        ? demoNextPatient
        : null
    )

  return {
    waitingQueue:
      waiting.map(
        (row, index) =>
          mapQueueItem(
            {
              ...row,
              etaMinutes:
                8 +
                index * 4
            },
            index
          )
      ),

    currentlyServing:
      mapQueueItem(
        serving
      ),

    stats: {
      waiting:
        waiting.length,

      currentlyServing:
        serving
          ? 1
          : 0,

      completed: 12,

      skipped: 1
    }
  }
}

/* ============================================================================
   USER MANAGEMENT
   ============================================================================ */

const USERS_TABLE = 'user'
const ROLES_TABLE = 'role'

/* ----------------------------------------------------------------------------
   FETCH USERS
   ---------------------------------------------------------------------------- */

export async function fetchUsers() {
  if (!supabase) {
    return demoUsers
  }

  const {
    data,
    error
  } = await supabase
    .from(USERS_TABLE)
    .select(`
      user_id,
      first_name,
      last_name,
      mi,
      contact_number,
      email,
      role_id,
      position,
      kiosk_id,
      kiosk,
      department_id,
      department,
      status,
      created_at,
      updated_at,
      role:role_id (
        role_id,
        role
      )
    `)
    .order(
      'created_at',
      {
        ascending: false
      }
    )

  if (error) {
    console.error(
      'Error fetching users:',
      error
    )

    throw error
  }

  return (data || []).map(
    user => ({
      ...user,

      roles: user.role
        ? {
            id:
              user.role.role_id,

            name:
              user.role.role
          }
        : null,

      contact_info:
        user.contact_number
    })
  )
}

/* ----------------------------------------------------------------------------
   FETCH ROLES
   ---------------------------------------------------------------------------- */

export async function fetchRoles() {
  if (!supabase) {
    return DEMO_ROLES
  }

  const {
    data,
    error
  } = await supabase
    .from(ROLES_TABLE)
    .select(
      'role_id, role'
    )
    .order(
      'role'
    )

  if (error) {
    console.error(
      'Error fetching roles:',
      error
    )

    throw error
  }

  return (data || []).map(
    row => ({
      id:
        row.role_id,

      name:
        row.role
    })
  )
}

/* ----------------------------------------------------------------------------
   CREATE USER
   ---------------------------------------------------------------------------- */

export async function createUser(
  payload
) {
  if (!supabase) {
    const created = {
      id:
        `demo-user-${Date.now()}`,

      status:
        'active',

      created_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),

      ...payload
    }

    demoUsers = [
      created,
      ...demoUsers
    ]

    return created
  }

  const userPayload = {
    first_name:
      payload.first_name ||
      null,

    last_name:
      payload.last_name ||
      null,

    mi:
      payload.mi ||
      null,

    contact_number:
      payload.contact_number ??
      payload.contact_info ??
      null,

    email:
      payload.email ||
      null,

    role_id:
      payload.role_id ||
      null,

    position:
      payload.position ||
      null,

    kiosk_id:
      payload.kiosk_id ||
      null,

    kiosk:
      payload.kiosk ||
      null,

    department_id:
      payload.department_id ||
      null,

    department:
      payload.department ||
      null,

    status:
      payload.status ||
      'active'
  }

  const {
    data,
    error
  } = await supabase
    .from(USERS_TABLE)
    .insert([
      userPayload
    ])
    .select(`
      user_id,
      first_name,
      last_name,
      mi,
      contact_number,
      email,
      role_id,
      position,
      kiosk_id,
      kiosk,
      department_id,
      department,
      status,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error(
      'Error creating user:',
      error
    )

    throw error
  }

  return {
    ...data,

    contact_info:
      data.contact_number
  }
}

/* ----------------------------------------------------------------------------
   UPDATE USER
   ---------------------------------------------------------------------------- */

export async function updateUser(
  userId,
  payload
) {
  if (!supabase) {
    let updated = null

    demoUsers =
      demoUsers.map(
        row => {
          if (
            row.id !== userId
          ) {
            return row
          }

          updated = {
            ...row,
            ...payload,
            updated_at:
              new Date().toISOString()
          }

          return updated
        }
      )

    return updated
  }

  const allowedPayload = {
    first_name:
      payload.first_name,

    last_name:
      payload.last_name,

    mi:
      payload.mi,

    contact_number:
      payload.contact_number !==
      undefined
        ? payload.contact_number
        : payload.contact_info,

    email:
      payload.email,

    role_id:
      payload.role_id,

    position:
      payload.position,

    kiosk_id:
      payload.kiosk_id,

    kiosk:
      payload.kiosk,

    department_id:
      payload.department_id,

    department:
      payload.department,

    status:
      payload.status,

    updated_at:
      new Date().toISOString()
  }

  Object.keys(
    allowedPayload
  ).forEach(
    key => {
      if (
        allowedPayload[key] ===
        undefined
      ) {
        delete allowedPayload[key]
      }
    }
  )

  const {
    data,
    error
  } = await supabase
    .from(USERS_TABLE)
    .update(
      allowedPayload
    )
    .eq(
      'user_id',
      userId
    )
    .select(`
      user_id,
      first_name,
      last_name,
      mi,
      contact_number,
      email,
      role_id,
      position,
      kiosk_id,
      kiosk,
      department_id,
      department,
      status,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error(
      'Error updating user:',
      error
    )

    throw error
  }

  return {
    ...data,

    contact_info:
      data.contact_number
  }
}

/* ----------------------------------------------------------------------------
   DELETE USER
   ---------------------------------------------------------------------------- */
export async function deleteUser(userId, deletionReason = '', deletedBy = 'superadmin') {
  if (!userId) {
    throw new Error('User ID is required.')
  }

  try {
    const response = await fetch(
      `${API_URL}/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deletion_reason: deletionReason,
          deletedBy,
        }),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.message ||
          result.error ||
          'Failed to delete user.'
      )
    }

    return result.data || result
  } catch (error) {
    console.error('Node.js delete user error:', error)
    throw error
  }
}

/* ============================================================================
   DEPARTMENTS
   ============================================================================ */

const DEPARTMENTS_TABLE =
  'departments'

export async function fetchDepartmentByName(
  name
) {
  if (!name) {
    return null
  }

  if (!supabase) {
    return {
      department_id:
        'demo-department',

      name
    }
  }

  const {
    data,
    error
  } = await supabase
    .from(
      DEPARTMENTS_TABLE
    )
    .select(`
      department_id,
      name,
      classification,
      location,
      prefix,
      status,
      est_time,
      administrator_id
    `)
    .eq(
      'name',
      name
    )
    .maybeSingle()

  if (error) {
    console.error(
      'Error fetching department:',
      error
    )

    return null
  }

  return data
}

export async function updateDepartmentName(
  departmentId,
  name
) {
  if (!supabase) {
    return {
      department_id:
        departmentId,

      name
    }
  }

  const {
    data,
    error
  } = await supabase
    .from(
      DEPARTMENTS_TABLE
    )
    .update({
      name,

      updated_at:
        new Date().toISOString()
    })
    .eq(
      'department_id',
      departmentId
    )
    .select(
      'department_id, name'
    )
    .single()

  if (error) {
    console.error(
      'Error updating department:',
      error
    )

    throw error
  }

  return data
}

/* ============================================================================
   COUNTERS
   ============================================================================ */

const COUNTERS_TABLE =
  'counter'

export async function fetchCounters(
  departmentId
) {
  if (
    !departmentId ||
    !supabase
  ) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from(
      COUNTERS_TABLE
    )
    .select(`
      counter_id,
      department_id,
      counter_number,
      prefix,
      status,
      assigned_staff_id,
      created_at,
      updated_at
    `)
    .eq(
      'department_id',
      departmentId
    )
    .order(
      'counter_number',
      {
        ascending: true
      }
    )

  if (error) {
    console.error(
      'Error fetching counters:',
      error
    )

    throw error
  }

  const counters =
    data || []

  const staffIds = [
    ...new Set(
      counters
        .map(
          row =>
            row.assigned_staff_id
        )
        .filter(Boolean)
    )
  ]

  let staffMap = {}

  if (
    staffIds.length > 0
  ) {
    const {
      data: staffData,
      error: staffError
    } = await supabase
      .from('user')
      .select(`
        user_id,
        first_name,
        last_name,
        email
      `)
      .in(
        'user_id',
        staffIds
      )

    if (staffError) {
      console.error(
        'Error fetching assigned staff:',
        staffError
      )
    } else {
      staffMap =
        Object.fromEntries(
          (staffData || [])
            .map(
              person => [
                person.user_id,
                person
              ]
            )
        )
    }
  }

  return counters.map(
    counter => ({
      ...counter,

      assigned:
        counter.assigned_staff_id
          ? staffMap[
              counter.assigned_staff_id
            ] || null
          : null
    })
  )
}

/* ----------------------------------------------------------------------------
   FETCH STAFF FOR DEPARTMENT
   ---------------------------------------------------------------------------- */

export async function fetchStaffForDepartment(
  departmentName
) {
  if (
    !departmentName ||
    !supabase
  ) {
    return []
  }

  console.log(
    'Loading staff for department:',
    departmentName
  )

  const {
    data,
    error
  } = await supabase
    .from('user')
    .select(`
      user_id,
      first_name,
      last_name,
      mi,
      contact_number,
      email,
      role_id,
      position,
      kiosk_id,
      kiosk,
      department_id,
      department,
      status,
      created_at,
      updated_at,
      role:role_id (
        role_id,
        role
      )
    `)
    .ilike(
      'department',
      departmentName
    )
    .order(
      'first_name',
      {
        ascending: true
      }
    )

  if (error) {
    console.error(
      'Staff query error:',
      error
    )

    throw error
  }

  console.log(
    'All users in department:',
    data
  )

  const staff =
    (data || [])
      .filter(
        person =>
          person.role?.role
            ?.trim()
            .toLowerCase() ===
          'staff'
      )
      .map(
        person => ({
          ...person,

          contact_info:
            person.contact_number,

          roles:
            person.role
              ? {
                  id:
                    person.role.role_id,

                  name:
                    person.role.role
                }
              : null
        })
      )

  console.log(
    'Filtered staff:',
    staff
  )

  return staff
}

/* ============================================================================
   CREATE COUNTER FOR DEPARTMENT
   ============================================================================ */

export async function createCounterForDepartment({
  departmentId,
  status = 'inactive'
}) {
  if (!supabase) {
    return {
      counter_id:
        `demo-counter-${Date.now()}`,

      department_id:
        departmentId,

      counter_number: 1,

      prefix: 'T1',

      assigned_staff_id:
        null,

      status
    }
  }

  if (!departmentId) {
    throw new Error(
      'Department is required.'
    )
  }

  const {
    data: department,
    error: departmentError
  } = await supabase
    .from('departments')
    .select(
      'department_id, name, prefix'
    )
    .eq(
      'department_id',
      departmentId
    )
    .maybeSingle()

  if (departmentError) {
    console.error(
      'Department lookup error:',
      departmentError
    )

    throw departmentError
  }

  if (!department) {
    throw new Error(
      'Department not found.'
    )
  }

  const departmentPrefix =
    department.prefix
      ?.trim()
      .toUpperCase()

  if (!departmentPrefix) {
    throw new Error(
      `Department "${department.name}" does not have a prefix.`
    )
  }

  const {
    data: existingCounters,
    error: countersError
  } = await supabase
    .from('counter')
    .select(
      'counter_number'
    )
    .eq(
      'department_id',
      departmentId
    )
    .order(
      'counter_number',
      {
        ascending: true
      }
    )

  if (countersError) {
    console.error(
      'Existing terminal lookup error:',
      countersError
    )

    throw countersError
  }

  const counters =
    existingCounters || []

  const usedNumbers =
    counters
      .map(
        counter =>
          Number(
            counter.counter_number
          )
      )
      .filter(
        number =>
          Number.isInteger(
            number
          ) &&
          number > 0
      )

  let nextCounterNumber =
    1

  while (
    usedNumbers.includes(
      nextCounterNumber
    )
  ) {
    nextCounterNumber++
  }

  const terminalPrefix =
    `${departmentPrefix}-${nextCounterNumber}`

  console.log(
    'Creating terminal:',
    {
      department:
        department.name,

      departmentPrefix,

      counterNumber:
        nextCounterNumber,

      terminalPrefix
    }
  )

  const {
    data,
    error
  } = await supabase
    .from('counter')
    .insert([
      {
        department_id:
          departmentId,

        counter_number:
          nextCounterNumber,

        prefix:
          terminalPrefix,

        assigned_staff_id:
          null,

        status
      }
    ])
    .select(`
      counter_id,
      department_id,
      counter_number,
      prefix,
      assigned_staff_id,
      status,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error(
      'Terminal insert error:',
      error
    )

    throw error
  }

  return data
}

/* ============================================================================
   CREATE COUNTER
   ============================================================================ */

export async function createCounter({
  counterNumber,
  prefix,
  assignedStaffId
}) {
  if (!supabase) {
    return {
      counter_id:
        `demo-counter-${Date.now()}`,

      counter_number:
        counterNumber,

      prefix,

      assigned_staff_id:
        assignedStaffId ||
        null,

      status:
        'inactive'
    }
  }

  if (!counterNumber) {
    throw new Error(
      'Counter number is required.'
    )
  }

  if (!prefix) {
    throw new Error(
      'Department prefix is required.'
    )
  }

  const departmentPrefix =
    prefix
      .trim()
      .toUpperCase()
      .split('-')[0]

  console.log(
    'Department prefix:',
    departmentPrefix
  )

  const {
    data: department,
    error: departmentError
  } = await supabase
    .from('departments')
    .select(
      'department_id, name, prefix'
    )
    .eq(
      'prefix',
      departmentPrefix
    )
    .maybeSingle()

  if (departmentError) {
    console.error(
      'Department lookup error:',
      departmentError
    )

    throw departmentError
  }

  if (!department) {
    throw new Error(
      `No department found for prefix "${departmentPrefix}".`
    )
  }

  console.log(
    'Department found:',
    department
  )

  const {
    data,
    error
  } = await supabase
    .from('counter')
    .insert([
      {
        department_id:
          department.department_id,

        counter_number:
          Number(
            counterNumber
          ),

        prefix:
          departmentPrefix,

        assigned_staff_id:
          assignedStaffId ||
          null,

        status:
          'inactive'
      }
    ])
    .select(`
      counter_id,
      department_id,
      counter_number,
      prefix,
      assigned_staff_id,
      status,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error(
      'Counter insert error:',
      error
    )

    throw error
  }

  return data
}

/* ============================================================================
   UPDATE COUNTER
   ============================================================================ */

export async function updateCounter(
  counterId,
  payload
) {
  if (!supabase) {
    return null
  }

  const updatePayload = {
    updated_at:
      new Date().toISOString()
  }

  if (
    payload.assigned_staff_id !==
    undefined
  ) {
    updatePayload.assigned_staff_id =
      payload.assigned_staff_id ||
      null
  }

  if (
    payload.counter_number !==
    undefined
  ) {
    updatePayload.counter_number =
      Number(
        payload.counter_number
      )
  }

  if (
    payload.prefix !==
    undefined
  ) {
    updatePayload.prefix =
      payload.prefix
        ? payload.prefix
            .trim()
            .toUpperCase()
        : null
  }

  if (
    payload.status !==
    undefined
  ) {
    updatePayload.status =
      payload.status
  }

  const {
    data,
    error
  } = await supabase
    .from(
      COUNTERS_TABLE
    )
    .update(
      updatePayload
    )
    .eq(
      'counter_id',
      counterId
    )
    .select(`
      counter_id,
      department_id,
      counter_number,
      prefix,
      status,
      assigned_staff_id,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error(
      'Error updating counter:',
      error
    )

    throw error
  }

  return data
}

/* ============================================================================
   DELETE COUNTER
   ============================================================================ */

export async function deleteCounter(
  counterId
) {
  if (!supabase) {
    return
  }

  const {
    error
  } = await supabase
    .from(
      COUNTERS_TABLE
    )
    .delete()
    .eq(
      'counter_id',
      counterId
    )

  if (error) {
    console.error(
      'Error deleting counter:',
      error
    )

    throw error
  }
}