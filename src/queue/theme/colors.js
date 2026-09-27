// =====================================================
// SHARED BRAND COLORS
// =====================================================
//
// Single source of truth for the hex values reused as inline
// style={{}} colors across Admin, Staff, and Patient screens
// (Tailwind utility classes keep using these same hex values
// directly, e.g. bg-[#9D0A0E], and are unaffected by this file).
//
export const THEME = {
  primary: '#9D0A0E',
  primaryHover: '#7d0809',
  secondary: '#B34C4C',
  textMain: '#1F2937',
  textSecondary: '#4B5563',
  neutral: '#F1F3F5',
  border: '#E5E7EB',
  page: '#F8F9FA',
};

// Queue status colors, shared by any screen that renders a
// status badge/dot (e.g. Staff queue history, Admin dashboard).
export const STATUS_COLORS = {
  waiting: { bg: '#F1F3F5', text: '#4B5563', dot: '#4B5563' },
  called: { bg: '#fff4df', text: '#a66a00', dot: '#a66a00' },
  serving: { bg: '#e4f7ee', text: '#18864b', dot: '#18864b' },
  completed: { bg: '#e4f7ee', text: '#18864b', dot: '#18864b' },
  cancelled: { bg: '#fce8e8', text: '#9D0A0E', dot: '#9D0A0E' },
  skipped: { bg: '#fce8e8', text: '#9D0A0E', dot: '#9D0A0E' },
};

export function getStatusColors(status) {
  const key = String(status || '').trim().toLowerCase();
  return STATUS_COLORS[key] || STATUS_COLORS.waiting;
}

// =====================================================
// DOMINANT COLOR EXTRACTION
// =====================================================
//
// Used by Admin's and Staff's Settings pages: when someone uploads a
// logo/photo, this samples it on a canvas and picks the most common
// vivid color, so that upload can also become the new accent color
// instead of requiring a separate manual pick.
//
// Near-white, near-black, and low-saturation (gray) pixels are
// excluded so a photo with a plain background doesn't just resolve
// to "white" or "gray" — resolves to null if the image has no vivid
// color at all (e.g. a grayscale logo), and the caller should keep
// whatever accent is already set.

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function extractDominantColor(imageSrc) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const size = 50;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);

        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = data[i + 3];

          if (alpha < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;

          if (max > 240 && min > 225) continue; // near white
          if (max < 20) continue; // near black
          if (saturation < 0.15) continue; // gray

          const key = `${Math.round(r / 24)}_${Math.round(g / 24)}_${Math.round(b / 24)}`;
          const bucket = buckets.get(key);

          if (bucket) {
            bucket.count += 1;
            bucket.r += r;
            bucket.g += g;
            bucket.b += b;
          } else {
            buckets.set(key, { count: 1, r, g, b });
          }
        }

        let best = null;
        for (const bucket of buckets.values()) {
          if (!best || bucket.count > best.count) best = bucket;
        }

        if (!best) {
          resolve(null);
          return;
        }

        resolve(
          rgbToHex(
            Math.round(best.r / best.count),
            Math.round(best.g / best.count),
            Math.round(best.b / best.count)
          )
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for color extraction.'));
    img.src = imageSrc;
  });
}
