
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
  return normalizeRole(user?.role?.role ?? user?.role);
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

const PAGE_PERMISSION_MAP = {
  dashboard: ["dashboard"],
  users: ["user_management", "users"],
  departments: ["department_management", "departments"],
  kiosks: ["kiosk_management", "kiosks"],
  roles: ["role_management", "roles"],
  positions: ["position_management", "positions"],
  queues: ["queue_management", "queue", "queues"],
  reports: ["reports_analytics", "reports"],
  settings: ["settings"],
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
    PAGE_PERMISSION_MAP[normalizedKey] ?? [normalizedKey];

  return possiblePermissions.some((permission) =>
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

// =====================================================
// ADMIN PAGE ACCESS
// =====================================================

export function canAccessAdminPage(user, key) {
  return (
    getUserRole(user) === "admin" &&
    hasRolePermission(user, key)
  );
}

// =====================================================
// STAFF PAGE ACCESS
// =====================================================

export function canAccessStaffPage(user, key) {
  return (
    getUserRole(user) === "staff" &&
    hasRolePermission(user, key)
  );
}