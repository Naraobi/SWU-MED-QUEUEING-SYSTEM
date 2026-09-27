import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { LANGUAGE_CODES, translate } from './staffI18n';

const StaffPreferencesContext = createContext(null);

const THEME_STORAGE_KEY = 'swumed_staff_theme';
const ACCENT_STORAGE_KEY = 'swumed_staff_accent';
const LANGUAGE_STORAGE_KEY = 'swumed_staff_language';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export const DEFAULT_STAFF_ACCENT = '#9D0A0E';

function loadStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  } catch {
    return 'light';
  }
}

function saveStoredTheme(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

function loadStoredAccent() {
  try {
    return localStorage.getItem(ACCENT_STORAGE_KEY) || DEFAULT_STAFF_ACCENT;
  } catch {
    return DEFAULT_STAFF_ACCENT;
  }
}

function saveStoredAccent(hex) {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

function loadStoredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'English';
  } catch {
    return 'English';
  }
}

function saveStoredLanguage(value) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

function getSystemTheme() {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// =====================================================
// STAFF PREFERENCES PROVIDER
// =====================================================
//
// Theme, accent color, and language for the Staff portal. Stored
// under swumed_staff_* keys (separate from swumed_admin_*) so an
// admin and a staff account signed into the same browser don't
// inherit each other's display preferences.
//
// The resolved theme/accent are applied by each Staff page to its
// own root element (never to <html>), matching how Admin scopes its
// theme, so this can't bleed into other roles' screens.
//
// isDirty/registerDiscard/discardChanges mirror Admin's
// UnsavedChangesContext: StaffSettingsPage flags a pending edit here,
// and Sidebar reads isDirty before navigating away from /staff/settings
// so it can prompt instead of silently dropping an unsaved pick.

export function StaffPreferencesProvider({ children }) {
  const [theme, setThemeState] = useState(loadStoredTheme);
  const [accent, setAccentState] = useState(loadStoredAccent);
  const [language, setLanguageState] = useState(loadStoredLanguage);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [isDirty, setIsDirty] = useState(false);
  const discardRef = useRef(() => {});

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

  const setTheme = useCallback((mode) => {
    setThemeState(mode);
    saveStoredTheme(mode);
  }, []);

  const setAccent = useCallback((hex) => {
    setAccentState(hex);
    saveStoredAccent(hex);
  }, []);

  const setLanguage = useCallback((name) => {
    setLanguageState(name);
    saveStoredLanguage(name);
  }, []);

  const registerDiscard = useCallback((fn) => {
    discardRef.current = typeof fn === 'function' ? fn : () => {};
  }, []);

  const discardChanges = useCallback(() => {
    discardRef.current();
    setIsDirty(false);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;
  const langCode = LANGUAGE_CODES[language] || 'en';
  const t = useCallback((key, vars) => translate(langCode, key, vars), [langCode]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      accent,
      setAccent,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      language,
      setLanguage,
      langCode,
      t,
      isDirty,
      setIsDirty,
      registerDiscard,
      discardChanges,
    }),
    [
      theme,
      setTheme,
      accent,
      setAccent,
      resolvedTheme,
      language,
      setLanguage,
      langCode,
      t,
      isDirty,
      registerDiscard,
      discardChanges,
    ]
  );

  return (
    <StaffPreferencesContext.Provider value={value}>
      {children}
    </StaffPreferencesContext.Provider>
  );
}

export function useStaffPreferences() {
  const ctx = useContext(StaffPreferencesContext);

  if (!ctx) {
    throw new Error('useStaffPreferences must be used inside a StaffPreferencesProvider');
  }

  return ctx;
}
