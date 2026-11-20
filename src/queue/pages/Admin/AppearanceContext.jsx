import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { loadStoredTheme, saveStoredTheme } from './adminHelpers';
import { usePatientBranding } from '../../services/patientBranding';

const AppearanceContext = createContext(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme() {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function AppearanceProvider({ children }) {
  const [theme, setThemeState] = useState(() => loadStoredTheme());
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const { accent } = usePatientBranding();

  // Only matters while the admin has picked "System Default", but the
  // listener is cheap and keeps systemTheme correct if they switch to it.
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

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const value = useMemo(
    () => ({
      theme,
      accent,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      setTheme,
    }),
    [theme, accent, resolvedTheme, setTheme]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);

  if (!ctx) {
    throw new Error('useAppearance must be used inside an AppearanceProvider');
  }

  return ctx;
}
