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
  loadStoredLogo,
  loadStoredTheme,
  saveStoredAccent,
  saveStoredLogo,
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
// Owns the Admin section's theme mode, accent colour, and logo.
//
// The resolved theme and accent are applied by AdminApp to the
// Admin root element, never to <html> or <body>. That scoping is
// deliberate: Staff, SuperAdmin, TV and Patient screens share the
// same document, so a class left on <html> would restyle them too
// once an admin navigated away. The logo is scoped the same way:
// uploading one in Settings only replaces what this Admin sees in
// their own sidebar, not what patients or other roles see.

export function AppearanceProvider({ children }) {
  const [theme, setThemeState] = useState(() => loadStoredTheme());
  const [accent, setAccentState] = useState(() => loadStoredAccent());
  const [logoUrl, setLogoUrlState] = useState(() => loadStoredLogo());
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

  const setLogo = useCallback((dataUrl) => {
    setLogoUrlState(dataUrl || '');
    saveStoredLogo(dataUrl || '');
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const value = useMemo(
    () => ({
      theme,
      accent,
      logoUrl,
      resolvedTheme,
      isDark: resolvedTheme === 'dark',
      setTheme,
      setAccent,
      setLogo,
    }),
    [theme, accent, logoUrl, resolvedTheme, setTheme, setAccent, setLogo]
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
