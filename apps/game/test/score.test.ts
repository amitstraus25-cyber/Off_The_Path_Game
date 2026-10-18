import { describe, expect, it } from 'vitest';
import { BEATS_PER_BAR, BPM, PHRASE_BARS, barNotes } from '../src/audio/score';
import type { Voice } from '../src/audio/score';

/*
 * The music is data, so the brand rules it was written against are assertions rather than good
 * intentions. Cyera's Music & Tone guidance asks for "light, playful, and modern" and explicitly
 * not "overly futuristic, sterile, or cyber"; the brand kit's own framing is "restraint is the
 * whole game: lots of neutral space, accent colour used like seasoning, not paint."
 *
 * These tests pin the parts of that which can be checked. They would all still pass if the music
 * were ugly -- taste is not testable -- but they fail the moment it stops being restrained.
 */

const BARS = 256;
const bars = Array.from({ length: BARS }, (_, i) => barNotes(i));
const count = (voice: Voice, notes: ReturnType<typeof barNotes>): number =>
  notes.filter((n) => n.voice === voice).length;

describe('the score obeys the brand rules it was written to', () => {
  it('the Lime rule: exactly one accent note per phrase, never two', () => {
    for (let phrase = 0; phrase < BARS / PHRASE_BARS; phrase++) {
      const inPhrase = bars
        .slice(phrase * PHRASE_BARS, (phrase + 1) * PHRASE_BARS)
        .reduce((sum, notes) => sum + count('accent', notes), 0);
      expect(inPhrase, `phrase ${phrase}`).toBe(1);
    }
  });

  it('the accent is the highest thing in the music, and the quietest', () => {
    for (const notes of bars)
      for (const accent of notes.filter((n) => n.voice === 'accent')) {
        const others = notes.filter((n) => n.voice === 'keys' || n.voice === 'bass');
        expect(Math.min(...others.map((n) => accent.midi - n.midi))).toBeGreaterThan(0);
        expect(Math.max(...others.map((n) => n.gain))).toBeGreaterThan(accent.gain);
      }
  });

  /*
   * "Never approximate, tint, lighten, darken, or invent a colour." The pitched voices draw from
   * one closed set; nothing outside it ever sounds. Drums are unpitched and sit outside the rule.
   */
  it('the pitch set is closed: no note outside the mode, ever', () => {
    const allowed = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const notes of bars)
      for (const n of notes) {
        if (n.voice === 'kick' || n.voice === 'rim') continue;
        expect(allowed.has((((n.midi - 53) % 12) + 12) % 12), `midi ${n.midi}`).toBe(true);
      }
  });

  it('leaves the space the brief asks for: never a crowded bar', () => {
    for (const [i, notes] of bars.entries()) {
      expect(count('keys', notes), `bar ${i}`).toBe(2);
      expect(count('bass', notes), `bar ${i}`).toBe(1);
      expect(notes.length, `bar ${i}`).toBeLessThanOrEqual(8);
    }
  });

  it('stays inside the bar it belongs to', () => {
    for (const notes of bars)
      for (const n of notes) {
        expect(n.beat).toBeGreaterThanOrEqual(0);
        expect(n.beat).toBeLessThan(BEATS_PER_BAR);
        expect(n.gain).toBeGreaterThan(0);
        expect(n.gain).toBeLessThanOrEqual(1);
      }
  });

  it('is unhurried, which is what a five-minute walk wants', () => {
    expect(BPM).toBeLessThanOrEqual(80);
  });

  /* Deterministic: the same bar always sounds the same, so nothing drifts between runs. */
  it('a bar is the same every time it is asked for', () => {
    expect(barNotes(97)).toEqual(barNotes(97));
    expect(barNotes(97)).not.toEqual(barNotes(98));
  });

  it('does not repeat itself every phrase, or it would read as a loop', () => {
    const shapes = new Set(bars.map((notes) => JSON.stringify(notes)));
    expect(shapes.size).toBeGreaterThan(PHRASE_BARS * 2);
  });
});
