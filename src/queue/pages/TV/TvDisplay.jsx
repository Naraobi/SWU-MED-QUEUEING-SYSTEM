import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Monitor,
  Video,
  UploadCloud,
  FileVideo,
  RefreshCw,
  Trash2,
  Check,
  Zap,
  Megaphone,
  Volume2,
} from 'lucide-react';

import {
  getKiosks,
  getPatientDepartments,
  getTerminals,
} from '../../services/backendApi';
import { fetchQueueState } from '../../services/api';
import { getLogo, subscribeAppearance } from '../../services/appearance';

import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { auth } from '../../../firebase';

import brandMark from '../../../assets/logo-transparent.png';

import {
  announceCall,
  attachVideo,
  enable as enableAnnouncer,
  cancelAnnouncements,
} from '../../services/announcer';

/*
 * SWUMed TV Display — one screen per kiosk.
 *
 *   /display?kiosk=<kiosk_id>
 *
 * Left: a card per department showing who is being served and who is next.
 * Right: the lobby information video. Until one is uploaded, the upload
 * panel is shown instead.
 *
 * The chosen video is stored in this browser (IndexedDB), so it survives a
 * refresh or a power cut without needing a server.
 */

const POLL_MS = 5000;
const MAX_DEPARTMENTS = 4;
const WAITING_ROWS = 2;
const SETTINGS_KEY = 'swumed_tv_video_settings';

/* ---------------------------------------------------------------
   Video storage (IndexedDB) — a TV should not lose its video on reboot
--------------------------------------------------------------- */

const DB_NAME = 'swumed-tv';
const STORE = 'video';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveVideo(kioskId, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record, kioskId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadVideo(kioskId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(kioskId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function removeVideo(kioskId) {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(kioskId);
    tx.oncomplete = () => resolve();
  });
}

/* ---------------------------------------------------------------
   Shared lobby video (Firebase) - set from Admin Settings, plays on every
   TV on any device. When present it takes priority over the video saved in
   this browser.
--------------------------------------------------------------- */

function normalizeTvVideos(data) {
  if (Array.isArray(data?.videos)) return data.videos.filter((video) => video?.url);
  if (data?.url) {
    return [{ id: 'legacy', name: data.name, url: data.url, uploaded_at: data.updated_at }];
  }
  return [];
}

/*
 * mode 'single'   -> play only the video chosen in Admin Settings
 * mode 'playlist' -> play every video in order, one after another
 * loop            -> repeat the video, or restart the list after the last one
 */
function useSharedLobbyVideo(kioskId) {
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!kioskId) return undefined;
    setData(null);

    return onSnapshot(
      doc(getFirestore(auth.app), 'kiosks', String(kioskId), 'settings', 'tvVideo'),
      (snap) => setData(snap.exists() ? snap.data() : null),
      () => setData(null)
    );
  }, [kioskId]);

  const loop = data?.loop ?? true;
  const muted = data?.muted ?? true;

  const queue = useMemo(() => {
    const videos = normalizeTvVideos(data);
    if (data?.mode === 'playlist') return videos;
    const one = videos.find((video) => video.id === data?.activeId) || videos[0];
    return one ? [one] : [];
  }, [data]);

  // Start from the first video whenever the list or the choice changes.
  const queueKey = queue.map((video) => video.id).join(',');
  useEffect(() => setIndex(0), [queueKey]);

  const current = queue.length ? queue[Math.min(index, queue.length - 1)] : null;

  // The version suffix makes the TV fetch a replaced video instead of
  // replaying a cached copy of an old one at the same address.
  const url = useMemo(() => {
    if (!current?.url) return null;
    return `${current.url}${current.url.includes('?') ? '&' : '?'}v=${encodeURIComponent(current.uploaded_at || '')}`;
  }, [current]);

  // Playlist: move to the next video; after the last one restart if looping.
  const onEnded = useCallback(() => {
    if (queue.length <= 1) return;
    setIndex((i) => (i + 1 < queue.length ? i + 1 : loop ? 0 : i));
  }, [queue.length, loop]);

  return {
    url,
    name: current?.name || null,
    settings: { loop, muted },
    // One video repeats by itself; a playlist advances through onEnded instead.
    nativeLoop: queue.length <= 1 ? loop : false,
    onEnded,
  };
}

/* ---------------------------------------------------------------
   helpers
--------------------------------------------------------------- */

function isPriority(ticket) {
  if (!ticket) return false;
  return (
    Boolean(ticket.isPriority || ticket.is_priority) ||
    String(ticket.id || '').toUpperCase().startsWith('P-')
  );
}

function formatSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024
    ? `${(mb / 1024).toFixed(1)} GB`
    : `${mb.toFixed(1)} MB`;
}

function readSettings() {
  try {
    return {
      loop: true,
      muted: true,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    };
  } catch {
    return { loop: true, muted: true };
  }
}

/* ---------------------------------------------------------------
   Clock
--------------------------------------------------------------- */

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/* ---------------------------------------------------------------
   Live queue for every department on this kiosk
--------------------------------------------------------------- */

function useKioskQueue(kioskId) {
  const [state, setState] = useState({ loading: true, error: null, departments: [] });
  const terminals = useRef(new Map());

  const load = useCallback(async () => {
    if (!kioskId) return;

    try {
      if (terminals.current.size === 0) {
        const rows = await getTerminals().catch(() => []);
        (Array.isArray(rows) ? rows : rows?.data || []).forEach((t) => {
          const id = t.counter_id || t.id;
          if (id) terminals.current.set(String(id), t.counter_number ?? '');
        });
      }

      const list = await getPatientDepartments(kioskId);

      const results = await Promise.all(
        (Array.isArray(list) ? list : [])
          .filter((d) => d.prefix)
          .slice(0, MAX_DEPARTMENTS)
          .map(async (department) => {
            try {
              const queue = await fetchQueueState(department.prefix);
              return { department, queue };
            } catch {
              return { department, queue: { waitingQueue: [], currentlyServing: null } };
            }
          })
      );

      setState({
        loading: false,
        error: null,
        departments: results.map(({ department, queue }) => {
          const serving = queue.currentlyServing;
          const waiting = queue.waitingQueue || [];

          return {
            id: department.department_id || department.prefix,
            name: department.name || 'Department',
            code: department.prefix || '',
            serving,
            servingTerminal: serving?.counterId
              ? terminals.current.get(String(serving.counterId))
              : null,
            priority: waiting.filter(isPriority),
            regular: waiting.filter((t) => !isPriority(t)),
          };
        }),
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error?.message || 'Unable to load the queue.' }));
    }
  }, [kioskId]);

  useEffect(() => {
    if (!kioskId) return undefined;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [kioskId, load]);

  return state;
}

/* ---------------------------------------------------------------
   Spoken announcement when a new number is called
--------------------------------------------------------------- */

/*
 * callSignature()
 *
 * Identifies a CALL, not a ticket. A recall re-announces the SAME ticket, so
 * keying on the ticket id alone makes the second call look like one already
 * seen - which is exactly why pressing Recall on the staff terminal did
 * nothing on the TV. Folding the call timestamps and the recall counter into
 * the key gives a recall a new signature for the same ticket.
 *
 * FOR THE BACKEND TEAM: this needs POST /staff-queue/recall/:prefix to move at
 * least one of called_at, recalled_at or recall_count. If the recall endpoint
 * changes nothing on the row, the TV has no way to know a recall happened.
 */
function callSignature(serving, terminal) {
  return [
    serving.uniqueKey || serving.id,
    serving.calledAt ?? '',
    serving.recalledAt ?? '',
    serving.recallCount ?? '',
    terminal ?? '',
  ].join('|');
}

function useAnnouncer(departments) {
  const [enabled, setEnabled] = useState(false);
  const [latest, setLatest] = useState(null);

  // Signatures already announced, plus the tickets behind them. A ticket seen
  // before that arrives under a NEW signature is a recall rather than a call.
  const seen = useRef(new Set());
  const seenTickets = useRef(new Set());
  const primed = useRef(false);

  useEffect(() => {
    const calls = departments
      .filter((d) => d.serving)
      .map((d) => ({
        key: callSignature(d.serving, d.servingTerminal),
        ticket: d.serving.uniqueKey || d.serving.id,
        number: d.serving.id,
        terminal: d.servingTerminal,
      }));

    if (!primed.current) {
      calls.forEach((c) => {
        seen.current.add(c.key);
        seenTickets.current.add(c.ticket);
      });
      primed.current = true;
      return;
    }

    const announcements = calls
      .filter((c) => !seen.current.has(c.key))
      .map((c) => {
        const recall = seenTickets.current.has(c.ticket);

        seen.current.add(c.key);
        seenTickets.current.add(c.ticket);

        return { ...c, recall };
      });

    if (announcements.length === 0) return;

    setLatest(announcements[announcements.length - 1]);

    // Each call is chimed, spoken twice, and queued so they never overlap.
    announcements.forEach((call) =>
      announceCall({ number: call.number, terminal: call.terminal })
    );
  }, [departments, enabled]);

  // Stop anything mid-sentence if the screen is closed.
  useEffect(() => () => cancelAnnouncements(), []);

  return {
    enabled,
    enable: () => {
      enableAnnouncer();
      setEnabled(true);
    },
    latest,
  };
}

/* =========================================================
   DEPARTMENT CARD
========================================================= */

function QueueChip({ ticket, priority }) {
  return (
    <div
      className={`shrink-0 rounded-md px-3 py-1 text-center text-sm font-bold ${
        priority
          ? 'bg-[#FBF1F1] text-[#9D0A0E]'
          : 'bg-[#EFF4FA] text-[#1F2937]'
      }`}
    >
      {ticket.id}
    </div>
  );
}

/*
 * One waiting lane (Priority or Regular).
 *
 * The header is fixed height; only the chip list grows, and it clips rather
 * than spilling, so a busy department can never push a ticket outside the
 * card. Whatever does not fit is counted instead of being silently dropped.
 */
function QueueLane({ label, tickets, priority }) {
  const next = tickets[0]?.id || '\u2014';
  const rows = tickets.slice(1, WAITING_ROWS + 1);
  const hidden = Math.max(0, tickets.length - WAITING_ROWS - 1);

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <div
        className={`shrink-0 rounded-md border px-2 py-1.5 text-center ${
          priority
            ? 'border-[#F0DADA] bg-[#FBF1F1]'
            : 'border-[#E5E7EB] bg-[#EFF4FA]'
        }`}
      >
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold uppercase text-white ${
            priority ? 'bg-[#9D0A0E]' : 'bg-[#1F2937]'
          }`}
        >
          {label}
        </span>

        <p className="mt-1 truncate text-xs text-[#4B5563]">
          Next:{' '}
          <span className={`font-bold ${priority ? 'text-[#9D0A0E]' : 'text-[#1F2937]'}`}>
            {next}
          </span>
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
        {rows.map((ticket) => (
          <QueueChip
            key={ticket.uniqueKey || ticket.id}
            ticket={ticket}
            priority={priority}
          />
        ))}

        {hidden > 0 && (
          <p className="shrink-0 text-center text-[10px] font-medium text-[#9CA3AF]">
            +{hidden} more waiting
          </p>
        )}
      </div>
    </div>
  );
}

function DepartmentCard({ department }) {
  const { name, code, serving, servingTerminal, priority, regular } = department;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-[#1F2937]">
          {name}
        </p>
        {code && (
          <span className="shrink-0 rounded bg-[#F1F3F5] px-1.5 py-0.5 text-xs font-medium text-[#9CA3AF]">
            {code}
          </span>
        )}
      </div>

      {/* now serving - keyed on the call so a recall re-animates the number */}
      <div
        key={serving ? callSignature(serving, servingTerminal) : 'idle'}
        className={`mt-2 shrink-0 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5 text-center ${
          serving ? 'swu-pop' : ''
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
          Now Serving
        </p>

        <p className={`mt-0.5 text-3xl font-extrabold ${serving ? 'text-[#9D0A0E]' : 'text-[#D1D5DB]'}`}>
          {serving?.id || '---'}
        </p>

        <p className="mt-0.5 text-xs text-[#4B5563]">
          {serving
            ? servingTerminal
              ? `\u2192 Proceed to Terminal ${servingTerminal}`
              : '\u2192 Proceed to the counter'
            : 'No patient is being served'}
        </p>
      </div>

      <p className="mt-2.5 shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
        Waiting Queue
      </p>

      {/* next up, split by lane */}
      {/*
        The two lanes take whatever height is left and clip inside the card.
        Without min-h-0 + overflow-hidden the chips are drawn PAST the card's
        rounded border and the grid slices them in half - that was the bug.
      */}
      <div className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2">
        <QueueLane label="Priority" tickets={priority} priority />
        <QueueLane label="Regular" tickets={regular} priority={false} />
      </div>
    </div>
  );
}

/* =========================================================
   VIDEO UPLOAD PANEL
========================================================= */

function UploadPanel({ onPublish, settings, setSettings, error }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function choose(selected) {
    if (!selected) return;
    setFile(selected);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
          <Video size={16} />
        </span>
        <div>
          <p className="text-sm font-bold text-[#1F2937]">Upload Information Video</p>
          <p className="text-xs text-[#4B5563]">
            Select a video file to broadcast on the Lobby TV Display
          </p>
        </div>
      </div>

      {/* drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging ? 'border-[#9D0A0E] bg-[#FBF1F1]' : 'border-[#E5E7EB] bg-white'
        }`}
      >
        <UploadCloud size={56} className="text-[#9D0A0E]" />

        <p className="mt-3 text-sm font-bold text-[#1F2937]">
          Drag and Drop Video file here
        </p>

        <p className="mt-1 max-w-sm text-xs text-[#4B5563]">
          Supported formats: MP4, WebM (1080p recommended, max 500MB)
        </p>

        <p className="my-2 text-xs font-semibold text-[#9CA3AF]">OR</p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="swu-press rounded-md border border-[#F0DADA] bg-white px-5 py-2 text-xs font-bold uppercase tracking-wide text-[#9D0A0E] transition-colors hover:bg-[#FBF1F1]"
        >
          Browse
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </div>

      {/* chosen file */}
      {file && (
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#F1F3F5] text-[#4B5563]">
              <FileVideo size={15} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#1F2937]">
                {file.name}
                <Check size={12} className="shrink-0 text-emerald-600" />
              </p>
              <p className="text-xs text-[#9CA3AF]">
                {formatSize(file.size)} &middot; Ready
              </p>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="swu-press flex items-center gap-1 text-xs font-medium text-[#4B5563] transition-colors hover:text-[#9D0A0E]"
            >
              <RefreshCw size={12} />
              Replace
            </button>

            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove file"
              className="swu-press rounded p-1 text-[#9CA3AF] transition-colors hover:text-[#9D0A0E]"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#F1F3F5]">
            <div className="h-full w-full rounded-full bg-[#9D0A0E]" />
          </div>
        </div>
      )}

      {/* settings */}
      <div className="rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#4B5563]">
          Video Display Settings
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { key: 'loop', title: 'Loop playback', caption: 'Replay continuously on lobby screen' },
            { key: 'muted', title: 'Audio mute on display', caption: 'Recommended for waiting lobby' },
          ].map(({ key, title, caption }) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-[#E5E7EB] bg-white p-2.5"
            >
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) =>
                  setSettings({ ...settings, [key]: e.target.checked })
                }
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#9D0A0E]"
              />
              <span>
                <span className="block text-xs font-semibold text-[#1F2937]">{title}</span>
                <span className="block text-xs text-[#9CA3AF]">{caption}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-[#E5E7EB] bg-white p-2.5">
          <span>
            <span className="block text-xs text-[#9CA3AF]">Scheduling</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-[#1F2937]">
              <Zap size={11} className="text-[#9D0A0E]" />
              Immediate Broadcast
            </span>
          </span>

          <span className="rounded bg-[#EFF4FA] px-2 py-1 text-xs font-medium text-[#4B5563]">
            Live TV-DISP-01
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9D0A0E]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] pt-3">
        <button
          type="button"
          onClick={() => setFile(null)}
          className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-medium text-[#4B5563] transition-colors hover:bg-[#F1F3F5]"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={!file}
          onClick={() => onPublish(file)}
          className="swu-press flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UploadCloud size={13} />
          Upload &amp; Publish to TV
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   TV DISPLAY
========================================================= */

function KioskPicker() {
  const [, setParams] = useSearchParams();
  const [kiosks, setKiosks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getKiosks()
      .then((rows) => setKiosks(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e?.message || 'Unable to load kiosks.'));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Monitor size={20} className="text-[#9D0A0E]" />
          <h1 className="text-lg font-bold text-[#1F2937]">Choose a kiosk for this TV</h1>
        </div>
        <p className="mt-1 text-sm text-[#4B5563]">
          Each TV shows the queue for one kiosk. Bookmark the page after choosing.
        </p>

        {error && <p className="mt-4 text-sm text-[#9D0A0E]">{error}</p>}
        {!kiosks && !error && <p className="mt-4 text-sm text-[#9CA3AF]">Loading kiosks...</p>}

        <div className="mt-5 space-y-2">
          {kiosks?.map((k) => (
            <button
              key={k.kiosk_id}
              type="button"
              onClick={() => setParams({ kiosk: k.kiosk_id })}
              className="swu-press flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] px-4 py-3 text-left text-sm font-semibold text-[#1F2937] transition hover:border-[#9D0A0E] hover:bg-[#FBF1F1]"
            >
              {k.name}
              <ArrowRight size={16} className="text-[#9CA3AF]" />
            </button>
          ))}
          {kiosks && kiosks.length === 0 && (
            <p className="text-sm text-[#9CA3AF]">No kiosks found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TvDisplay() {
  const [params] = useSearchParams();
  const kioskId = params.get('kiosk');

  const now = useClock();
  const { loading, error, departments } = useKioskQueue(kioskId);
  const { enabled: soundOn, enable: enableSound, latest } = useAnnouncer(departments);

  // A logo uploaded in Settings replaces the bundled mark on the TV too.
  const [brandLogo, setBrandLogo] = useState(() => getLogo());

  useEffect(
    () => subscribeAppearance((appearance) => setBrandLogo(appearance.logo)),
    []
  );

  const [videoUrl, setVideoUrl] = useState(null);
  const [videoName, setVideoName] = useState(null);
  const [settings, setSettings] = useState(() => readSettings());
  const [videoError, setVideoError] = useState(null);

  // Shared video wins; otherwise fall back to the video saved in this browser.
  const shared = useSharedLobbyVideo(kioskId);
  const activeUrl = shared.url || videoUrl;
  const activeName = shared.url ? shared.name : videoName;
  const activeSettings = shared.url ? shared.settings : settings;

  /* load any video already saved for this kiosk */
  useEffect(() => {
    if (!kioskId) return undefined;
    let url = null;

    loadVideo(kioskId)
      .then((record) => {
        if (record?.blob) {
          url = URL.createObjectURL(record.blob);
          setVideoUrl(url);
          setVideoName(record.name);
        }
      })
      .catch(() => {});

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [kioskId]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  async function publish(file) {
    setVideoError(null);

    if (file.size > 500 * 1024 * 1024) {
      setVideoError('That file is larger than 500MB.');
      return;
    }

    try {
      await saveVideo(kioskId, { blob: file, name: file.name, size: file.size });
      setVideoUrl(URL.createObjectURL(file));
      setVideoName(file.name);
    } catch {
      setVideoError('Could not save the video on this device.');
    }
  }

  async function clearVideo() {
    await removeVideo(kioskId).catch(() => {});
    setVideoUrl(null);
    setVideoName(null);
  }

  const time = useMemo(
    () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [now]
  );

  const date = useMemo(
    () => now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    [now]
  );

  if (!kioskId) return <KioskPicker />;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#F8F9FA]">

      {/* HEADER */}

      <header className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-3">
        <img
          src={brandLogo || brandMark}
          alt="SWUMed"
          className="h-14 w-auto object-contain object-left"
        />

        <div className="text-right">
          <p className="text-3xl font-bold text-[#1F2937]">{time}</p>
          <p className="text-sm font-medium text-[#4B5563]">{date}</p>
        </div>
      </header>

      {/* BODY */}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 p-3">

        {/* LEFT — departments */}

        <section className="grid min-h-0 grid-cols-2 grid-rows-2 gap-3 overflow-hidden">
          {loading && departments.length === 0 && (
            <p className="col-span-2 self-center text-center text-sm text-[#9CA3AF]">
              Loading departments...
            </p>
          )}

          {!loading && departments.length === 0 && !error && (
            <p className="col-span-2 self-center text-center text-sm text-[#9CA3AF]">
              No departments assigned to this kiosk.
            </p>
          )}

          {error && (
            <p className="col-span-2 self-center text-center text-sm text-[#9D0A0E]">{error}</p>
          )}

          {departments.map((department) => (
            <DepartmentCard key={department.id} department={department} />
          ))}
        </section>

        {/* RIGHT — video */}

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          {activeUrl ? (
            <>
              <div className="relative min-h-0 flex-1 bg-black">
                <video
                  ref={attachVideo}
                  key={activeUrl}
                  src={activeUrl}
                  autoPlay
                  controls
                  loop={shared.url ? shared.nativeLoop : settings.loop}
                  onEnded={shared.url ? shared.onEnded : undefined}
                  muted={activeSettings.muted}
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#E5E7EB] px-3 py-2 text-xs text-[#4B5563]">
                <span className="truncate">{activeName}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {activeSettings.muted && (
                    <span className="rounded bg-[#F1F3F5] px-2 py-0.5">Muted for Lobby</span>
                  )}
                  {!shared.url && (
                  <button
                    type="button"
                    onClick={clearVideo}
                    className="swu-press rounded-md border border-[#E5E7EB] px-2 py-1 font-medium transition-colors hover:border-[#F0DADA] hover:text-[#9D0A0E]"
                  >
                    Replace video
                  </button>
                  )}
                </div>
              </div>

              {/* announcement */}
              {latest && (
                <div
                  key={latest.key}
                  className="swu-enter flex shrink-0 items-center gap-3 bg-[#9D0A0E] px-4 py-3 text-white"
                >
                  <Megaphone size={18} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-white/80">
                      {latest.recall ? 'Repeat Call' : 'Patient Announcement'}
                    </p>
                    <p className="truncate text-sm">
                      {latest.recall ? 'Paging again' : 'Paging'}{' '}
                      <span className="font-bold">{latest.number}</span>
                      {latest.terminal ? ` to Terminal ${latest.terminal}` : ''} &middot; Please
                      present your appointment slip or valid government ID.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <UploadPanel
              onPublish={publish}
              settings={settings}
              setSettings={setSettings}
              error={videoError}
            />
          )}
        </section>
      </div>

      {!soundOn && (
        <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-6">
          <div className="swu-pop w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
              <Volume2 size={26} />
            </span>

            <h2 className="mt-4 text-xl font-bold text-[#1F2937]">
              Turn on voice announcements
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#4B5563]">
              Called numbers will be announced aloud in the lobby. This screen
              needs one tap before it is allowed to play sound.
            </p>

            <button
              type="button"
              onClick={enableSound}
              className="swu-press mt-6 w-full rounded-lg bg-[#9D0A0E] py-3 text-base font-bold text-white transition-colors hover:bg-[#7D080B]"
            >
              Start Display
            </button>

            <p className="mt-3 text-xs text-[#9CA3AF]">
              Only needed once, each time the screen is restarted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}