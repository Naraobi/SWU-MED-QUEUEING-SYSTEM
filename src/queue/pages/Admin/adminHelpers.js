import { formatShortDateLocalized, translate } from './i18n';

// =====================================================
// THEME
// =====================================================
//
// Brand palette shared across every Admin page.
//
export const THEME = {
  primary: '#9D0A0E',
  secondary: '#B34C4C',
  textMain: '#1F2937',
  textSecondary: '#4B5563',
  neutral: '#F1F3F5',
  border: '#E5E7EB',
};

// =====================================================
// DISPLAY PREFERENCES
// =====================================================
//
// Persisted client-side (localStorage) admin preferences.
// Light/Dark toggling is real (it flips a class on <html>).
// The accent color, language, and avatar are saved for real,
// but nothing else in the app reads the accent/language yet —
// see the Settings page for what's genuinely wired up versus
// a saved preference waiting on future work.
//

const THEME_STORAGE_KEY = 'swumed_admin_theme';
const ACCENT_STORAGE_KEY = 'swumed_admin_accent';
const LANGUAGE_STORAGE_KEY = 'swumed_admin_language';
const AVATAR_STORAGE_KEY = 'swumed_admin_avatar';

export function loadStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(themeName = 'light') {
  const root = document.documentElement;
  const isDark = themeName === 'dark';

  root.classList.toggle('admin-dark', isDark);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

export function loadStoredAccent() {
  try {
    return localStorage.getItem(ACCENT_STORAGE_KEY) || '#9D0A0E';
  } catch {
    return '#9D0A0E';
  }
}

export function applyAccent(hex) {
  document.documentElement.style.setProperty('--admin-accent', hex);

  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, hex);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

export function loadStoredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'English';
  } catch {
    return 'English';
  }
}

export function saveStoredLanguage(value) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

export function loadStoredAvatar() {
  try {
    return localStorage.getItem(AVATAR_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredAvatar(dataUrl) {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

// =====================================================
// DATE RANGE HELPERS
// =====================================================

export function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function addMonths(date, amount) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + amount);
  return copy;
}

export function startOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

export function toDateKey(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatShortDate(date, langCode = 'en') {
  return formatShortDateLocalized(date, langCode);
}

export const RANGE_PRESETS = [
  'Today',
  'Yesterday',
  'Last week',
  'Last month',
  'Last quarter',
];

export function getPresetRange(preset) {
  const today = startOfDay(
    new Date()
  );

  if (preset === 'Yesterday') {
    const day = addDays(today, -1);
    return { start: day, end: day, preset };
  }

  if (preset === 'Last week') {
    return {
      start: addDays(today, -6),
      end: today,
      preset,
    };
  }

  if (preset === 'Last month') {
    return {
      start: addMonths(today, -1),
      end: today,
      preset,
    };
  }

  if (preset === 'Last quarter') {
    return {
      start: addMonths(today, -3),
      end: today,
      preset,
    };
  }

  return {
    start: today,
    end: today,
    preset: 'Today',
  };
}

export function formatRangeLabel(range, langCode = 'en') {
  if (!range?.start || !range?.end) {
    return translate(langCode, 'common.today');
  }

  if (range.preset) {
    return translate(langCode, `dateRange.preset.${range.preset}`);
  }

  if (
    toDateKey(range.start) ===
    toDateKey(range.end)
  ) {
    return formatShortDate(
      range.start,
      langCode
    );
  }

  return `${formatShortDate(
    range.start,
    langCode
  )} – ${formatShortDate(
    range.end,
    langCode
  )}`;
}

export function buildMonthGrid(viewMonth) {
  const firstOfMonth = startOfMonth(
    viewMonth
  );

  // Convert Sun(0)..Sat(6) to a Mon(0)..Sun(6) week start.
  const firstWeekday =
    (firstOfMonth.getDay() + 6) % 7;

  const gridStart = addDays(
    firstOfMonth,
    -firstWeekday
  );

  return Array.from(
    { length: 42 },
    (_, index) => {
      const date = addDays(
        gridStart,
        index
      );

      return {
        date,
        inMonth:
          date.getMonth() ===
          viewMonth.getMonth(),
      };
    }
  );
}
