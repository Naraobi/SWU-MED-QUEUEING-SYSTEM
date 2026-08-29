// ---------------------------------------------------------------------------
// MOCK DATA LAYER
// ---------------------------------------------------------------------------
// This file stands in for what your Express + PostgreSQL API will eventually
// return. Keep the SHAPE of these objects identical to what you design your
// SQL tables / API responses around, so that swapping services/api.js from
// "mock mode" to "real fetch calls" later requires touching nothing else in
// the UI layer.
// ---------------------------------------------------------------------------

export const mockStaff = {
  staffId: 'STAFF_ID_02',
  name: 'Jhon Paul L. Benolirao',
  department: 'Laboratory',
  terminal: 'Terminal 2',
  password: 'password123', // demo only — never do this in production
}

// Starts empty — no fake patients. Real entries will come from your
// Express + PostgreSQL backend once it's connected.
export const initialWaitingQueue = []

export const initialCurrentlyServing = null

export const initialStats = {
  waiting: 0,
  currentlyServing: 0,
  completed: 0,
  skipped: 0,
}

export const initialQueueHistory = [
  { queueNumber: 'LB-018', service: 'Laboratory', department: 'Laboratory', terminal: 'Terminal 2', status: 'Completed', calledAt: '7:42 AM', completedAt: '7:48 AM', duration: '6 min', waitingTime: '01:10', skipReason: null, staff: 'STAFF_ID_02', transactionDate: 'August 19, 2026' },
  { queueNumber: 'LB-019', service: 'Laboratory', department: 'Laboratory', terminal: 'Terminal 2', status: 'Completed', calledAt: '7:49 AM', completedAt: '7:55 AM', duration: '6 min', waitingTime: '00:58', skipReason: null, staff: 'STAFF_ID_02', transactionDate: 'August 19, 2026' },
  { queueNumber: 'LB-020', service: 'Laboratory', department: 'Laboratory', terminal: 'Terminal 2', status: 'Skipped', calledAt: '7:56 AM', completedAt: null, duration: null, waitingTime: '02:04', skipReason: 'Patient requested cancellation', staff: 'STAFF_ID_02', transactionDate: 'August 19, 2026' },
  { queueNumber: 'LB-021', service: 'Laboratory', department: 'Laboratory', terminal: 'Terminal 2', status: 'Completed', calledAt: '8:01 AM', completedAt: '8:07 AM', duration: '6 min', waitingTime: '01:12', skipReason: null, staff: 'STAFF_ID_02', transactionDate: 'August 19, 2026' },
  { queueNumber: 'LB-022', service: 'Laboratory', department: 'Laboratory', terminal: 'Terminal 2', status: 'Skipped', calledAt: '8:08 AM', completedAt: null, duration: null, waitingTime: '01:32', skipReason: 'Patient did not arrive', staff: 'STAFF_ID_02', transactionDate: 'August 19, 2026' },
]

export const initialNotifications = [
  { id: 'n1', type: 'performance', title: 'Performance Recognition', message: 'Great job! You completed 18 transactions today with an average time of 4.2 minutes.', time: 'Just now', unread: true },
  { id: 'n2', type: 'queue', title: 'Queue Update', message: 'Your department currently has 8 patients waiting.', time: '2h ago', unread: false },
  { id: 'n3', type: 'system', title: 'System Notice', message: 'A system update is scheduled for later today. Please save your work.', time: '4h ago', unread: true },
  { id: 'n4', type: 'urgent', title: 'Urgent Patient Alert', message: 'Dr. Smith requested immediate review of lab results for Room 204.', time: 'Yesterday', unread: false, action: 'View Results' },
]

export const skipReasons = [
  'Patient did not arrive',
  'Patient requested cancellation',
  'Patient was called but unavailable',
  'Other',
]
