// Staff terminal customization is a TEMPORARY, per-session override.
//
// The staff's own picks (theme, accent, language, logo) live under the
// swumed_staff_* keys, which StaffPreferencesContext already reads and
// writes. This module only decides WHEN those picks are valid:
//
//  - Every override is stamped with the staff member who made it (kept in
//    sessionStorage, so it also dies when the tab closes). A different staff
//    member, or a brand-new session, never inherits it.
//  - clearStaffOverride() wipes it on any session end, and tells a mounted
//    Staff UI to fall back to the defaults immediately.
//
// The defaults are what the Admin saved in Settings (swumed_admin_*, the same
// browser storage the Admin page writes), or the built-in values when none.

const OVERRIDE_KEYS = [
  'swumed_staff_theme',
  'swumed_staff_accent',
  'swumed_staff_language',
  'swumed_staff_logo',
];

const OWNER_KEY = 'swumed_staff_override_owner';

export const STAFF_OVERRIDE_CLEARED_EVENT = 'swumed-staff-override-cleared';

const BUILT_IN_DEFAULTS = {
  theme: 'light',
  accent: '#9D0A0E',
  language: 'English',
};

function readLocal(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

// What a staff terminal shows when the staff has not customized anything.
export function getDefaultStaffAppearance() {
  return {
    theme: readLocal('swumed_admin_theme') || BUILT_IN_DEFAULTS.theme,
    accent: readLocal('swumed_admin_accent') || BUILT_IN_DEFAULTS.accent,
    language: readLocal('swumed_admin_language') || BUILT_IN_DEFAULTS.language,
  };
}

function removeOverrideKeys() {
  OVERRIDE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage issues in private mode or restricted browsers.
    }
  });

  try {
    sessionStorage.removeItem(OWNER_KEY);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

// Session end (logout, timeout, revoked token): forget the override and
// reset any mounted Staff UI to the defaults without a refresh.
export function clearStaffOverride() {
  removeOverrideKeys();

  try {
    window.dispatchEvent(new Event(STAFF_OVERRIDE_CLEARED_EVENT));
  } catch {
    // Non-browser environment: nothing is listening anyway.
  }
}

// Record that the stored override belongs to this staff member.
export function markStaffOverrideOwner(staffId) {
  if (staffId === null || staffId === undefined) return;

  try {
    sessionStorage.setItem(OWNER_KEY, String(staffId));
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

// Run before the stored override is read. A refresh by the same staff keeps
// it (same tab, same owner); anything else starts from the defaults.
export function reconcileStaffOverride(staffId) {
  if (staffId === null || staffId === undefined) return;

  let owner;

  try {
    owner = sessionStorage.getItem(OWNER_KEY);
  } catch {
    owner = null;
  }

  if (owner !== String(staffId)) {
    removeOverrideKeys();
  }
}
