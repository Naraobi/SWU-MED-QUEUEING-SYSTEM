import { useEffect, useState } from 'react';
import shield from '../../assets/swu-shield.png';
import { getAccentColor, subscribeAppearance } from '../services/appearance';

const DEFAULT_ACCENT = '#9D0A0E';

// Edit this list to change the credits shown in the footer.
export const POWERED_BY = [
  'ABELLA',
  'OBI',
  'CILOY',
  'FERNANDEZ',
  'GALANIDA',
  'BENOLIRAO',
];

function parseHex(value) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');

  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// White text unless the accent is light enough that white would be hard to read.
function pickTextColor(accent) {
  const rgb = parseHex(accent);
  if (!rgb) return '#FFFFFF';

  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#1F2937' : '#FFFFFF';
}

// Shared footer for the Admin, Staff and Super Admin screens.
// `accent` is the role's own accent colour. When it is omitted (Super Admin),
// the accent saved by the appearance service is used and followed live.
export default function AppFooter({ accent }) {
  const [savedAccent, setSavedAccent] = useState(() => getAccentColor());

  useEffect(
    () => subscribeAppearance(() => setSavedAccent(getAccentColor())),
    []
  );

  const background = accent || savedAccent || DEFAULT_ACCENT;
  const color = pickTextColor(background);

  return (
    <footer
      className="mt-6 flex min-h-[var(--bottom-bar-height)] w-full shrink-0 items-center justify-center border-t px-4 py-1.5 lg:h-[var(--bottom-bar-height)] lg:overflow-hidden"
      style={{
        backgroundColor: background,
        color,
        borderTopColor: `color-mix(in srgb, ${color} 18%, transparent)`,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-0.5 text-center">
          {/* Top: brand */}
          <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1">
            <span className="flex items-center gap-1.5">
              <img src={shield} alt="" className="h-5 w-5 shrink-0 object-contain" />
              <span className="text-sm font-normal leading-none">Powered by Southwestern University PHINMA</span>
            </span>
            <span aria-hidden="true" className="hidden h-6 w-px bg-current opacity-40 sm:block" />
            <span className="text-sm font-normal leading-tight">College of IT</span>
          </div>

          {/* Bottom: credits */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-normal uppercase leading-none tracking-[0.06em]">
            {POWERED_BY.map((name, index) => (
              <span key={name} className="flex items-center gap-3">
                {index > 0 && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current opacity-60" />}
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
