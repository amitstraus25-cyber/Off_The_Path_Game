import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isMintedHandle } from '@otp/core';
import raw from '../../../content/game.json';
import { newHandle } from '../src/net/leaderboard';

/*
 * The screen and the wire have to agree about the player's name on the board.
 *
 * For four rounds they did not, and the disagreement was visible to anybody who played: Results
 * rendered `<input class="otp-field">`, the player typed `wolfspotter`, pressed Post -- and
 * `submit()` in src/net/leaderboard.ts dropped the typed string on the floor and sent
 * `mintHandle()` instead, because decision D4 says the board names its own runs and a free-text
 * name on a Cyera-branded public page is a moderation problem. The status line then read "Posted
 * to the board as deft-cloak-81". The product took an input and threw it away, and told the player
 * so only afterwards.
 *
 * It was fixable from either end, and the fix went the way D4 points: the input is gone, the
 * minted name is rendered as text, and a reroll button mints another. This guards that direction,
 * because the pull back is real -- a handle field is the obvious thing to put next to a Post
 * button, and the next person to add one will not read a four-round-old comment first.
 *
 * It is a SOURCE guard rather than a rendered one, deliberately. apps/game's vitest runs on the
 * `node` environment with no DOM, so there is nothing here to mount Preact into; `test/strings.
 * test.ts`, `test/csp.test.ts` and `test/docs-truth.test.ts` all read the shipped text the same
 * way. The rendered half lives in e2e, which drives the real form in a real browser.
 */

const RESULTS = fileURLToPath(new URL('../src/ui/Results.tsx', import.meta.url));
const strings = (raw as { strings: Record<string, string> }).strings;

/*
 * THE CODE, WITHOUT THE PROSE -- and the first draft of this file needed the lesson.
 *
 * Results.tsx explains at length why there is no input and why the handle is minted lazily, and it
 * quotes both mistakes to do it. A scanner over the raw text therefore found `useState(newHandle())`
 * in the sentence warning against `useState(newHandle())` and failed on a file that was correct.
 * This project's house style is long explanatory comments; a guard that reads them as code is a
 * guard that gets deleted the first time it cries wolf, so it reads the code.
 *
 * Block comments only. `//` would also match the `https://` in a URL, and the comments that matter
 * here -- the JSX `{/* ... *\/}` blocks and the docstrings -- are all block form.
 */
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

describe('the name on the board is minted, not typed', () => {
  it('offers the player nothing to type into', () => {
    /*
     * Not "no input anywhere in Results": the form is the thing under test, and a field elsewhere
     * on the payoff screen would be a different argument. Inside this form, any of the three is
     * the defect coming back -- `<input>` is how it shipped, `<textarea>` and `contenteditable`
     * are the two ways round a test that only looked for the first.
     */
    const form = postForm();
    for (const typed of ['<input', '<textarea', 'contenteditable', 'contentEditable']) {
      expect(form.toLowerCase(), `the post form takes typed input again (${typed})`).not.toContain(
        typed.toLowerCase(),
      );
    }
  });

  it('posts the name it shows, with nothing in between', () => {
    /*
     * The old `onPost(handle.trim())` was honest about a typed string and is a smell on a minted
     * one: anything that transforms the value between the screen and the wire is a second place
     * for the two to drift apart. `submit()` passes the state through unchanged, and `submit()` in
     * the adapter checks `isMintedHandle` and mints a replacement if it ever is not -- so a
     * transformation here would silently swap the name a player just read for another one.
     */
    expect(code, 'the posted value is no longer the handle on the screen').toContain(
      'onPost(handle)',
    );
    expect(postForm(), 'the form no longer renders the handle it posts').toContain('{handle}');
  });

  it('mints the name once per arrival, not once per render', () => {
    /*
     * `useState(newHandle)` passes the function and Preact calls it for the initial state only;
     * `useState(newHandle())` mints on EVERY render, and this component re-renders on every post
     * and every reroll. The symptom is nasty and intermittent: the name under the player's eyes
     * changes between reading it and pressing Post, and the confirmation names a third one. One
     * pair of parentheses apart, and nothing but this would catch it.
     */
    expect(code).toContain('useState(newHandle)');
    expect(code, 'the handle is minted on every render').not.toContain('useState(newHandle())');
  });

  it('mints from the same place the wire does', () => {
    // One mint function, in the module that reaches the network. A second one in the component is
    // how the screen and the body on the wire start producing different grammars.
    expect(code).toMatch(/import \{ newHandle \} from '\.\.\/net\/leaderboard'/);
    // And what it produces is what the adapter will send unchanged, rather than silently replace.
    for (let i = 0; i < 200; i++) expect(isMintedHandle(newHandle())).toBe(true);
  });

  it('ships the reroll copy, and no copy for a field that is gone', () => {
    expect(strings['handleReroll']?.trim(), 'the reroll button renders as nothing').toBeTruthy();
    /*
     * A placeholder is a property of a field you can type in. If one is back in the content file
     * it is because an input is back on the screen, and this fails next to the test above rather
     * than leaving a dead string for `test/strings.test.ts` to find a round later.
     */
    expect(Object.keys(strings), 'handlePlaceholder is back -- so is the input').not.toContain(
      'handlePlaceholder',
    );
  });

  it('scans the file it thinks it does', () => {
    // A guard that silently stops matching is worse than no guard: this project has shipped one.
    expect(code.length).toBeGreaterThan(1000);
    expect(postForm().length).toBeGreaterThan(100);
    expect(postForm(), 'the Post button is still inside the form this reads').toContain(
      "{s('post')}",
    );
  });
});
