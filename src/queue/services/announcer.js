/*
 * Queue call announcer for the lobby TV.
 *
 * Reads a called number aloud in a way patients can match against the slip
 * in their hand: prefix letters spelled out, digits read one at a time.
 *
 *   "Now serving, priority number, B P, zero two one.
 *    Please proceed to Terminal 2."
 *
 * Announcements are queued so two calls never talk over each other, each is
 * repeated once after a pause, and the lobby video is turned down while the
 * announcement plays and restored afterwards.
 *
 * Browsers block audio until the page has been clicked, so enable() must be
 * called from a real click before anything will be heard.
 */

const DIGITS = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
};

const REPEAT_COUNT = 2;
const REPEAT_GAP_MS = 900;
const DUCK_VOLUME = 0.12;

let enabled = false;
let speaking = false;
const pending = [];

/* the lobby video, turned down while announcing */
let videoElement = null;
let previousVolume = null;

export function attachVideo(element) {
  videoElement = element || null;
}

export function isEnabled() {
  return enabled;
}

/* Must be called from a click, or the browser will stay silent. */
export function enable() {
  enabled = true;

  // Unlock speech on browsers that need a first utterance inside a gesture.
  try {
    const warmUp = new SpeechSynthesisUtterance('');
    warmUp.volume = 0;
    window.speechSynthesis.speak(warmUp);
  } catch {
    /* speech unavailable - chime only */
  }
}

/* ---------------------------------------------------------------
   Turn "P-BP-021" into something a waiting patient can follow
--------------------------------------------------------------- */

export function buildPhrase(number, terminal) {
  const raw = String(number || '').trim().toUpperCase();

  if (!raw) return '';

  const priority = raw.startsWith('P-');
  const body = priority ? raw.slice(2) : raw;

  // Letters are spelled out, digits are read one at a time.
  const spoken = body
    .split('')
    .map((character) => {
      if (character in DIGITS) return DIGITS[character];
      if (/[A-Z]/.test(character)) return character;
      return '';
    })
    .filter(Boolean)
    .join(' ');

  const lead = priority
    ? 'Now serving, priority number,'
    : 'Now serving, number,';

  const where = terminal
    ? ` Please proceed to Terminal ${terminal}.`
    : ' Please proceed to the counter.';

  return `${lead} ${spoken}.${where}`;
}

/* ---------------------------------------------------------------
   Chime
--------------------------------------------------------------- */

function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const context = new Ctx();

    [880, 660].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);

      const start = context.currentTime + index * 0.32;
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

      oscillator.start(start);
      oscillator.stop(start + 0.3);
    });
  } catch {
    /* audio unavailable */
  }
}

/* ---------------------------------------------------------------
   Video ducking
--------------------------------------------------------------- */

function duck() {
  if (!videoElement) return;

  try {
    previousVolume = videoElement.volume;
    videoElement.volume = DUCK_VOLUME;
  } catch {
    previousVolume = null;
  }
}

function unduck() {
  if (!videoElement || previousVolume == null) return;

  try {
    videoElement.volume = previousVolume;
  } catch {
    /* ignore */
  }

  previousVolume = null;
}

/* ---------------------------------------------------------------
   Speaking, one announcement at a time
--------------------------------------------------------------- */

function speakOnce(phrase) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    utterance.pitch = 1;

    utterance.onend = resolve;
    utterance.onerror = resolve;

    window.speechSynthesis.speak(utterance);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function drain() {
  if (speaking) return;

  speaking = true;
  duck();

  try {
    while (pending.length > 0) {
      const phrase = pending.shift();

      chime();
      await wait(700);

      for (let round = 0; round < REPEAT_COUNT; round += 1) {
        await speakOnce(phrase);
        if (round < REPEAT_COUNT - 1) await wait(REPEAT_GAP_MS);
      }

      if (pending.length > 0) await wait(600);
    }
  } finally {
    unduck();
    speaking = false;
  }
}

/* Announce one called ticket. Ignored until enable() has been called. */
export function announceCall({ number, terminal }) {
  if (!enabled) return;

  const phrase = buildPhrase(number, terminal);
  if (!phrase) return;

  pending.push(phrase);
  drain();
}

export function cancelAnnouncements() {
  pending.length = 0;

  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }

  unduck();
  speaking = false;
}

export default announceCall;