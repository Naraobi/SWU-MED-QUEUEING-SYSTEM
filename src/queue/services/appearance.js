/*
 * Appearance — accent colour and theme mode.
 *
 * The chosen values are kept on this browser and applied to the document
 * root, where the CSS in index.css picks them up. Importing this module
 * applies the saved appearance straight away, so the app starts in the
 * right colours instead of flashing the defaults first.
 */

const ACCENT_KEY = 'swumed_accent_color';
const THEME_KEY = 'swumed_theme_mode';

export const DEFAULT_ACCENT = '#9D0A0E';
export const DEFAULT_THEME = 'light';

function read(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked - the choice simply will not persist */
  }
}

export function getAccentColor() {
  return read(ACCENT_KEY, DEFAULT_ACCENT);
}

export function getThemeMode() {
  return read(THEME_KEY, DEFAULT_THEME);
}

/* Resolve "system" into the OS preference. */
function resolveTheme(mode) {
  if (mode !== 'system') return mode;

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export function applyAccentColor(color) {
  const value = color || DEFAULT_ACCENT;
  document.documentElement.style.setProperty('--swu-accent', value);
  return value;
}

export function applyThemeMode(mode) {
  const value = mode || DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', resolveTheme(value));
  return value;
}

export function setAccentColor(color) {
  write(ACCENT_KEY, applyAccentColor(color));
}

export function setThemeMode(mode) {
  write(THEME_KEY, mode || DEFAULT_THEME);
  applyThemeMode(mode);
}

/* Apply whatever was saved, and follow the OS while set to "system". */
export function initAppearance() {
  applyAccentColor(getAccentColor());
  applyThemeMode(getThemeMode());

  try {
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = () => {
      if (getThemeMode() === 'system') applyThemeMode('system');
    };

    if (query.addEventListener) {
      query.addEventListener('change', handler);
    } else if (query.addListener) {
      query.addListener(handler);
    }
  } catch {
    /* matchMedia unavailable - stay with the saved mode */
  }
}

initAppearance();

export default initAppearance;
