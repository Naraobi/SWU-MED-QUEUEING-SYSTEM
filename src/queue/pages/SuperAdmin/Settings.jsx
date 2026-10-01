import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Sun,
  Moon,
  Monitor,
  Check,
  ShieldCheck,
  LockKeyhole,
  Palette,
  Copy,
  Upload,
 Eye, 
 EyeOff,
  KeyRound,
  Globe,
  FileText,
  ExternalLink,
  Save,
  PencilLine,
} from 'lucide-react';

import { auth } from '../../../firebase';
import {

  getSecurityPinStatus,
  requestSecurityPinVerification,
  verifySecurityPinCode,
} from '../../services/backendApi';

import ChangePasswordModal from '../../components/changePasswordModal';
import LegalModal, { LAST_UPDATED } from '../../components/LegalModal';

import {
  getAccentColor,
  getThemeMode,
  getLogo,
  getSystemName,
  getClockFormat,
  setAccentColor,
  setThemeMode,
  setLogo,
  setSystemName,
  setClockFormat,
  applyAccentColor,
  applyThemeMode,
  readLogoFile,
} from '../../services/appearance';

import { useLanguage, LANGUAGES } from '../../services/language';

import TvVideoManagement from '../../components/settings/TvVideoManagement';
import EstimatedTransactionTime from '../../components/settings/EstimatedTransactionTime';

import Logo from '../../../assets/logo.png';

const ACCENT_PRESETS = [
  '#9D0A0E',
  '#B34C4C',
  '#1F2937',
  '#0F766E',
  '#4B5563',
];

const CLOCK_FORMATS = [
  { key: '12h', labelKey: 'sa.settings.clock12' },
  { key: '24h', labelKey: 'sa.settings.clock24' },
];

// Each swatch is a 4-quadrant preview circle.
const THEME_MODES = [
  {
    key: 'light',
    labelKey: 'sa.settings.themeLight',
    captionKey: 'sa.settings.themeLightCaption',
    icon: Sun,
  },
  {
    key: 'dark',
    labelKey: 'sa.settings.themeDark',
    captionKey: 'sa.settings.themeDarkCaption',
    icon: Moon,
  },
  {
    key: 'system',
    labelKey: 'sa.settings.themeSystem',
    captionKey: 'sa.settings.themeSystemCaption',
    icon: Monitor,
  },
];

function SettingsSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
}) {
  return (
    <section className="swu-card rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div className="flex items-start gap-2.5">
          <Icon
            size={16}
            className="mt-0.5 shrink-0 text-[#9D0A0E]"
          />

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

      {/* Body */}
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

/* ---------------- Create PIN Modal ---------------- */

function CreatePinModal({ onClose, onContinue }) {
  const { t } = useLanguage();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  
  // States for toggling PIN visibility
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const handleContinue = () => {
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError(t('sa.pin.mustBeSix'));
      return;
    }

    if (pin !== confirmPin) {
      setError(t('sa.pin.noMatch'));
      return;
    }

    onContinue(pin);
  };

  const handlePinChange = (value, setter) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setter(digitsOnly);
    setError('');
  };

  return (
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              {t('sa.pin.createTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              {t('sa.pin.createSub')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] transition hover:text-[#1F2937]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#FBF1F1] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#9D0A0E]">
              <ShieldCheck size={16} />
            </div>

            <p className="text-xs leading-4 text-[#4B5563]">
              {t('sa.pin.intro')}
            </p>
          </div>

          {/* New PIN */}
          <div>
            <label
              htmlFor="security-pin"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
            >
              {t('sa.pin.newPin')}
            </label>

            <div className="relative">
              <input
                id="security-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value, setPin)}
                placeholder={t('sa.pin.newPinPlaceholder')}
                className="w-full rounded-lg border border-[#E5E7EB] pl-3 pr-10 py-2.5 text-sm tracking-[0.35em] text-[#1F2937] outline-none transition placeholder:tracking-normal placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9CA3AF] hover:text-[#4B5563] focus:outline-none"
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm PIN */}
          <div>
            <label
              htmlFor="confirm-security-pin"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
            >
              {t('sa.pin.confirmPin')}
            </label>

            <div className="relative">
              <input
                id="confirm-security-pin"
                type={showConfirmPin ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
                placeholder={t('sa.pin.confirmPinPlaceholder')}
                className="w-full rounded-lg border border-[#E5E7EB] pl-3 pr-10 py-2.5 text-sm tracking-[0.35em] text-[#1F2937] outline-none transition placeholder:tracking-normal placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9CA3AF] hover:text-[#4B5563] focus:outline-none"
              >
                {showConfirmPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
          >
            {t('sa.common.cancel')}
          </button>

          <button
            type="button"
            onClick={handleContinue}
            className="swu-press rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
          >
            {t('sa.common.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PIN Verification Modal ---------------- */

function PinVerificationModal({
  onClose,
  onBack,
  onSuccess,
  firebaseUser,
  pendingPin,
}) {
  const { t } = useLanguage();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState('');

  const handleCodeChange = (value) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
    setError('');
    setMessage('');
  };

  const handleVerify = async () => {
    setError('');
    setMessage('');

    if (!/^\d{6}$/.test(code)) {
      setError(t('sa.pin.codeMustBeSix'));
      return;
    }

    if (!/^\d{6}$/.test(pendingPin)) {
      setError(t('sa.pin.pinMissing'));
      return;
    }

    if (!firebaseUser) {
      setError(t('sa.pin.noSession'));
      return;
    }

    try {
      setIsVerifying(true);

      await verifySecurityPinCode(
        firebaseUser,
        code,
        pendingPin
      );

      onSuccess();
    } catch (err) {
      setError(err?.message || t('sa.pin.verifyFailed'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');

    if (!firebaseUser) {
      setError(t('sa.pin.noSession'));
      return;
    }

    try {
      setIsResending(true);

      await requestSecurityPinVerification(
        firebaseUser
      );

      setCode('');
      setMessage(t('sa.pin.resent'));
    } catch (err) {
      setError(err?.message || t('sa.pin.resendFailed'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              {t('sa.pin.verifyTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              {t('sa.pin.verifySub')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] transition hover:text-[#1F2937]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#FBF1F1] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#9D0A0E]">
              <LockKeyhole size={15} />
            </div>

            <p className="text-xs leading-4 text-[#4B5563]">
              {t('sa.pin.verifyIntro')}
            </p>
          </div>

          <div>
            <label
              htmlFor="pin-verification-code"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
            >
              {t('sa.pin.code')}
            </label>

            <input
              id="pin-verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder={t('sa.pin.codePlaceholder')}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-center text-sm font-semibold tracking-[0.4em] text-[#1F2937] outline-none transition placeholder:tracking-normal placeholder:font-normal placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="text-xs font-medium text-green-600">
              {message}
            </p>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-xs font-semibold text-[#9D0A0E] transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResending ? t('sa.pin.sending') : t('sa.pin.resend')}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isVerifying}
            className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('sa.common.back')}
          </button>

          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="swu-press rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {isVerifying ? t('sa.pin.verifying') : t('sa.pin.verify')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PIN Success Modal ---------------- */

function PinSuccessModal({ onClose, isChanging }) {
  const { t } = useLanguage();

  return (
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex flex-col items-center px-6 py-7 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
            <Check size={24} strokeWidth={2.5} />
          </div>

          <h2 className="mt-4 text-base font-bold text-[#1F2937]">
            {isChanging ? t('sa.pin.changed') : t('sa.pin.created')}
          </h2>

          <p className="mt-2 max-w-xs text-xs leading-5 text-[#4B5563]">
            {isChanging ? t('sa.pin.changedBody') : t('sa.pin.createdBody')}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="swu-press mt-6 rounded-md bg-[#9D0A0E] px-6 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
          >
            {t('sa.common.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Settings Page ---------------- */

export default function Settings() {
  /*
  |--------------------------------------------------------------------------
  | DRAFT AND SAVED
  |--------------------------------------------------------------------------
  |
  | Branding, appearance, language and clock format are edited as a draft and
  | committed together by "Save All Changes". Nothing is written to storage
  | until then, so a half-finished change never leaks into the rest of the app.
  |
  | Accent and theme are the exception in one direction only: they are PREVIEWED
  | live on the document, because a colour you cannot see is impossible to pick.
  | applyAccentColor / applyThemeMode touch the DOM without persisting, while
  | setAccentColor / setThemeMode are what Save calls. Leaving the page with
  | unsaved changes puts the preview back.
  |
  | The two sections below with their own Save buttons - TV videos and
  | transaction times - act on their own and are not part of this draft.
  |
  */
  const { language, setLanguage, t } = useLanguage();

  const readSaved = () => ({
    systemName: getSystemName(),
    accentColor: getAccentColor(),
    themeMode: getThemeMode(),
    logo: getLogo(),
    language,
    clockFormat: getClockFormat(),
  });

  const [saved, setSaved] = useState(readSaved);
  const [draft, setDraft] = useState(readSaved);

  const dirty = useMemo(
    () =>
      draft.systemName !== saved.systemName ||
      draft.accentColor !== saved.accentColor ||
      draft.themeMode !== saved.themeMode ||
      draft.logo !== saved.logo ||
      draft.language !== saved.language ||
      draft.clockFormat !== saved.clockFormat,
    [draft, saved]
  );

  const [justSaved, setJustSaved] = useState(false);

  function update(patch) {
    setDraft((current) => ({ ...current, ...patch }));
    setJustSaved(false);
  }

  // Live preview of the two visual choices.
  useEffect(() => {
    applyAccentColor(draft.accentColor);
  }, [draft.accentColor]);

  useEffect(() => {
    applyThemeMode(draft.themeMode);
  }, [draft.themeMode]);

  // Leaving with the preview still showing unsaved colours puts it back.
  useEffect(
    () => () => {
      applyAccentColor(getAccentColor());
      applyThemeMode(getThemeMode());
    },
    []
  );

  // A reload would silently drop the draft, so say so first.
  useEffect(() => {
    if (!dirty) return undefined;

    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function handleSaveAll() {
    setSystemName(draft.systemName);
    setAccentColor(draft.accentColor);
    setThemeMode(draft.themeMode);
    setClockFormat(draft.clockFormat);

    if (draft.logo !== saved.logo) {
      setLogo(draft.logo);
    }

    if (draft.language !== saved.language) {
      setLanguage(draft.language);
    }

    setSaved(draft);
    setJustSaved(true);
    setLogoNoColour(false);
    setDerivedAccent(null);
  }

  function handleDiscardAll() {
    setDraft(saved);
    setJustSaved(false);
    setLogoError('');
    setLogoNoColour(false);
    setDerivedAccent(null);

    applyAccentColor(saved.accentColor);
    applyThemeMode(saved.themeMode);
  }

  // Which legal document is open, if any.
  const [legalDocument, setLegalDocument] = useState(null);
  const [legalMode, setLegalMode] = useState('view');

  const [activeModal, setActiveModal] = useState(null);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [pinStatusLoading, setPinStatusLoading] = useState(true);
  const [pendingPin, setPendingPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSecurityPinStatus = async () => {
      try {
        setPinStatusLoading(true);
        setPinError('');

        const firebaseUser = auth.currentUser;

        if (!firebaseUser) {
          throw new Error(t('sa.pin.noSession'));
        }

        const result = await getSecurityPinStatus(firebaseUser);

        if (isMounted) {
          setPinConfigured(Boolean(result.configured));
        }
      } catch (error) {
        console.error('Failed to load Security PIN status:', error);

        if (isMounted) {
          setPinError(error?.message || t('sa.pin.statusFailed'));
        }
      } finally {
        if (isMounted) {
          setPinStatusLoading(false);
        }
      }
    };

    loadSecurityPinStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | SYSTEM LOGO
  |--------------------------------------------------------------------------
  |
  | The file is read and its dominant colour worked out immediately so the
  | preview is honest, but neither the logo nor the derived accent is stored
  | until Save. A logo with no real colour in it (a plain black wordmark)
  | leaves the accent alone rather than turning the whole system grey.
  |
  */
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoNoColour, setLogoNoColour] = useState(false);
  const [derivedAccent, setDerivedAccent] = useState(null);

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];

    // Cleared so choosing the same file twice still fires a change.
    event.target.value = '';

    if (!file) return;

    setLogoError('');
    setLogoNoColour(false);
    setDerivedAccent(null);
    setLogoBusy(true);

    try {
      const { dataUrl, accent } = await readLogoFile(file);

      if (accent) {
        update({ logo: dataUrl, accentColor: accent });
        setDerivedAccent(accent);
      } else {
        update({ logo: dataUrl });
        setLogoNoColour(true);
      }
    } catch (error) {
      setLogoError(error?.message || t('sa.settings.logoFailed'));
    } finally {
      setLogoBusy(false);
    }
  }

  function handleLogoRestore() {
    update({ logo: null });
    setDerivedAccent(null);
    setLogoNoColour(false);
    setLogoError('');
  }

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopyName() {
    navigator.clipboard
      ?.writeText(draft.systemName)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  }

  return (
    <div className="space-y-5">

      {/* =====================================================
          PAGE TITLE + SAVE ALL
      ===================================================== */}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">
            {t('sa.settings.title')}
          </h1>

          <p className="mt-0.5 text-xs text-[#4B5563]">
            {t('sa.settings.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={handleDiscardAll}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#4B5563] transition hover:text-[#9D0A0E]"
            >
              {t('sa.settings.discard')}
            </button>
          )}

          {justSaved && !dirty && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D8A4E]">
              <Check size={12} strokeWidth={3} />
              {t('sa.settings.allSaved')}
            </span>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={!dirty}
            className="swu-press inline-flex items-center gap-1.5 rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            <Save size={13} />
            {t('sa.settings.saveAll')}
          </button>
        </div>
      </div>

      {dirty && (
        <p className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-2.5 text-xs text-[#9D0A0E]">
          {t('sa.settings.unsavedNote')}
        </p>
      )}

      {/* =====================================================
          BRANDING & IDENTITY
      ===================================================== */}

      <SettingsSection
        icon={Palette}
        title={t('sa.settings.branding')}
        subtitle={t('sa.settings.brandingSub')}
        badge={t('sa.settings.whiteLabel')}
      >

        {/* SYSTEM NAME */}

        <div>
          <FieldLabel>{t('sa.settings.systemName')}</FieldLabel>

          <div className="relative">
            <input
              id="system-name"
              type="text"
              value={draft.systemName}
              onChange={(e) => update({ systemName: e.target.value })}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 pr-10 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
            />

            <button
              type="button"
              onClick={handleCopyName}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[#9CA3AF] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
              aria-label={t('sa.settings.copyName')}
              title={copied ? t('sa.settings.copied') : t('sa.settings.copy')}
            >
              {copied ? (
                <Check size={16} className="text-emerald-600" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>

          <Hint>{t('sa.settings.systemNameHint')}</Hint>
        </div>

        {/* SYSTEM LOGO */}

        <div className="mt-6">
          <FieldLabel>{t('sa.settings.systemLogo')}</FieldLabel>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] px-4 py-3">

            <div className="flex items-center gap-4">
              <img
                src={draft.logo || Logo}
                alt={
                  draft.logo
                    ? t('sa.settings.uploadedLogo')
                    : t('sa.settings.currentLogo')
                }
                className="h-7 w-auto object-contain"
              />

              <div>
                <p className="flex items-center gap-2 text-xs font-semibold text-[#1F2937]">
                  {t('sa.settings.currentLogo')}

                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/30">
                    {t('sa.common.active')}
                  </span>
                </p>

                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  {t('sa.settings.logoFormats')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {draft.logo && (
                <button
                  type="button"
                  onClick={handleLogoRestore}
                  disabled={logoBusy}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
                >
                  {t('sa.settings.restoreLogo')}
                </button>
              )}

              <label
                className={`swu-press flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E] ${
                  logoBusy ? 'pointer-events-none opacity-60' : 'cursor-pointer'
                }`}
              >
                <Upload size={14} />
                {logoBusy
                  ? t('sa.settings.readingLogo')
                  : t('sa.settings.uploadLogo')}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  disabled={logoBusy}
                  className="hidden"
                />
              </label>
            </div>

          </div>

          {derivedAccent && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[#4B5563]">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: derivedAccent }}
              />
              {t('sa.settings.logoAccent')}
            </p>
          )}

          {logoNoColour && (
            <p className="mt-2 text-xs text-[#9CA3AF]">
              {t('sa.settings.logoNoColour')}
            </p>
          )}

          {logoError && (
            <p className="mt-2 text-xs text-[#9D0A0E]">{logoError}</p>
          )}
        </div>

        {/* PRIMARY ACCENT COLOR */}

        <div className="mt-6">
          <FieldLabel>{t('sa.settings.accent')}</FieldLabel>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2">
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: draft.accentColor }}
              />
              <span className="text-xs font-semibold uppercase text-[#1F2937]">
                {t('sa.settings.hex')} {draft.accentColor}
              </span>
            </div>

            <div className="flex items-center gap-2 border-l border-[#E5E7EB] pl-4">
              <span className="text-xs text-[#4B5563]">
                {t('sa.settings.presets')}
              </span>

              {ACCENT_PRESETS.map((preset) => {
                const isSelected = draft.accentColor === preset;

                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => update({ accentColor: preset })}
                    aria-label={`Accent ${preset}`}
                    aria-pressed={isSelected}
                    className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                      isSelected
                        ? 'ring-2 ring-[#9D0A0E] ring-offset-2'
                        : 'ring-1 ring-black/10 hover:ring-[#9CA3AF]'
                    }`}
                    style={{ backgroundColor: preset }}
                  >
                    {isSelected && (
                      <Check size={12} strokeWidth={3} className="text-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Hint>{t('sa.settings.accentHint')}</Hint>
        </div>
    </SettingsSection>

      {/* =====================================================
          PASSWORD & SECURITY
      ===================================================== */}

      <SettingsSection
        icon={ShieldCheck}
        title={t('sa.settings.security')}
        subtitle={t('sa.settings.securitySub')}
      >
        <div className="divide-y divide-[#E5E7EB]">

          {/* PASSWORD */}

          <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
            <div>
              <p className="text-sm font-bold text-[#1F2937]">
                {t('sa.settings.password')}
              </p>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                {t('sa.settings.passwordSub')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="swu-press flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
            >
              <KeyRound size={14} />
              {t('sa.settings.changePassword')}
            </button>
          </div>

          {/* SECURITY PIN */}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                {t('sa.settings.securityPin')}

                {pinConfigured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/30">
                    <Check size={10} strokeWidth={3} />
                    {t('sa.settings.pinIsSet')}
                  </span>
                )}
              </p>

              <p className="mt-0.5 text-xs text-[#4B5563]">
                {t('sa.settings.pinSub')}
              </p>

              {pinError && (
                <p className="mt-1.5 text-xs font-medium text-[#9D0A0E]">
                  {pinError}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={pinStatusLoading}
              onClick={() => {
                setIsChangingPin(pinConfigured);
                setActiveModal('createPin');
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LockKeyhole size={14} />
              {pinStatusLoading
                ? t('sa.common.loading')
                : pinConfigured
                  ? t('sa.settings.changePin')
                  : t('sa.settings.setPin')}
            </button>
          </div>

        </div>
      </SettingsSection>

      {/* =====================================================
          APPEARANCE
      ===================================================== */}

      <SettingsSection
        icon={Monitor}
        title={t('sa.settings.appearance')}
        subtitle={t('sa.settings.appearanceSub')}
      >
        <FieldLabel>{t('sa.settings.themeMode')}</FieldLabel>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_MODES.map(({ key, labelKey, captionKey, icon: Icon }) => {
            const isSelected = draft.themeMode === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => update({ themeMode: key })}
                aria-pressed={isSelected}
                className={`rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? 'border-[#9D0A0E] ring-1 ring-[#9D0A0E]'
                    : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Icon size={14} className="mt-0.5 shrink-0 text-[#9D0A0E]" />
                    <div>
                      <p className="text-xs font-bold text-[#1F2937]">
                        {t(labelKey)}
                      </p>
                      <p className="mt-0.5 text-xs text-[#9CA3AF]">
                        {t(captionKey)}
                      </p>
                    </div>
                  </div>

                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? 'border-[#9D0A0E]' : 'border-[#D1D5DB]'
                    }`}
                  >
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-[#9D0A0E]" />
                    )}
                  </span>
                </div>

                <div
                  aria-hidden="true"
                  className={`mt-3 overflow-hidden rounded-md border border-[#E5E7EB] px-3 py-3 ${
                    key === 'dark'
                      ? 'bg-[#1F2937]'
                      : key === 'system'
                        ? 'bg-gradient-to-r from-white to-[#1F2937]'
                        : 'bg-white'
                  }`}
                >
                  <span
                    className={`block h-2 w-16 rounded-sm ${
                      key === 'dark' ? 'bg-white/70' : 'bg-[#4B5563]'
                    }`}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="h-3 w-8 rounded-sm"
                      style={{ backgroundColor: draft.accentColor }}
                    />
                    <span
                      className={`h-3 flex-1 rounded-sm ${
                        key === 'dark' ? 'bg-white/20' : 'bg-[#E5E7EB]'
                      }`}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* =====================================================
          TV VIDEO MANAGEMENT
          Its own component, with its own Upload action - not part
          of the Save All draft above.
      ===================================================== */}

      <TvVideoManagement />

      {/* =====================================================
          ESTIMATED TRANSACTION TIME
          Also self-contained, with its own Save Changes button.
      ===================================================== */}

      <EstimatedTransactionTime />

      {/* =====================================================
          LANGUAGE & REGIONAL SETTINGS
      ===================================================== */}

      <SettingsSection
        icon={Globe}
        title={t('sa.settings.language')}
        subtitle={t('sa.settings.languageSub')}
      >
        <div>
          <FieldLabel>{t('sa.settings.primaryLanguage')}</FieldLabel>

          <div className="flex flex-wrap items-center gap-2">
            {LANGUAGES.map((lang) => {
              const isSelected = draft.language === lang;

              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => update({ language: lang })}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-[#B34C4C] text-white'
                      : 'border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F1F3F5]'
                  }`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                  {lang}
                </button>
              );
            })}
          </div>

          <Hint>{t('sa.settings.languageHint')}</Hint>
        </div>

        <div className="mt-5 border-t border-[#E5E7EB] pt-5">
          <FieldLabel>{t('sa.settings.clockFormat')}</FieldLabel>

          <select
            value={draft.clockFormat}
            onChange={(e) => update({ clockFormat: e.target.value })}
            aria-label={t('sa.settings.clockFormat')}
            className="w-full max-w-xs rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
          >
            {CLOCK_FORMATS.map((format) => (
              <option key={format.key} value={format.key}>
                {t(format.labelKey)}
              </option>
            ))}
          </select>

          <Hint>{t('sa.settings.clockHint')}</Hint>
        </div>
      </SettingsSection>

      {/* =====================================================
          TERMS & CONDITIONS
      ===================================================== */}

      <SettingsSection
        icon={FileText}
        title={t('sa.settings.legal')}
        subtitle={t('sa.settings.legalSub')}
        badge={t('sa.settings.updated', { date: LAST_UPDATED })}
      >
        <div className="divide-y divide-[#E5E7EB]">

          {[
            {
              key: 'terms',
              titleKey: 'sa.settings.terms',
              captionKey: 'sa.settings.termsCaption',
            },
            {
              key: 'privacy',
              titleKey: 'sa.settings.privacy',
              captionKey: 'sa.settings.privacyCaption',
            },
          ].map((item, index) => (
            <div
              key={item.key}
              className={`flex flex-wrap items-center justify-between gap-4 ${
                index === 0 ? 'pb-5' : 'pt-5'
              }`}
            >
              <div>
                <p className="text-sm font-bold text-[#1F2937]">
                  {t(item.titleKey)}
                </p>
                <p className="mt-0.5 text-xs text-[#4B5563]">
                  {t(item.captionKey)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLegalMode('view');
                    setLegalDocument(item.key);
                  }}
                  className="swu-press flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
                >
                  <ExternalLink size={14} />
                  {t('sa.settings.view')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLegalMode('edit');
                    setLegalDocument(item.key);
                  }}
                  className="swu-press flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
                >
                  <PencilLine size={14} />
                  {t('sa.common.edit')}
                </button>
              </div>
            </div>
          ))}

        </div>
      </SettingsSection>

      {/* Modals */}
      {legalDocument && (
        <LegalModal
          document={legalDocument}
          mode={legalMode}
          onClose={() => setLegalDocument(null)}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal
          onSuccess={() => setShowChangePassword(false)}
          onClose={() => setShowChangePassword(false)}
        />
      )}

      {activeModal === 'createPin' && (
        <CreatePinModal
          onClose={() => {
            setPendingPin('');
            setActiveModal(null);
          }}
          onContinue={async (pin) => {
            try {
              setPinError('');

              const firebaseUser = auth.currentUser;

              if (!firebaseUser) {
                throw new Error(t('sa.pin.noSession'));
              }

              setPendingPin(pin);

              await requestSecurityPinVerification(firebaseUser);

              setActiveModal('verifyPin');
            } catch (error) {
              console.error(
                'Failed to request Security PIN verification:',
                error
              );

              setPinError(error?.message || t('sa.pin.sendFailed'));
            }
          }}
        />
      )}

      {activeModal === 'verifyPin' && (
        <PinVerificationModal
          firebaseUser={auth.currentUser}
          pendingPin={pendingPin}
          onClose={() => {
            setPendingPin('');
            setActiveModal(null);
          }}
          onBack={() => setActiveModal('createPin')}
          onSuccess={() => {
            setPendingPin('');
            setPinConfigured(true);
            setActiveModal('pinSuccess');
          }}
        />
      )}

      {activeModal === 'pinSuccess' && (
        <PinSuccessModal
          onClose={() => setActiveModal(null)}
          isChanging={isChangingPin}
        />
      )}
    </div>
  );
}