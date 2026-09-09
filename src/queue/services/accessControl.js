// src/services/accessControl.js

const RESTRICTED_POSITIONS = new Set(['president', 'vice president', 'manager']);

export function normalizeRole(role) {
  if (typeof role === 'object' && role?.role) role = role.role;
  return String(role ?? '').trim().toLowerCase();
}

export function normalizePosition(position) {
  const value = String(position ?? '').trim().toLowerCase();
  return value === '' || value === 'null' ? null : value;
}

export function getUserRole(user) {
  return normalizeRole(user?.role?.role ?? user?.role);
}

export function getUserPosition(user) {
  return normalizePosition(user?.position);
}

export function isRestrictedPosition(position) {
  return RESTRICTED_POSITIONS.has(normalizePosition(position));
}

export function getAccessLevel(user) {
  const role = getUserRole(user);
  const position = getUserPosition(user);
  const restricted = isRestrictedPosition(position);

  if (role === 'superadmin') return restricted ? 'superadmin-restricted' : 'superadmin-full';
  if (role === 'admin') return restricted ? 'admin-restricted' : 'admin-full';
  if (role === 'staff') return restricted ? 'staff-restricted' : 'staff-full';
  return 'none';
}

export function getLandingPath(user) {
  switch (getAccessLevel(user)) {
    case 'superadmin-full':
    case 'superadmin-restricted':
      return '/superadmin/Dashboard';
    case 'admin-full':
    case 'admin-restricted':
      return '/admin';
    case 'staff-full':
      return '/staff';
    case 'staff-restricted':
      return '/staff/history';
    default:
      return null;
  }
}

export function canAccessSuperadminPage(user, key) {
  const access = getAccessLevel(user);
  if (access === 'superadmin-full') return true;
  return access === 'superadmin-restricted' && ['dashboard', 'reports'].includes(key);
}

export function canAccessAdminPage(user, key) {
  const access = getAccessLevel(user);
  if (access === 'admin-full') return true;
  return access === 'admin-restricted' && ['dashboard', 'reports'].includes(key);
}

export function canAccessStaffPage(user, key) {
  const access = getAccessLevel(user);
  if (access === 'staff-full') return true;
  return access === 'staff-restricted' && key === 'history';
}
