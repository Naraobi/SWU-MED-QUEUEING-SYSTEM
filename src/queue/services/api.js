import { supabase } from '../../supabase' // Make sure this path points to your supabase.js file!

// Helper to calculate seconds elapsed between now and when the patient was called
function getSecondsElapsed(calledAt) {
  if (!calledAt) return 0;
  const diff = Date.now() - new Date(calledAt).getTime();
  return Math.floor(diff / 1000);
}

// Helper to map your Supabase database row to the frontend format
function mapQueueItem(row, index = 0) {
  if (!row) return null;
  return {
    dbId: row.queue_id,
    id: row.queue_number,
    uniqueKey: `${row.queue_number}-${row.queue_id || index}`, // Prevents React key crashes
    service: row.is_priority ? 'Priority' : 'Regular',
    terminal: 'Default', 
    status: row.status,
    secondsElapsed: getSecondsElapsed(row.called_at),
    avatarSeed: row.queue_number,
    etaMinutes: 5 
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
  return [];
}

export async function markAllNotificationsRead(departmentPrefix) {
  return [];
}

// --- HISTORY -----------------------------------------------------------------
export async function fetchQueueHistory({ search = '', status = 'All Status', range = 'Today' } = {}, departmentPrefix) {
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
      completedAt: row.completed_at ? new Date(row.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—',
      waitingTime: '—',
      skipReason: row.skip_reason || null, // Fetches the saved reason for the modal!
      transactionDate: new Date(row.issued_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    }));
  } catch (err) {
    console.error("History fetch exception:", err);
    return [];
  }
}