/*
 * THE DOCUMENTS HAVE TO DESCRIBE THE THING THAT EXISTS.
 *
 * Two rounds in a row were lost to prose rather than to code. Four chiefs led with a blocker that
 * was already fixed because they measured committed HEAD instead of the working tree; four more
 * were then misled by documents that described a package that had been rebuilt, an API shape that
 * was never built, an embed channel that was never built, a test that did exist, and a landmark
 * that is not on the map. Every one of those was cheap to check and nothing checked it.
 *
 * This file is the check. It is the same trick as csp.test.ts: read two shipped artefacts as text
 * and assert they agree, with no browser and no deploy. Here one side is always a FACT DERIVED FROM
 * THE TREE -- a directory that exists, a route file's name, a count of services in vercel.json, an
 * object in the map, a line in content/game.json -- and the other side is always the PROSE. Neither
 * side is a constant typed into this file, because a guard that reads the same number twice and
 * compares it to itself passes forever and protects nothing.
 *
 * WHAT IT DOES NOT DO: it does not check that the documents are well written, complete, or that
 * their reasoning is sound. It catches exactly one class of defect -- a document asserting
 * something the repository contradicts -- which is the class that has actually cost this project
 * time.
 *
 * WHEN THIS FAILS, FIX THE PROSE, NOT THIS FILE. If a route is genuinely renamed or a workspace
 * genuinely deleted, the tree changes and the assertion follows it on its own. A failure means a
 * document is now lying about the tree in front of it.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url);
const at = (p: string): string => fileURLToPath(new URL(p, ROOT));

/** The five documents this guard covers, by the name a reader would use for them. */
const DOCS = {
  'CLAUDE.md': 'CLAUDE.md',
  'ARCHITECTURE.md': 'docs/ARCHITECTURE.md',
  'HANDOFF.md': 'docs/HANDOFF.md',
  'PLAN.md': 'docs/PLAN.md',
  'GAME_DESIGN.md': 'docs/GAME_DESIGN.md',
} as const;

type DocName = keyof typeof DOCS;

const read = (p: string): string => readFileSync(at(p), 'utf8');
const docs = (): [DocName, string][] =>
  (Object.keys(DOCS) as DocName[]).map((name) => [name, read(DOCS[name])]);

/**
 * A phrase is "marked as superseded" when the prose right beside it says so.
 *
 * THIS HATCH IS DELIBERATELY NARROW, AND MOST CHECKS BELOW DO NOT USE IT AT ALL. It exists only
 * for the two cases where a document must NAME a dead thing to stop it being re-proposed: the
 * route design that was specified and never built, and the line of dialogue that was cut. For
 * everything else the rule is simply that a false sentence may not appear -- a document narrating
 * its own history can say "this paragraph said the opposite" without restating the falsehood, and
 * the first draft of this guard let four real regressions through by being generous here.
 */
const SUPERSEDED =
  /\b(never built|not built|was never|no longer|used to|deliberately|superseded|dropped|struck|must not be reinstated|do not restore|do not "fix")\b/i;

function nearbyMarksSuperseded(text: string, index: number, span = 500): boolean {
  return SUPERSEDED.test(text.slice(Math.max(0, index - span), index + span));
}

/** Every occurrence of `needle` in `text`, as indices. */
function occurrences(text: string, needle: RegExp): number[] {
  const found: number[] = [];
  for (const match of text.matchAll(new RegExp(needle.source, `${needle.flags.replace('g', '')}g`)))
    if (match.index !== undefined) found.push(match.index);
  return found;
}

describe('the workspaces the documents claim', () => {
  /*
   * Derived from the directory listing, not from a number. apps/api was deleted, documented as
   * deleted, then rebuilt in Phase 6 -- and three documents went on saying it did not exist.
   */
  const onDisk = ['packages/core', 'apps/game', 'apps/api', 'tools/graybox', 'tools/sim'].filter(
    (p) => existsSync(at(p)),
  );

  it.each(onDisk)('%s exists, so no document may deny it', (pkg) => {
    const name = pkg.split('/')[1] ?? pkg;
    // "apps/api does not exist", "`apps/api` is not among them", "Deleted `apps/api`".
    const denial = new RegExp(
      `\`?(?:apps/|packages/|tools/)?${name}\`?[^.\\n]{0,80}?\\b(?:does not exist|is \\*\\*not\\*\\* among|is not among|not built yet)\\b`,
      'i',
    );
    // No hatch: a document can narrate the history without restating the false sentence.
    for (const [doc, text] of docs())
      expect(
        occurrences(text, denial),
        `${doc} says ${name} does not exist, but it is on disk`,
      ).toEqual([]);
  });
});

describe('the services vercel.json declares', () => {
  const declared = Object.keys(
    (JSON.parse(read('vercel.json')) as { services?: Record<string, unknown> }).services ?? {},
  );

  /** The count, spelled the way prose spells it -- so the wrong counts are derived too. */
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];

  it('is a count the documents do not contradict', () => {
    expect(
      declared.length,
      'no services in vercel.json -- is this the right file?',
    ).toBeGreaterThan(0);
    const right = WORDS[declared.length];
    const wrong = WORDS.filter((w, i) => i !== declared.length && i > 0);

    for (const [doc, text] of docs()) {
      for (const word of wrong) {
        // "declares a single service", "declares **one service**", "declares three services".
        const claim = new RegExp(
          `declares?\\s+(?:a\\s+)?\\*{0,2}(?:${word}|single)\\*{0,2}\\s+services?`,
          'gi',
        );
        expect(
          occurrences(text, claim),
          `${doc} says vercel.json declares ${word} service(s); it declares ${right} (${declared.join(', ')})`,
        ).toEqual([]);
      }
    }
  });

  it('is named route-for-route in the architecture, when an api service is one of them', () => {
    if (!declared.includes('api') || !existsSync(at('apps/api/api'))) return;
    const architecture = read(DOCS['ARCHITECTURE.md']);
    // api/score.ts is served at /api/score. The filenames ARE the routes.
    const routes = readdirSync(at('apps/api/api'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => `/api/${f.replace(/\.ts$/, '')}`);

    expect(routes.length, 'no route files found').toBeGreaterThan(0);
    for (const route of routes)
      expect(architecture, `ARCHITECTURE does not name the shipped route ${route}`).toContain(
        route,
      );
  });
});

describe('the API table in the architecture', () => {
  /*
   * `POST /runs`, `POST /runs/:id/submit` and `GET /leaderboard` were specified here for weeks and
   * never built. Mentioning them in PROSE is fine and necessary -- saying a design was dropped is
   * how it stops being re-proposed -- so this does not police prose. It polices the TABLE, which is
   * what a reader skims to learn the API, and it reads the real routes off the filesystem.
   */
  it('lists only routes the service actually serves', () => {
    if (!existsSync(at('apps/api/api'))) return;
    const served = readdirSync(at('apps/api/api'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => `/api/${f.replace(/\.ts$/, '')}`);
    expect(served.length, 'no route files found').toBeGreaterThan(0);

    // A table row whose first cell is a route: | `POST /api/score` | ... |
    const rows = read(DOCS['ARCHITECTURE.md']).matchAll(
      /^\|\s*`?(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s`|]*)`?\s*(?:\||$)/gim,
    );
    const listed = [...rows].map((m) => `${m[1]} ${m[2]}`);
    expect(
      listed.length,
      'ARCHITECTURE lists no routes at all -- did the table move?',
    ).toBeGreaterThan(0);

    for (const entry of listed) {
      const path = entry.split(' ')[1] ?? '';
      expect(
        served.some((s) => path === s),
        `ARCHITECTURE's API table lists "${entry}", which apps/api does not serve (it serves ${served.join(', ')})`,
      ).toBe(true);
    }
  });
});

describe('the embed channel', () => {
  const sources = ['apps/game/src', 'packages/core/src'];
  const files = sources.flatMap(function walk(dir: string): string[] {
    return readdirSync(at(dir), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(`${dir}/${entry.name}`)
        : entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')
          ? [`${dir}/${entry.name}`]
          : [],
    );
  });

  const receives = files.some((f) => /addEventListener\(\s*['"]message['"]/.test(read(f)));

  /*
   * The word "inbound" is not the defect -- saying there is NO inbound channel is the correction,
   * and a guard that banned the word would ban the fix. What is checked is the CLAIM that the game
   * receives: "Inbound (optional): otp:pause", "only accepts messages from that origin".
   */
  const claimsToReceive = [
    /\bInbound\s*\(/i,
    /\b(?:only\s+)?accepts?\s+(?:messages|postMessage)/i,
    /\breceives?\s+\w{0,12}\s?messages?\s+from\b/i,
  ];

  it('is described as receiving only if something actually receives', () => {
    if (receives) return;
    for (const [doc, text] of docs())
      for (const pattern of claimsToReceive)
        for (const index of occurrences(text, pattern))
          expect(
            nearbyMarksSuperseded(text, index),
            `${doc} says the game accepts inbound messages; nothing in apps/game/src listens for one`,
          ).toBe(true);
  });
});

describe('a test the documents say does not exist', () => {
  it('is not called untested once it is tested', () => {
    if (!existsSync(at('apps/game/test/csp.test.ts'))) return;
    for (const [doc, text] of docs())
      expect(
        occurrences(text, /nothing in the repository tests this policy/gi),
        `${doc} says nothing tests the CSP, but apps/game/test/csp.test.ts does`,
      ).toEqual([]);
  });
});

describe('the landmarks the documents place characters at', () => {
  type MapObject = { name?: string };
  type MapLayer = { type?: string; objects?: MapObject[] };

  const names = (
    JSON.parse(read('apps/game/src/assets/map-forest.json')) as { layers?: MapLayer[] }
  ).layers
    ?.flatMap((l) => (l.type === 'objectgroup' ? (l.objects ?? []) : []))
    .map((o) => o.name ?? '');

  it('are landmarks the map actually has', () => {
    expect(names?.length, 'no map objects parsed').toBeGreaterThan(0);
    // One landmark, checked properly: three rows placed travellers "at the bridge" for weeks.
    if (names?.some((n) => /bridge/i.test(n))) return;
    for (const [doc, text] of docs())
      for (const index of occurrences(text, /\b(?:at|by|near|before|over|across) the bridge\b/gi))
        expect(
          nearbyMarksSuperseded(text, index),
          `${doc} places something at a bridge; map-forest.json has no bridge object`,
        ).toBe(true);
  });
});

describe('player-facing lines the documents quote', () => {
  /** Every string anywhere in the shipped content file. */
  const strings: string[] = [];
  (function collect(node: unknown): void {
    if (typeof node === 'string') strings.push(node);
    else if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === 'object') Object.values(node).forEach(collect);
  })(JSON.parse(read('content/game.json')));

  const shipped = (quote: string): boolean => strings.some((s) => s.includes(quote));

  it('are either still in content/game.json, or marked as cut', () => {
    expect(strings.length, 'no strings parsed from content').toBeGreaterThan(0);
    // Dialogue is recognisable: addressed to Grandma, ending in a question mark.
    const spoken = /Grandma,[^"”_*`\n]{3,80}\?/g;
    for (const [doc, text] of docs())
      for (const match of text.matchAll(spoken)) {
        const quote = match[0];
        if (shipped(quote) || match.index === undefined) continue;
        expect(
          nearbyMarksSuperseded(text, match.index),
          `${doc} quotes "${quote}", which is not in content/game.json, without saying it was cut or why`,
        ).toBe(true);
      }
  });
});

describe('the cast the documents count', () => {
  const content = JSON.parse(read('content/game.json')) as {
    characters?: unknown[];
    bystanders?: unknown[];
  };
  const WORDS = ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

  it.each([
    ['bystanders', content.bystanders?.length ?? 0],
    ['characters', content.characters?.length ?? 0],
  ])('counts %s the way content/game.json does', (kind, count) => {
    expect(count, `no ${kind} in content`).toBeGreaterThan(0);
    for (const [doc, text] of docs())
      for (const word of WORDS.slice(1)) {
        if (WORDS.indexOf(word) === count) continue;
        const claim = new RegExp(`\\*{0,2}${word}\\*{0,2}\\s+\\*{0,2}${kind}\\*{0,2}\\b`, 'gi');
        expect(
          occurrences(text, claim),
          `${doc} says "${word} ${kind}"; content/game.json has ${count}`,
        ).toEqual([]);
      }
  });
});
