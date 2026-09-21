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

export function normalizePosition(position) {
  const value = String(position ?? "")
    .trim()
    .toLowerCase();

  return value === "" ||
    value === "null" ||
    value === "undefined"
    ? null
    : value;
}

export function getUserRole(user) {
  return normalizeRole(user?.role?.role ?? user?.role);
}

export function getUserPosition(user) {
  return normalizePosition(user?.position);
}

// =====================================================
// POSITION TABS
// =====================================================

export function getPositionTabs(user) {
  const rawTabs = user?.position_tabs;

  // Already an array
  if (Array.isArray(rawTabs)) {
    return rawTabs
      .map((tab) =>
        String(tab)
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
  }

  // JSON string from MySQL / Firestore
  if (typeof rawTabs === "string") {
    const trimmed = rawTabs.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed
          .map((tab) =>
            String(tab)
              .trim()
              .toLowerCase()
          )
          .filter(Boolean);
      }
    } catch {
      // Ignore invalid JSON and try comma-separated values below
    }

    return trimmed
      .split(",")
      .map((tab) =>
        tab
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);
  }

  return [];
}

// =====================================================
// TAB ACCESS
// =====================================================

export function hasPositionTab(user, key) {
  const position = getUserPosition(user);

  // ===================================================
  // NO POSITION = FULL ACCESS
  // ===================================================

  if (!position) {
    return true;
  }

  const tabs = getPositionTabs(user);

  const normalizedKey = String(key ?? "")
    .trim()
    .toLowerCase();

  // ===================================================
  // SUPPORT queue / queues NAMING DIFFERENCE
  // ===================================================

  if (normalizedKey === "queues") {
    return (
      tabs.includes("queue") ||
      tabs.includes("queues")
    );
  }

  if (normalizedKey === "queue") {
    return (
      tabs.includes("queue") ||
      tabs.includes("queues")
    );
  }

  return tabs.includes(normalizedKey);
}

// =====================================================
// ACCESS LEVEL
// =====================================================

export function getAccessLevel(user) {
  const role = getUserRole(user);
  const position = getUserPosition(user);

  if (role === "superadmin") {
    return position
      ? "superadmin-position"
      : "superadmin-full";
  }

  if (role === "admin") {
    return position
      ? "admin-position"
      : "admin-full";
  }

  if (role === "staff") {
    return position
      ? "staff-position"
      : "staff-full";
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
  const role = getUserRole(user);

  if (role !== "superadmin") {
    return false;
  }

  return hasPositionTab(user, key);
}

// =====================================================
// ADMIN PAGE ACCESS
// =====================================================

export function canAccessAdminPage(user, key) {
  const role = getUserRole(user);

  if (role !== "admin") {
    return false;
  }

  return hasPositionTab(user, key);
}

// =====================================================
// STAFF PAGE ACCESS
// =====================================================

export function canAccessStaffPage(user, key) {
  const role = getUserRole(user);

  if (role !== "staff") {
    return false;
  }

  return hasPositionTab(user, key);
}