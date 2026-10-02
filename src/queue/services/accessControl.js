
// =====================================================
// ACCESS CONTROL
// =====================================================

export function normalizeRole(role) {
  if (typeof role === "object" && role?.role) {
    role = role.role;
  }

  return String(role ?? "")
    .trim()
    .toLowerCase();
}

export function getUserRole(user) {
  return normalizeRole(
    user?.system_role ??
    user?.role?.role ??
    user?.role
  );
}

// =====================================================
// ROLE PERMISSIONS
// =====================================================

function parsePermissions(rawPermissions) {
  if (Array.isArray(rawPermissions)) {
    return rawPermissions
      .map((permission) =>
        String(permission).trim().toLowerCase()
      )
      .filter(Boolean);
  }

  if (typeof rawPermissions === "string") {
    const trimmed = rawPermissions.trim();

    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsePermissions(parsed);
      }

      if (parsed && typeof parsed === "object") {
        return Object.entries(parsed)
          .filter(([, enabled]) => enabled === true)
          .map(([key]) => key.trim().toLowerCase());
      }
    } catch {
      return trimmed
        .split(",")
        .map((permission) => permission.trim().toLowerCase())
        .filter(Boolean);
    }
  }

  if (rawPermissions && typeof rawPermissions === "object") {
    return Object.entries(rawPermissions)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key.trim().toLowerCase());
  }

  return [];
}

export function getRolePermissions(user) {
  const roleObject =
    user?.role && typeof user.role === "object"
      ? user.role
      : null;

  const rawPermissions =
    roleObject?.permissions ??
    user?.role_permissions ??
    user?.permissions ??
    [];

  return parsePermissions(rawPermissions);
}

// =====================================================
// PERMISSION MAPPING
// =====================================================

const ROLE_PAGE_PERMISSION_MAP = {
  // SUPERADMIN
  superadmin: {
    dashboard: ["dashboard"],
    queues: ["queue_management", "queue", "queues"],
    reports: ["reports_analytics", "reports"],
    users: ["user_management", "users"],
    departments: ["department_management", "departments"],
    kiosks: ["kiosk_management", "kiosks"],
    roles: ["role_management", "roles"],
    positions: ["position_management", "positions"],
    settings: ["settings"],
  },
admin: {
  dashboard: ["dashboard"],
  staff: ["staff_management", "user_management", "staff"],
  queues: ["queue_management", "queue", "queues"],
  terminal: [
    "terminal_management",
    "terminal",
    "kiosk_management",
    "kiosks",
  ],
  reports: ["reports_analytics", "reports"],
  settings: ["settings"],
},

  // STAFF
  staff: {
    today: ["todays_queue", "today_queue", "queue_management"],
    history: ["queue_history", "history"],
    settings: ["settings"],
  },
};

// =====================================================
// TAB ACCESS
// =====================================================

export function hasRolePermission(user, key) {
  const role = getUserRole(user);
  const permissions = getRolePermissions(user);

  const normalizedKey = String(key ?? "")
    .trim()
    .toLowerCase();

  const possiblePermissions =
    ROLE_PAGE_PERMISSION_MAP[role]?.[normalizedKey] ??
    [normalizedKey];

  return possiblePermissions.some(
    (permission) =>
      permissions.includes(permission) ||
      permissions.includes(`${role}:${permission}`)
  );
}

// =====================================================
// ACCESS LEVEL
// =====================================================

export function getAccessLevel(user) {
  const role = getUserRole(user);

  if (["superadmin", "admin", "staff"].includes(role)) {
    return `${role}-role`;
  }

  return "none";
}

// =====================================================
// LANDING PAGE
// =====================================================

export function getLandingPath(user) {
  const role = getUserRole(user);

  switch (role) {
    case "superadmin":
      return "/superadmin/Dashboard";

    case "admin":
      return "/admin";

    case "staff":
      return "/staff";

    default:
      return null;
  }
}

// =====================================================
// SUPERADMIN PAGE ACCESS
// =====================================================

export function canAccessSuperadminPage(user, key) {
  return (
    getUserRole(user) === "superadmin" &&
    hasRolePermission(user, key)
  );
}

function parsePositionTabs(rawTabs) {
  if (Array.isArray(rawTabs)) {
    return rawTabs
      .map((tab) => {
        if (typeof tab === "object" && tab !== null) {
          return tab.key ?? tab.value ?? tab.name ?? tab.label ?? "";
        }

        return tab;
      })
      .map((tab) => String(tab).trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof rawTabs === "string") {
    const trimmed = rawTabs.trim();

    if (!trimmed) return [];

    try {
      return parsePositionTabs(JSON.parse(trimmed));
    } catch {
      return trimmed
        .split(",")
        .map((tab) => tab.trim().toLowerCase())
        .filter(Boolean);
    }
  }

  if (rawTabs && typeof rawTabs === "object") {
    return Object.entries(rawTabs)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key.trim().toLowerCase());
  }

  return [];
}

function hasAssignedPosition(user) {
  return Boolean(
    user?.position_id ||
    user?.position_name ||
    user?.position
  );
}

const ADMIN_TAB_ALIASES = {
  dashboard: ["dashboard"],
  staff: ["staff", "users", "user_management"],
  queues: ["queues", "queue", "queue_management"],
  terminal: ["terminal", "kiosk", "kiosks", "kiosk_management"],
  reports: ["reports", "reports_analytics"],
  settings: ["settings"],
};const STAFF_TAB_ALIASES = {
  today: [
    "todays_queue",
    "today's_queue",
    "today_queue",
    "today",
  ],

  history: [
    "queue_history",
    "history",
  ],

  settings: [
    "settings",
  ],
};
function hasPositionTabAccess(user, pageKey) {
  const tabs = parsePositionTabs(user?.position_tabs);
  const possibleTabs = ADMIN_TAB_ALIASES[pageKey] ?? [pageKey];

  return possibleTabs.some((tab) => tabs.includes(tab));
}
function hasStaffPositionTabAccess(user, pageKey) {
  const tabs = parsePositionTabs(user?.position_tabs);
  const possibleTabs = STAFF_TAB_ALIASES[pageKey] ?? [pageKey];

  return possibleTabs.some((tab) => tabs.includes(tab));
}
// =====================================================
// POSITION TAB ACCESS
// =====================================================

// =====================================================
// ADMIN PAGE ACCESS
// =====================================================

export function canAccessAdminPage(user, key) {
  if (getUserRole(user) !== "admin") {
    return false;
  }

  // Admin without an assigned position has full access.
  if (!hasAssignedPosition(user)) {
    return true;
  }

  // Allow access if the custom role permission or position tab permits it.
  return (
    hasRolePermission(user, key) ||
    hasPositionTabAccess(user, key)
  );
}

// =====================================================
// STAFF PAGE ACCESS
// =====================================================

export function canAccessStaffPage(user, key) {
  if (getUserRole(user) !== "staff") {
    return false;
  }

  // Staff without an assigned position have full staff page access.
  if (!hasAssignedPosition(user)) {
    return true;
  }

  // Check custom role permissions first.
  if (hasRolePermission(user, key)) {
    return true;
  }

  // Fall back to assigned position tabs.
  return hasStaffPositionTabAccess(user, key);
}