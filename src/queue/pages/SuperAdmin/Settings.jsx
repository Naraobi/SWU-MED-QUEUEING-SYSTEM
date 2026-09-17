import { useState } from 'react';
import { X, Sun, Moon, Monitor, Check, Pipette } from 'lucide-react';

const LANGUAGES = ['English', 'Filipino', 'Cebuano'];

const THEME_MODES = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'device', label: 'Device', icon: Monitor },
];

// Each swatch is a 4-quadrant preview circle.
const THEME_SWATCHES = [
  { key: 'blue', colors: ['#9D0A0E', '#D4B0B1', '#7D080B', '#F0DADA'] },
  { key: 'slate', colors: ['#6B7280', '#9CA3AF', '#4B5563', '#D1D5DB'] },
  { key: 'ocean', colors: ['#1E5FA8', '#5B8FC9', '#123C73', '#A8C4E0'] },
  { key: 'steel', colors: ['#64748B', '#94A3B8', '#334155', '#CBD5E1'] },

  { key: 'graphite', colors: ['#455A64', '#78909C', '#37474F', '#B0BEC5'] },
  { key: 'teal', colors: ['#14B8A6', '#5EEAD4', '#0F766E', '#99F6E4'] },
  { key: 'green', colors: ['#22C55E', '#86EFAC', '#15803D', '#BBF7D0'] },
  { key: 'moss', colors: ['#5F7A5F', '#8FA98F', '#3F5A3F', '#B8CBB8'] },

  { key: 'olive', colors: ['#A3A32B', '#C7C755', '#7A7A1F', '#DEDE8A'] },
  { key: 'orange', colors: ['#F97316', '#FDBA74', '#C2410C', '#FED7AA'] },
  { key: 'brown', colors: ['#6B4F3F', '#A98A76', '#4A362A', '#D6C0B1'] },
  { key: 'rose', colors: ['#E11D6B', '#F9A8C4', '#9F1239', '#FBCFE0'] },

  { key: 'mauve', colors: ['#8B6B6B', '#B08F8F', '#6A4F4F', '#D4BDBD'] },
  { key: 'pink', colors: ['#E879C6', '#F5B4E0', '#C0439C', '#FBDCF1'] },
  { key: 'purple', colors: ['#8B5CF6', '#C4B5FD', '#6D28D9', '#DDD6FE'] },
];

function quadrantGradient(colors) {
  const [a, b, c, d] = colors;
  return `conic-gradient(from 0deg, ${a} 0deg 90deg, ${b} 90deg 180deg, ${c} 180deg 270deg, ${d} 270deg 360deg)`;
}

/* ---------------- Department Customization Modal ---------------- */

function DepartmentCustomizationModal({ onClose }) {
  const [departmentName, setDepartmentName] = useState('Billing Department');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-800">Department Customization</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FBF1F1] text-xs font-semibold text-[#9D0A0E]">
              JD
            </div>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Change
            </button>
          </div>

          <div className="rounded-lg border border-slate-300 px-3 py-2">
            <label
              htmlFor="department-name"
              className="block text-[10px] font-medium text-slate-500"
            >
              Department Name
            </label>
            <input
              id="department-name"
              type="text"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full border-none p-0 text-sm text-slate-800 focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7D080B]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Theme Modal ---------------- */

function ThemeModal({ onClose, onOpenColorPicker }) {
  const [mode, setMode] = useState('light');
  const [selectedSwatch, setSelectedSwatch] = useState('blue');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-[280px] overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-800">Theme</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Mode selector */}
          <div className="flex items-center gap-1.5">
            {THEME_MODES.map(({ key, label, icon: Icon }) => {
              const isActive = mode === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                    isActive
                      ? 'border border-slate-300 bg-white text-slate-800 shadow-sm'
                      : 'border border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Swatch grid */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {THEME_SWATCHES.map(({ key, colors }) => {
              const isSelected = selectedSwatch === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedSwatch(key)}
                  aria-label={`${key} theme`}
                  className="relative flex aspect-square items-center justify-center rounded-lg bg-slate-50 transition hover:bg-slate-100"
                >
                  <span
                    className="block h-8 w-8 rounded-full"
                    style={{ background: quadrantGradient(colors) }}
                  />
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}

            {/* Custom color launcher */}
            <button
              type="button"
              onClick={onOpenColorPicker}
              aria-label="Pick a custom color"
              className="relative flex aspect-square items-center justify-center rounded-lg bg-slate-50 transition hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C2603C] text-white">
                <Pipette size={14} />
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7D080B]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Color Picker Modal ---------------- */

function ColorPickerModal({ onClose }) {
  const [hue, setHue] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-[320px] overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-800">Color Picker</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex items-center gap-3 px-5 py-5">
          <span
            className="h-7 w-7 shrink-0 rounded-full"
            style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
          />
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            aria-label="Hue"
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background:
                'linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Settings Page ---------------- */

export default function Settings() {
  const [language, setLanguage] = useState('English');
  const [activeModal, setActiveModal] = useState(null);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Manage system preferences, display configurations, and global rules.
        </p>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Appearance</h2>

        <div className="mt-4 flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => setActiveModal('department')}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Department Customization
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('theme')}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Theme
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Language</h2>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {LANGUAGES.map((lang) => {
            const isActive = language === lang;

            return (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'border border-slate-300 bg-white text-slate-800 shadow-sm'
                    : 'border border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {activeModal === 'department' && (
        <DepartmentCustomizationModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'theme' && (
        <ThemeModal
          onClose={() => setActiveModal(null)}
          onOpenColorPicker={() => setActiveModal('colorPicker')}
        />
      )}

      {activeModal === 'colorPicker' && (
        <ColorPickerModal onClose={() => setActiveModal('theme')} />
      )}
    </div>
  );
}