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
import { useAuth } from '../../services/Authcontext';
import { usePatientBranding } from '../../services/patientBranding';
import {
  STAFF_OVERRIDE_CLEARED_EVENT,
  getDefaultStaffAppearance,
  markStaffOverrideOwner,
  reconcileStaffOverride,
} from '../../services/staffOverride';

const StaffPreferencesContext = createContext(null);

const THEME_STORAGE_KEY = 'swumed_staff_theme';
const LANGUAGE_STORAGE_KEY = 'swumed_staff_language';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function loadStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || getDefaultStaffAppearance().theme;
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

function loadStoredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || getDefaultStaffAppearance().language;
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

export function StaffPreferencesProvider({ children }) {
  const { user } = useAuth();
  const { accent } = usePatientBranding();
  const staffId = user?.staff_id ?? user?.user_id ?? user?.id ?? null;
  const staffIdRef = useRef(staffId);

  useEffect(() => {
    staffIdRef.current = staffId;
  }, [staffId]);

  // Temporary override: drop anything that belongs to a previous staff
  // member or session before the stored values are read below.
  useState(() => reconcileStaffOverride(staffId));

  const [theme, setThemeState] = useState(loadStoredTheme);
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

  // When the staff session ends, fall back to the defaults right away
  // (services/staffOverride has already removed the stored override).
  useEffect(() => {
    const handleCleared = () => {
      const defaults = getDefaultStaffAppearance();

      setThemeState(defaults.theme);
      setLanguageState(defaults.language);
      setIsDirty(false);
    };

    window.addEventListener(STAFF_OVERRIDE_CLEARED_EVENT, handleCleared);

    return () => window.removeEventListener(STAFF_OVERRIDE_CLEARED_EVENT, handleCleared);
  }, []);

  const setTheme = useCallback((mode) => {
    setThemeState(mode);
    saveStoredTheme(mode);
    markStaffOverrideOwner(staffIdRef.current);
  }, []);

  const setLanguage = useCallback((name) => {
    setLanguageState(name);
    saveStoredLanguage(name);
    markStaffOverrideOwner(staffIdRef.current);
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
