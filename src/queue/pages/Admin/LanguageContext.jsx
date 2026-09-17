import { createContext, useCallback, useContext, useState } from 'react';
import { loadStoredLanguage, saveStoredLanguage } from './adminHelpers';
import { LANGUAGE_CODES, translate } from './i18n';

const LanguageContext = createContext(null);

// =====================================================
// LANGUAGE PROVIDER
// =====================================================
//
// Wraps the Admin section so every page can read/switch the
// active language and translate strings through `t()`. The
// choice persists to localStorage (loadStoredLanguage /
// saveStoredLanguage, from adminHelpers.js) the same way the
// theme and accent color already do.

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => loadStoredLanguage());

  const setLanguage = useCallback((name) => {
    setLanguageState(name);
    saveStoredLanguage(name);
  }, []);

  const langCode = LANGUAGE_CODES[language] || 'en';

  const t = useCallback(
    (key, vars) => translate(langCode, key, vars),
    [langCode]
  );

  return (
    <LanguageContext.Provider value={{ language, langCode, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);

  if (!ctx) {
    throw new Error('useLanguage must be used inside a LanguageProvider');
  }

  return ctx;
}
