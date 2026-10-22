/*
 * docs/UX_REVIEW.md finding 11: the title screen may not describe a machine the player is not on.
 *
 * e2e/title-claims.spec.ts already checks the phone, where the lie was loudest. What it cannot see
 * is the predicate: it emulates a coarse pointer, and the branch that was wrong is the *other*
 * side of a query whose negation does not mean what it looks like. `(pointer: coarse)` is false
 * for a pen-first tablet or a kiosk stylus, which then read the keyboard line while it had no
 * keyboard. Playwright cannot emulate pointer/hover, so the branch is checked here instead.
 *
 * The decision this records: a narrow viewport with a fine pointer reads the keyboard line, and
 * that is correct rather than merely tolerated. Width is not an input modality -- a desktop window
 * at 375 has its keyboard as surely as one at 1280 -- so what misleads a reviewer at 375 is the
 * capture using a mouse, not the sentence. The cabinet's deck is drawn on every machine now; the
 * keyboard is still the better input where there is one, so the hint names it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import raw from '../../../content/game.v2.json';
import { FIT_LAST, KEYBOARD_QUERY, chooseFit, titleHint } from '../src/ui/Title';

const strings: Record<string, string> = raw.ui.chrome;
const TOKENS = fileURLToPath(new URL('../src/ui/tokens.css', import.meta.url));
const SCREENS = fileURLToPath(new URL('../src/ui/screens.css', import.meta.url));

/** Every `@media` condition under which the stylesheet hides the on-screen pad. */
function padHidingQueries(css: string = readFileSync(TOKENS, 'utf8')): string[] {
  return css
    .split('@media')
    .slice(1)
    .flatMap((chunk) => {
      const condition = chunk.slice(0, chunk.indexOf('{')).trim().replace(/\s+/g, ' ');
      // The pad's own rule, or its two thumb controls', however the formatter broke the lines.
      const hides =
        /\.otp-touch(?:\s+\.otp-(?:stick|a-button)|\s*,|\s*)*\s*\{[^}]*display:\s*none/.test(chunk);
      return hides ? [condition] : [];
    });
}

describe('the title hint describes the machine the player is actually on', () => {
  it('reads the keyboard line wherever there is a keyboard, narrow or wide', () => {
    expect(titleHint(strings, true)).toBe(strings['controlsHint']);
  });

  it('reads the deck line wherever there is no keyboard', () => {
    expect(titleHint(strings, false)).toBe(strings['howToPlayWalkTouch']);
  });

  it('names the keys that walk and talk, on a keyboard', () => {
    const hint = titleHint(strings, true);
    expect(hint).toMatch(/arrow/i);
    // E, the key UI_FOUNDATIONS section 8 names (Paul's round, 2026-10-22); Space and Enter work too.
    expect(hint).toMatch(/\bE to talk\b/);
  });

  it('names the joystick and the A button, and no key, on a pad', () => {
    const hint = titleHint(strings, false);
    expect(hint).toMatch(/joystick/i);
    expect(hint).toMatch(/\bA\b/);
    expect(hint).not.toMatch(/arrow|\bspace\b|wasd|\besc\b/i);
  });

  it('promises no walk from a tap: only a held drag walks', () => {
    for (const sentence of titleHint(strings, false).split(/(?<=[.!?])\s+/))
      expect(
        /\btap/i.test(sentence) && /\b(walk|move|step)/i.test(sentence),
        `"${sentence}" promises a walk from a tap`,
      ).toBe(false);
  });

  it('stays quiet rather than lying when the pad line is missing', () => {
    expect(titleHint({ controlsHint: 'keys' }, false)).toBe('');
  });

  it('asks about the keyboard, never about whether the pad is drawn', () => {
    /*
     * The arcade cabinet draws the deck -- joystick and A button -- on every machine, and they work
     * with a mouse (the client, 2026-10-22). The hint's question was always "what does this player
     * walk with?", so it is asked of the pointer, and NO rule in tokens.css may hide the pad on that
     * query again: that would put the keyboard line over a deck the desktop player can no longer see,
     * and a mouse player would lose the only controls the cabinet gives them.
     */
    expect(KEYBOARD_QUERY).toBe('(pointer: fine) and (hover: hover)');
    expect(padHidingQueries(), 'a rule in tokens.css hides the deck again').toEqual([]);
    // The guard is only worth its silence if it can see a hiding rule at all: the one that used to
    // stand in tokens.css, verbatim.
    const old = `@media ${KEYBOARD_QUERY} {\n  .otp-touch .otp-stick,\n  .otp-touch .otp-a-button {\n    display: none;\n  }\n}`;
    expect(padHidingQueries(old)).toEqual([KEYBOARD_QUERY]);
  });
});

/*
 * THE FIT LADDER (ui/Title.tsx useTitleFit, screens.css "THE FIT LADDER").
 *
 * Which rung a window gets is the browser's answer, so the browser-facing half is
 * e2e/title-steps.spec.ts. What is checked here is the part that has no browser in it: the choice
 * the component makes from an answer, and that every rung the component can write has a rule in
 * the stylesheet that gives it a meaning.
 */
describe('the title fit ladder', () => {
  it('takes the loosest rung that fits and does not look further', () => {
    const asked: number[] = [];
    const chosen = chooseFit((rung) => {
      asked.push(rung);
      return rung >= 2;
    });
    expect(chosen).toEqual({ rung: 2, scrolls: false });
    // Loosest first: a viewport that already fitted keeps the card it always had.
    expect(asked).toEqual([0, 1, 2]);
  });

  it('leaves a card that already fits exactly as designed', () => {
    expect(chooseFit(() => true)).toEqual({ rung: 0, scrolls: false });
  });

  it('settles on the last rung WITHOUT claiming a scroll when only the last rung fits', () => {
    expect(chooseFit((rung) => rung === FIT_LAST)).toEqual({ rung: FIT_LAST, scrolls: false });
  });

  it('says so, rather than clipping quietly, when nothing fits', () => {
    expect(chooseFit(() => false)).toEqual({ rung: FIT_LAST, scrolls: true });
  });

  it('never asks about a rung past the last', () => {
    const asked: number[] = [];
    chooseFit((rung) => {
      asked.push(rung);
      return false;
    });
    expect(Math.max(...asked)).toBe(FIT_LAST);
    expect(asked).toHaveLength(FIT_LAST + 1);
  });

  it('has a rule in screens.css for every rung above the first, and for the scroll cue', () => {
    const css = readFileSync(SCREENS, 'utf8');
    // Rung 0 is the card as designed and has no rule on purpose. Every other rung the component
    // can write must be spelled `data-fit='N'` somewhere, or it is a rung that does nothing and a
    // viewport that lands on it is clipped with the ladder believing it has acted.
    const written = Array.from({ length: FIT_LAST }, (_, i) => i + 1);
    for (const rung of written)
      expect(
        css.includes(`[data-fit='${rung}']`),
        `screens.css never styles rung ${rung} -- a card settled there gives up nothing`,
      ).toBe(true);
    expect(css, 'the loop above is vacuous if the stylesheet has no ladder at all').toContain(
      '[data-fit=',
    );
    expect(css, "the scroll cue is the ladder's honest last resort").toContain('[data-scrolls]');
    // And nothing past FIT_LAST: a rule for a rung the component never writes is dead weight that
    // reads as a rung that exists.
    expect(css).not.toContain(`[data-fit='${FIT_LAST + 1}']`);
  });
});
