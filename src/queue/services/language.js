/*
 * Language — the chosen interface language for this browser.
 *
 * The translations themselves live in pages/Admin/i18n.js, which already
 * carries English, Filipino and Cebuano dictionaries. This module only
 * handles three things that file does not:
 *
 *   1. remembering the choice across refreshes,
 *   2. telling every mounted component when it changes,
 *   3. handing components a `t()` already bound to the current language.
 *
 * It follows the same shape as services/appearance.js, so the two settings
 * behave the same way.
 */

import {
  LANGUAGES,
  LANGUAGE_CODES,
  translate as translateAdmin,
} from '../pages/Admin/i18n';

import { SUPERADMIN_TRANSLATIONS } from './i18nSuperAdmin';

import { useEffect, useState } from 'react';

const LANGUAGE_KEY = 'swumed_language';

export const DEFAULT_LANGUAGE = 'English';

export { LANGUAGES, LANGUAGE_CODES };

function read() {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);

    // Guard against a stale or hand-edited value.
    return LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function write(value) {
  try {
    localStorage.setItem(LANGUAGE_KEY, value);
  } catch {
    /* storage blocked - the choice simply will not persist */
  }
}

let currentLanguage = read();

/* Components that need to re-render when the language changes. */
const listeners = new Set();

export function getLanguage() {
  return currentLanguage;
}

export function getLanguageCode(language = currentLanguage) {
  return LANGUAGE_CODES[language] || 'en';
}

/*
 * Sets <html lang="..."> so screen readers announce the page in the right
 * language, and so the browser's own spellcheck behaves.
 */
function applyDocumentLanguage(language) {
  try {
    document.documentElement.lang = getLanguageCode(language);
  } catch {
    /* no document - nothing to apply */
  }
}

export function setLanguage(language) {
  const value = LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;

  currentLanguage = value;
  write(value);
  applyDocumentLanguage(value);

  listeners.forEach((listener) => listener(value));

  return value;
}

/* Apply the saved language as soon as this module is imported. */
applyDocumentLanguage(currentLanguage);

/*
 * translate()
 *
 * Looks in the SuperAdmin dictionary first, then hands anything it does not
 * have to the Admin dictionary, which applies its own English fallback and
 * finally returns the key. So a key is never rendered as blank space, and
 * the two sections can add keys independently without treading on each other.
 */
export function translate(langCode, key, vars) {
  const dictionary =
    SUPERADMIN_TRANSLATIONS[langCode] || SUPERADMIN_TRANSLATIONS.en;

  let text = dictionary[key] ?? SUPERADMIN_TRANSLATIONS.en[key];

  if (text === undefined) {
    return translateAdmin(langCode, key, vars);
  }

  if (vars) {
    Object.keys(vars).forEach((varKey) => {
      text = text.replaceAll(`{${varKey}}`, vars[varKey]);
    });
  }

  return text;
}

/*
 * useLanguage()
 *
 *   const { language, setLanguage, t } = useLanguage();
 *   <h1>{t('settings.title')}</h1>
 *
 * `t` falls back to English, and then to the key itself, so a missing
 * translation shows readable text rather than blank space.
 */
export function useLanguage() {
  const [language, setLanguageState] = useState(currentLanguage);

  useEffect(() => {
    const listener = (value) => setLanguageState(value);

    listeners.add(listener);

    // Another tab or component may have changed it before this mounted.
    if (language !== currentLanguage) {
      setLanguageState(currentLanguage);
    }

    return () => {
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const code = getLanguageCode(language);

  return {
    language,
    languageCode: code,
    setLanguage,
    t: (key, vars) => translate(code, key, vars),
  };
}