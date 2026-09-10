import { supabase } from '../../supabase'

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
    completed_at: '2026-09-04T07:48:00',
    issued_at: '2026-09-04T07:30:00'
  },
  {
    queue_number: 'BP-019',
    is_priority: false,
    status: 'completed',
    called_at: '2026-09-04T07:49:00',
    completed_at: '2026-09-04T07:55:00',
    issued_at: '2026-09-04T07:35:00'
  },
  {
    queue_number: 'BP-020',
    is_priority: false,
    status: 'skipped',
    called_at: '2026-09-04T07:56:00',
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
    email: 'staff.demo@swu.local',
    status: 'Active',
    role_id: 'demo-role-staff',
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
    email: 'admin.demo@swu.local',
    status: 'Active',
    role_id: 'demo-role-super',
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

// Calculate seconds elapsed between now and when the patient was called.
function getSecondsElapsed(calledAt) {
  if (!calledAt) return 0

  const diff = Date.now() - new Date(calledAt).getTime()

  return Math.floor(diff / 1000)
}

// Format service duration as MM:SS.
function getServiceDuration(startedAtIso, completedAtIso) {
  if (!startedAtIso || !completedAtIso) return null

  const startMs = new Date(startedAtIso).getTime()
  const endMs = new Date(completedAtIso).getTime()

  if (
    Number.isNaN(startMs) ||
    Number.isNaN(endMs) ||
    endMs < startMs
  ) {
    return null
  }

  const totalSeconds = Math.floor((endMs - startMs) / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60

  return `${mins}:${String(secs).padStart(2, '0')}`
}

function mapQueueItem(
  row,
  index = 0
) {
  if (!row) return null

  return {
    dbId: row.queue_id,
    id: row.queue_number,

    uniqueKey:
      `${row.queue_number}-${row.queue_id || index}`,

    service:
      row.is_priority
        ? 'Priority'
        : 'Regular',

    terminal:
      row.counter_id
        ? `Counter ${row.counter_id}`
        : 'Unassigned',

    status: row.status,

    secondsElapsed:
      getSecondsElapsed(row.called_at),

    avatarSeed:
      row.queue_number,

    // Temporary frontend fallback.
    // AI estimates can be connected here later.
    etaMinutes:
      Number(row.etaMinutes) || 5
  }
}
/* ============================================================================
   PATIENT TRACKER
   ============================================================================ */
export async function fetchTicketStatus(ticketId) {
  try {
    if (!ticketId) {
      return {
        error: 'No ticket ID was provided.'
      }
    }

    const {
      data: ticket,
      error: ticketError
    } = await supabase
      .from('queue_ticket')
      .select(`
        queue_id,
        queue_number,
        queue_sequence,
        department_id,
        counter_id,
        status,
        is_priority,
        issued_at,
        called_at,
        completed_at
      `)
      .eq('queue_id', ticketId)
      .maybeSingle()

    if (ticketError) {
      console.error(
        'Tracker ticket fetch error:',
        ticketError
      )

      return {
        error: 'Unable to load your ticket.'
      }
    }

    if (!ticket) {
      return {
        error: 'The ticket could not be found.'
      }
    }

    // Fetch department USING the department_id
    // already stored in the ticket.
    const {
      data: department,
      error: departmentError
    } = await supabase
      .from('departments')
      .select(`
        department_id,
        name,
        est_time
      `)
      .eq(
        'department_id',
        ticket.department_id
      )
      .maybeSingle()

    if (departmentError) {
      console.error(
        'Tracker department fetch error:',
        departmentError
      )
    }

    const departmentName =
      department?.name || 'Hospital Services'

    const issuedDate =
      new Date(ticket.issued_at)

    const startOfDay =
      new Date(issuedDate)

    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay =
      new Date(issuedDate)

    endOfDay.setHours(
      23,
      59,
      59,
      999
    )

    // Get waiting patients for this
    // department and issue date.
    const {
      data: waitingTickets,
      error: waitingError
    } = await supabase
      .from('queue_ticket')
      .select(`
        queue_id,
        queue_sequence,
        is_priority,
        issued_at
      `)
      .eq(
        'department_id',
        ticket.department_id
      )
      .eq('status', 'waiting')
      .gte(
        'issued_at',
        startOfDay.toISOString()
      )
      .lte(
        'issued_at',
        endOfDay.toISOString()
      )
      .order('is_priority', {
        ascending: false
      })
      .order('queue_sequence', {
        ascending: true
      })

    if (waitingError) {
      console.error(
        'Tracker waiting queue fetch error:',
        waitingError
      )
    }

    let peopleAhead = 0

    if (waitingTickets) {
      const ticketIndex =
        waitingTickets.findIndex(
          item =>
            item.queue_id === ticket.queue_id
        )

      peopleAhead =
        ticketIndex >= 0
          ? ticketIndex
          : 0
    }

    // Currently serving patient.
    const {
      data: servingTicket,
      error: servingError
    } = await supabase
      .from('queue_ticket')
      .select(`
        queue_number,
        counter_id,
        called_at
      `)
      .eq(
        'department_id',
        ticket.department_id
      )
      .eq('status', 'serving')
      .gte(
        'issued_at',
        startOfDay.toISOString()
      )
      .lte(
        'issued_at',
        endOfDay.toISOString()
      )
      .order('called_at', {
        ascending: false
      })
      .limit(1)
      .maybeSingle()

    if (servingError) {
      console.error(
        'Tracker serving ticket fetch error:',
        servingError
      )
    }

    // First try to use the latest AI estimate.
    const {
      data: prediction,
      error: predictionError
    } = await supabase
      .from('estimated_time')
      .select(`
        predicted_waiting_time,
        generated_at
      `)
      .eq(
        'department_id',
        ticket.department_id
      )
      .order('generated_at', {
        ascending: false
      })
      .limit(1)
      .maybeSingle()

    if (predictionError) {
      console.warn(
        'AI estimate unavailable:',
        predictionError
      )
    }

    const fallbackServiceMinutes =
      Number(department?.est_time) || 5

    const aiEstimatedWait =
      prediction?.predicted_waiting_time

    const estimatedWaitMinutes =
      aiEstimatedWait !== null &&
      aiEstimatedWait !== undefined
        ? Number(aiEstimatedWait)
        : peopleAhead *
          fallbackServiceMinutes

    return {
      status: ticket.status || 'waiting',
      queueNumber: ticket.queue_number,
      department: departmentName,
      terminal: ticket.counter_id
        ? `Counter ${ticket.counter_id}`
        : 'Assigned Counter',
      nowServing:
        servingTicket?.queue_number || '—',
      peopleAhead,
      estimatedWaitMinutes,
      totalAheadAtIssue:
        Math.max(peopleAhead, 1)
    }

  } catch (error) {
    console.error(
      'Ticket status fetch failed:',
      error
    )

    return {
      error:
        'Something went wrong while loading your ticket.'
    }
  }
}

/* ============================================================================
   QUEUE STATE
   ============================================================================ */
export async function fetchQueueState(
  departmentPrefix
) {
  if (!departmentPrefix) {
    return {
      waitingQueue: [],
      currentlyServing: null,
      stats: {
        waiting: 0,
        completed: 0,
        skipped: 0
      }
    }
  }

  if (!supabase) {
    return getDemoQueueState()
  }

  try {
    const now = new Date()

    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)

    const {
      data: waitingData,
      error: waitingError
    } = await supabase
      .from('queue_ticket')
      .select(`
        queue_id,
        queue_number,
        queue_sequence,
        department_id,
        counter_id,
        status,
        is_priority,
        issued_at,
        called_at
      `)
      .eq('status', 'waiting')
      .ilike(
        'queue_number',
        `${departmentPrefix}-%`
      )
      .gte(
        'issued_at',
        startOfDay.toISOString()
      )
      .lte(
        'issued_at',
        endOfDay.toISOString()
      )
      .order('is_priority', {
        ascending: false
      })
      .order('queue_sequence', {
        ascending: true
      })

    if (waitingError) {
      console.error(
        'Error fetching waiting queue:',
        waitingError
      )
      throw waitingError
    }

    const {
      data: servingData,
      error: servingError
    } = await supabase
      .from('queue_ticket')
      .select(`
        queue_id,
        queue_number,
        queue_sequence,
        department_id,
        counter_id,
        status,
        is_priority,
        issued_at,
        called_at
      `)
      .eq('status', 'serving')
      .ilike(
        'queue_number',
        `${departmentPrefix}-%`
      )
      .gte(
        'issued_at',
        startOfDay.toISOString()
      )
      .lte(
        'issued_at',
        endOfDay.toISOString()
      )
      .order('called_at', {
        ascending: false
      })
      .limit(1)
      .maybeSingle()

    if (servingError) {
      console.error(
        'Error fetching serving patient:',
        servingError
      )
      throw servingError
    }

    const {
      count: completedCount,
      error: completedError
    } = await supabase
      .from('queue_ticket')
      .select('*', {
        count: 'exact',
        head: true
      })
      .eq('status', 'completed')
      .ilike(
        'queue_number',
        `${departmentPrefix}-%`
      )
      .gte(
        'issued_at',
        startOfDay.toISOString()
      )
      .lte(
        'issued_at',
        endOfDay.toISOString()
      )

    if (completedError) {
      console.error(
        'Error fetching completed count:',
        completedError
      )
    }

    const {
      count: skippedCount,
      error: skippedError
    } = await supabase
      .from('queue_ticket')
      .select('*', {
        count: 'exact',
        head: true
      })
      .eq('status', 'skipped')
      .ilike(
        'queue_number',
        `${departmentPrefix}-%`
      )
      .gte(
        'issued_at',
        startOfDay.toISOString()
      )
      .lte(
        'issued_at',
        endOfDay.toISOString()
      )

    if (skippedError) {
      console.error(
        'Error fetching skipped count:',
        skippedError
      )
    }

    return {
      waitingQueue:
        (waitingData || []).map(
          (row, index) =>
            mapQueueItem(row, index)
        ),

      currentlyServing:
        mapQueueItem(servingData),

      stats: {
        waiting:
          waitingData?.length || 0,
        currentlyServing:
          servingData ? 1 : 0,
        completed:
          completedCount || 0,
        skipped:
          skippedCount || 0
      }
    }

  } catch (error) {
    console.error(
      'Supabase queue state error:',
      error
    )

    throw error
  }
}
/* ============================================================================
   STAFF QUEUE ACTIONS
   ============================================================================ */

export async function callNextPatient(
  departmentPrefix
) {
  const state =
    await fetchQueueState(departmentPrefix)

  const nextPatient =
    state.waitingQueue[0]

  if (!supabase) {
    demoNextPatient.status = 'serving'
    demoNextPatient.called_at =
      new Date().toISOString()

    return {
      ...getDemoQueueState(),
      currentlyServing:
        mapQueueItem(demoNextPatient)
    }
  }

  if (nextPatient) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        status: 'serving',
        called_at: new Date().toISOString()
      })
      .eq(
        'queue_id',
        nextPatient.dbId
      )

    if (error) {
      console.error(
        'Call next error:',
        error
      )
    }
  }

  return fetchQueueState(
    departmentPrefix
  )
}

export async function markPatientArrived(
  departmentPrefix
) {
  const state =
    await fetchQueueState(departmentPrefix)

  if (!supabase) {
    return state
  }

  if (state.currentlyServing) {
    // queue_ticket currently does not use
    // service_began_at here.
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        status: 'serving'
      })
      .eq(
        'queue_id',
        state.currentlyServing.dbId
      )

    if (error) {
      console.error(
        'Mark arrived error:',
        error
      )
    }
  }

  return fetchQueueState(
    departmentPrefix
  )
}

export async function recallCurrentPatient(
  departmentPrefix
) {
  const state =
    await fetchQueueState(departmentPrefix)

  if (!supabase) {
    return state
  }

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        called_at: new Date().toISOString()
      })
      .eq(
        'queue_id',
        state.currentlyServing.dbId
      )

    if (error) {
      console.error(
        'Recall error:',
        error
      )
    }
  }

  return fetchQueueState(
    departmentPrefix
  )
}

export async function completeCurrentPatient(
  departmentPrefix
) {
  const state =
    await fetchQueueState(departmentPrefix)

  if (!supabase) {
    demoNextPatient.status =
      'completed'

    return getDemoQueueState()
  }

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        status: 'completed',
        completed_at:
          new Date().toISOString()
      })
      .eq(
        'queue_id',
        state.currentlyServing.dbId
      )

    if (error) {
      console.error(
        'Complete error:',
        error
      )
    }
  }

  return fetchQueueState(
    departmentPrefix
  )
}

export async function skipCurrentPatient(
  reason,
  departmentPrefix
) {
  const state =
    await fetchQueueState(departmentPrefix)

  if (!supabase) {
    demoNextPatient.status =
      'skipped'

    demoNextPatient.skip_reason =
      reason

    return getDemoQueueState()
  }

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        status: 'skipped',
        completed_at:
          new Date().toISOString(),
        skip_reason: reason
      })
      .eq(
        'queue_id',
        state.currentlyServing.dbId
      )

    if (error) {
      console.error(
        'Skip error:',
        error
      )
    }
  }

  return fetchQueueState(
    departmentPrefix
  )
}

/* ============================================================================
   NOTIFICATIONS
   ============================================================================ */

export async function fetchNotifications(
  departmentPrefix
) {
  return supabase
    ? []
    : demoNotifications
}

export async function markAllNotificationsRead(
  departmentPrefix
) {
  return []
}

/* ============================================================================
   HISTORY
   ============================================================================ */

export async function fetchQueueHistory(
  {
    search = '',
    status = 'All Status',
    range = 'Today'
  } = {},
  departmentPrefix
) {
  // Demo history.
  if (!supabase) {
    return demoHistory
      .filter(
        row =>
          !search ||
          row.queue_number.includes(
            search.toUpperCase()
          )
      )
      .filter(
        row =>
          status === 'All Status' ||
          row.status ===
            status.toLowerCase()
      )
      .map(row => ({
        queueNumber:
          row.queue_number,

        service:
          row.is_priority
            ? 'Priority'
            : 'Billing / Payment',

        department:
          'Billing Department',

        terminal:
          'Terminal 2',

        status:
          row.status
            .charAt(0)
            .toUpperCase() +
          row.status.slice(1),

        calledAt:
          new Date(
            row.called_at
          ).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          }),

        startedAt:
          row.service_began_at
            ? new Date(
                row.service_began_at
              ).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
              })
            : '—',

        completedAt:
          new Date(
            row.completed_at
          ).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          }),

        duration:
          getServiceDuration(
            row.service_began_at ||
              row.called_at,
            row.completed_at
          ) || '—',

        waitingTime: '—',

        skipReason:
          row.skip_reason || null,

        transactionDate:
          new Date(
            row.issued_at
          ).toLocaleDateString(
            'en-US',
            {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            }
          )
      }))
  }

  try {
    let query = supabase
      .from('queue_ticket')
      .select('*')
      .order('issued_at', {
        ascending: false
      })

    // Filter by department prefix.
    if (departmentPrefix) {
      query = query.ilike(
        'queue_number',
        `%${departmentPrefix}-%`
      )
    }

    // Filter by status.
    if (
      status &&
      status !== 'All Status'
    ) {
      const statusMap = {
        Completed: 'completed',
        Skipped: 'skipped',
        Serving: 'serving',
        Waiting: 'waiting'
      }

      if (statusMap[status]) {
        query = query.eq(
          'status',
          statusMap[status]
        )
      }
    }

    // Search queue number.
    if (search) {
      query = query.ilike(
        'queue_number',
        `%${search}%`
      )
    }

    const { data, error } =
      await query

    if (error) {
      console.error(
        'Error fetching history:',
        error
      )

      return []
    }

    return data.map(row => ({
      queueNumber:
        row.queue_number,

      service:
        row.is_priority
          ? 'Priority'
          : 'Regular',

      department:
        departmentPrefix ||
        'General',

      terminal:
        'Default',

      status:
        row.status
          .charAt(0)
          .toUpperCase() +
        row.status.slice(1),

      calledAt:
        row.called_at
          ? new Date(
              row.called_at
            ).toLocaleTimeString(
              [],
              {
                hour: 'numeric',
                minute: '2-digit'
              }
            )
          : '—',

      startedAt:
        row.service_began_at
          ? new Date(
              row.service_began_at
            ).toLocaleTimeString(
              [],
              {
                hour: 'numeric',
                minute: '2-digit'
              }
            )
          : '—',

      completedAt:
        row.completed_at
          ? new Date(
              row.completed_at
            ).toLocaleTimeString(
              [],
              {
                hour: 'numeric',
                minute: '2-digit'
              }
            )
          : '—',

      duration:
        getServiceDuration(
          row.service_began_at ||
            row.called_at,
          row.completed_at
        ) || '—',

      waitingTime: '—',

      skipReason:
        row.skip_reason || null,

      transactionDate:
        new Date(
          row.issued_at
        ).toLocaleDateString(
          'en-US',
          {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }
        )
    }))
  } catch (err) {
    console.error(
      'History fetch exception:',
      err
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
      row => row.status === 'waiting'
    )

  const serving =
    demoQueue.find(
      row => row.status === 'serving'
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
                8 + index * 4
            },
            index
          )
      ),

    currentlyServing:
      mapQueueItem(serving),

    stats: {
      waiting:
        waiting.length,

      currentlyServing:
        serving ? 1 : 0,

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

export async function fetchUsers() {
  if (!supabase) {
    return demoUsers
  }

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(`
      user_id,
      first_name,
      last_name,
      email,
      status,
      created_at,
      updated_at,
      role_id,
      department,
      location,
      contact_info,
      role:role_id (
        role_id,
        role
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
    throw error
  }

  // Keep a frontend-friendly `roles` object so existing UI code
  // that expects roles.id / roles.name can continue working.
  return (data || []).map(user => ({
    ...user,
    roles: user.role
      ? {
          id: user.role.role_id,
          name: user.role.role
        }
      : null
  }))
}

export async function fetchRoles() {
  if (!supabase) {
    return DEMO_ROLES
  }

  const { data, error } = await supabase
    .from(ROLES_TABLE)
    .select('role_id, role')
    .order('role')

  if (error) {
    console.error('Error fetching roles:', error)
    throw error
  }

  // Keep the frontend format as id/name.
  return (data || []).map(row => ({
    id: row.role_id,
    name: row.role
  }))
}

export async function createUser(payload) {
  if (!supabase) {
    const created = {
      id: `demo-user-${Date.now()}`,
      status: 'Active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...payload
    }

    demoUsers = [created, ...demoUsers]
    return created
  }

  // Only send columns that actually exist in the user table.
  const userPayload = {
    first_name: payload.first_name || null,
    last_name: payload.last_name || null,
    email: payload.email || null,
    status: payload.status || 'Active',
    role_id: payload.role_id || null,
    department: payload.department || null,
    location: payload.location || null,
    contact_info: payload.contact_info || null
  }

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .insert([userPayload])
    .select(`
      user_id,
      first_name,
      last_name,
      email,
      status,
      role_id,
      department,
      location,
      contact_info,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error('Error creating user:', error)
    throw error
  }

  return data
}

export async function updateUser(userId, payload) {
  if (!supabase) {
    let updated = null

    demoUsers = demoUsers.map(row => {
      if (row.id !== userId) return row

      updated = {
        ...row,
        ...payload,
        updated_at: new Date().toISOString()
      }

      return updated
    })

    return updated
  }

  const allowedPayload = {
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    status: payload.status,
    role_id: payload.role_id,
    department: payload.department,
    location: payload.location,
    contact_info: payload.contact_info,
    updated_at: new Date().toISOString()
  }

  // Remove undefined properties.
  Object.keys(allowedPayload).forEach(key => {
    if (allowedPayload[key] === undefined) {
      delete allowedPayload[key]
    }
  })

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update(allowedPayload)
    .eq('user_id', userId)
    .select(`
      user_id,
      first_name,
      last_name,
      email,
      status,
      role_id,
      department,
      location,
      contact_info,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    console.error('Error updating user:', error)
    throw error
  }

  return data
}

export async function deleteUser(userId) {
  if (!supabase) {
    demoUsers = demoUsers.filter(row => row.id !== userId)
    return
  }

  const { error } = await supabase
    .from(USERS_TABLE)
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting user:', error)
    throw error
  }
}

/* ============================================================================
   DEPARTMENTS
   ============================================================================ */

const DEPARTMENTS_TABLE = 'departments'

export async function fetchDepartmentByName(name) {
  if (!name) return null

  if (!supabase) {
    return {
      department_id: 'demo-department',
      name
    }
  }

  const { data, error } = await supabase
    .from(DEPARTMENTS_TABLE)
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
    .eq('name', name)
    .maybeSingle()

  if (error) {
    console.error('Error fetching department:', error)
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
      department_id: departmentId,
      name
    }
  }

  const { data, error } = await supabase
    .from(DEPARTMENTS_TABLE)
    .update({
      name,
      updated_at: new Date().toISOString()
    })
    .eq('department_id', departmentId)
    .select('department_id, name')
    .single()

  if (error) {
    console.error('Error updating department:', error)
    throw error
  }

  return data
}
/* ============================================================================
   COUNTERS
   ============================================================================ */

const COUNTERS_TABLE = 'counter'

export async function fetchCounters(departmentId) {
  if (!departmentId || !supabase) {
    return []
  }

  const { data, error } = await supabase
    .from(COUNTERS_TABLE)
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
    .eq('department_id', departmentId)
    .order('counter_number', {
      ascending: true
    })

  if (error) {
    console.error('Error fetching counters:', error)
    throw error
  }

  const counters = data || []

  // Fetch assigned staff separately.
  // This avoids Supabase relationship-name issues.
  const staffIds = [
    ...new Set(
      counters
        .map(row => row.assigned_staff_id)
        .filter(Boolean)
    )
  ]

  let staffMap = {}

  if (staffIds.length > 0) {
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
      .in('user_id', staffIds)

    if (staffError) {
      console.error(
        'Error fetching assigned staff:',
        staffError
      )
    } else {
      staffMap = Object.fromEntries(
        (staffData || []).map(person => [
          person.user_id,
          person
        ])
      )
    }
  }

  return counters.map(counter => ({
    ...counter,
    assigned:
      counter.assigned_staff_id
        ? staffMap[counter.assigned_staff_id] || null
        : null
  }))
}

export async function fetchStaffForDepartment(departmentName) {
  if (!departmentName || !supabase) {
    return [];
  }

  console.log('Loading staff for department:', departmentName);

  const { data, error } = await supabase
    .from('user')
    .select(`
      user_id,
      first_name,
      last_name,
      email,
      department,
      role_id,
      role:role_id (
        role_id,
        role
      )
    `)
    .ilike('department', departmentName)
    .order('first_name', {
      ascending: true
    });

  if (error) {
    console.error('Staff query error:', error);
    throw error;
  }

  console.log('All users in department:', data);

  const staff = (data || []).filter(
    person =>
      person.role?.role?.trim().toLowerCase() === 'staff'
  );

  console.log('Filtered staff:', staff);

  return staff;
}

export async function createCounterForDepartment({
  departmentId,
  status = 'inactive'
}) {
  if (!supabase) {
    return {
      counter_id: `demo-counter-${Date.now()}`,
      department_id: departmentId,
      counter_number: 1,
      prefix: 'T1',
      assigned_staff_id: null,
      status
    };
  }

  if (!departmentId) {
    throw new Error('Department is required.');
  }

  // Get the department prefix
  const { data: department, error: departmentError } =
    await supabase
      .from('departments')
      .select('department_id, name, prefix')
      .eq('department_id', departmentId)
      .maybeSingle();

  if (departmentError) {
    console.error(
      'Department lookup error:',
      departmentError
    );
    throw departmentError;
  }

  if (!department) {
    throw new Error('Department not found.');
  }

  const departmentPrefix = department.prefix
    ?.trim()
    .toUpperCase();

  if (!departmentPrefix) {
    throw new Error(
      `Department "${department.name}" does not have a prefix.`
    );
  }

  // Get existing terminals for this department
  const { data: existingCounters, error: countersError } =
    await supabase
      .from('counter')
      .select('counter_number')
      .eq('department_id', departmentId)
      .order('counter_number', {
        ascending: true
      });

  if (countersError) {
    console.error(
      'Existing terminal lookup error:',
      countersError
    );
    throw countersError;
  }

  const counters = existingCounters || [];

  // Find the next available terminal number.
  // Example:
  // Existing: 1, 2, 3
  // New terminal: 4
  const usedNumbers = counters
    .map(counter => Number(counter.counter_number))
    .filter(number => Number.isInteger(number) && number > 0);

  let nextCounterNumber = 1;

  while (usedNumbers.includes(nextCounterNumber)) {
    nextCounterNumber++;
  }

  // Automatically create:
  // CT + 1 = CT-1
  // CT + 2 = CT-2
  // CT + 3 = C-3
const terminalPrefix =
  `${departmentPrefix}-${nextCounterNumber}`;

  console.log('Creating terminal:', {
    department: department.name,
    departmentPrefix,
    counterNumber: nextCounterNumber,
    terminalPrefix
  });

  const { data, error } = await supabase
    .from('counter')
    .insert([
      {
        department_id: departmentId,
        counter_number: nextCounterNumber,
        prefix: terminalPrefix,
        assigned_staff_id: null,
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
    .single();

  if (error) {
    console.error(
      'Terminal insert error:',
      error
    );
    throw error;
  }

  return data;
}

export async function createCounter({
  counterNumber,
  prefix,
  assignedStaffId
}) {
  if (!supabase) {
    return {
      counter_id: `demo-counter-${Date.now()}`,
      counter_number: counterNumber,
      prefix,
      assigned_staff_id: assignedStaffId || null,
      status: 'inactive'
    };
  }

  if (!counterNumber) {
    throw new Error('Counter number is required.');
  }

  if (!prefix) {
    throw new Error('Department prefix is required.');
  }

  // Example:
  // IN-1 → IN
  // BP-1 → BP
  // CT   → CT
  const departmentPrefix = prefix
    .trim()
    .toUpperCase()
    .split('-')[0];

  console.log('Department prefix:', departmentPrefix);

  // Find department using prefix
  const { data: department, error: departmentError } =
    await supabase
      .from('departments')
      .select('department_id, name, prefix')
      .eq('prefix', departmentPrefix)
      .maybeSingle();

  if (departmentError) {
    console.error(
      'Department lookup error:',
      departmentError
    );
    throw departmentError;
  }

  if (!department) {
    throw new Error(
      `No department found for prefix "${departmentPrefix}".`
    );
  }

  console.log('Department found:', department);

  // Create counter
  const { data, error } = await supabase
    .from('counter')
    .insert([
      {
        department_id: department.department_id,
        counter_number: Number(counterNumber),
        prefix: departmentPrefix,
        assigned_staff_id: assignedStaffId || null,
        status: 'inactive'
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
    .single();

  if (error) {
    console.error(
      'Counter insert error:',
      error
    );
    throw error;
  }

  return data;
}


export async function updateCounter(
  counterId,
  payload
) {
  if (!supabase) {
    return null
  }

  const updatePayload = {
    updated_at: new Date().toISOString()
  }

  if (
    payload.assigned_staff_id !== undefined
  ) {
    updatePayload.assigned_staff_id =
      payload.assigned_staff_id || null
  }

  if (
    payload.counter_number !== undefined
  ) {
    updatePayload.counter_number =
      Number(payload.counter_number)
  }

  if (payload.prefix !== undefined) {
    updatePayload.prefix =
      payload.prefix
        ? payload.prefix.trim().toUpperCase()
        : null
  }

  if (payload.status !== undefined) {
    updatePayload.status = payload.status
  }

  const { data, error } = await supabase
    .from(COUNTERS_TABLE)
    .update(updatePayload)
    .eq('counter_id', counterId)
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

export async function deleteCounter(
  counterId
) {
  if (!supabase) return

  const { error } = await supabase
    .from(COUNTERS_TABLE)
    .delete()
    .eq('counter_id', counterId)

  if (error) {
    console.error(
      'Error deleting counter:',
      error
    )
    throw error
  }
}

