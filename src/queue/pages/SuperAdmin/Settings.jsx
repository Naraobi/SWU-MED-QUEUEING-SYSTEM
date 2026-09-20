import { useState } from 'react';
import {
  Palette,
  ShieldCheck,
  Sun,
  Moon,
  Monitor,
  Check,
  Upload,
  Copy,
  KeyRound,
  Clock,
} from 'lucide-react';

import ChangePasswordModal from '../../components/changePasswordModal';
import Logo from '../../../assets/logo.png';

/* =========================================================
   OPTIONS
========================================================= */

const ACCENT_PRESETS = [
  '#9D0A0E',
  '#B34C4C',
  '#1F2937',
  '#0F766E',
  '#4B5563',
];

const THEME_MODES = [
  {
    key: 'light',
    label: 'Light Mode',
    caption: 'Default hospital theme',
    icon: Sun,
  },
  {
    key: 'dark',
    label: 'Dark Mode',
    caption: 'Dimmed high contrast',
    icon: Moon,
  },
  {
    key: 'system',
    label: 'System Default',
    caption: 'Follows OS preference',
    icon: Monitor,
  },
];

const LANGUAGES = ['English', 'Filipino', 'Cebuano'];

const CLOCK_FORMATS = [
  '12-Hour (1:30 PM)',
  '24-Hour (13:30)',
];

/* =========================================================
   SECTION SHELL
========================================================= */

function SettingsSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">

      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div className="flex items-start gap-2.5">
          <Icon size={16} className="mt-0.5 shrink-0 text-[#9D0A0E]" />

          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              {title}
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              {subtitle}
            </p>
          </div>
        </div>

        {badge && (
          <span className="shrink-0 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
            {badge}
          </span>
        )}
      </div>

      <div className="border-t border-[#E5E7EB] px-6 py-5">
        {children}
      </div>

    </section>
  );
}

function FieldLabel({ children }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#4B5563]">
      {children}
    </p>
  );
}

function Hint({ children }) {
  return (
    <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">
      {children}
    </p>
  );
}

/* =========================================================
   SETTINGS PAGE
========================================================= */

export default function Settings() {
  const [systemName, setSystemName] = useState(
    'SWUMed Queuing System'
  );

  const [accentColor, setAccentColor] = useState(
    ACCENT_PRESETS[0]
  );

  const [themeMode, setThemeMode] = useState('light');
  const [language, setLanguage] = useState('English');
  const [clockFormat, setClockFormat] = useState(
    CLOCK_FORMATS[0]
  );

  const [showChangePassword, setShowChangePassword] =
    useState(false);

  const [copied, setCopied] = useState(false);

  function handleCopyName() {
    navigator.clipboard
      ?.writeText(systemName)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  }

  return (
    <div className="space-y-5">

      {/* =====================================================
          PAGE TITLE
      ===================================================== */}

      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">
          Settings
        </h1>

        <p className="mt-0.5 text-xs text-[#4B5563]">
          Manage system preferences, security, appearance, and localization.
        </p>
      </div>

      {/* =====================================================
          BRANDING & IDENTITY
      ===================================================== */}

      <SettingsSection
        icon={Palette}
        title="Branding &amp; Identity"
        subtitle="Customize your brand presence across patient kiosks, queue trackers, and staff monitors."
        badge="White label"
      >

        {/* SYSTEM NAME */}

        <div>
          <FieldLabel>System Name</FieldLabel>

          <div className="relative">
            <input
              id="system-name"
              type="text"
              value={systemName}
              onChange={(e) =>
                setSystemName(e.target.value)
              }
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 pr-10 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
            />

            <button
              type="button"
              onClick={handleCopyName}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[#9CA3AF] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
              aria-label="Copy system name"
              title={copied ? 'Copied' : 'Copy'}
            >
              {copied ? (
                <Check size={16} className="text-emerald-600" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>

          <Hint>
            Displayed on browser titles, kiosk welcome screens, and physical
            thermal ticket headers.
          </Hint>
        </div>

        {/* SYSTEM LOGO */}

        <div className="mt-6">
          <FieldLabel>System Logo</FieldLabel>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] px-4 py-3">

            <div className="flex items-center gap-4">
              <img
                src={Logo}
                alt="Current brand logo"
                className="h-7 w-auto object-contain"
              />

              <div>
                <p className="flex items-center gap-2 text-xs font-semibold text-[#1F2937]">
                  Current Brand Logo

                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/30">
                    Active
                  </span>
                </p>

                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  PNG or SVG, max 2MB
                </p>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5]">
              <Upload size={14} />
              Upload New Logo

              <input
                type="file"
                accept="image/png,image/svg+xml"
                className="hidden"
              />
            </label>

          </div>
        </div>

        {/* PRIMARY ACCENT COLOR */}

        <div className="mt-6">
          <FieldLabel>Primary Accent Color</FieldLabel>

          <div className="flex flex-wrap items-center gap-4">

            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2">
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: accentColor }}
              />

              <span className="text-xs font-semibold uppercase text-[#1F2937]">
                Hex {accentColor}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#4B5563]">
                Presets:
              </span>

              {ACCENT_PRESETS.map((preset) => {
                const isSelected = accentColor === preset;

                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAccentColor(preset)}
                    aria-label={`Accent ${preset}`}
                    aria-pressed={isSelected}
                    className={`h-6 w-6 rounded-full transition ${
                      isSelected
                        ? 'ring-2 ring-[#9D0A0E] ring-offset-2'
                        : 'ring-1 ring-black/10 hover:ring-[#9CA3AF]'
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                );
              })}
            </div>

          </div>

          <Hint>
            Applies to primary action buttons, active navigation markers, kiosk
            highlighted badges, and key queue alerts.
          </Hint>
        </div>

      </SettingsSection>

      {/* =====================================================
          PASSWORD & SECURITY
      ===================================================== */}

      <SettingsSection
        icon={ShieldCheck}
        title="Password &amp; Security"
        subtitle="Manage your account password and Admin PIN."
      >

        <div className="divide-y divide-[#E5E7EB]">

          {/* PASSWORD */}

          <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
            <div>
              <p className="text-sm font-bold text-[#1F2937]">
                Password
              </p>

              <p className="mt-0.5 text-xs text-[#4B5563]">
                Keep your account secure by regularly updating your password.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowChangePassword(true)
              }
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5]"
            >
              <KeyRound size={14} />
              Change Password
            </button>
          </div>

          {/* SECURITY PIN */}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <div>
              <p className="text-sm font-bold text-[#1F2937]">
                Security PIN
              </p>

              <p className="mt-0.5 text-xs text-[#4B5563]">
                Used to authorize protected system actions such as resetting
                records.
              </p>
            </div>

            <button
              type="button"
              disabled
              title="Security PIN storage is not available yet."
              className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#9CA3AF]"
            >
              <KeyRound size={14} />
              Change PIN
            </button>
          </div>

        </div>

      </SettingsSection>

      {/* =====================================================
          APPEARANCE
      ===================================================== */}

      <SettingsSection
        icon={Monitor}
        title="Appearance"
        subtitle="Choose default theme settings for admin and kiosk interfaces."
      >

        <FieldLabel>Theme Mode</FieldLabel>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_MODES.map(
            ({ key, label, caption, icon: Icon }) => {
              const isSelected = themeMode === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setThemeMode(key)}
                  aria-pressed={isSelected}
                  className={`rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-[#9D0A0E] ring-1 ring-[#9D0A0E]'
                      : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                  }`}
                >

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        size={14}
                        className="mt-0.5 shrink-0 text-[#4B5563]"
                      />

                      <div>
                        <p className="text-xs font-bold text-[#1F2937]">
                          {label}
                        </p>

                        <p className="mt-0.5 text-xs text-[#9CA3AF]">
                          {caption}
                        </p>
                      </div>
                    </div>

                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-[#9D0A0E] bg-[#9D0A0E]'
                          : 'border-[#9CA3AF] bg-white'
                      }`}
                    >
                      {isSelected && (
                        <Check
                          size={10}
                          strokeWidth={3}
                          className="text-white"
                        />
                      )}
                    </span>
                  </div>

                  {/* Preview thumbnail */}

                  <div
                    aria-hidden="true"
                    className={`mt-3 overflow-hidden rounded-md border border-[#E5E7EB] ${
                      key === 'dark'
                        ? 'bg-[#1F2937]'
                        : key === 'system'
                          ? 'bg-gradient-to-r from-white to-[#1F2937]'
                          : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 px-3 py-3">
                      <span
                        className="h-3 w-10 rounded-sm"
                        style={{ backgroundColor: accentColor }}
                      />

                      <span
                        className={`h-3 flex-1 rounded-sm ${
                          key === 'dark'
                            ? 'bg-white/20'
                            : 'bg-[#E5E7EB]'
                        }`}
                      />
                    </div>
                  </div>

                </button>
              );
            }
          )}
        </div>

      </SettingsSection>

      {/* =====================================================
          LANGUAGE & REGIONAL SETTINGS
      ===================================================== */}

      <SettingsSection
        icon={Clock}
        title="Language &amp; Regional Settings"
        subtitle="Configure default language and regional time displays across touchpoints."
      >

        {/* PRIMARY LANGUAGE */}

        <div>
          <FieldLabel>Primary Language</FieldLabel>

          <div className="flex flex-wrap items-center gap-2">
            {LANGUAGES.map((lang) => {
              const isSelected = language === lang;

              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-[#9D0A0E] text-white'
                      : 'bg-[#F1F3F5] text-[#4B5563] hover:bg-[#E5E7EB]'
                  }`}
                >
                  {isSelected && <Check size={12} />}
                  {lang}
                </button>
              );
            })}
          </div>

          <Hint>
            Sets the initial default locale for patient kiosk prompts and
            printed slips.
          </Hint>
        </div>

        {/* CLOCK FORMAT */}

        <div className="mt-6">
          <FieldLabel>Clock Format</FieldLabel>

          <select
            value={clockFormat}
            onChange={(e) =>
              setClockFormat(e.target.value)
            }
            aria-label="Clock format"
            className="w-full max-w-xs rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
          >
            {CLOCK_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>

          <Hint>
            Applied to TV Queue displays, timestamp audits, and ticket issuance
            times.
          </Hint>
        </div>

      </SettingsSection>

      {/* =====================================================
          CHANGE PASSWORD MODAL (existing, real)
      ===================================================== */}

      {showChangePassword && (
        <ChangePasswordModal
          onSuccess={() =>
            setShowChangePassword(false)
          }
        />
      )}

    </div>
  );
}