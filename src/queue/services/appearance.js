/*
 * Appearance — accent colour, theme mode, and the system logo.
 *
 * The chosen values are kept on this browser and applied to the document
 * root, where the CSS in index.css picks them up. Importing this module
 * applies the saved appearance straight away, so the app starts in the
 * right colours instead of flashing the defaults first.
 *
 * Uploading a logo also re-colours the app: the dominant colour of the
 * image becomes the accent, so the interface matches whatever branding the
 * hospital uploads without anyone picking a hex by hand.
 */

const ACCENT_KEY = 'swumed_accent_color';
const THEME_KEY = 'swumed_theme_mode';
const LOGO_KEY = 'swumed_system_logo';

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
  notify();
}

export function setThemeMode(mode) {
  write(THEME_KEY, mode || DEFAULT_THEME);
  applyThemeMode(mode);
  notify();
}

/* =========================================================
   SYSTEM LOGO
========================================================= */

/*
 * The logo is kept as a data URL on this browser.
 *
 * NOTE FOR THE BACKEND TEAM: this means the uploaded logo is visible only on
 * the machine that uploaded it. The kiosk, the TV and every other staff
 * browser still show the bundled default. Making it truly system-wide needs
 * the file stored server-side and served from an endpoint - at which point
 * getLogo() reads that URL instead and nothing else here has to change.
 */

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

export function getLogo() {
  return read(LOGO_KEY, '') || null;
}

export function setLogo(dataUrl) {
  if (!dataUrl) {
    remove(LOGO_KEY);
  } else {
    write(LOGO_KEY, dataUrl);
  }

  notify();
  return dataUrl || null;
}

export function clearLogo() {
  return setLogo(null);
}

/* =========================================================
   COLOUR HELPERS
========================================================= */

function toHex(r, g, b) {
  const part = (n) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function channelLuminance(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/* WCAG relative luminance. */
function luminance(r, g, b) {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/* Contrast ratio of a colour against white. */
function contrastWithWhite(r, g, b) {
  return 1.05 / (luminance(r, g, b) + 0.05);
}

function saturationOf(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  return max === 0 ? 0 : (max - min) / max;
}

/*
 * Buttons in this app put WHITE text on the accent, so an accent that is too
 * light is unreadable. Darken until it clears the WCAG AA threshold (4.5:1)
 * rather than accepting whatever the logo happened to contain.
 */
function darkenUntilReadable(r, g, b) {
  let red = r;
  let green = g;
  let blue = b;
  let guard = 0;

  while (contrastWithWhite(red, green, blue) < 4.5 && guard < 40) {
    red *= 0.92;
    green *= 0.92;
    blue *= 0.92;
    guard += 1;
  }

  return [red, green, blue];
}

/*
 * deriveAccentFromImage(image)
 *
 * Picks the dominant branding colour out of a logo.
 *
 * Near-white, near-black and washed-out pixels are ignored, because a logo is
 * mostly background and outline - counting those would return grey every
 * time. What is left is bucketed by colour and the biggest bucket wins.
 *
 * Returns null for a logo with no real colour in it (a plain black wordmark,
 * say), so the caller can keep the existing accent instead of picking
 * something arbitrary.
 */
export function deriveAccentFromImage(image) {
  const SIZE = 64;

  let data;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, SIZE, SIZE);

    data = context.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    // Tainted canvas or no 2d context - fail quietly and keep the accent.
    return null;
  }

  const buckets = new Map();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 25 && g < 25 && b < 25) continue;
    if (saturationOf(r, g, b) < 0.18) continue;

    // Quantise so near-identical shades count as the same colour.
    const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };

    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;

    buckets.set(key, bucket);
  }

  if (buckets.size === 0) {
    return null;
  }

  let winner = null;

  buckets.forEach((bucket) => {
    if (!winner || bucket.n > winner.n) winner = bucket;
  });

  const [r, g, b] = darkenUntilReadable(
    winner.r / winner.n,
    winner.g / winner.n,
    winner.b / winner.n
  );

  return toHex(r, g, b);
}

/*
 * readLogoFile(file) -> { dataUrl, accent }
 *
 * The image is redrawn at no more than 512px before being stored, because a
 * full-size photo as a data URL will blow past the localStorage quota. SVGs
 * are kept as they are: they are small already, and rasterising one would
 * throw away the thing that makes it an SVG.
 */
export function readLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected.'));
      return;
    }

    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) {
      reject(new Error('Please choose a PNG, JPG, WEBP or SVG image.'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('That image is larger than 2MB.'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Could not read that file.'));

    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();

      image.onerror = () =>
        reject(new Error('That file could not be read as an image.'));

      image.onload = () => {
        const accent = deriveAccentFromImage(image);

        if (file.type === 'image/svg+xml') {
          resolve({ dataUrl: source, accent });
          return;
        }

        try {
          const MAX = 512;
          const scale = Math.min(1, MAX / Math.max(image.width, image.height));

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          resolve({ dataUrl: canvas.toDataURL('image/png'), accent });
        } catch {
          // Could not redraw it - store the original and hope it is small.
          resolve({ dataUrl: source, accent });
        }
      };

      image.src = source;
    };

    reader.readAsDataURL(file);
  });
}

/*
 * applyBrandingFromFile(file)
 *
 * The whole upload flow: read it, store it, and re-colour the app from it.
 * Returns what changed so the caller can tell the user.
 */
export async function applyBrandingFromFile(file) {
  const { dataUrl, accent } = await readLogoFile(file);

  setLogo(dataUrl);

  if (accent) {
    setAccentColor(accent);
  }

  return { logo: dataUrl, accent };
}

/* =========================================================
   SUBSCRIPTIONS
========================================================= */

const listeners = new Set();

function notify() {
  const snapshot = getAppearance();
  listeners.forEach((listener) => listener(snapshot));
}

export function getAppearance() {
  return {
    accentColor: getAccentColor(),
    themeMode: getThemeMode(),
    logo: getLogo(),
  };
}

export function subscribeAppearance(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
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