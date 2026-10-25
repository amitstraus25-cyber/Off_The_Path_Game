import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatElapsed, keptOutOf, spottedOf } from '../src/ui/Results';

/*
 * The 2026-10-22 afternoon round: the clear instructions, the score-first reveal and the player's
 * own row right after posting. Pure pieces only -- apps/game's vitest has no DOM; the rendered half
 * is e2e/results.spec.ts.
 */

const content = v2.loadContent(raw);
const chrome: Record<string, string> = raw.ui.chrome;

/** A finished run through the real reducer: the careful strategy, at a pace that arrives. */
const careful = v2.play(content, 'careful', { seed: 7, pace: { walkMs: 1000, talkMs: 1000 } });

describe('the instructions say what the deal does', () => {
  /*
   * TRAP 1, IN COPY. "Three are good. Four are malicious." is a fact about `deal.good` and the size
   * of the cast, written as words. So the words are read back against the numbers: change the deal
   * and this fails until the sentence says the new one.
   */
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const good = WORDS[content.deal.good]!;
  const bad = WORDS[content.characters.length - content.deal.good]!;

  it('the how-to names how many are good and how many are malicious', () => {
    const line = content.ui.howTo.steps.find((step) => /malicious/i.test(step));
    expect(line, 'no how-to step says some skills are malicious').toBeDefined();
    expect(line!.toLowerCase()).toContain(good);
    expect(line!.toLowerCase()).toContain(bad);
  });

  it('the landing says it in one line too', () => {
    const premise = chrome['landingPremise']!.toLowerCase();
    expect(premise).toContain(good);
    expect(premise).toContain(bad);
    expect(premise).toMatch(/grandma/);
  });

  /*
   * Ten words, up from eight, for ONE line: the client asked (2026-10-22) for "take only the good
   * ones, leave the malicious ones" in so many words, and "Read each card. Take only the good,
   * leave the malicious." is ten. The ceiling still stops a step turning into a paragraph.
   */
  it('the how-to is four short lines at most, and says faster scores higher', () => {
    expect(content.ui.howTo.steps.length).toBeLessThanOrEqual(4);
    for (const step of content.ui.howTo.steps)
      expect(step.split(/\s+/).length, step).toBeLessThanOrEqual(10);
    expect(content.ui.howTo.steps.join(' ')).toMatch(/faster/i);
  });

  it('the how-to says to take only the good skills and leave the malicious ones', () => {
    const line = content.ui.howTo.steps.find((step) => /take only/i.test(step));
    expect(line, 'no step says to take only the good ones').toBeDefined();
    expect(line!).toMatch(/good/i);
    expect(line!).toMatch(/leave the malicious/i);
  });

  /*
   * TRAP 1 AGAIN: "At 2:00 left" is `world.dusk.fromLeftMs` written as words, so it is read back
   * against the number, formatted the way the HUD's face shows it. Move the dusk and this fails
   * until the sentence moves with it.
   */
  it("the how-to names the moment the dusk starts, and it is the content's", () => {
    const seconds = content.world.dusk.fromLeftMs / 1000;
    const face = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const line = content.ui.howTo.steps.find((step) => /dark/i.test(step));
    expect(line, 'no step says the forest gets darker').toBeDefined();
    expect(line!).toContain(face);
  });

  it('the stressed lines are lines that exist, and they are the two the client named', () => {
    const { steps, stress = [] } = content.ui.howTo;
    for (const i of stress) expect(steps[i], `stress index ${i}`).toBeDefined();
    const stressed = stress.map((i) => steps[i]!);
    expect(
      stressed.some((s) => /take only/i.test(s)),
      'the take-only line is stressed',
    ).toBe(true);
    expect(
      stressed.some((s) => /dark/i.test(s)),
      'the dusk line is stressed',
    ).toBe(true);
  });
});

describe('the score, as the reveal reads it from core', () => {
  it('reports parts that add up to the total, on a clean run', () => {
    const run = v2.result(careful.state, content);
    expect(run.ending).toBe('grandma');
    expect(run.played + run.choices + run.speed).toBe(run.total);
    expect(run.played).toBe(content.scoring.played);
    expect(run.timeMs).not.toBeNull();
  });

  it('writes elapsed time as the clock face does', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(59_999)).toBe('0:59');
    expect(formatElapsed(100_000)).toBe('1:40');
    expect(formatElapsed(-5)).toBe('0:00');
  });

  it('counts a bad skill as spotted only when its card was opened and it stayed out', () => {
    const entry = (over: Partial<v2.RevealEntry>): v2.RevealEntry => ({
      skillId: 'x',
      name: 'X',
      promise: 'p',
      good: false,
      verdict: 'leave',
      read: true,
      line: 'l',
      giveaway: 'g',
      ...over,
    });
    expect(
      spottedOf([
        entry({}), // read and left: spotted
        entry({ verdict: null }), // read, walked on: spotted
        entry({ verdict: 'take' }), // taken: not spotted
        entry({ read: false, verdict: null }), // never met: not spotted
        entry({ good: true, giveaway: null }), // a good one is never "spotted"
      ]),
    ).toBe(2);
    // The careful run reads every card and leaves every bad one.
    const run = v2.result(careful.state, content);
    expect(spottedOf(run.entries)).toBe(run.entries.filter((e) => !e.good).length);
  });

  it('counts a bad skill as kept out whenever it stayed out of the basket, read or not', () => {
    const entry = (over: Partial<v2.RevealEntry>): v2.RevealEntry => ({
      skillId: 'x',
      name: 'X',
      promise: 'p',
      good: false,
      verdict: 'leave',
      read: true,
      line: 'l',
      giveaway: 'g',
      ...over,
    });
    // Walked past without meeting its owner: never in the basket, so kept out.
    expect(keptOutOf([entry({ read: false, verdict: null })])).toBe(1);
    // Taken: in the basket, so not kept out.
    expect(keptOutOf([entry({ verdict: 'take' })])).toBe(0);
    // A good one never counts, whatever was done with it.
    expect(keptOutOf([entry({ good: true, giveaway: null, verdict: null })])).toBe(0);
    // Every card walked past: all four bad ones were kept out -- and none were spotted.
    const walkedPast = [0, 1, 2, 3].map((i) =>
      entry({ skillId: `b${i}`, read: false, verdict: null }),
    );
    expect(keptOutOf(walkedPast)).toBe(4);
    expect(spottedOf(walkedPast)).toBe(0);
    // The careful run keeps every bad one out too.
    const run = v2.result(careful.state, content);
    expect(keptOutOf(run.entries)).toBe(run.entries.filter((e) => !e.good).length);
  });
});

describe("the player's own row, right after posting", () => {
  /*
   * Which row is the reader's is the adapter's to say since 2026-10-22 (`entry.yours`, set by
   * net/leaderboard.ts `withYourRow` from the rank the server counted), and a row the adapter placed
   * from the post's own answer -- because the edge-cached board had not caught up -- says so in
   * words. The browser half is e2e/results.spec.ts.
   */
  const results = readFileSync(
    fileURLToPath(new URL('../src/ui/Results.tsx', import.meta.url)),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, ' ');

  it("marks the row the adapter says is the reader's, through boardRowKey", () => {
    expect(results).toContain('entry.yours !== undefined');
    expect(results, 'the screen matches rows by name again').not.toContain('entry.handle === ');
  });

  it('says in words when the row is still joining the board', () => {
    expect(results).toContain("entry.yours === 'pending'");
    expect(results).toContain("s('boardJoining')");
    expect(chrome['boardJoining']?.trim()).toBeTruthy();
  });

  it('says what a run that did not arrive clean keeps, and offers it Post like any other', () => {
    expect(chrome['revealFloorWolf']).toContain('{played}');
    expect(chrome['revealFloorLate']).toContain('{played}');
    expect(chrome['revealPlayed']?.trim()).toBeTruthy();
    expect(chrome).not.toHaveProperty('wolfNotPosted');
    expect(chrome).not.toHaveProperty('postLate');
  });
});
