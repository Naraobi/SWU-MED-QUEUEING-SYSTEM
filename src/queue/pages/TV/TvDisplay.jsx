import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BellRing,
  Clock,
  ListPlus,
  ArrowRight,
  Info,
  Volume2,
  Monitor,
} from 'lucide-react';

import {
  getKiosks,
  getPatientDepartments,
  getTerminals,
} from '../../services/backendApi';
import { fetchQueueState } from '../../services/api';
import HospitalPhoto from '../../../assets/LoginBG1.jpg';

/*
 * SWUMed TV Display — one screen per kiosk.
 *
 *   /display?kiosk=<kiosk_id>
 *
 * Without ?kiosk the screen shows a kiosk picker, so a TV can be set up
 * once and bookmarked.
 *
 * Video: drop the presentation file at
 *   public/videos/swumed-presentation.mp4
 * It autoplays muted on a loop. Until the file exists, the hospital
 * photo is shown in its place.
 */

const POLL_MS = 5000;
const WAITING_SLOTS = 8;
const VIDEO_SRC = '/videos/swumed-presentation.mp4';

function isPriorityTicket(ticket) {
  if (!ticket) return false;
  return (
    String(ticket.id || '').toUpperCase().startsWith('P-') ||
    ticket.service === 'Priority'
  );
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
   Live queue data for every department assigned to one kiosk
--------------------------------------------------------------- */
function useKioskQueue(kioskId) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    serving: [],
    waiting: [],
    estimatedWait: 0,
  });

  const terminalNames = useRef(new Map());

  const load = useCallback(async () => {
    if (!kioskId) return;

    try {
      if (terminalNames.current.size === 0) {
        const terminals = await getTerminals().catch(() => []);
        (Array.isArray(terminals) ? terminals : terminals?.data || []).forEach((t) => {
          const id = t.counter_id || t.id;
          if (id) terminalNames.current.set(String(id), t.counter_number ?? '');
        });
      }

      const departments = await getPatientDepartments(kioskId);
      const list = Array.isArray(departments) ? departments : [];

      const results = await Promise.all(
        list
          .filter((d) => d.prefix)
          .map((d) =>
            fetchQueueState(d.prefix)
              .then((q) => ({ department: d, queue: q }))
              .catch(() => null)
          )
      );

      const valid = results.filter(Boolean);

      const label = (ticket, department) => {
        const number = ticket.counterId
          ? terminalNames.current.get(String(ticket.counterId))
          : '';
        return {
          ...ticket,
          departmentName: department.name || ticket.department || '',
          terminalLabel: number ? `Terminal ${number}` : '',
        };
      };

      const serving = valid
        .filter(({ queue }) => queue.currentlyServing)
        .map(({ department, queue }) => label(queue.currentlyServing, department));

      const waiting = valid.flatMap(({ department, queue }) =>
        (queue.waitingQueue || []).map((t) => label(t, department))
      );

      const averages = valid
        .map(({ queue }) => Number(queue.stats?.averageServiceMinutes) || 0)
        .filter((n) => n > 0);

      setState({
        loading: false,
        error: null,
        serving,
        waiting,
        estimatedWait: averages.length
          ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length)
          : 0,
      });
    } catch (error) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error?.message || 'Unable to load the queue.',
      }));
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
   Audio: chime + spoken announcement when a new number is called.
   Browsers block sound until the screen is clicked once, so the
   TV shows an "Enable sound" button until then.
--------------------------------------------------------------- */
function useCallAnnouncer(serving) {
  const [enabled, setEnabled] = useState(false);
  const announced = useRef(new Set());
  const primed = useRef(false);

  const chime = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [880, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + i * 0.35;
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {
      /* audio is best-effort */
    }
  }, []);

  useEffect(() => {
    const keys = serving.map((t) => t.uniqueKey || t.id);

    // First load: remember what is already being served, don't announce it.
    if (!primed.current) {
      keys.forEach((k) => announced.current.add(k));
      primed.current = true;
      return;
    }

    const fresh = serving.filter((t) => !announced.current.has(t.uniqueKey || t.id));
    fresh.forEach((t) => announced.current.add(t.uniqueKey || t.id));

    if (!enabled || fresh.length === 0) return;

    chime();

    if ('speechSynthesis' in window) {
      fresh.forEach((t) => {
        const spokenNumber = String(t.id).split('').join(' ');
        const where = t.terminalLabel ? `, please proceed to ${t.terminalLabel}` : '';
        const utterance = new SpeechSynthesisUtterance(
          `Now serving ${spokenNumber}${where}.`
        );
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      });
    }
  }, [serving, enabled, chime]);

  return { enabled, enable: () => setEnabled(true) };
}

/* =========================================================
   PIECES
========================================================= */

function ServingCard({ ticket, priority }) {
  const numberColor = priority ? 'text-[#9D0A0E]' : 'text-[#1F2937]';

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-6 py-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-[#4B5563]">
          {ticket?.departmentName || '\u00A0'}
        </p>

        <span
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white ${
            priority ? 'bg-[#9D0A0E]' : 'bg-[#1F2937]'
          }`}
        >
          {priority ? 'Priority Queue' : 'Regular Queue'}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        <p className={`text-6xl font-extrabold leading-none tracking-tight ${ticket ? numberColor : 'text-[#D1D5DB]'}`}>
          {ticket?.id || '---'}
        </p>

        {ticket?.terminalLabel && (
          <span className="shrink-0 rounded-md bg-[#F1F3F5] px-4 py-2 text-sm font-bold uppercase tracking-wide text-[#1F2937]">
            {ticket.terminalLabel}
          </span>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-[#4B5563]">
        <ArrowRight size={14} />
        {ticket
          ? ticket.terminalLabel
            ? `Please proceed to ${ticket.terminalLabel}`
            : 'Please proceed to the counter'
          : 'No patient is being served'}
      </p>
    </div>
  );
}

function WaitingCard({ ticket }) {
  const priority = isPriorityTicket(ticket);

  return (
    <div
      className={`rounded-xl border-2 bg-white px-3 py-3 text-center ${
        priority ? 'border-[#9D0A0E]/60' : 'border-[#1F2937]/40'
      }`}
    >
      <p className="truncate text-xs font-medium uppercase tracking-wide text-[#4B5563]">
        {ticket.departmentName || '\u00A0'}
      </p>
      <p className={`mt-1 text-2xl font-bold ${priority ? 'text-[#9D0A0E]' : 'text-[#1F2937]'}`}>
        {ticket.id}
      </p>
    </div>
  );
}

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
              className="flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] px-4 py-3 text-left text-sm font-semibold text-[#1F2937] transition hover:border-[#9D0A0E] hover:bg-[#FBF1F1]"
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

/* =========================================================
   TV DISPLAY
========================================================= */

export default function TvDisplay() {
  const [params] = useSearchParams();
  const kioskId = params.get('kiosk');

  const now = useClock();
  const { loading, error, serving, waiting, estimatedWait } = useKioskQueue(kioskId);
  const { enabled: soundOn, enable: enableSound } = useCallAnnouncer(serving);

  const [videoFailed, setVideoFailed] = useState(false);

  const priorityServing = useMemo(() => serving.find(isPriorityTicket) || null, [serving]);
  const regularServing = useMemo(
    () => serving.find((t) => !isPriorityTicket(t)) || null,
    [serving]
  );

  if (!kioskId) return <KioskPicker />;

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">

      {/* HEADER */}

      <header className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-10 py-5">
        <p className="text-4xl font-bold">
          <span className="text-[#9D0A0E]">SWU</span>
          <span className="text-[#4B5563]">Med</span>
        </p>

        <div className="text-right">
          <p className="text-4xl font-bold text-[#1F2937]">{time}</p>
          <p className="text-base font-medium text-[#4B5563]">{date}</p>
        </div>
      </header>

      {/* BODY */}

      <div className="grid min-h-0 flex-1 grid-cols-2">

        {/* LEFT: queue */}

        <section className="flex min-h-0 flex-col overflow-hidden bg-[#F8F9FA] px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-[#1F2937]">
              <BellRing size={22} className="text-[#9D0A0E]" />
              Now Serving
            </p>

            {estimatedWait > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-4 py-1.5 text-sm font-medium text-[#4B5563] shadow-sm">
                <Clock size={14} />
                Estimated Wait: ~{estimatedWait} min
              </span>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <ServingCard ticket={priorityServing} priority />
            <ServingCard ticket={regularServing} priority={false} />
          </div>

          <p className="mt-6 flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-[#1F2937]">
            <ListPlus size={22} className="text-[#4B5563]" />
            Waiting Queue
          </p>

          <div className="mt-3 grid grid-cols-4 gap-3">
            {waiting.slice(0, WAITING_SLOTS).map((ticket) => (
              <WaitingCard key={ticket.uniqueKey || ticket.id} ticket={ticket} />
            ))}
          </div>

          {!loading && waiting.length === 0 && !error && (
            <p className="mt-3 text-sm text-[#9CA3AF]">No patients waiting.</p>
          )}

          {error && (
            <p className="mt-3 text-sm text-[#9D0A0E]">{error}</p>
          )}

          {!soundOn && (
            <button
              type="button"
              onClick={enableSound}
              className="mt-auto flex w-fit items-center gap-2 self-start rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#4B5563] shadow-sm transition hover:border-[#9D0A0E] hover:text-[#9D0A0E]"
            >
              <Volume2 size={14} />
              Enable sound announcements
            </button>
          )}
        </section>

        {/* RIGHT: presentation video */}

        <section className="relative min-h-0 overflow-hidden bg-[#1F2937]">
          {!videoFailed ? (
            <video
              key={VIDEO_SRC}
              src={VIDEO_SRC}
              poster={HospitalPhoto}
              autoPlay
              muted
              loop
              playsInline
              onError={() => setVideoFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <>
              <img
                src={HospitalPhoto}
                alt="SWU Medical Center"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center gap-2 rounded-md bg-white/95 px-4 py-2 text-sm font-medium text-[#1F2937] shadow">
                  <Info size={14} className="text-[#9D0A0E]" />
                  SWUMed Information Video
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}