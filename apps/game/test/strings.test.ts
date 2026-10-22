/*
 * The UI may only read words a content file carries (CLAUDE.md golden rule 3).
 *
 * v2's own words live in content/game.v2.json's `ui`, `endings` and the cast, and that file's
 * schema is STRICT: a missing or unknown `ui` key fails `v2.loadContent` at startup and in core's
 * suite, so a screen reading `content.ui.*` cannot reach a key that was never validated. What this
 * file guards is the one free-keyed part, `ui.chrome` (read through `ui/copy.ts`'s `strings`): the
 * touch pad, music switch, problem screens, post form, board and forest summary. A record is
 * free-form, so a read of a key it does not carry renders as the `?? ''` behind it -- nothing at
 * all -- and no screenshot review notices a blank.
 *
 * So the rule is mechanical: scan the UI for `strings['key']` and `s('key')` reads and fail on any
 * key the file does not ship.
 *
 * There is no `PENDING` list any more: every word v2 introduced has a schema-validated key in `ui`,
 * and the last test below fails if a list of unkeyed words comes back.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import raw from '../../../content/game.v2.json';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** Every `.ts`/`.tsx` file under apps/game/src. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** Key reads, as `s('key')` or `strings['key']`, with the file and line that read them. */
function keyReads(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of sources(SRC)) {
    const src = readFileSync(path, 'utf8');
    const pattern = /(?:\bs\(|strings\[)\s*'([A-Za-z0-9_]+)'/g;
    for (const match of src.matchAll(pattern)) {
      const line = src.slice(0, match.index).split('\n').length;
      const where = `${path.slice(SRC.length + 1)}:${line}`;
      found.set(match[1]!, [...(found.get(match[1]!) ?? []), where]);
    }
  }
  return found;
}

const shipped = new Set(Object.keys(raw.ui.chrome));

describe('the UI only reads strings the content file carries', () => {
  it('reads no key the chrome strings do not ship', () => {
    const reads = keyReads();
    const unaccounted = [...reads.keys()]
      .filter((key) => !shipped.has(key))
      .map((key) => `${key} (read at ${reads.get(key)!.join(', ')})`)
      .sort();
    expect(unaccounted, 'add the key to the content file, or stop reading it').toEqual([]);
  });

  it('scans the files it thinks it does', () => {
    // A guard that silently stops matching is worse than no guard: this project has shipped one.
    const reads = keyReads();
    expect(sources(SRC).length).toBeGreaterThan(10);
    expect(reads.size).toBeGreaterThan(20);
    expect(reads.has('leaderboardTitle'), 'the scanner finds an ordinary shipped key').toBe(true);
  });

  it('keeps no list of words outside the content file', async () => {
    // The words v2 introduced before it had keys sat in a `PENDING` object in ui/copy.ts. They are
    // all content now; a list like it coming back is copy research never sees.
    const copy = await import('../src/ui/copy');
    expect(Object.keys(copy).sort()).toEqual(['fill', 'marqueeText', 'strings']);
    for (const path of sources(SRC))
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/\bPENDING\s*[.=[]/);
  });

  it('ships every chrome key the schema names, and no other', () => {
    expect([...shipped].sort()).toEqual([...v2.CHROME_KEYS].sort());
  });
});
