const API_URL =
  `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`

// =====================================================
// DEPARTMENT API
// =====================================================

export async function getDepartments() {
  const response = await fetch(
    `${API_URL}/departments`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve departments"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve departments"
    );
  }

  return result.data;
}

export async function getDepartmentById(
  departmentId
) {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/departments/${encodeURIComponent(
      departmentId
    )}`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve department"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve department"
    );
  }

  return result.data;
}

export async function createDepartment(
  department
) {
  if (!department) {
    throw new Error(
      "Department data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/departments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(department),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to create department"
    );
  }

  return result.data;
}

export async function updateDepartment(
  departmentId,
  department
) {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  if (!department) {
    throw new Error(
      "Department data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/departments/${encodeURIComponent(
      departmentId
    )}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(department),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to update department"
    );
  }

  return result.data;
}

export async function deleteDepartment(
  departmentId
) {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/departments/${encodeURIComponent(
      departmentId
    )}`,
    {
      method: "DELETE",
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to delete department"
    );
  }

  return result;
}

// =====================================================
// KIOSK API
// =====================================================

export async function getKiosks() {
  const response = await fetch(
    `${API_URL}/kiosks`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve kiosks"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve kiosks"
    );
  }

  return result.data;
}

export async function getKioskById(
  kioskId
) {
  if (!kioskId) {
    throw new Error(
      "Kiosk ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/kiosks/${encodeURIComponent(
      kioskId
    )}`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve kiosk"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve kiosk"
    );
  }

  return result.data;
}

export async function createKiosk(
  kiosk
) {
  if (!kiosk) {
    throw new Error(
      "Kiosk data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/kiosks`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(kiosk),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to create kiosk"
    );
  }

  return result.data;
}

export async function updateKiosk(
  kioskId,
  kiosk
) {
  if (!kioskId) {
    throw new Error(
      "Kiosk ID is required"
    );
  }

  if (!kiosk) {
    throw new Error(
      "Kiosk data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/kiosks/${encodeURIComponent(
      kioskId
    )}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(kiosk),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to update kiosk"
    );
  }

  return result.data;
}

export async function deleteKiosk(
  kioskId
) {
  if (!kioskId) {
    throw new Error(
      "Kiosk ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/kiosks/${encodeURIComponent(
      kioskId
    )}`,
    {
      method: "DELETE",
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to delete kiosk"
    );
  }

  return result;
}

// =====================================================
// ROLE API
// =====================================================

export async function getRoles() {
  const response = await fetch(
    `${API_URL}/roles`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve roles"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve roles"
    );
  }

  return result.data;
}

export async function getRoleById(
  roleId
) {
  if (!roleId) {
    throw new Error(
      "Role ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/roles/${encodeURIComponent(
      roleId
    )}`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve role"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve role"
    );
  }

  return result.data;
}

// =====================================================
// USER API
// =====================================================

export async function getUsers() {
  const response = await fetch(
    `${API_URL}/users`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve users"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve users"
    );
  }

  return result.data;
}

export async function getUserById(
  userId
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/users/${encodeURIComponent(
      userId
    )}`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve user"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve user"
    );
  }

  return result.data;
}

export async function getUserByEmail(
  email
) {
  if (!email) {
    throw new Error(
      "Email is required"
    );
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  const response = await fetch(
    `${API_URL}/users/by-email/${encodeURIComponent(
      normalizedEmail
    )}`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve user"
    );
  }

  return result.data;
}

export async function createUser(
  user
) {
  if (!user) {
    throw new Error(
      "User data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to create user"
    );
  }

  return result.data;
}

export async function updateUser(
  userId,
  user
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  if (!user) {
    throw new Error(
      "User data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/users/${encodeURIComponent(
      userId
    )}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to update user"
    );
  }

  return result.data;
}

export async function deleteUser(
  userId,
  deletionReason,
  deletedBy = "superadmin"
) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/users/${encodeURIComponent(
      userId
    )}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deletion_reason:
          deletionReason || "",
        deletedBy,
      }),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to delete user"
    );
  }

  return result;
}

// =====================================================
// STAFF BY DEPARTMENT
// =====================================================

export async function getStaffByDepartment(
  departmentId
) {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/users/department/${encodeURIComponent(
      departmentId
    )}`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve department staff"
    );
  }

  return result.data;
}

// =====================================================
// TERMINAL / COUNTER API
// =====================================================
//
// These are terminal/counter records.
//
// They are separate from queue_ticket.
//
// counter table:
//   counter_id
//   department_id
//   counter_number
//   prefix
//   assigned_staff_id
//   status
//
// queue_ticket DOES NOT contain counter_id.
// =====================================================

export async function getTerminals() {
  const response = await fetch(
    `${API_URL}/counters`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve terminals"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve terminals"
    );
  }

  return result.data;
}

export async function getTerminalById(
  terminalId
) {
  if (!terminalId) {
    throw new Error(
      "Terminal ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/counters/${encodeURIComponent(
      terminalId
    )}`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve terminal"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve terminal"
    );
  }

  return result.data;
}

export async function createTerminal(
  terminal
) {
  if (!terminal) {
    throw new Error(
      "Terminal data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/counters`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(terminal),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to create terminal"
    );
  }

  return result.data;
}

export async function updateTerminal(
  terminalId,
  terminal
) {
  if (!terminalId) {
    throw new Error(
      "Terminal ID is required"
    );
  }

  if (!terminal) {
    throw new Error(
      "Terminal data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/counters/${encodeURIComponent(
      terminalId
    )}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(terminal),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to update terminal"
    );
  }

  return result.data;
}

export async function deleteTerminal(
  terminalId
) {
  if (!terminalId) {
    throw new Error(
      "Terminal ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/counters/${encodeURIComponent(
      terminalId
    )}`,
    {
      method: "DELETE",
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to delete terminal"
    );
  }

  return result;
}

// =====================================================
// STAFF TERMINAL SESSION API
// =====================================================

export async function assignTerminal(
  terminalId,
  staffId
) {
  if (!terminalId) {
    throw new Error(
      "Terminal ID is required"
    );
  }

  if (!staffId) {
    throw new Error(
      "Staff ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/counters/${encodeURIComponent(
      terminalId
    )}/assign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staff_id: staffId,
      }),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to assign terminal"
    );
  }

  return result.data;
}

export async function releaseTerminal(
  terminalId,
  staffId
) {
  if (!terminalId) {
    throw new Error(
      "Terminal ID is required"
    );
  }

  if (!staffId) {
    throw new Error(
      "Staff ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/counters/${encodeURIComponent(
      terminalId
    )}/release`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staff_id: staffId,
      }),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to release terminal"
    );
  }

  return result.data;
}

export async function getStaffTerminal(
  staffId
) {
  if (!staffId) {
    throw new Error(
      "Staff ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/counters/staff/${encodeURIComponent(
      staffId
    )}`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve staff terminal"
    );
  }

  return result.data;
}

// =====================================================
// PATIENT API
// =====================================================

export async function getPatientDepartments(
  kioskId
) {
  if (!kioskId) {
    throw new Error(
      "Kiosk ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/patients/departments/${encodeURIComponent(
      kioskId
    )}`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve patient departments"
    );
  }

  return result.data;
}

export async function createPatientQueue(
  queueData
) {
  if (!queueData) {
    throw new Error(
      "Queue data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/patients/queue`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queueData),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to create patient queue"
    );
  }

  return result.data;
}

export async function getQueueTicket(
  queueId
) {
  if (!queueId) {
    throw new Error(
      "Queue ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/patients/queue/${encodeURIComponent(
      queueId
    )}`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve queue ticket"
    );
  }

  return result.data;
}

export async function getWaitingCount(
  departmentId
) {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/patients/waiting-count/${encodeURIComponent(
      departmentId
    )}`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve waiting count"
    );
  }

  return result.data;
}

// =====================================================
// STAFF QUEUE API
// =====================================================

export async function fetchQueueState(
  departmentPrefix
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required"
    );
  }

  const response = await fetch(
    `${API_URL}/staff-queue/state/${encodeURIComponent(
      departmentPrefix
    )}`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve queue state"
    );
  }

  return result.data;
}

export async function callNextPatient(
  departmentPrefix
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required"
    );
  }

  const response = await fetch(
    `${API_URL}/staff-queue/call-next/${encodeURIComponent(
      departmentPrefix
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to call next patient"
    );
  }

  return result.data;
}

export async function startService(
  departmentPrefix
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required"
    );
  }

  const response = await fetch(
    `${API_URL}/staff-queue/start-service/${encodeURIComponent(
      departmentPrefix
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to start service"
    );
  }

  return result.data;
}

export async function markPatientArrived(
  departmentPrefix
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required"
    );
  }

  const response = await fetch(
    `${API_URL}/staff-queue/arrived/${encodeURIComponent(
      departmentPrefix
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to mark patient as arrived"
    );
  }

  return result.data;
}

export async function recallCurrentPatient(
  departmentPrefix
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required"
    );
  }

  const response = await fetch(
    `${API_URL}/staff-queue/recall/${encodeURIComponent(
      departmentPrefix
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to recall patient"
    );
  }

  return result.data;
}

export async function completeCurrentPatient(
  departmentPrefix
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required"
    );
  }

  const response = await fetch(
    `${API_URL}/staff-queue/complete/${encodeURIComponent(
      departmentPrefix
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to complete patient"
    );
  }

  return result.data;
}

export async function skipCurrentPatient(
  departmentPrefix
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required"
    );
  }

  const response = await fetch(
    `${API_URL}/staff-queue/cancel/${encodeURIComponent(
      departmentPrefix
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to cancel patient"
    );
  }

  return result.data;
}

export async function fetchQueueHistory(
  departmentId,
  options = {}
) {
  if (!departmentId) {
    throw new Error(
      "Department ID is required"
    );
  }

  const params =
    new URLSearchParams();

  if (options.search) {
    params.set(
      "search",
      options.search
    );
  }

  if (options.status) {
    params.set(
      "status",
      options.status
    );
  }

  if (options.range) {
    params.set(
      "range",
      options.range
    );
  }

  const queryString =
    params.toString();

  const response = await fetch(
    `${API_URL}/staff-queue/history/${encodeURIComponent(
      departmentId
    )}${
      queryString
        ? `?${queryString}`
        : ""
    }`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve queue history"
    );
  }

  return result.data;
}

export async function fetchNotifications(
  departmentPrefix
) {
  if (!departmentPrefix) {
    return [];
  }

  const response = await fetch(
    `${API_URL}/staff-queue/notifications/${encodeURIComponent(
      departmentPrefix
    )}`
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to retrieve notifications"
    );
  }

  return result.data;
}

export async function markAllNotificationsRead() {
  const response = await fetch(
    `${API_URL}/staff-queue/notifications/read-all`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to update notifications"
    );
  }

  return result.data;
}

// =====================================================
// AUTHENTICATION API
// =====================================================
//
// Firebase Authentication handles:
//   - Email
//   - Password
//   - Authentication session
//
// Node.js / MySQL handles:
//   - Application user profile
//   - Role
//   - Department
//   - Kiosk
//   - Position
//   - Status
//
// Flow:
//
// React
//   ↓
// Firebase Authentication
//   ↓
// Firebase ID Token
//   ↓
// Node.js /api/auth/profile
//   ↓
// MySQL user profile
// =====================================================

// -----------------------------------------------------
// GET CURRENT USER PROFILE
// GET /api/auth/profile
// -----------------------------------------------------

export async function getCurrentUserProfile(
  firebaseUser
) {
  if (!firebaseUser) {
    throw new Error(
      "Firebase user is required"
    );
  }

  try {
    const token =
      await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_URL}/auth/profile`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
      }
    );

    let result;

    try {
      result =
        await response.json();
    } catch {
      throw new Error(
        "The server returned an invalid response."
      );
    }

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          "Failed to retrieve user profile."
      );
    }

    if (!result.data) {
      throw new Error(
        "User profile was not returned by the server."
      );
    }

    return result.data;
  } catch (error) {
    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend server."
      );
    }

    throw error;
  }
}

export async function getDashboardAnalytics(
  firebaseUser,
  startDate,
  endDate
) {
  if (!firebaseUser) {
    throw new Error("Firebase user is required");
  }

  const token = await firebaseUser.getIdToken();

  const params = new URLSearchParams();

  if (startDate) {
    params.set("startDate", startDate);
  }

  if (endDate) {
    params.set("endDate", endDate);
  }

  const queryString = params.toString();

  const response = await fetch(
    `${API_URL}/dashboard/analytics${
      queryString ? `?${queryString}` : ""
    }`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to load dashboard analytics."
    );
  }

  return result.data;
}

export async function getReportsAnalytics(firebaseUser, startDate, endDate) {
  if (!firebaseUser) {
    throw new Error("Firebase user is required");
  }

  const token = await firebaseUser.getIdToken();

  const params = new URLSearchParams();

  if (startDate) {
    params.set("startDate", startDate);
  }

  if (endDate) {
    params.set("endDate", endDate);
  }

  const queryString = params.toString();

  const response = await fetch(
    `${API_URL}/dashboard/analytics${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to load reports analytics."
    );
  }

  return result.data;
}
// -----------------------------------------------------
// MARK PASSWORD AS CHANGED
// POST /api/auth/password-changed
// -----------------------------------------------------
//
// Firebase changes the actual password first.
//
// This function then tells Node.js to update:
//   must_change_password = 0
//   password_changed_at = current timestamp
//
// The Firebase ID token identifies the user.
// The frontend does NOT send a user ID.
// -----------------------------------------------------

export async function markPasswordChanged(
  firebaseUser
) {
  if (!firebaseUser) {
    throw new Error(
      "Firebase user is required"
    );
  }

  try {
    const token =
      await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_URL}/auth/password-changed`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
      }
    );

    let result;

    try {
      result =
        await response.json();
    } catch {
      throw new Error(
        "The server returned an invalid response."
      );
    }

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          "Failed to update password status."
      );
    }

    return result.data;
  } catch (error) {
    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend server."
      );
    }

    throw error;
  }
}

// -----------------------------------------------------
// LEGACY LOGIN
// POST /api/auth/login
// -----------------------------------------------------

export async function loginUser(
  email,
  password
) {
  if (!email) {
    throw new Error(
      "Email is required"
    );
  }

  if (!password) {
    throw new Error(
      "Password is required"
    );
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  const response = await fetch(
    `${API_URL}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
      }),
    }
  );

  const result =
    await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Login failed."
    );
  }

  return result.data;
}

// =====================================================
// KIOSK PIN API
// =====================================================

export async function verifyKioskPin(
  kioskId,
  pin
) {
  const response = await fetch(
    `${API_URL}/kiosks/${kioskId}/verify-pin`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        pin,
      }),
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Unable to verify kiosk PIN."
    );
  }

  return data;
}

// =====================================================
// SECURITY PIN API
// =====================================================

// -----------------------------------------------------
// GET SECURITY PIN STATUS
// GET /api/security/pin/status
// -----------------------------------------------------

export async function getSecurityPinStatus(
  firebaseUser
) {
  if (!firebaseUser) {
    throw new Error(
      "Firebase user is required"
    );
  }

  try {
    const token =
      await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_URL}/security/pin/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
      }
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          "Failed to retrieve Security PIN status."
      );
    }

    return result;
  } catch (error) {
    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend server."
      );
    }

    throw error;
  }
}

// -----------------------------------------------------
// REQUEST SECURITY PIN VERIFICATION CODE
// POST /api/security/pin/request
// -----------------------------------------------------

export async function requestSecurityPinVerification(
  firebaseUser
) {
  if (!firebaseUser) {
    throw new Error(
      "Firebase user is required"
    );
  }

  try {
    const token =
      await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_URL}/security/pin/request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
      }
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          "Failed to send the verification code."
      );
    }

    return result;
  } catch (error) {
    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend server."
      );
    }

    throw error;
  }
}

// -----------------------------------------------------
// VERIFY EMAIL CODE AND SAVE SECURITY PIN
// POST /api/security/pin/verify
// -----------------------------------------------------

export async function verifySecurityPinCode(
  firebaseUser,
  code,
  pin
) {
  if (!firebaseUser) {
    throw new Error(
      "Firebase user is required"
    );
  }

  try {
    const token =
      await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_URL}/security/pin/verify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          code,
          pin,
        }),
      }
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      const error =
        new Error(
          result.message ||
            "Failed to verify the Security PIN."
        );

      error.attemptsRemaining =
        result.attemptsRemaining;

      throw error;
    }

    return result;
  } catch (error) {
    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend server."
      );
    }

    throw error;
  }
}

// -----------------------------------------------------
// VALIDATE SECURITY PIN
// POST /api/security/pin/validate
// -----------------------------------------------------

export async function validateSecurityPin(
  firebaseUser,
  pin
) {
  if (!firebaseUser) {
    throw new Error(
      "Firebase user is required"
    );
  }

  try {
    const token =
      await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_URL}/security/pin/validate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          pin,
        }),
      }
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          "Invalid Security PIN."
      );
    }

    return result;
  } catch (error) {
    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend server."
      );
    }

    throw error;
  }
}

// =====================================================
// CHANGE PASSWORD WIZARD API
// =====================================================

// -----------------------------------------------------
// REQUEST CHANGE PASSWORD VERIFICATION CODE
// POST /api/auth/change-password/request
// -----------------------------------------------------

export async function requestPasswordChangeCode(
  firebaseUser
) {
  if (!firebaseUser) {
    throw new Error(
      "Firebase user is required"
    );
  }

  try {
    const token =
      await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_URL}/auth/change-password/request`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
      }
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
          "Failed to send the verification code."
      );
    }

    return result;
  } catch (error) {
    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend server."
      );
    }

    throw error;
  }
}

// -----------------------------------------------------
// VERIFY EMAIL CODE AND CHANGE PASSWORD
// POST /api/auth/change-password/verify
// -----------------------------------------------------

export async function verifyPasswordChangeCode(
  firebaseUser,
  code,
  newPassword
) {
  if (!firebaseUser) {
    throw new Error(
      "Firebase user is required"
    );
  }

  try {
    const token =
      await firebaseUser.getIdToken();

    const response = await fetch(
      `${API_URL}/auth/change-password/verify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          code,
          newPassword,
        }),
      }
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      const error =
        new Error(
          result.message ||
            "Failed to change your password."
        );

      error.attemptsRemaining =
        result.attemptsRemaining;

      throw error;
    }

    return result;
  } catch (error) {
    if (
      error instanceof TypeError
    ) {
      throw new Error(
        "Unable to connect to the backend server."
      );
    }

    throw error;
  }
}

// =====================================================
// BACKEND / DATABASE TEST
// =====================================================

export async function testBackend() {
  const response = await fetch(
    `${API_URL}/test`
  );

  if (!response.ok) {
    throw new Error(
      "Backend request failed"
    );
  }

  return response.json();
}

export async function getDatabaseStatus() {
  const response = await fetch(
    `${API_URL}/database/status`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve database status"
    );
  }

  return response.json();
}
// =====================================================
// POSITION API
// =====================================================
//
// Append this block to src/queue/services/backendApi.js.
// It follows the same shape as the DEPARTMENT API above:
// fetch -> { success, data, message } -> return result.data
//
// Server routes still to be created:
//   GET    /api/positions
//   POST   /api/positions
//   PUT    /api/positions/:positionId
//   DELETE /api/positions/:positionId
//
// Expected position row:
//   {
//     position_id, name, status,          // 'Active' | 'Inactive'
//     tabs: ['dashboard', 'queue', ...],  // sidebar keys this position can see
//     users,                              // assigned user count (server-computed)
//     updated_at
//   }

export async function getPositions() {
  const response = await fetch(
    `${API_URL}/positions`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to retrieve positions"
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      result.message ||
        "Failed to retrieve positions"
    );
  }

  return result.data;
}

export async function createPosition(
  position
) {
  if (!position) {
    throw new Error(
      "Position data is required"
    );
  }

  const response = await fetch(
    `${API_URL}/positions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(position),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to create position"
    );
  }

  return result.data;
}

export async function updatePosition(
  positionId,
  position
) {
  if (!positionId) {
    throw new Error(
      "Position ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/positions/${encodeURIComponent(
      positionId
    )}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(position),
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to update position"
    );
  }

  return result.data;
}

export async function deletePosition(
  positionId
) {
  if (!positionId) {
    throw new Error(
      "Position ID is required"
    );
  }

  const response = await fetch(
    `${API_URL}/positions/${encodeURIComponent(
      positionId
    )}`,
    {
      method: "DELETE",
    }
  );

  const result = await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.message ||
        "Failed to delete position"
    );
  }

  return result.data;
}