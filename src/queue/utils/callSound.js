import { useEffect, useState } from 'react';
import { getFirestore, doc, deleteField, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

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
 * A kiosk can also have a CUSTOM sound (an uploaded audio file) in the same
 * document: customSoundUrl, customSoundName, customSoundPath (the Storage
 * object, call-sounds/<kioskId>/...), customSoundSize, customSoundUpdatedAt.
 * When customSoundUrl exists the chime IS that file; if it cannot load or play,
 * the default chime plays instead, so a call is never silent in chime/voice mode.
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

/* ---------------------------------------------------------------
   The custom sound (set from the kiosk's Firestore document)
--------------------------------------------------------------- */

// A custom sound that failed is tried again after this long.
const CUSTOM_RETRY_MS = 60000;

// The custom file has this long to start playing before the default is used.
const CUSTOM_START_TIMEOUT_MS = 4000;

// A custom sound is waited for (and then stopped) after this long.
const CUSTOM_MAX_WAIT_MS = 30000;

let customSrc = '';
let customAudio = null;
let customFailedAt = 0;

// Firebase download URLs already carry a query string, so add to it.
function withVersion(url, version) {
  if (!version) return url;

  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}`;
}

// sound is { url, updatedAt } or null for "use the default". Safe to call often.
export function setCustomCallSound(sound) {
  const src = sound?.url ? withVersion(sound.url, sound.updatedAt) : '';

  if (src === customSrc) return;

  customSrc = src;
  customAudio = null;
  customFailedAt = 0;

  if (src) getCustomAudio()?.load();
}

function markCustomFailed() {
  customFailedAt = Date.now();
  customAudio = null;
}

function getCustomAudio() {
  if (!customSrc || typeof Audio === 'undefined') return null;
  if (customFailedAt && Date.now() - customFailedAt < CUSTOM_RETRY_MS) return null;

  if (!customAudio) {
    const src = customSrc;
    const element = new Audio(src);

    element.preload = 'auto';
    element.volume = VOLUME;

    element.addEventListener('error', () => {
      if (src !== customSrc || customAudio !== element) return;

      console.warn('Custom call sound could not be loaded; the default chime is used instead.');
      markCustomFailed();
    });

    customFailedAt = 0;
    customAudio = element;
  }

  return customAudio;
}

// Start loading the file early so the first call is not late.
export function preloadCallSound() {
  getAudio()?.load();
  getCustomAudio()?.load();
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

  const unlocked = await silentUnlock(element);

  if (unlocked) setBlocked(false);

  // The custom sound is a separate element, so it needs its own click too.
  const customElement = getCustomAudio();

  if (customElement) {
    await Promise.race([silentUnlock(customElement), new Promise((resolve) => setTimeout(resolve, 3000))]);
  }

  return unlocked;
}

async function silentUnlock(element) {
  try {
    element.muted = true;
    await element.play();
    element.pause();
    element.currentTime = 0;
    element.muted = false;
    return true;
  } catch {
    element.muted = false;
    return false;
  }
}

/* ---------------------------------------------------------------
   Playing the chime
--------------------------------------------------------------- */

// Resolves once the element has finished (or could not play). Never rejects.
function playElement(
  element,
  { startTimeoutMs = 0, maxWaitMs = CHIME_MAX_WAIT_MS, stopAtMax = false } = {}
) {
  if (!element) return Promise.resolve('failed');

  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    let startTimer = null;

    const finish = (result) => {
      if (done) return;

      done = true;
      clearTimeout(timer);
      clearTimeout(startTimer);
      element.removeEventListener('ended', onEnded);
      element.removeEventListener('error', onError);

      if (result === 'failed' && startTimeoutMs) {
        try {
          element.pause();
        } catch {
          /* nothing to stop */
        }
      }

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

    if (startTimeoutMs) startTimer = setTimeout(() => finish('failed'), startTimeoutMs);

    element
      .play()
      .then(() => {
        if (done) return;

        clearTimeout(startTimer);
        setBlocked(false);
        timer = setTimeout(() => {
          if (stopAtMax) {
            try {
              element.pause();
            } catch {
              /* nothing to stop */
            }
          }

          finish('played');
        }, maxWaitMs);
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

// The chime: the kiosk's custom sound when it has one, else the default file.
// A custom sound that fails falls back to the default, so a call is never silent.
async function playChime() {
  const customElement = getCustomAudio();

  if (customElement) {
    const result = await playElement(customElement, {
      startTimeoutMs: CUSTOM_START_TIMEOUT_MS,
      maxWaitMs: CUSTOM_MAX_WAIT_MS,
      stopAtMax: true,
    });

    if (result !== 'failed') return result;

    console.warn('Custom call sound could not play; the default chime is used instead.');
    markCustomFailed();
  }

  return playElement(getAudio());
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

// { url, name, path, size, updatedAt } when the kiosk has a custom sound, else null.
export function normalizeCustomSound(data) {
  const url = typeof data?.customSoundUrl === 'string' ? data.customSoundUrl : '';

  if (!url) return null;

  return {
    url,
    name: String(data.customSoundName || ''),
    path: String(data.customSoundPath || ''),
    size: Number(data.customSoundSize) || 0,
    updatedAt: data.customSoundUpdatedAt || '',
  };
}

/*
 * onChange({ mode, custom }) fires with the saved mode and custom sound, or the
 * defaults when there is none. It also hands the custom sound to the player, so
 * everything that subscribes (TV, Staff, Settings "Test sound") plays it.
 */
export function subscribeCallSound(kioskId, onChange, onError) {
  if (!kioskId) return () => {};

  return onSnapshot(
    callSoundDoc(kioskId),
    (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : null;
      const custom = normalizeCustomSound(data);

      setCustomCallSound(custom);
      onChange({ mode: normalizeCallSoundMode(data?.mode), custom });
    },
    (error) => {
      console.warn('Call sound setting could not be read:', error?.message || error);
      setCustomCallSound(null);
      onChange({ mode: DEFAULT_CALL_SOUND_MODE, custom: null });
      onError?.(error);
    }
  );
}

// onChange(mode) fires with the saved mode, or the default when there is none.
export function subscribeCallSoundMode(kioskId, onChange, onError) {
  return subscribeCallSound(kioskId, ({ mode }) => onChange(mode), onError);
}

export async function saveCallSoundMode(kioskId, mode) {
  await setDoc(
    callSoundDoc(kioskId),
    { mode: normalizeCallSoundMode(mode), updated_at: new Date().toISOString() },
    { merge: true }
  );
}

/* ---------------------------------------------------------------
   Uploading a custom sound
--------------------------------------------------------------- */

export const CUSTOM_SOUND_MAX_BYTES = 5 * 1024 * 1024;

const CUSTOM_SOUND_TYPES = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
};

export const CUSTOM_SOUND_ACCEPT = '.mp3,.wav,.ogg,.m4a,audio/*';

const extensionOf = (name) => String(name || '').split('.').pop().toLowerCase();

// Checked before anything is uploaded: mp3 / wav / ogg / m4a, at most 5 MB.
export function isValidCustomSoundFile(file) {
  if (!file || !CUSTOM_SOUND_TYPES[extensionOf(file.name)]) return false;
  if (file.type && !/^(audio\/|video\/(mp4|ogg)$)/.test(file.type)) return false;

  return file.size > 0 && file.size <= CUSTOM_SOUND_MAX_BYTES;
}

const safeFileName = (name) =>
  String(name || 'sound')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-80) || 'sound';

// Uploads to call-sounds/<kioskId>/<timestamp>-<safeFileName>. Resolves with
// { url, name, path, size }. Rejects with the Firebase error (see .code).
export async function uploadCustomCallSound(kioskId, file, onProgress) {
  const path = `call-sounds/${kioskId}/${Date.now()}-${safeFileName(file.name)}`;
  const task = uploadBytesResumable(storageRef(getStorage(auth.app), path), file, {
    contentType: CUSTOM_SOUND_TYPES[extensionOf(file.name)],
  });

  await new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (progress) => onProgress?.(Math.round((progress.bytesTransferred / progress.totalBytes) * 100)),
      reject,
      resolve
    );
  });

  const url = await getDownloadURL(task.snapshot.ref);

  return { url, name: file.name, path, size: file.size };
}

// Merges the custom fields into the kiosk's document (mode is left alone).
// sound = { url, name, path, size } to set, or null to clear them.
export async function saveCustomCallSound(kioskId, sound) {
  const now = new Date().toISOString();

  await setDoc(
    callSoundDoc(kioskId),
    sound
      ? {
          customSoundUrl: sound.url,
          customSoundName: sound.name,
          customSoundPath: sound.path,
          customSoundSize: sound.size,
          customSoundUpdatedAt: now,
          updated_at: now,
        }
      : {
          customSoundUrl: deleteField(),
          customSoundName: deleteField(),
          customSoundPath: deleteField(),
          customSoundSize: deleteField(),
          customSoundUpdatedAt: deleteField(),
          updated_at: now,
        },
    { merge: true }
  );
}

export async function readCustomCallSound(kioskId) {
  const snapshot = await getDoc(callSoundDoc(kioskId));

  return snapshot.exists() ? normalizeCustomSound(snapshot.data()) : null;
}

/*
 * Deletes a Storage file - but only when no kiosk still points at it ("Apply to
 * all kiosks" shares one file). If any kiosk cannot be checked, the file is kept.
 * Resolves true when it was deleted.
 */
export async function deleteCustomSoundFileIfUnused(path, kioskIds) {
  if (!path || !path.startsWith('call-sounds/')) return false;

  const sounds = await Promise.all(kioskIds.map((id) => readCustomCallSound(id)));

  if (sounds.some((sound) => sound?.path === path)) return false;

  await deleteObject(storageRef(getStorage(auth.app), path)).catch((error) => {
    if (error?.code !== 'storage/object-not-found') throw error;
  });

  return true;
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
