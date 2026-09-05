import { supabase } from '../../supabase'

// Helper to calculate seconds elapsed between now and when the patient was called
function getSecondsElapsed(calledAt) {
  if (!calledAt) return 0

  const diff = Date.now() - new Date(calledAt).getTime()
  return Math.floor(diff / 1000)
}

// Helper to map your Supabase database row to the frontend format
function mapQueueItem(row, index = 0) {
  if (!row) return null

  return {
    dbId: row.queue_id,
    id: row.queue_number,
    uniqueKey: `${row.queue_number}-${row.queue_id || index}`,
    service: row.is_priority ? 'Priority' : 'Regular',
    terminal: 'Default',
    status: row.status,
    secondsElapsed: getSecondsElapsed(row.called_at),
    avatarSeed: row.queue_number,
    etaMinutes: 5
  }
}

// --- PATIENT TRACKER ---------------------------------------------------------

export async function fetchTicketStatus(ticketId) {
  try {
    if (!ticketId) {
      return {
        error: 'No ticket ID was provided.'
      }
    }

    // 1. Get the exact ticket using its unique queue_id.
    const { data: ticket, error: ticketError } = await supabase
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
      console.error('Tracker ticket fetch error:', ticketError)

      return {
        error: 'Unable to load your ticket.'
      }
    }

    if (!ticket) {
      return {
        error: 'The ticket could not be found.'
      }
    }

    // 2. Get the department information.
    const { data: department, error: departmentError } = await supabase
      .from('departments')
      .select('department_id, name, prefix, est_time')
      .eq('department_id', ticket.department_id)
      .maybeSingle()

    if (departmentError) {
      console.error('Tracker department fetch error:', departmentError)
    }

    const departmentName = department?.name || 'Hospital Services'

    // 3. Determine the start and end of the ticket's issue date.
    const issuedDate = new Date(ticket.issued_at)

    const startOfDay = new Date(issuedDate)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(issuedDate)
    endOfDay.setHours(23, 59, 59, 999)

    // 4. Get all waiting tickets in the same department and same day.
    const { data: waitingTickets, error: waitingError } = await supabase
      .from('queue_ticket')
      .select(`
        queue_id,
        queue_sequence,
        is_priority,
        issued_at
      `)
      .eq('department_id', ticket.department_id)
      .eq('status', 'waiting')
      .gte('issued_at', startOfDay.toISOString())
      .lte('issued_at', endOfDay.toISOString())
      .order('is_priority', { ascending: false })
      .order('queue_sequence', { ascending: true })

    if (waitingError) {
      console.error('Tracker waiting queue fetch error:', waitingError)
    }

    // 5. Count how many waiting patients are ahead of this ticket.
    let peopleAhead = 0

    if (waitingTickets) {
      const ticketIndex = waitingTickets.findIndex(
        item => item.queue_id === ticket.queue_id
      )

      if (ticketIndex >= 0) {
        peopleAhead = ticketIndex
      } else {
        // The ticket has already been called/served,
        // so there are no waiting patients ahead of it.
        peopleAhead = 0
      }
    }

    // 6. Find the patient currently being served in this department.
    const { data: servingTicket, error: servingError } = await supabase
      .from('queue_ticket')
      .select('queue_number, counter_id, called_at')
      .eq('department_id', ticket.department_id)
      .eq('status', 'serving')
      .gte('issued_at', startOfDay.toISOString())
      .lte('issued_at', endOfDay.toISOString())
      .order('called_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (servingError) {
      console.error('Tracker serving ticket fetch error:', servingError)
    }

    // 7. Determine the estimated waiting time.
    // Temporary baseline for now.
    // AI-assisted prediction can be connected here later.
    const averageServiceMinutes = Number(department?.est_time) || 5

    const estimatedWaitMinutes =
      peopleAhead > 0
        ? peopleAhead * averageServiceMinutes
        : 0

    // 8. Return the information needed by the tracker screens.
    return {
      status: ticket.status || 'waiting',
      queueNumber: ticket.queue_number,
      department: departmentName,
      terminal: ticket.counter_id
        ? `Counter ${ticket.counter_id}`
        : 'Assigned Counter',
      nowServing: servingTicket?.queue_number || '—',
      peopleAhead,
      estimatedWaitMinutes,
      totalAheadAtIssue: Math.max(peopleAhead, 1)
    }
  } catch (error) {
    console.error('Ticket status fetch failed:', error)

    return {
      error: 'Something went wrong while loading your ticket.'
    }
  }
}

// --- QUEUE STATE -------------------------------------------------------------

export async function fetchQueueState(departmentPrefix) {
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

  try {
    // 1. Get Waiting Queue
    // Priority clients come first, then sequence order.
    const { data: waitingData, error: waitingError } = await supabase
      .from('queue_ticket')
      .select('*')
      .eq('status', 'waiting')
      .or(
        `queue_number.ilike.%${departmentPrefix}-%,queue_number.ilike.%${departmentPrefix}%`
      )
      .order('is_priority', { ascending: false })
      .order('queue_sequence', { ascending: true })

    if (waitingError) {
      console.error('Error fetching waiting queue:', waitingError)
    }

    // 2. Get Currently Serving Patient
    const { data: servingData, error: servingError } = await supabase
      .from('queue_ticket')
      .select('*')
      .eq('status', 'serving')
      .ilike('queue_number', `%${departmentPrefix}-%`)
      .order('called_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (servingError) {
      console.error('Error fetching serving patient:', servingError)
    }

    // 3. Get Completed Count
    const { count: completedCount } = await supabase
      .from('queue_ticket')
      .select('*', {
        count: 'exact',
        head: true
      })
      .eq('status', 'completed')
      .ilike('queue_number', `%${departmentPrefix}-%`)

    // 4. Get Skipped Count
    const { count: skippedCount } = await supabase
      .from('queue_ticket')
      .select('*', {
        count: 'exact',
        head: true
      })
      .eq('status', 'skipped')
      .ilike('queue_number', `%${departmentPrefix}-%`)

    return {
      waitingQueue: waitingData
        ? waitingData.map((row, idx) => mapQueueItem(row, idx))
        : [],

      currentlyServing: mapQueueItem(servingData),

      stats: {
        waiting: waitingData?.length || 0,
        currentlyServing: servingData ? 1 : 0,
        completed: completedCount || 0,
        skipped: skippedCount || 0
      }
    }
  } catch (err) {
    console.error('Supabase Fetch Error:', err)

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
}

// --- STAFF QUEUE ACTIONS ----------------------------------------------------

export async function callNextPatient(departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix)
  const nextPatient = state.waitingQueue[0]

  if (nextPatient) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        status: 'serving',
        called_at: new Date().toISOString()
      })
      .eq('queue_id', nextPatient.dbId)

    if (error) {
      console.error('Call next error:', error)
    }
  }

  return fetchQueueState(departmentPrefix)
}

export async function markPatientArrived(departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix)

  if (state.currentlyServing) {
    // queue_ticket does not currently have a service_began_at column,
    // so we only keep the status as serving.
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        status: 'serving'
      })
      .eq('queue_id', state.currentlyServing.dbId)

    if (error) {
      console.error('Mark arrived error:', error)
    }
  }

  return fetchQueueState(departmentPrefix)
}

export async function recallCurrentPatient(departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix)

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        called_at: new Date().toISOString()
      })
      .eq('queue_id', state.currentlyServing.dbId)

    if (error) {
      console.error('Recall error:', error)
    }
  }

  return fetchQueueState(departmentPrefix)
}

export async function completeCurrentPatient(departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix)

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('queue_id', state.currentlyServing.dbId)

    if (error) {
      console.error('Complete error:', error)
    }
  }

  return fetchQueueState(departmentPrefix)
}

export async function skipCurrentPatient(reason, departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix)

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({
        status: 'skipped',
        completed_at: new Date().toISOString(),
        skip_reason: reason
      })
      .eq('queue_id', state.currentlyServing.dbId)

    if (error) {
      console.error('Skip error:', error)
    }
  }

  return fetchQueueState(departmentPrefix)
}

// --- NOTIFICATIONS -----------------------------------------------------------

export async function fetchNotifications(departmentPrefix) {
  return []
}

export async function markAllNotificationsRead(departmentPrefix) {
  return []
}

// --- HISTORY -----------------------------------------------------------------

export async function fetchQueueHistory(
  { search = '', status = 'All Status', range = 'Today' } = {},
  departmentPrefix
) {
  try {
    let query = supabase
      .from('queue_ticket')
      .select('*')
      .order('issued_at', { ascending: false })

    // Filter by department prefix if provided
    if (departmentPrefix) {
      query = query.ilike(
        'queue_number',
        `%${departmentPrefix}-%`
      )
    }

    if (status && status !== 'All Status') {
      const statusMap = {
        Completed: 'completed',
        Skipped: 'skipped',
        Serving: 'serving',
        Waiting: 'waiting'
      }

      if (statusMap[status]) {
        query = query.eq('status', statusMap[status])
      }
    }

    if (search) {
      query = query.ilike(
        'queue_number',
        `%${search}%`
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching history:', error)
      return []
    }

    return data.map(row => ({
      queueNumber: row.queue_number,
      service: row.is_priority ? 'Priority' : 'Regular',
      department: departmentPrefix || 'General',
      terminal: 'Default',
      status:
        row.status.charAt(0).toUpperCase() +
        row.status.slice(1),
      calledAt: row.called_at
        ? new Date(row.called_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })
        : '—',
      completedAt: row.completed_at
        ? new Date(row.completed_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })
        : '—',
      waitingTime: '—',
      skipReason: row.skip_reason || null,
      transactionDate: new Date(
        row.issued_at
      ).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    }))
  } catch (err) {
    console.error('History fetch exception:', err)
    return []
  }
}