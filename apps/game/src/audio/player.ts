/*
 * The only thing in the game that makes a sound.
 *
 * Synthesised, not sampled. That is a deliberate choice with three reasons behind it:
 *
 *  1. LICENCE. Cyera has no music it owns. The two tracks in the brand kit's Music & Tone section
 *     are third-party stock embedded as mood references, with no stated licence, so they cannot
 *     be shipped. Synthesis has no licence question at all.
 *  2. THE CSP. A bundled audio file would need `media-src 'self'` added to the strict policy in
 *     vercel.json. Web Audio fetches nothing, so the policy is untouched -- which matters for an
 *     asset that exists to argue Cyera takes this seriously.
 *  3. SIZE AND SEAM. Zero bytes against the 300 KB budget in docs/ASSETS.md, and a bed that never
 *     loops audibly because it is generated a bar at a time rather than wrapped around.
 *
 * It is OFF until the player turns it on. Never autoplay: this embeds in an iframe on the
 * research page, and sound that starts by itself in someone else's page is how an embed gets
 * pulled. Browsers would block it before the first gesture anyway, so the only honest design is a
 * control the player reaches for.
 */
import { BEATS_PER_BAR, barNotes, beatSeconds } from './score';
import type { Note, Voice } from './score';

/** How far ahead notes are scheduled, and how often we top it up. The standard Web Audio shape. */
const LOOKAHEAD_S = 0.3;
const TICK_MS = 60;

/** Quiet to begin with. This is a bed, not a soundtrack. */
const MASTER_GAIN = 0.34;
/** What the bed drops to while a panel is open, so reading the fine print is the quiet moment. */
const DUCKED_GAIN = 0.1;
const FADE_S = 0.4;

const STORE_KEY = 'otp:music';

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** One short burst of filtered noise, reused for the brush. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic, so the brush is the same every time and nothing shimmers between runs.
  let seed = 1;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

export interface MusicPlayer {
  /** True when the player has asked for sound. Survives a reload. */
  readonly wanted: boolean;
  /** Turn it on or off, and remember the choice. Returns the new state. */
  toggle(): boolean;
  /** Called once the run begins; starts only if the player already asked for sound. */
  begin(): void;
  /** Quieten while a panel owns the screen, without stopping. */
  duck(on: boolean): void;
  stop(): void;
}

/**
 * Reads the remembered choice. Wrapped because storage throws outright in some privacy modes,
 * and a game that will not boot without localStorage is a worse game than a silent one.
 */
function remembered(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === 'on';
  } catch {
    return false;
  }
}

function remember(on: boolean): void {
  try {
    localStorage.setItem(STORE_KEY, on ? 'on' : 'off');
  } catch {
    // Nothing to do. The choice just will not survive the reload.
  }
}

export function createMusicPlayer(): MusicPlayer {
  let wanted = remembered();
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let nextBar = 0;
  let nextBarAt = 0;
  let ducked = false;
  let running = false;

  const target = (): number => (ducked ? DUCKED_GAIN : MASTER_GAIN);

  /** One voice, built from oscillators rather than samples. Soft attacks throughout. */
  const play = (note: Note, at: number): void => {
    if (!ctx || !master) return;
    const beat = beatSeconds();
    const end = at + note.length * beat;
    const env = ctx.createGain();
    env.connect(master);

    if (note.voice === 'rim') {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1900;
      band.Q.value = 1.1;
      src.connect(band).connect(env);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(note.gain, at + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      src.start(at);
      src.stop(at + 0.2);
      return;
    }

    const osc = ctx.createOscillator();
    if (note.voice === 'kick') {
      // A soft round thump: a sine dropping in pitch, which is all a kick really is.
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, at);
      osc.frequency.exponentialRampToValueAtTime(42, at + 0.1);
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(note.gain, at + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(env);
      osc.start(at);
      osc.stop(at + 0.35);
      return;
    }

    /*
     * Keys, bass and accent are all triangle through a gentle lowpass. Triangle because a square
     * or saw is where "chiptune" and "cyber" live, and the brief asks for neither; the filter
     * takes the edge off the top so it sits behind the game rather than on top of it.
     */
    osc.type = 'triangle';
    osc.frequency.value = midiToHz(note.midi);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = note.voice === 'bass' ? 420 : 1700;
    tone.Q.value = 0.5;
    osc.connect(tone).connect(env);

    const attack = note.voice === 'accent' ? 0.08 : 0.02;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(note.gain, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.start(at);
    osc.stop(end + 0.05);
  };

  /** Schedule everything that falls inside the lookahead window, then come back for more. */
  const tick = (): void => {
    if (!ctx) return;
    const beat = beatSeconds();
    while (nextBarAt < ctx.currentTime + LOOKAHEAD_S) {
      for (const note of barNotes(nextBar)) play(note, nextBarAt + note.beat * beat);
      nextBar += 1;
      nextBarAt += BEATS_PER_BAR * beat;
    }
  };

  const start = (): void => {
    if (running) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // No Web Audio. The game is unchanged; there is simply no music.
    ctx ??= new Ctor();
    noise ??= noiseBuffer(ctx);
    master ??= ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(target(), ctx.currentTime + 1.2);
    void ctx.resume();
    nextBar = 0;
    nextBarAt = ctx.currentTime + 0.15;
    running = true;
    timer = setInterval(tick, TICK_MS);
    tick();
  };

  const stop = (): void => {
    running = false;
    clearInterval(timer);
    if (ctx && master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_S);
      const closing = ctx;
      setTimeout(() => void closing.close(), FADE_S * 1000 + 100);
      ctx = null;
      master = null;
      noise = null;
    }
  };

  return {
    get wanted() {
      return wanted;
    },
    toggle() {
      wanted = !wanted;
      remember(wanted);
      if (wanted) start();
      else stop();
      return wanted;
    },
    begin() {
      if (wanted) start();
    },
    duck(on: boolean) {
      ducked = on;
      if (ctx && master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(target(), ctx.currentTime + FADE_S);
      }
    },
    stop,
  };
}

export type { Note, Voice };
