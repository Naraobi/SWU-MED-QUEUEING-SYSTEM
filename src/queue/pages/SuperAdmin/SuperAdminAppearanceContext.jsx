import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  applyAccentColor,
  applyThemeMode,
  getAccentColor,
  getLogo,
  getThemeMode,
} from '../../services/appearance';

// =====================================================
// SUPER ADMIN APPEARANCE PROVIDER
// =====================================================
//
// Theme, accent, logo, system name and clock format for the Super Admin
// screens only. It follows the Admin's AppearanceContext pattern but keeps
// its own storage (swumed_superadmin_*), so nothing here reads or writes
// the Admin's keys and an Admin/Staff/TV/kiosk screen never sees a change.
//
// Edits are a live PREVIEW (the draft) until Save persists them; Discard
// puts the draft back to the last saved values. The preview is applied to
// the document only while a Super Admin screen is mounted: on unmount the
// document goes back to the system defaults, so the choice cannot bleed
// into another role's screens.

const THEME_KEY = 'swumed_superadmin_theme';
const ACCENT_KEY = 'swumed_superadmin_accent';
const LOGO_KEY = 'swumed_superadmin_logo';
const SYSTEM_NAME_KEY = 'swumed_superadmin_system_name';
const CLOCK_FORMAT_KEY = 'swumed_superadmin_clock_format';

export const DEFAULT_SYSTEM_NAME = 'SWUMed Queuing System';
export const DEFAULT_CLOCK_FORMAT = '12h';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const AppearanceContext = createContext(null);

function readKey(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeKey(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage issues in private mode or restricted browsers
    // (a large uploaded logo can also exceed the storage quota).
  }
}

// What was saved by this Super Admin, falling back to the system defaults
// so the screens look the same until something is saved here.
function loadSaved() {
  return {
    theme: readKey(THEME_KEY) || getThemeMode(),
    accent: readKey(ACCENT_KEY) || getAccentColor(),
    logoUrl: readKey(LOGO_KEY) || getLogo() || '',
    systemName: readKey(SYSTEM_NAME_KEY) || DEFAULT_SYSTEM_NAME,
    clockFormat: readKey(CLOCK_FORMAT_KEY) || DEFAULT_CLOCK_FORMAT,
  };
}

function getSystemTheme() {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function SuperAdminAppearanceProvider({ children }) {
  const [saved, setSaved] = useState(loadSaved);
  const [draft, setDraft] = useState(saved);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  useEffect(() => {
    let query;

    try {
      query = window.matchMedia(DARK_QUERY);
    } catch {
      return undefined;
    }

    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    query.addEventListener('change', handleChange);

    return () => query.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = draft.theme === 'system' ? systemTheme : draft.theme;

  // Apply the preview to the document while Super Admin screens are shown,
  // and hand the document back to the system defaults afterwards.
  useEffect(() => {
    applyAccentColor(draft.accent);
    applyThemeMode(resolvedTheme);
  }, [draft.accent, resolvedTheme]);

  useEffect(
    () => () => {
      applyAccentColor(getAccentColor());
      applyThemeMode(getThemeMode());
    },
    []
  );

  const setField = useCallback((field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const setTheme = useCallback((value) => setField('theme', value), [setField]);
  const setAccent = useCallback((value) => setField('accent', value), [setField]);
  const setLogo = useCallback((value) => setField('logoUrl', value || ''), [setField]);
  const setSystemName = useCallback((value) => setField('systemName', value), [setField]);
  const setClockFormat = useCallback((value) => setField('clockFormat', value), [setField]);

  const isDirty =
    draft.theme !== saved.theme ||
    draft.accent !== saved.accent ||
    draft.logoUrl !== saved.logoUrl ||
    draft.systemName !== saved.systemName ||
    draft.clockFormat !== saved.clockFormat;

  const save = useCallback(() => {
    writeKey(THEME_KEY, draft.theme);
    writeKey(ACCENT_KEY, draft.accent);
    writeKey(LOGO_KEY, draft.logoUrl);
    writeKey(SYSTEM_NAME_KEY, draft.systemName.trim() || DEFAULT_SYSTEM_NAME);
    writeKey(CLOCK_FORMAT_KEY, draft.clockFormat);

    const next = {
      ...draft,
      systemName: draft.systemName.trim() || DEFAULT_SYSTEM_NAME,
    };

    setSaved(next);
    setDraft(next);
  }, [draft]);

  const discard = useCallback(() => {
    setDraft(saved);
  }, [saved]);

  const value = useMemo(
    () => ({
      theme: draft.theme,
      accent: draft.accent,
      logoUrl: draft.logoUrl,
      systemName: draft.systemName,
      clockFormat: draft.clockFormat,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      setTheme,
      setAccent,
      setLogo,
      setSystemName,
      setClockFormat,
      isDirty,
      save,
      discard,
    }),
    [
      draft,
      resolvedTheme,
      setTheme,
      setAccent,
      setLogo,
      setSystemName,
      setClockFormat,
      isDirty,
      save,
      discard,
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useSuperAdminAppearance() {
  const ctx = useContext(AppearanceContext);

  if (!ctx) {
    throw new Error(
      'useSuperAdminAppearance must be used inside a SuperAdminAppearanceProvider'
    );
  }

  return ctx;
}
