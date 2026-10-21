/*
 * docs/UX_REVIEW.md finding 11: the title screen may not describe a machine the player is not on.
 *
 * e2e/title-claims.spec.ts already checks the phone, where the lie was loudest. What it cannot see
 * is the predicate: it emulates a coarse pointer, and the branch that was wrong is the *other*
 * side of a query whose negation does not mean what it looks like. `(pointer: coarse)` is false
 * for a pen-first tablet or a kiosk stylus, which then read the keyboard line -- while tokens.css,
 * which hides the pad on `(pointer: fine) and (hover: hover)`, drew them a joystick. Playwright
 * cannot emulate pointer/hover, so the branch is checked here instead, against the real
 * stylesheet.
 *
 * The decision this records: a narrow viewport with a fine pointer reads the keyboard line, and
 * that is correct rather than merely tolerated. Width is not an input modality -- the pad is
 * hidden at 375 and at 1280 alike -- so what misleads a reviewer at 375 is the capture using a
 * mouse, not the sentence.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import raw from '../../../content/game.v2.json';
import { FIT_LAST, PAD_HIDDEN_QUERY, chooseFit, titleHint } from '../src/ui/Title';

const strings: Record<string, string> = raw.ui.chrome;
const TOKENS = fileURLToPath(new URL('../src/ui/tokens.css', import.meta.url));
const SCREENS = fileURLToPath(new URL('../src/ui/screens.css', import.meta.url));

/** Every `@media` condition under which the stylesheet hides the on-screen pad. */
function padHidingQueries(): string[] {
  const css = readFileSync(TOKENS, 'utf8');
  return css
    .split('@media')
    .slice(1)
    .flatMap((chunk) => {
      const condition = chunk.slice(0, chunk.indexOf('{')).trim().replace(/\s+/g, ' ');
      /*
       * The pad's own rule inside this block, however the formatter has broken the lines.
       *
       * This used to look for `.otp-touch { ... display: none }` -- the whole pad hidden at once.
       * It no longer is, and deliberately: the five named walk buttons now STAY in the tree on a
       * fine pointer so a keyboard player has more than one focusable control on Explore, and only
       * the two thumb controls are hidden. So the question this asks is unchanged -- "under which
       * query does the stylesheet stop drawing the pad?" -- but the answer is written on the
       * children now. Matching either keeps the guard honest if the rule moves back to the parent.
       */
      const hides =
        /\.otp-touch(?:\s+\.otp-(?:stick|a-button)|\s*,|\s*)*\s*\{[^}]*display:\s*none/.test(chunk);
      return hides ? [condition] : [];
    });
}

describe('the title hint describes the machine the player is actually on', () => {
  it('reads the keyboard line wherever the pad is hidden, narrow or wide', () => {
    expect(titleHint(strings, true)).toBe(strings['controlsHint']);
  });

  it('reads the pad line wherever the pad is drawn', () => {
    expect(titleHint(strings, false)).toBe(strings['howToPlayWalkTouch']);
  });

  it('names the keys that walk and talk, on a keyboard', () => {
    const hint = titleHint(strings, true);
    expect(hint).toMatch(/arrow/i);
    expect(hint).toMatch(/\bspace\b/i);
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

  it('branches on the same query that governs the pad', () => {
    const queries = padHidingQueries();
    // A guard that stops matching is worse than no guard: this project has shipped one.
    expect(queries, 'no @media rule in tokens.css hides .otp-touch any more').not.toEqual([]);
    expect(
      queries,
      'the hint and the pad must answer the same question -- update PAD_HIDDEN_QUERY with the rule',
    ).toContain(PAD_HIDDEN_QUERY);
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
