/*
 * content/game.json and the UI must name the same strings, in both directions.
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
 *
 * The other direction matters for the same reason, which finding 13 spells out: a key nothing reads
 * is not inert. It reads as reviewed content -- it is in the file research is asked to sign off --
 * and the next person to need a line in that spot wires up whatever it says, unread, a year after
 * whoever wrote it left the round. Seven were dead when this was written, one of them
 * (`trustBreakdown`) the clause whose absence makes the Results breakdown not sum. So a key the code
 * cannot reach fails the build too, and `UNREAD` is the same shrinking handover list on that side.
 *
 * The two directions use deliberately different scanners. A *read* is strict -- `s('key')` or
 * `strings['key']` -- because the question is whether a specific lookup resolves. *Reachability* is
 * loose: any mention of the key's name as a literal anywhere in the sources counts, because
 * `VERDICT_STRING` and friends name keys in lookup tables and the honest question is only "can
 * anything get to this?". Loose errs towards leaving a dead key alive rather than deleting a live
 * one, which is the right way for a guard whose remedy is deletion.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import raw from '../../../content/game.json';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const CORE = fileURLToPath(new URL('../../../packages/core/src', import.meta.url));

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

/**
 * The mirror: keys content/game.json carries that nothing in the code can reach, each with the
 * component owed the wiring.
 *
 * Empty, and the shipped file now has no unreachable string at all. Six of the seven dead keys
 * found on 2026-10-19 were deleted outright -- `chipTitle`, `errandDone`, `errandFailed`,
 * `trustHeld`, `trustLost` (copy for rows the design no longer has) and `leaderboardTitle`
 * (unstarted Phase 6; "Wolf Spotters" survives in content/game.seed.json and docs/COPY_REVIEW.md,
 * so Phase 6 restores it rather than reinventing it). The seventh, `trustBreakdown`, was held here
 * for one round because deleting it would have deleted the fix for an open bug -- and is now
 * wired: `Results.tsx breakdown()` reads it, and `test/results.test.ts` adds the clauses up
 * against `score().total` so the headline and the parts cannot drift apart again.
 *
 * The two below are the opposite case to those seven: copy written ahead of the code that will say
 * it, applied to the content file in this round because the component that needs it is in another
 * round's file. `App.tsx worldAsText()` says who is left to meet and nothing about WHERE they are,
 * which it admits in a comment -- "a bearing per traveller is the remaining piece and it needs
 * direction words in the content file". These are those words. For a player who cannot see the
 * canvas, finding a traveller is otherwise a sweep of the whole forest.
 *
 * Both are pipe-separated lists, the convention `arriveLines.<ending>` and `arrivePawEndings`
 * already use in this file, so the eight bearings are one reviewed string rather than eight keys.
 * The contract for whoever wires them: `worldBearings` is eight 45-degree sectors CLOCKWISE FROM
 * NORTH (index = round(angle / 45) mod 8, north = 0), and `worldDistances` is three bands NEAREST
 * FIRST. Both read as the tail of a traveller's sentence: "the Owl: not met yet, east of you, a
 * short walk away."
 */
const UNREAD: Record<string, string> = {
  worldBearings: 'App.tsx worldAsText() -- bearing per unmet traveller',
  worldDistances: 'App.tsx worldAsText() -- coarse distance per unmet traveller',
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

/**
 * Every key name the code mentions as a literal, and every prefix it builds a key from.
 *
 * The prefixes are the `arriveLines.${ending.id}` family: a read whose key is assembled at runtime,
 * which no literal scan can see. A shipped key under one of those prefixes is reachable by
 * construction -- and the suffix is checked separately, because `arriveLines.cleen` would be just
 * as reachable and just as dead.
 */
function reachable(): { names: Set<string>; prefixes: string[] } {
  const names = new Set<string>();
  const prefixes: string[] = [];
  for (const path of [...sources(SRC), ...sources(CORE)]) {
    const src = readFileSync(path, 'utf8');
    for (const match of src.matchAll(/['"`]([A-Za-z0-9_.]+)['"`]/g)) names.add(match[1]!);
    for (const match of src.matchAll(/(?:\bs\(|strings\[)\s*`([A-Za-z0-9_.]*)\$\{/g))
      if (match[1]) prefixes.push(match[1]);
  }
  return { names, prefixes };
}

/** Every `id` in the content file, at any depth: what a runtime-built key suffix must be. */
function contentIds(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const item of value) contentIds(item, found);
  else if (value && typeof value === 'object')
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'id' && typeof inner === 'string') found.add(inner);
      contentIds(inner, found);
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

describe('the content file carries no string the code cannot reach', () => {
  it('ships no key that nothing names, directly or through a prefix', () => {
    const { names, prefixes } = reachable();
    const dead = [...shipped]
      .filter((key) => !names.has(key) && !prefixes.some((p) => key.startsWith(p)))
      .filter((key) => !(key in UNREAD))
      .sort();
    expect(dead, 'delete the key, or wire it up, or record it in UNREAD with its owner').toEqual(
      [],
    );
  });

  it('still finds every unread key unreachable, so wired ones are struck off the list', () => {
    const { names, prefixes } = reachable();
    const wired = Object.keys(UNREAD).filter(
      (key) => names.has(key) || prefixes.some((p) => key.startsWith(p)),
    );
    expect(wired, 'something reads these now -- delete them from UNREAD').toEqual([]);
  });

  it('still ships every unread key, so a deleted one does not linger on the list', () => {
    const gone = Object.keys(UNREAD).filter((key) => !shipped.has(key));
    expect(gone, 'these are not in content/game.json any more -- delete them from UNREAD').toEqual(
      [],
    );
  });

  it('names a real thing in every key built from a prefix', () => {
    // `arriveLines.cleen` is as reachable as `arriveLines.clean` and renders for nobody.
    const { prefixes } = reachable();
    const ids = contentIds(raw);
    const unmatched = [...shipped]
      .filter((key) => prefixes.some((p) => key.startsWith(p)))
      .filter((key) => !ids.has(key.slice(key.lastIndexOf('.') + 1)))
      .sort();
    expect(unmatched, 'the suffix matches no id in this file -- a typo renders as nothing').toEqual(
      [],
    );
  });

  it('scans the files it thinks it does', () => {
    const { names, prefixes } = reachable();
    expect(sources(CORE).length).toBeGreaterThan(3);
    expect(prefixes, 'the runtime-built arrival keys').toContain('arriveLines.');
    // The indirect case the strict read scanner cannot see, and the reason this one is loose.
    expect(names.has('verdictAllowed'), 'a key named only inside a lookup table').toBe(true);
    expect(contentIds(raw).has('clean'), 'the ending ids a prefix key resolves against').toBe(true);
  });
});
