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
import raw from '../../../content/game.json';
import { PAD_HIDDEN_QUERY, titleHint } from '../src/ui/Title';

const strings = (raw as { strings: Record<string, string> }).strings;
const TOKENS = fileURLToPath(new URL('../src/ui/tokens.css', import.meta.url));

/** Every `@media` condition under which the stylesheet hides the on-screen pad. */
function padHidingQueries(): string[] {
  const css = readFileSync(TOKENS, 'utf8');
  return css
    .split('@media')
    .slice(1)
    .flatMap((chunk) => {
      const condition = chunk.slice(0, chunk.indexOf('{')).trim().replace(/\s+/g, ' ');
      // The pad's own rule inside this block, however the formatter has broken the lines.
      const hides = /\.otp-touch\s*\{[^}]*display:\s*none/.test(chunk);
      return hides ? [condition] : [];
    });
}

describe('the title hint describes the machine the player is actually on', () => {
  it('reads the keyboard line wherever the pad is hidden, narrow or wide', () => {
    expect(titleHint(strings, true)).toBe(strings['titleMeta']);
    expect(titleHint(strings, true)).toMatch(/arrow/i);
  });

  it('reads the pad line wherever the pad is drawn', () => {
    expect(titleHint(strings, false)).toBe(strings['titleMetaTouch']);
  });

  it('never offers keys to a player who is being given a pad', () => {
    // The same claims e2e/title-claims.spec.ts refuses on a phone, checked against the content
    // file so a copy edit cannot reintroduce them without failing here first.
    expect(titleHint(strings, false)).not.toMatch(/arrow|\bspace\b|wasd|\besc\b|\btap/i);
  });

  it('stays quiet rather than lying when the pad line is missing', () => {
    expect(titleHint({ titleMeta: 'keys' }, false)).toBe('');
  });

  it('falls back to the in-world line, not to silence, on a keyboard', () => {
    expect(titleHint({ controlsHint: 'arrows' }, true)).toBe('arrows');
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
