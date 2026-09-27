import { useEffect, useState } from 'react';
import { Check, Globe, Monitor, Moon, Palette, Save, Sun } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useStaffPreferences } from './StaffPreferencesContext.jsx';
import { LANGUAGES } from './staffI18n';

const THEME_MODES = [
  {
    key: 'light',
    icon: Sun,
    labelKey: 'settings.appearance.light',
    captionKey: 'settings.appearance.lightCaption',
  },
  {
    key: 'dark',
    icon: Moon,
    labelKey: 'settings.appearance.dark',
    captionKey: 'settings.appearance.darkCaption',
  },
  {
    key: 'system',
    icon: Monitor,
    labelKey: 'settings.appearance.system',
    captionKey: 'settings.appearance.systemCaption',
  },
];

const ACCENT_PRESETS = ['#9D0A0E', '#B34C4C', '#1F2937', '#0F766E', '#4B5563', '#1E5FA8'];

function SettingsSection({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-start gap-2.5 px-6 py-5">
        <Icon size={16} className="mt-0.5 shrink-0 text-[#9D0A0E]" />
        <div>
          <h2 className="text-sm font-bold text-[#1F2937]">{title}</h2>
          <p className="mt-0.5 text-xs text-[#667085]">{subtitle}</p>
        </div>
      </div>
      <div className="border-t border-[#E5E7EB] px-6 py-5">{children}</div>
    </section>
  );
}

export default function StaffSettingsPage() {
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    isDark,
    language,
    setLanguage,
    t,
    setIsDirty,
    registerDiscard,
  } = useStaffPreferences();

  // Baseline "last saved" values. Save moves this baseline forward;
  // leaving without saving reverts the live values back to it instead
  // of quietly keeping half-made edits. Mirrors Admin's SettingsExactPage.
  const [savedTheme, setSavedTheme] = useState(theme);
  const [savedAccent, setSavedAccent] = useState(accent);
  const [savedLanguage, setSavedLanguage] = useState(language);
  const [justSaved, setJustSaved] = useState(false);

  const isDirty = theme !== savedTheme || accent !== savedAccent || language !== savedLanguage;

  useEffect(() => {
    setIsDirty(isDirty);
  }, [isDirty, setIsDirty]);

  useEffect(() => {
    registerDiscard(() => {
      setTheme(savedTheme);
      setAccent(savedAccent);
      setLanguage(savedLanguage);
    });
  }, [registerDiscard, savedTheme, savedAccent, savedLanguage, setTheme, setAccent, setLanguage]);

  // Covers a closed tab / browser refresh the in-app nav guard can't see.
  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function handleSave() {
    if (!isDirty) return;
    setSavedTheme(theme);
    setSavedAccent(accent);
    setSavedLanguage(language);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <div
      className={`staff-shell flex min-h-screen w-full bg-[#f4f6f8] antialiased text-slate-800${isDark ? ' staff-dark' : ''}`}
      style={{ fontFamily: 'Inter, sans-serif', '--staff-accent': accent }}
    >
      <Sidebar />

      <main className="min-h-screen min-w-0 flex-1 flex flex-col">
        <Topbar title={t('settings.title')} />

        <div className="p-8 flex-1 max-w-[900px] w-full mx-auto space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#1F2937]">{t('settings.title')}</h1>
              <p className="mt-0.5 text-xs text-[#4B5563]">{t('settings.subtitle')}</p>
            </div>

            <div className="flex items-center gap-2.5">
              {isDirty && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#9D0A0E]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#9D0A0E]" />
                  {t('settings.unsavedChanges')}
                </span>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition-colors ${
                  isDirty
                    ? 'bg-[#9D0A0E] text-white hover:bg-[#7d0809]'
                    : 'cursor-not-allowed bg-[#F1F3F5] text-[#98A2B3]'
                }`}
              >
                {justSaved ? <Check size={14} /> : <Save size={14} />}
                {justSaved ? t('settings.saved') : t('settings.saveChanges')}
              </button>
            </div>
          </div>

          <SettingsSection icon={Monitor} title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')}>
            <div className="grid gap-4 sm:grid-cols-3">
              {THEME_MODES.map(({ key, icon: Icon, labelKey, captionKey }) => {
                const selected = theme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    aria-pressed={selected}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected ? 'border-[#9D0A0E] ring-1 ring-[#9D0A0E]' : 'border-[#E5E7EB] hover:border-[#98A2B3]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Icon size={14} className="mt-0.5 shrink-0 text-[#9D0A0E]" />
                        <div>
                          <p className="text-xs font-bold text-[#1F2937]">{t(labelKey)}</p>
                          <p className="mt-0.5 text-xs text-[#98A2B3]">{t(captionKey)}</p>
                        </div>
                      </div>
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-[#9D0A0E]' : 'border-[#D0D5DD]'}`}>
                        {selected && <span className="h-2 w-2 rounded-full bg-[#9D0A0E]" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SettingsSection>

          <SettingsSection icon={Palette} title={t('settings.color.title')} subtitle={t('settings.color.subtitle')}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2">
                <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: accent }} />
                <span className="text-xs font-semibold uppercase text-[#1F2937]">{t('settings.color.hex')} {accent.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 border-l border-[#E5E7EB] pl-4">
                <span className="text-xs text-[#667085]">{t('settings.color.presets')}</span>
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAccent(preset)}
                    aria-label={`Accent ${preset}`}
                    aria-pressed={accent.toUpperCase() === preset.toUpperCase()}
                    className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                      accent.toUpperCase() === preset.toUpperCase() ? 'ring-2 ring-[#9D0A0E] ring-offset-2' : 'ring-1 ring-black/10 hover:ring-[#98A2B3]'
                    }`}
                    style={{ backgroundColor: preset }}
                  >
                    {accent.toUpperCase() === preset.toUpperCase() && <Check size={12} strokeWidth={3} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection icon={Globe} title={t('settings.language.title')} subtitle={t('settings.language.subtitle')}>
            <div className="flex flex-wrap items-center gap-2">
              {LANGUAGES.map((lang) => {
                const selected = language === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    aria-pressed={selected}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      selected ? 'bg-[#9D0A0E] text-white' : 'border border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F1F3F5]'
                    }`}
                  >
                    {selected && <Check size={12} strokeWidth={3} />}
                    {lang}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-5 text-[#98A2B3]">{t('settings.language.hint')}</p>
          </SettingsSection>
        </div>
      </main>
    </div>
  );
}
