/*
 * Every player-facing string the UI reads must exist in content/game.json.
 *
 * CLAUDE.md golden rule 3 makes content data, and docs/UX_REVIEW.md finding 13 already records that
 * ~35 player-facing strings live in `.tsx` instead. This guard is about the sharper version of that
 * problem, which is what the parallel design round actually produced: a component reading a key that
 * is not in the shipped file at all. Those render as the code literal behind `??`, or -- worse, and
 * invisibly -- as nothing at all where there is no fallback. Neither shows up in a screenshot
 * review, and twelve of them shipped in one round without anyone noticing.
 *
 * So the rule is mechanical: scan the UI for key reads, compare against the shipped file, and fail
 * on anything not recorded below as awaiting a human. `PENDING` is a handover list, not an excuse
 * list -- content/game.json is owned by a human this round, and these keys were requested through
 * the brief's `stringsNeeded` channel. As each is applied its entry here stops matching and must be
 * deleted, which is the point: the list can only shrink.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import raw from '../../../content/game.json';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/*
 * Keys the UI reads that content/game.json does not carry yet, each with the component that reads
 * it. Every one of these was handed to the human who owns the content file; until it is applied the
 * game renders the code-side fallback, except `titleMetaTouch`, which renders nothing on purpose
 * (Title.tsx would rather stay quiet than repeat a keyboard hint to a phone -- finding 11).
 */
const PENDING: Record<string, string> = {
  // Empty, and it should stay that way. Every key listed here on 2026-10-19 -- the two trade
  // strings, the sound control's three, the notice's quiet line, the coarse-pointer title hint
  // and the five world-summary strings -- is now in content/game.json, and the components read
  // them with no literal behind them. A key recorded here renders as nothing, so this list is a
  // handover note with a deadline, never a place to park copy.
};

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

const shipped = new Set(Object.keys((raw as { strings: Record<string, string> }).strings));

describe('the UI only reads strings the content file carries', () => {
  it('reads no key that is neither shipped nor recorded as pending', () => {
    const reads = keyReads();
    const unaccounted = [...reads.keys()]
      .filter((key) => !shipped.has(key) && !(key in PENDING))
      .map((key) => `${key} (read at ${reads.get(key)!.join(', ')})`)
      .sort();
    expect(unaccounted, 'add the key to content/game.json, or record it in PENDING').toEqual([]);
  });

  it('still finds every pending key missing, so applied ones are struck off the list', () => {
    const applied = Object.keys(PENDING).filter((key) => shipped.has(key));
    expect(applied, 'these are in content/game.json now -- delete them from PENDING').toEqual([]);
  });

  it('still reads every pending key, so a dropped one does not linger on the list', () => {
    const reads = keyReads();
    const stale = Object.keys(PENDING).filter((key) => !reads.has(key));
    expect(stale, 'nothing reads these any more -- delete them from PENDING').toEqual([]);
  });

  it('scans the files it thinks it does', () => {
    // A guard that silently stops matching is worse than no guard: this project has shipped one.
    const reads = keyReads();
    expect(sources(SRC).length).toBeGreaterThan(10);
    expect(reads.size).toBeGreaterThan(50);
    expect(reads.has('title'), 'the scanner finds an ordinary shipped key').toBe(true);
  });
});
