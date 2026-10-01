import { useEffect, useMemo, useState } from 'react';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  X,
  Sun,
  Moon,
  Monitor,
  Check,
  Pipette,
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
  Video,
  Trash2,
} from 'lucide-react';

import { auth } from '../../../firebase';
import {
  getKiosks,
  getSecurityPinStatus,
  requestSecurityPinVerification,
  verifySecurityPinCode,
} from '../../services/backendApi';

import ChangePasswordModal from '../../components/changePasswordModal';
import LegalModal, { LAST_UPDATED } from '../../components/LegalModal';

import {
  getAccentColor,
  getThemeMode,
  setAccentColor as persistAccentColor,
  setThemeMode as persistThemeMode,
  getLogo,
  clearLogo,
  applyBrandingFromFile,
} from '../../services/appearance';

import { useLanguage, LANGUAGES } from '../../services/language';

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
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              Department Customization
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Customize department settings.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md p-1.5 text-[#4B5563] transition-colors hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#4B5563]">
              Department Name
            </label>

            <input
              type="text"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#9D0A0E] focus:ring-1 focus:ring-[#9D0A0E]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

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

function ThemeModal({ onClose, onOpenColorPicker }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState('system');
  const [selectedSwatch, setSelectedSwatch] = useState('blue');

  return (
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-xs overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3.5">
          <h2 className="text-sm font-bold text-[#1F2937]">
            Theme
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#1F2937]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Mode selector */}
          <div className="flex items-center gap-1.5">
            {THEME_MODES.map(({ key, labelKey, icon: Icon }) => {
              const isActive = mode === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'border border-[#E5E7EB] bg-white text-[#1F2937] shadow-sm'
                      : 'border border-transparent bg-[#F1F3F5] text-[#4B5563] hover:bg-[#E5E7EB]'
                  }`}
                >
                  <Icon size={12} />
                  {t(labelKey)}
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
                  className="swu-press relative flex aspect-square items-center justify-center rounded-lg bg-[#F8F9FA] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#F1F3F5] hover:shadow-sm"
                >
                  <span
                    className="block h-8 w-8 rounded-full"
                    style={{
                      background: quadrantGradient(colors),
                    }}
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
              className="swu-press relative flex aspect-square items-center justify-center rounded-lg bg-[#F8F9FA] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#F1F3F5] hover:shadow-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C2603C] text-white">
                <Pipette size={14} />
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Hint({ children }) {
  return (
    <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">
      {children}
    </p>
  );
}

/* ---------------- Lobby TV video ----------------
 *
 * Each kiosk can hold several videos (up to TV_MAX_VIDEOS). The files live in
 * Firebase Storage (tv-videos/<kioskId>/<videoId>) and the list lives in
 * Firestore at kiosks/<kioskId>/settings/tvVideo as:
 *   { videos: [{ id, name, size, url, uploaded_at }], mode, activeId, loop, muted }
 *
 *   mode 'single'   -> the TV plays only the video chosen as activeId
 *   mode 'playlist' -> the TV plays every video in order, one after another
 *   loop            -> repeat the video (single) or restart the list (playlist)
 *
 * TV displays subscribe to that document, so changes appear without a refresh.
 */

const TV_MAX_BYTES = 500 * 1024 * 1024;
const TV_MAX_VIDEOS = 10;

const tvInfoDoc = (kioskId) =>
  doc(getFirestore(auth.app), 'kiosks', String(kioskId), 'settings', 'tvVideo');

// 'legacy' is the single video saved by the first version of this feature.
const tvFileRef = (kioskId, videoId) =>
  storageRef(
    getStorage(auth.app),
    videoId === 'legacy' ? `tv-videos/${kioskId}` : `tv-videos/${kioskId}/${videoId}`
  );

function normalizeTvVideos(data) {
  if (Array.isArray(data?.videos)) return data.videos.filter((video) => video?.url);
  if (data?.url) {
    return [{ id: 'legacy', name: data.name, size: data.size, url: data.url, uploaded_at: data.updated_at }];
  }
  return [];
}

// Reads the latest saved list, applies a change, and saves it back.
async function updateTvVideos(kioskId, change) {
  const snap = await getDoc(tvInfoDoc(kioskId));
  const data = snap.exists() ? snap.data() : {};

  const next = change({
    videos: normalizeTvVideos(data),
    activeId: data.activeId ?? null,
    mode: data.mode === 'playlist' ? 'playlist' : 'single',
  });

  await setDoc(
    tvInfoDoc(kioskId),
    {
      videos: next.videos,
      activeId: next.activeId,
      mode: next.mode,
      url: null,
      name: null,
      size: null,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

function formatVideoSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function TvVideoSettings({ accentColor }) {
  // Follows the accent colour chosen in Settings.

  const [kiosks, setKiosks] = useState([]);
  const [kioskId, setKioskId] = useState('');
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getKiosks()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setKiosks(list);
        if (list[0]) setKioskId(String(list[0].kiosk_id));
      })
      .catch((e) => setError(e?.message || 'Unable to load kiosks.'));
  }, []);

  // Live view of this kiosk's videos and playback settings.
  useEffect(() => {
    if (!kioskId) return undefined;
    setMessage('');
    setInfo(null);

    return onSnapshot(
      tvInfoDoc(kioskId),
      (snap) => setInfo(snap.exists() ? snap.data() : null),
      () => setInfo(null)
    );
  }, [kioskId]);

  const videos = useMemo(() => normalizeTvVideos(info), [info]);
  const mode = info?.mode === 'playlist' ? 'playlist' : 'single';
  const activeId =
    info?.activeId && videos.some((video) => video.id === info.activeId)
      ? info.activeId
      : videos[0]?.id ?? null;
  const tvSettings = { loop: info?.loop ?? true, muted: info?.muted ?? true };

  async function saveChange(change, doneMessage) {
    setError('');
    setMessage('');
    try {
      await updateTvVideos(kioskId, change);
      if (doneMessage) setMessage(doneMessage);
    } catch (err) {
      console.error('Lobby TV update failed:', err);
      setError('Could not save the change. Please try again.');
    }
  }

  async function updateTvSettings(next) {
    setError('');
    try {
      await setDoc(tvInfoDoc(kioskId), { loop: next.loop, muted: next.muted }, { merge: true });
    } catch {
      setError('Could not save the playback settings.');
    }
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || !kioskId) return;

    setError('');
    setMessage('');

    const room = TV_MAX_VIDEOS - videos.length;
    if (room <= 0) {
      setError(`This kiosk already has ${TV_MAX_VIDEOS} videos. Remove one first.`);
      return;
    }

    const accepted = [];
    const problems = [];

    files.forEach((file) => {
      if (!/^video\/(mp4|webm)$/.test(file.type)) {
        problems.push(`${file.name}: not an MP4 or WebM video.`);
      } else if (file.size > TV_MAX_BYTES) {
        problems.push(`${file.name}: larger than 500MB.`);
      } else {
        accepted.push(file);
      }
    });

    if (accepted.length > room) {
      accepted.splice(room);
      problems.push(`Only ${room} more video(s) fit on this kiosk, so the rest were skipped.`);
    }

    let added = 0;

    try {
      setBusy(true);

      for (let i = 0; i < accepted.length; i += 1) {
        const file = accepted[i];
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const label = (percent) => `Uploading ${i + 1}/${accepted.length}... ${percent}%`;

        setUploadLabel(label(0));

        const task = uploadBytesResumable(tvFileRef(kioskId, id), file, { contentType: file.type });
        await new Promise((resolve, reject) => {
          task.on(
            'state_changed',
            (s) => setUploadLabel(label(Math.round((s.bytesTransferred / s.totalBytes) * 100))),
            reject,
            resolve
          );
        });

        const url = await getDownloadURL(task.snapshot.ref);

        await updateTvVideos(kioskId, (current) => ({
          ...current,
          videos: [
            ...current.videos,
            { id, name: file.name, size: file.size, url, uploaded_at: new Date().toISOString() },
          ],
          activeId: current.activeId ?? id,
        }));

        added += 1;
      }

      if (added) {
        setMessage(`${added} video${added > 1 ? 's' : ''} added. TV displays will update automatically.`);
      }
      if (problems.length) setError(problems.join(' '));
    } catch (err) {
      console.error('Lobby TV upload failed:', err);
      setError(
        err?.code === 'storage/unauthorized'
          ? 'You are not allowed to upload. Please sign in again.'
          : 'Could not upload the video. Please try again.'
      );
    } finally {
      setBusy(false);
      setUploadLabel('');
    }
  }

  async function handleRemove(video) {
    setError('');
    setMessage('');
    try {
      await deleteObject(tvFileRef(kioskId, video.id)).catch(() => {}); // already gone is fine
      await updateTvVideos(kioskId, (current) => {
        const remaining = current.videos.filter((item) => item.id !== video.id);
        return {
          ...current,
          videos: remaining,
          activeId: current.activeId === video.id ? remaining[0]?.id ?? null : current.activeId,
        };
      });
      setMessage('Video removed.');
    } catch {
      setError('Could not remove the video.');
    }
  }

  return (
    <SettingsSection icon={Video} title="Lobby TV Video" subtitle="Upload the information videos shown beside the queue on the TV display.">
      <FieldLabel>Kiosk / TV</FieldLabel>
      <select value={kioskId} onChange={(event) => setKioskId(event.target.value)} aria-label="Kiosk" className="w-full max-w-xs rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20">
        {kiosks.length === 0 && <option value="">No kiosks found</option>}
        {kiosks.map((k) => (
          <option key={k.kiosk_id} value={k.kiosk_id}>{k.name}</option>
        ))}
      </select>

      <div className="mt-5">
        <FieldLabel>What to play</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { key: 'single', title: 'Play one video', caption: 'Choose which video the TV plays' },
            { key: 'playlist', title: 'Play all videos', caption: 'Plays every video one after another' },
          ].map(({ key, title, caption }) => (
            <button
              key={key}
              type="button"
              disabled={!kioskId || videos.length === 0}
              aria-pressed={mode === key}
              onClick={() => saveChange((current) => ({ ...current, mode: key }))}
              className="rounded-md border bg-white p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: mode === key ? accentColor : '#E5E7EB',
                boxShadow: mode === key ? `0 0 0 1px ${accentColor}` : 'none',
              }}
            >
              <span className="block text-xs font-semibold text-[#1F2937]">{title}</span>
              <span className="block text-xs text-[#98A2B3]">{caption}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {videos.length === 0 && (
          <div className="rounded-lg border border-[#E5E7EB] px-4 py-3">
            <p className="text-xs font-semibold text-[#1F2937]">No video uploaded</p>
            <p className="mt-0.5 text-xs text-[#98A2B3]">MP4 or WebM, up to 500MB each</p>
          </div>
        )}

        {videos.map((video, index) => {
          const isActive = mode === 'single' && video.id === activeId;

          return (
            <div key={video.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#1F2937]">{video.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-[#98A2B3]">
                  {formatVideoSize(video.size)}
                  {isActive && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: accentColor }}>Now playing</span>
                  )}
                  {mode === 'playlist' && (
                    <span className="rounded bg-[#F1F3F5] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#4B5563]">#{index + 1} in order</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {mode === 'single' && !isActive && (
                  <button type="button" onClick={() => saveChange((current) => ({ ...current, activeId: video.id, mode: 'single' }), 'Playing this video on the TV.')} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5]">
                    Play this one
                  </button>
                )}
                <button type="button" onClick={() => handleRemove(video)} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#667085] transition hover:border-[#F0DADA] hover:text-[#9D0A0E] disabled:cursor-not-allowed disabled:opacity-60">
                  <Trash2 size={14} />Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[#98A2B3]">{videos.length} of {TV_MAX_VIDEOS} videos</p>
        <label className={`flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E] ${busy || !kioskId || videos.length >= TV_MAX_VIDEOS ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
          <Upload size={14} />{busy ? uploadLabel || 'Uploading...' : 'Add videos'}
          <input type="file" multiple accept="video/mp4,video/webm" className="hidden" disabled={busy || !kioskId || videos.length >= TV_MAX_VIDEOS} onChange={handleUpload} />
        </label>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          { key: 'loop', title: 'Loop playback', caption: 'Repeat the video, or restart the list after the last one' },
          { key: 'muted', title: 'Mute video audio', caption: 'Recommended for the waiting lobby' },
        ].map(({ key, title, caption }) => (
          <label key={key} className="flex cursor-pointer items-start gap-2 rounded-md border border-[#E5E7EB] bg-white p-2.5">
            <input type="checkbox" checked={tvSettings[key]} disabled={!kioskId} onChange={(event) => updateTvSettings({ ...tvSettings, [key]: event.target.checked })} style={{ accentColor }} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="block text-xs font-semibold text-[#1F2937]">{title}</span>
              <span className="block text-xs text-[#98A2B3]">{caption}</span>
            </span>
          </label>
        ))}
      </div>

      {message && <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-xs text-[#9D0A0E]">{error}</p>}
      <Hint>Videos are stored online, so they play on every TV display for this kiosk, on any device. Up to {TV_MAX_VIDEOS} videos, 500MB each.</Hint>
    </SettingsSection>
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
   * `language` is the saved interface language rather than local state, so
   * picking one here re-labels the whole app straight away and survives a
   * refresh. `t` reads from the same choice.
   */
  const { language, setLanguage, t } = useLanguage();

  const [systemName, setSystemName] = useState(
    'SWUMed Queuing System'
  );

  /*
  |--------------------------------------------------------------------------
  | APPEARANCE
  |--------------------------------------------------------------------------
  |
  | Accent colour and theme mode apply across the whole app and are
  | remembered on this browser, so they survive a refresh.
  |
  */
  const [accentColor, setAccentColorState] = useState(
    () => getAccentColor()
  );

  function setAccentColor(color) {
    setAccentColorState(color);
    persistAccentColor(color);
  }

  // Which legal document is open, if any.
  const [legalDocument, setLegalDocument] = useState(null);

  const [themeMode, setThemeModeState] = useState(
    () => getThemeMode()
  );

  function setThemeMode(mode) {
    setThemeModeState(mode);
    persistThemeMode(mode);
  }
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

      const result =
        await getSecurityPinStatus(firebaseUser);

      if (isMounted) {
        setPinConfigured(
          Boolean(result.configured)
        );
      }
    } catch (error) {
      console.error(
        'Failed to load Security PIN status:',
        error
      );

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
  const [clockFormat, setClockFormat] = useState(
    CLOCK_FORMATS[0].key
  );

  /*
  |--------------------------------------------------------------------------
  | SYSTEM LOGO
  |--------------------------------------------------------------------------
  |
  | Uploading a logo also re-colours the app: the dominant colour of the image
  | becomes the accent, so the interface follows whatever branding the hospital
  | uploads without anyone picking a hex by hand. A logo with no real colour in
  | it (a plain black wordmark) leaves the accent alone rather than turning the
  | whole system grey.
  |
  */
  const [logo, setLogoState] = useState(() => getLogo());
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
      const result = await applyBrandingFromFile(file);

      setLogoState(result.logo);

      if (result.accent) {
        setAccentColorState(result.accent);
        setDerivedAccent(result.accent);
      } else {
        setLogoNoColour(true);
      }
    } catch (error) {
      setLogoError(error?.message || 'Could not use that image.');
    } finally {
      setLogoBusy(false);
    }
  }

  function handleLogoRestore() {
    clearLogo();
    setLogoState(null);
    setDerivedAccent(null);
    setLogoNoColour(false);
    setLogoError('');
  }

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
          {t('sa.settings.title')}
        </h1>

        <p className="mt-0.5 text-xs text-[#4B5563]">
          {t('sa.settings.subtitle')}
        </p>
      </div>

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
                src={logo || Logo}
                alt={
                  logo
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
              {logo && (
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
                  logoBusy
                    ? 'pointer-events-none opacity-60'
                    : 'cursor-pointer'
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
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-xs font-semibold uppercase text-[#1F2937]">
                {t('sa.settings.hex')} {accentColor}
              </span>
            </div>

            <div className="flex items-center gap-2 border-l border-[#E5E7EB] pl-4">
              <span className="text-xs text-[#4B5563]">
                {t('sa.settings.presets')}
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
                    className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                      isSelected
                        ? 'ring-2 ring-[#9D0A0E] ring-offset-2'
                        : 'ring-1 ring-black/10 hover:ring-[#9CA3AF]'
                    }`}
                    style={{ backgroundColor: preset }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
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
                <p className="mt-1.5 text-xs font-medium text-[#9D0A0E]">{pinError}</p>
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
                    {isSelected && <span className="h-2 w-2 rounded-full bg-[#9D0A0E]" />}
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
                  <span className={`block h-2 w-16 rounded-sm ${key === 'dark' ? 'bg-white/70' : 'bg-[#4B5563]'}`} />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-3 w-8 rounded-sm" style={{ backgroundColor: accentColor }} />
                    <span className={`h-3 flex-1 rounded-sm ${key === 'dark' ? 'bg-white/20' : 'bg-[#E5E7EB]'}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

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
              const isSelected = language === lang;

              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
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
            value={clockFormat}
            onChange={(e) => setClockFormat(e.target.value)}
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

      <TvVideoSettings accentColor={accentColor} />

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

              <button
                type="button"
                onClick={() => setLegalDocument(item.key)}
                className="swu-press flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
              >
                <ExternalLink size={14} />
                {t('sa.settings.view')}
              </button>
            </div>
          ))}

        </div>
      </SettingsSection>

      {/* Modals */}
      {legalDocument && (
        <LegalModal
          document={legalDocument}
          onClose={() => setLegalDocument(null)}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal
          onSuccess={() => setShowChangePassword(false)}
          onClose={() => setShowChangePassword(false)}
        />
      )}

      {activeModal === 'department' && (
        <DepartmentCustomizationModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'theme' && (
        <ThemeModal
          onClose={() => setActiveModal(null)}
          onOpenColorPicker={() => setActiveModal('colorPicker')}
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

      await requestSecurityPinVerification(
        firebaseUser
      );

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