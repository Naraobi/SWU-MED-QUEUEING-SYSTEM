import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';

/*
 * useFormDraft — "continue where you left off" for forms.
 *
 * Saves what the user has typed to this browser as they go, so a refresh,
 * a crash, a blackout, or navigating away doesn't lose their work.
 *
 * It never refills the form silently. When a draft is found it surfaces a
 * small bar offering Restore or Discard, so nobody is surprised by data
 * they didn't just type.
 *
 *   const draft = useFormDraft('kiosk-add', {
 *     values: { kioskName, kioskLocation, kioskStatus },
 *     enabled: modalOpen && mode === 'add',
 *     exclude: ['kioskPin'],            // never stored
 *   });
 *
 *   {draft.pending && (
 *     <DraftRestoreBar
 *       savedAt={draft.savedAt}
 *       onRestore={() => {
 *         const v = draft.restore();
 *         setKioskName(v.kioskName ?? '');
 *       }}
 *       onDiscard={draft.discard}
 *     />
 *   )}
 *
 * Call draft.clear() after a successful save, or when the user cancels.
 */

const PREFIX = 'swumed_draft:';
const SAVE_DELAY_MS = 400;
const DEFAULT_TTL_HOURS = 24;

function isEmptyValue(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function useFormDraft(
  key,
  { values, enabled = true, exclude = [], ttlHours = DEFAULT_TTL_HOURS } = {}
) {
  const storageKey = `${PREFIX}${key}`;

  const [pending, setPending] = useState(null);
  const timer = useRef(null);
  const checked = useRef(false);

  const strip = useCallback(
    (source) => {
      const out = {};
      Object.entries(source || {}).forEach(([field, value]) => {
        if (!exclude.includes(field)) out[field] = value;
      });
      return out;
    },
    [exclude]
  );

  /* ---- look for an existing draft when the form opens ---- */

  useEffect(() => {
    if (!enabled) {
      checked.current = false;
      setPending(null);
      return;
    }

    if (checked.current) return;
    checked.current = true;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      const age = Date.now() - (saved.savedAt || 0);

      if (age > ttlHours * 60 * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return;
      }

      if (saved.values && Object.keys(saved.values).length > 0) {
        setPending(saved);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [enabled, storageKey, ttlHours]);

  /* ---- save as the user types (debounced) ---- */

  useEffect(() => {
    if (!enabled) return undefined;

    const payload = strip(values);
    const hasContent = Object.values(payload).some((v) => !isEmptyValue(v));

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      try {
        if (!hasContent) {
          localStorage.removeItem(storageKey);
          return;
        }

        localStorage.setItem(
          storageKey,
          JSON.stringify({ values: payload, savedAt: Date.now() })
        );
      } catch {
        /* storage full or blocked — drafts are best-effort */
      }
    }, SAVE_DELAY_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, values, storageKey, strip]);

  const restore = useCallback(() => {
    const saved = pending?.values || {};
    setPending(null);
    return saved;
  }, [pending]);

  const discard = useCallback(() => {
    setPending(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const clear = useCallback(() => {
    setPending(null);
    checked.current = false;
    if (timer.current) clearTimeout(timer.current);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return {
    pending: Boolean(pending),
    savedAt: pending?.savedAt || null,
    restore,
    discard,
    clear,
  };
}

/* =========================================================
   The bar shown when unsaved work is found
========================================================= */

function timeAgo(timestamp) {
  if (!timestamp) return '';

  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export function DraftRestoreBar({ savedAt, onRestore, onDiscard }) {
  return (
    <div className="swu-enter mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5">
      <RotateCcw size={14} className="shrink-0 text-[#9D0A0E]" />

      <p className="min-w-0 flex-1 text-xs text-[#1F2937]">
        You have unsaved changes from{' '}
        <span className="font-semibold">{timeAgo(savedAt)}</span>.
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRestore}
          className="swu-press rounded-md bg-[#9D0A0E] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#7D080B]"
        >
          Restore
        </button>

        <button
          type="button"
          onClick={onDiscard}
          aria-label="Discard saved changes"
          className="swu-press rounded-md p-1.5 text-[#4B5563] transition-colors hover:bg-white hover:text-[#1F2937]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default useFormDraft;
