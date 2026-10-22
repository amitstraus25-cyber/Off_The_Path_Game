import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';
import { newHandle } from '../src/net/leaderboard';
import { HANDLE_PROBLEM, readName, validateHandle } from '../src/ui/Results';

/*
 * The screen and the wire have to agree about the player's name on the board.
 *
 * THE HISTORY, because the pull in each direction is real. For four rounds Results rendered an
 * `<input>`, the player typed `wolfspotter`, and `submit()` dropped the typed string and sent a
 * minted one instead -- the product took an input and threw it away. Decision D4 then went the
 * minted way: no field, a minted name shown as text, a reroll button. On 2026-10-22 the client
 * reversed D4 in so many words ("I want people to put their own name. I don't like that you can
 * only use this name."), so the field is back -- and this file now guards THAT direction, with the
 * lesson of the first one kept: the name the player typed is the name that is posted, checked by
 * the board's own rule (`v2.checkName`, packages/core/src/v2/board.ts) and by nothing invented
 * here.
 *
 * It is a SOURCE guard where it reads the component, deliberately. apps/game's vitest runs on the
 * `node` environment with no DOM, so there is nothing to mount Preact into; the rendered half lives
 * in e2e/results.spec.ts, which types a name into the real form and reads the request body.
 */

const RESULTS = fileURLToPath(new URL('../src/ui/Results.tsx', import.meta.url));
const strings: Record<string, string> = raw.ui.chrome;

/** The code, without the prose: Results.tsx quotes the old shapes in its comments. */
const code = readFileSync(RESULTS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The post form, with its explanatory comments stripped. */
function postForm(): string {
  const match = /<form class="otp-post"[\s\S]*?<\/form>/.exec(code);
  expect(
    match,
    'Results.tsx has no form.otp-post -- this guard is watching nothing',
  ).not.toBeNull();
  return match![0]!;
}

describe('the name on the board is the one the player types', () => {
  it('gives the player a real, labelled text field', () => {
    const form = postForm();
    expect(form, 'the post form has no input').toContain('<input');
    expect(form).toContain('type="text"');
    // Labelled by a visible <label>, not by a placeholder: a placeholder is not a label.
    expect(form).toMatch(/<label class="otp-handle" for="otp-handle-input">/);
    expect(form).toContain('id="otp-handle-input"');
    expect(form).not.toContain('placeholder=');
    expect(form, "the label's words come from the content file").toContain("s('handleLabel')");
  });

  it('posts the name the board accepted, and checks it with the board’s own rule', () => {
    // The check is core's, so the friendly message can never disagree with the server's refusal.
    expect(code).toContain('v2.checkName(');
    expect(code, 'a second, home-made rule is back on the screen').not.toMatch(
      /const HANDLE\w* = \//,
    );
    // What goes to `onPost` is the tidied name the check answered, never the raw field.
    expect(code).toContain('await onPost(name)');
    expect(code).toContain('const name = read.name;');
    expect(code, 'the raw field value is posted').not.toContain('await onPost(handle');
  });

  it('pre-fills a suggestion once per arrival, not once per render', () => {
    /*
     * `useState(newHandle)` passes the function and Preact calls it for the initial state only;
     * `useState(newHandle())` mints on EVERY render -- and this component now re-renders on every
     * keystroke, so the field would be overwritten under the player's fingers.
     */
    expect(code).toContain('useState(newHandle)');
    expect(code, 'the suggestion is minted on every render').not.toContain('useState(newHandle())');
    expect(code).toMatch(/import \{ newHandle \} from '\.\.\/net\/leaderboard'/);
  });

  it('accepts every suggestion it can make', () => {
    for (let i = 0; i < 200; i++) {
      const suggestion = newHandle();
      expect(validateHandle(suggestion), suggestion).toBeNull();
      expect(readName(suggestion)).toEqual({ name: suggestion });
    }
  });

  it('accepts an ordinary typed name, tidied as the board will store it', () => {
    expect(readName('Amit')).toEqual({ name: 'Amit' });
    expect(readName('  Little   Purple ')).toEqual({ name: 'Little Purple' });
    expect(readName('O’Neill')).toEqual({ name: "O'Neill" });
  });

  it('says, in words, what is wrong with a name the board would refuse', () => {
    const cases: [string, keyof typeof HANDLE_PROBLEM][] = [
      ['ab', 'short'],
      ['a name far too long to fit', 'long'],
      ['wolf@forest', 'characters'],
      ['call 5551234567', 'contact'],
      ['admin', 'blocked'],
    ];
    for (const [name, reason] of cases) {
      const check = v2.checkName(name);
      expect(check, `${name}: the fixture no longer exercises ${reason}`).toEqual({
        ok: false,
        reason,
      });
      const sentence = validateHandle(name);
      expect(sentence, name).toBe(strings[HANDLE_PROBLEM[reason]]);
      expect(sentence?.trim(), `${name}: the sentence is empty`).toBeTruthy();
    }
  });

  it('ships a sentence for every reason the board can give, and no copy for a field it lacks', () => {
    for (const key of Object.values(HANDLE_PROBLEM))
      expect(strings[key]?.trim(), `${key} renders as nothing`).toBeTruthy();
    expect(strings['handleReroll']?.trim(), 'the suggest button renders as nothing').toBeTruthy();
    // A placeholder would be a second, invisible-on-type label; the field has a real one.
    expect(Object.keys(strings)).not.toContain('handlePlaceholder');
  });

  /*
   * TRAP 1 IN THE COPY: a number written in a sentence instead of read from the rule. The two
   * length messages name the bounds, so the bounds they name are core's.
   */
  it('names the length bounds the rule actually has', () => {
    expect(strings['handleShort']).toContain(String(v2.NAME_MIN_LENGTH));
    expect(strings['handleLong']).toContain(String(v2.NAME_MAX_LENGTH));
  });

  it('scans the file it thinks it does', () => {
    expect(code.length).toBeGreaterThan(1000);
    expect(postForm().length).toBeGreaterThan(100);
    expect(postForm(), 'the Post button is still inside the form this reads').toContain(
      "{s('post')}",
    );
  });
});
