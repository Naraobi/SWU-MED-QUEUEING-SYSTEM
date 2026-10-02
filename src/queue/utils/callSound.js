import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';

import { auth } from '../../firebase';
import {
  announceCall,
  duckVideo,
  enable as enableAnnouncer,
  isAnnouncing,
  unduckVideo,
} from '../services/announcer';

/*
 * =============================================================================
 * CALL SOUND
 * =============================================================================
 *
 * What plays when a queue number is called. Each kiosk has one setting:
 *
 *   mode: 'muted'  no sound at all
 *         'chime'  the call chime only (public/sounds/queue-call.mp3)   DEFAULT
 *         'voice'  the chime, then the number spoken aloud
 *
 * The setting is saved per kiosk in Firestore at
 *
 *   kiosks/<kioskId>/settings/callSound   ->   { mode, updated_at }
 *
 * the same pattern as the Lobby TV video document. TV displays subscribe to it,
 * so a change in Admin or Super Admin reaches them without a refresh. A Staff
 * screen can override the mode for itself only (see staffOverride.js); that
 * never touches this document.
 *
 * Everything that announces a call goes through playCallSound() below. The
 * spoken part is the app's EXISTING voice code (services/announcer.js for the
 * TV, Staff's own announceCalledPatient for the Staff screen); this file only
 * decides whether and when it runs.
 * =============================================================================
 */

export const CALL_SOUND_MODES = ['muted', 'chime', 'voice'];

export const DEFAULT_CALL_SOUND_MODE = 'chime';

export function normalizeCallSoundMode(value) {
  return CALL_SOUND_MODES.includes(value) ? value : DEFAULT_CALL_SOUND_MODE;
}

/* ---------------------------------------------------------------
   The sound file
--------------------------------------------------------------- */

// Vite-base aware, so it still resolves if the app is served from a sub-path.
export const CALL_SOUND_URL = `${import.meta.env.BASE_URL || '/'}sounds/queue-call.mp3`;

const VOLUME = 0.8;

// Calls closer together than this share one chime (the voice still queues).
const CHIME_COOLDOWN_MS = 500;

// The longest the chime is waited for before the voice starts.
const CHIME_MAX_WAIT_MS = 7000;

// The longest a new voice call waits for the previous announcement to finish.
const SPEECH_MAX_WAIT_MS = 30000;

let audio = null;
let failed = false;
let lastChimeAt = 0;

function getAudio() {
  if (failed || typeof Audio === 'undefined') return null;

  if (!audio) {
    audio = new Audio(CALL_SOUND_URL);
    audio.preload = 'auto';
    audio.volume = VOLUME;

    audio.addEventListener('error', () => {
      failed = true;
      console.warn(`Call sound could not be loaded (${CALL_SOUND_URL}).`);
    });
  }

  return audio;
}

// Start loading the file early so the first call is not late.
export function preloadCallSound() {
  getAudio()?.load();
}

/* ---------------------------------------------------------------
   Browsers block sound until the page has been clicked
--------------------------------------------------------------- */

let blocked = false;
const blockedListeners = new Set();

function setBlocked(value) {
  if (blocked === value) return;

  blocked = value;
  blockedListeners.forEach((listener) => listener(blocked));
}

export function isCallSoundBlocked() {
  return blocked;
}

export function subscribeCallSoundBlocked(listener) {
  blockedListeners.add(listener);
  return () => blockedListeners.delete(listener);
}

// Must run inside a click. Starts the file silently once, which is what
// lets later, un-clicked calls play.
export async function unlockCallSound() {
  enableAnnouncer();

  const element = getAudio();

  if (!element) {
    setBlocked(false);
    return true;
  }

  try {
    element.muted = true;
    await element.play();
    element.pause();
    element.currentTime = 0;
    element.muted = false;
    setBlocked(false);
    return true;
  } catch {
    element.muted = false;
    return false;
  }
}

/* ---------------------------------------------------------------
   Playing the chime
--------------------------------------------------------------- */

// Resolves once the chime has finished (or could not play). Never rejects.
function playChime() {
  const element = getAudio();

  if (!element) return Promise.resolve('failed');

  return new Promise((resolve) => {
    let done = false;
    let timer = null;

    const finish = (result) => {
      if (done) return;

      done = true;
      clearTimeout(timer);
      element.removeEventListener('ended', onEnded);
      element.removeEventListener('error', onError);
      resolve(result);
    };

    const onEnded = () => finish('played');
    const onError = () => finish('failed');

    element.addEventListener('ended', onEnded);
    element.addEventListener('error', onError);

    // A second call while it is still playing restarts it instead of piling up.
    try {
      element.pause();
      element.currentTime = 0;
    } catch {
      /* not ready yet - play() will start from the beginning */
    }

    element
      .play()
      .then(() => {
        setBlocked(false);
        timer = setTimeout(() => finish('played'), CHIME_MAX_WAIT_MS);
      })
      .catch((error) => {
        if (error?.name === 'NotAllowedError') {
          // Not a failure: the screen just needs a click.
          setBlocked(true);
          finish('blocked');
          return;
        }

        console.warn('Call sound could not play:', error?.message || error);
        finish('failed');
      });
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isSpeechBusy() {
  try {
    return isAnnouncing() || Boolean(window.speechSynthesis?.speaking);
  } catch {
    return false;
  }
}

// A new call never starts over one that is still being spoken.
async function waitForSpeechToFinish() {
  const started = Date.now();

  while (isSpeechBusy() && Date.now() - started < SPEECH_MAX_WAIT_MS) {
    await wait(150);
  }
}

// Calls are handled one after another, so their chimes never overlap.
let chain = Promise.resolve();

/*
 * playCallSound(mode, queueNumber, options)
 *
 *   mode         'muted' | 'chime' | 'voice' (anything else is treated as chime)
 *   queueNumber  e.g. 'BP-021'
 *   options.terminal   handed to the voice, as the TV announcer expects
 *   options.speak      the voice function to run in 'voice' mode. Defaults to
 *                      the TV announcer; the Staff screen passes its own
 *                      existing one.
 *
 * Returns a promise that resolves when the sound is done. It never rejects.
 */
export function playCallSound(mode, queueNumber, options = {}) {
  const resolved = normalizeCallSoundMode(mode);

  if (resolved === 'muted') return Promise.resolve();

  const run = async () => {
    if (resolved === 'voice') await waitForSpeechToFinish();

    // Lobby video down while the chime plays; the announcer ducks it itself
    // for the spoken part, so hand it back first.
    duckVideo();

    const now = Date.now();
    const cooledDown = now - lastChimeAt >= CHIME_COOLDOWN_MS;

    if (cooledDown) {
      lastChimeAt = now;
      await playChime();
    }

    unduckVideo();

    if (resolved !== 'voice') return;

    try {
      if (options.speak) {
        options.speak(queueNumber, options.terminal);
      } else {
        announceCall({ number: queueNumber, terminal: options.terminal, withChime: false });
      }
    } catch (error) {
      console.warn('Voice announcement failed:', error?.message || error);
    }
  };

  chain = chain.then(run, run).catch(() => {});

  return chain;
}

// "Test sound": the selected mode's sound. Muted plays the chime once, so the
// file itself can be checked. Must run inside a click.
export async function testCallSound(mode) {
  await unlockCallSound();

  lastChimeAt = 0;

  if (normalizeCallSoundMode(mode) === 'voice') {
    return playCallSound('voice', 'B-001');
  }

  duckVideo();
  await playChime();
  unduckVideo();

  return undefined;
}

/* ---------------------------------------------------------------
   The per-kiosk setting in Firestore
--------------------------------------------------------------- */

const callSoundDoc = (kioskId) =>
  doc(getFirestore(auth.app), 'kiosks', String(kioskId), 'settings', 'callSound');

// onChange(mode) fires with the saved mode, or the default when there is none.
export function subscribeCallSoundMode(kioskId, onChange, onError) {
  if (!kioskId) return () => {};

  return onSnapshot(
    callSoundDoc(kioskId),
    (snapshot) =>
      onChange(snapshot.exists() ? normalizeCallSoundMode(snapshot.data()?.mode) : DEFAULT_CALL_SOUND_MODE),
    (error) => {
      console.warn('Call sound setting could not be read:', error?.message || error);
      onChange(DEFAULT_CALL_SOUND_MODE);
      onError?.(error);
    }
  );
}

export async function saveCallSoundMode(kioskId, mode) {
  await setDoc(
    callSoundDoc(kioskId),
    { mode: normalizeCallSoundMode(mode), updated_at: new Date().toISOString() },
    { merge: true }
  );
}

// The kiosk's saved mode, live. `loaded` is false until the first answer.
export function useCallSoundMode(kioskId) {
  const [state, setState] = useState({ kioskId: null, mode: DEFAULT_CALL_SOUND_MODE });

  useEffect(() => {
    if (!kioskId) return undefined;

    return subscribeCallSoundMode(kioskId, (mode) => setState({ kioskId, mode }));
  }, [kioskId]);

  return {
    mode: state.kioskId === kioskId ? state.mode : DEFAULT_CALL_SOUND_MODE,
    loaded: Boolean(kioskId) && state.kioskId === kioskId,
  };
}

// True while the browser is refusing to play sound until a click.
export function useCallSoundBlocked() {
  const [value, setValue] = useState(isCallSoundBlocked());

  useEffect(() => subscribeCallSoundBlocked(setValue), []);

  return value;
}
