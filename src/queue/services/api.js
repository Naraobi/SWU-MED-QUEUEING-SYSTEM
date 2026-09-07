import { supabase } from '../../supabase'

const demoQueue = [
  { queue_id: 'demo-1', queue_number: 'P-BP-022', is_priority: true, status: 'waiting', issued_at: new Date().toISOString() },
  ...Array.from({ length: 7 }, (_, index) => ({
    queue_id: `demo-${index + 2}`,
    queue_number: `BP-${String(index + 23).padStart(3, '0')}`,
    is_priority: false,
    status: 'waiting',
    issued_at: new Date().toISOString(),
  })),
]

const demoNextPatient = { queue_id: 'demo-next', queue_number: 'P-BP-021', is_priority: true, status: 'waiting', issued_at: new Date().toISOString() }

const demoHistory = [
  { queue_number: 'P-BP-018', is_priority: false, status: 'completed', called_at: '2026-09-04T07:42:00', completed_at: '2026-09-04T07:48:00', issued_at: '2026-09-04T07:30:00' },
  { queue_number: 'BP-019', is_priority: false, status: 'completed', called_at: '2026-09-04T07:49:00', completed_at: '2026-09-04T07:55:00', issued_at: '2026-09-04T07:35:00' },
  { queue_number: 'BP-020', is_priority: false, status: 'skipped', called_at: '2026-09-04T07:56:00', completed_at: '2026-09-04T07:58:00', issued_at: '2026-09-04T07:40:00', skip_reason: 'Patient did not arrive' },
]

const demoNotifications = [
  { id: 'demo-1', type: 'performance', title: 'Performance Recognition', message: 'Great job! You completed 18 transactions today with an average time of 4.2 minutes.', time: 'Just now', unread: true },
  { id: 'demo-2', type: 'queue', title: 'Queue Update', message: 'Your department currently has 8 patients waiting.', time: '2m ago', unread: true },
  { id: 'demo-3', type: 'system', title: 'System Notice', message: 'A system update is scheduled for later today. Please save your work.', time: '4h ago', unread: false },
]

// Used for Staff Management when Supabase isn't configured, so that page
// still works during local/demo development instead of throwing.
const DEMO_ROLES = [
  { id: 'demo-role-super', name: 'Super admin' },
  { id: 'demo-role-dept', name: 'Dept Admin' },
  { id: 'demo-role-staff', name: 'Staff' },
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
    roles: { id: 'demo-role-staff', name: 'Staff' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-user-2',
    auth_user_id: null,
    first_name: 'John',
    last_name: 'Doe',
    email: 'admin.demo@swu.local',
    status: 'Active',
    role_id: 'demo-role-super',
    roles: { id: 'demo-role-super', name: 'Super admin' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

// Helper to calculate seconds elapsed between now and when the patient was called
function getSecondsElapsed(calledAt) {
  if (!calledAt) return 0;
  const diff = Date.now() - new Date(calledAt).getTime();
  return Math.floor(diff / 1000);
}

// Helper to format the minutes between when a patient started being served
// (service_began_at, falling back to called_at) and when they were
// completed, as "MM:SS" for display in Queue History.
function getServiceDuration(startedAtIso, completedAtIso) {
  if (!startedAtIso || !completedAtIso) return null;
  const startMs = new Date(startedAtIso).getTime();
  const endMs = new Date(completedAtIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  const totalSeconds = Math.floor((endMs - startMs) / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Helper to map your Supabase database row to the frontend format
function mapQueueItem(row, index = 0) {
  if (!row) return null;
  return {
    dbId: row.queue_id,
    id: row.queue_number,
    uniqueKey: `${row.queue_number}-${row.queue_id || index}`, // Prevents React key crashes
    service: row.service || (row.is_priority ? 'Priority' : 'Regular'),
    terminal: row.terminal || 'Default', 
    status: row.status,
    secondsElapsed: getSecondsElapsed(row.called_at),
    avatarSeed: row.queue_number,
    etaMinutes: row.etaMinutes || 5 
  }
}

// --- QUEUE STATE -------------------------------------------------------------

export async function fetchTicketStatus(ticketNumber = 'LB-021') {
  const fallback = {
    status: 'waiting',
    queueNumber: ticketNumber || 'LB-021',
    department: 'Laboratory',
    terminal: 'Counter 3',
    nowServing: 'LB-018',
    peopleAhead: 4,
    estimatedWaitMinutes: 12,
    totalAheadAtIssue: 5,
  }

  try {
    const normalized = (ticketNumber || 'LB-021').toString().trim().toUpperCase()

    const { data, error } = await supabase
      .from('queue_ticket')
      .select('*')
      .ilike('queue_number', `%${normalized}%`)
      .order('issued_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Tracker fetch error:', error)
      return fallback
    }

    if (!data) return fallback

    const peopleAhead = Number(data.people_ahead ?? data.peopleAhead ?? 0)

    return {
      status: data.status || 'waiting',
      queueNumber: data.queue_number || normalized,
      department: data.department || 'Laboratory',
      terminal: data.terminal || 'Counter 3',
      nowServing: data.now_serving || data.nowServing || 'LB-018',
      peopleAhead: peopleAhead,
      estimatedWaitMinutes: Number(data.estimated_wait_minutes ?? data.estimatedWaitMinutes ?? 12),
      totalAheadAtIssue: Number(data.total_ahead_at_issue ?? data.totalAheadAtIssue ?? Math.max(peopleAhead + 1, 1)),
    }
  } catch (error) {
    console.error('Ticket status fetch failed:', error)
    return fallback
  }
}

export async function fetchQueueState(departmentPrefix) {
  if (!departmentPrefix) {
    return { waitingQueue: [], currentlyServing: null, stats: { waiting: 0, completed: 0, skipped: 0 } };
  }

  if (!supabase) return getDemoQueueState()

  try {
    // 1. Get Waiting Queue
// 1. Get Waiting Queue sorted by Priority first, then sequence number
    const { data: waitingData, error: waitingError } = await supabase
      .from('queue_ticket')
      .select('*')
      .eq('status', 'waiting')
      .or(`queue_number.ilike.%${departmentPrefix}-%,queue_number.ilike.%${departmentPrefix}%`)
      .order('is_priority', { ascending: false }) // <--- Priority clients come first!
      .order('queue_sequence', { ascending: true }); // <--- Then regular sequence order

    if (waitingError) console.error("Error fetching waiting queue:", waitingError);

    // 2. Get Currently Serving Patient (Checking both 'serving' and 'called' states)
  // 2. Get Currently Serving Patient
    const { data: servingData, error: servingError } = await supabase
      .from('queue_ticket')
      .select('*')
      .eq('status', 'serving') // <--- CHANGED FROM .in('status', ['called', 'serving'])
      .ilike('queue_number', `%${departmentPrefix}-%`)
      .order('called_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (servingError) console.error("Error fetching serving patient:", servingError);

    // 3. Get Stats: Completed Count
    const { count: completedCount } = await supabase
      .from('queue_ticket')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .ilike('queue_number', `%${departmentPrefix}-%`);

    // 4. Get Stats: Skipped Count (Updated from 'cancelled' to 'skipped')
    const { count: skippedCount } = await supabase
      .from('queue_ticket')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'skipped') 
      .ilike('queue_number', `%${departmentPrefix}-%`);

    return {
      waitingQueue: waitingData ? waitingData.map((row, idx) => mapQueueItem(row, idx)) : [],
      currentlyServing: mapQueueItem(servingData),
      stats: {
        waiting: waitingData?.length || 0,
        currentlyServing: servingData ? 1 : 0,
        completed: completedCount || 0,
        skipped: skippedCount || 0, 
      }
    }
  } catch (err) {
    console.error("Supabase Fetch Error:", err);
    return { waitingQueue: [], currentlyServing: null, stats: { waiting: 0, completed: 0, skipped: 0 } };
  }
}

export async function callNextPatient(departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix);
  const nextPatient = state.waitingQueue[0];

  if (!supabase) {
    demoNextPatient.status = 'serving'
    demoNextPatient.called_at = new Date().toISOString()
    return { ...getDemoQueueState(), currentlyServing: mapQueueItem(demoNextPatient) }
  }

  if (nextPatient) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({ 
        status: 'serving', // <--- CHANGED THIS FROM 'called' TO 'serving'
        called_at: new Date().toISOString()
      })
      .eq('queue_id', nextPatient.dbId);
      
    if (error) console.error("Call next error:", error);
  }
  
  return fetchQueueState(departmentPrefix);
}

export async function markPatientArrived(departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix);

  if (!supabase) return state

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({ 
        status: 'serving', 
        service_began_at: new Date().toISOString() 
      })
      .eq('queue_id', state.currentlyServing.dbId);
      
    if (error) console.error("Mark arrived error:", error);
  }
  return fetchQueueState(departmentPrefix);
}

export async function recallCurrentPatient(departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix);

  if (!supabase) return state

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({ called_at: new Date().toISOString() })
      .eq('queue_id', state.currentlyServing.dbId);
      
    if (error) console.error("Recall error:", error);
  }
  return fetchQueueState(departmentPrefix);
}

export async function completeCurrentPatient(departmentPrefix) {
  const state = await fetchQueueState(departmentPrefix);

  if (!supabase) {
    demoNextPatient.status = 'completed'
    return getDemoQueueState()
  }

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('queue_id', state.currentlyServing.dbId);
      
    if (error) console.error("Complete error:", error);
  }
  return fetchQueueState(departmentPrefix);
}

export async function skipCurrentPatient(reason, departmentPrefix) {
  // Get the current state to find who is currently being served
  const state = await fetchQueueState(departmentPrefix);

  if (!supabase) {
    demoNextPatient.status = 'skipped'
    demoNextPatient.skip_reason = reason
    return getDemoQueueState()
  }

  if (state.currentlyServing) {
    const { error } = await supabase
      .from('queue_ticket')
      .update({ 
        status: 'skipped', 
        completed_at: new Date().toISOString(),
        skip_reason: reason // Saves the text reason from the modal into Supabase
      })
      .eq('queue_id', state.currentlyServing.dbId); // Targets the exact active patient
      
    if (error) {
      console.error("Skip error:", error);
    }
  }
  
  return fetchQueueState(departmentPrefix);
}

// --- NOTIFICATIONS -------------------------------------------------------------
export async function fetchNotifications(departmentPrefix) {
  return supabase ? [] : demoNotifications;
}

export async function markAllNotificationsRead(departmentPrefix) {
  return [];
}

// --- HISTORY -----------------------------------------------------------------
export async function fetchQueueHistory({ search = '', status = 'All Status', range = 'Today' } = {}, departmentPrefix) {
  if (!supabase) {
    return demoHistory
      .filter((row) => !search || row.queue_number.includes(search.toUpperCase()))
      .filter((row) => status === 'All Status' || row.status === status.toLowerCase())
      .map((row) => ({
        queueNumber: row.queue_number,
        service: row.is_priority ? 'Priority' : 'Billing / Payment',
        department: 'Billing Department',
        terminal: 'Terminal 2',
        status: row.status.charAt(0).toUpperCase() + row.status.slice(1),
        calledAt: new Date(row.called_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        startedAt: row.service_began_at
          ? new Date(row.service_began_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '—',
        completedAt: new Date(row.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        duration: getServiceDuration(row.service_began_at || row.called_at, row.completed_at) || '—',
        waitingTime: '—',
        skipReason: row.skip_reason || null,
        transactionDate: new Date(row.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      }))
  }

  try {
    let query = supabase
      .from('queue_ticket')
      .select('*')
      .order('issued_at', { ascending: false });

    // Filter by department prefix if provided
    if (departmentPrefix) {
      query = query.ilike('queue_number', `%${departmentPrefix}-%`);
    }

    if (status && status !== 'All Status') {
      // Map frontend status labels to database enum values
      const statusMap = {
        'Completed': 'completed',
        'Skipped': 'skipped', // Updated to match your new enum
        'Serving': 'serving',
        'Waiting': 'waiting'
      };
      if (statusMap[status]) {
        query = query.eq('status', statusMap[status]);
      }
    }

    if (search) {
      query = query.ilike('queue_number', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching history:", error);
      return [];
    }

    // Map rows to match your history table UI expectations
    return data.map(row => ({
      queueNumber: row.queue_number,
      service: row.is_priority ? 'Priority' : 'Regular',
      department: departmentPrefix || 'General',
      terminal: 'Default',
      status: row.status.charAt(0).toUpperCase() + row.status.slice(1),
      calledAt: row.called_at ? new Date(row.called_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—',
      startedAt: row.service_began_at ? new Date(row.service_began_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—',
      completedAt: row.completed_at ? new Date(row.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—',
      duration: getServiceDuration(row.service_began_at || row.called_at, row.completed_at) || '—',
      waitingTime: '—',
      skipReason: row.skip_reason || null, // Fetches the saved reason for the modal!
      transactionDate: new Date(row.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    }));
  } catch (err) {
    console.error("History fetch exception:", err);
    return [];
  }
}

function getDemoQueueState() {
  const waiting = demoQueue.filter((row) => row.status === 'waiting')
  const serving = demoQueue.find((row) => row.status === 'serving') || (demoNextPatient.status === 'serving' ? demoNextPatient : null)
  return {
    waitingQueue: waiting.map((row, index) => mapQueueItem({ ...row, etaMinutes: 8 + index * 4 }, index)),
    currentlyServing: mapQueueItem(serving),
    stats: { waiting: waiting.length, currentlyServing: serving ? 1 : 0, completed: 12, skipped: 1 },
  }
}

// --- USER MANAGEMENT (Staff Management page) ---------------------------------
// Matches columns: id, auth_user_id, role_id, first_name, last_name, email,
// status, created_at, updated_at, with role_id FK -> roles (id, name) per the
// backend reference doc. Adjust USERS_TABLE/ROLES_TABLE or the select below
// if your actual table/column names differ.
const USERS_TABLE = 'user'
const ROLES_TABLE = 'roles'

export async function fetchUsers() {
  if (!supabase) return demoUsers

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(`
      id,
      auth_user_id,
      first_name,
      last_name,
      email,
      status,
      created_at,
      updated_at,
      role_id,
      roles ( id, name )
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchRoles() {
  if (!supabase) return DEMO_ROLES

  const { data, error } = await supabase.from(ROLES_TABLE).select('id, name')
  if (error) throw error
  return data
}

export async function createUser(payload) {
  if (!supabase) {
    const created = {
      id: `demo-user-${Date.now()}`,
      auth_user_id: null,
      status: 'Active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...payload,
      roles: DEMO_ROLES.find((r) => r.id === payload.role_id) || null,
    }
    demoUsers = [created, ...demoUsers]
    return created
  }

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .insert([{ status: 'Active', ...payload }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateUser(id, payload) {
  if (!supabase) {
    let updated = null
    demoUsers = demoUsers.map((row) => {
      if (row.id !== id) return row
      updated = { ...row, ...payload, updated_at: new Date().toISOString() }
      return updated
    })
    return updated
  }

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteUser(id) {
  if (!supabase) {
    demoUsers = demoUsers.filter((row) => row.id !== id)
    return
  }

  const { error } = await supabase.from(USERS_TABLE).delete().eq('id', id)
  if (error) throw error
}

// --- DEPARTMENTS (Settings > Department Customization) -----------------------
const DEPARTMENTS_TABLE = 'departments'

export async function fetchDepartmentByName(name) {
  if (!name) return null
  if (!supabase) return { id: 'demo-department', name }

  const { data, error } = await supabase
    .from(DEPARTMENTS_TABLE)
    .select('id, name')
    .eq('name', name)
    .maybeSingle()

  if (error) {
    console.error('Error fetching department:', error)
    return null
  }
  return data
}

// --- COUNTERS (Admin > Queue Management > Assigned Terminal) -----------------
const COUNTERS_TABLE = 'counters'

export async function fetchCounters(departmentId) {
  if (!departmentId || !supabase) return []

  const { data, error } = await supabase
    .from(COUNTERS_TABLE)
    .select(`
      id,
      counter_number,
      prefix,
      status,
      assigned_staff_id,
      assigned:assigned_staff_id ( user_id, first_name, last_name, email )
    `)
    .eq('department_id', departmentId)
    .order('counter_number', { ascending: true })

  if (error) {
    console.error('Error fetching counters:', error)
    return []
  }
  return data
}

export async function fetchStaffForDepartment(departmentName) {
  if (!departmentName || !supabase) return []

  const { data, error } = await supabase
    .from('user')
    .select('user_id, first_name, last_name, email')
    .eq('department', departmentName)
    .order('first_name', { ascending: true })

  if (error) {
    console.error('Error fetching department staff:', error)
    return []
  }
  return data
}

export async function createCounter({ departmentId, counterNumber, prefix, assignedStaffId }) {
  const { data, error } = await supabase
    .from(COUNTERS_TABLE)
    .insert([{
      department_id: departmentId,
      counter_number: counterNumber,
      prefix: prefix || null,
      assigned_staff_id: assignedStaffId || null,
      status: 'offline',
    }])
    .select(`
      id,
      counter_number,
      prefix,
      status,
      assigned_staff_id,
      assigned:assigned_staff_id ( user_id, first_name, last_name, email )
    `)
    .single()

  if (error) throw error
  return data
}

export async function updateCounter(id, payload) {
  const { data, error } = await supabase
    .from(COUNTERS_TABLE)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      id,
      counter_number,
      prefix,
      status,
      assigned_staff_id,
      assigned:assigned_staff_id ( user_id, first_name, last_name, email )
    `)
    .single()

  if (error) throw error
  return data
}

export async function deleteCounter(id) {
  const { error } = await supabase.from(COUNTERS_TABLE).delete().eq('id', id)
  if (error) throw error
}

export async function updateDepartmentName(id, name) {
  if (!supabase) return { id, name }

  const { data, error } = await supabase
    .from(DEPARTMENTS_TABLE)
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name')
    .single()

  if (error) throw error
  return data
}