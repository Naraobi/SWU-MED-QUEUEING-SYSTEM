import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  loadStoredAccent,
  loadStoredTheme,
  saveStoredAccent,
  saveStoredTheme,
} from './adminHelpers';

const AppearanceContext = createContext(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme() {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// =====================================================
// APPEARANCE PROVIDER
// =====================================================
//
// Owns the Admin section's theme mode and accent colour.
//
// The resolved theme and accent are applied by AdminApp to the
// Admin root element, never to <html> or <body>. That scoping is
// deliberate: Staff, SuperAdmin, TV and Patient screens share the
// same document, so a class left on <html> would restyle them too
// once an admin navigated away.

export function AppearanceProvider({ children }) {
  const [theme, setThemeState] = useState(() => loadStoredTheme());
  const [accent, setAccentState] = useState(() => loadStoredAccent());
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

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

  const setAccent = useCallback((hex) => {
    setAccentState(hex);
    saveStoredAccent(hex);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const value = useMemo(
    () => ({
      theme,
      accent,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      setTheme,
      setAccent,
    }),
    [theme, accent, resolvedTheme, setTheme, setAccent]
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
