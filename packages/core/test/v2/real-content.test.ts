import { describe, expect, it } from 'vitest';
import raw from '../../../../content/game.v2.json';
import manifest from '../../../../apps/game/src/assets/manifest.json';
import mapJson from '../../../../apps/game/src/assets/map-forest.json';
import { readForestMap, findObject } from '../../../../apps/game/src/world/map.ts';
import type { MapObject } from '../../../../apps/game/src/world/map.ts';
import {
  INTERACT_RADIUS,
  TILE,
  WALK_SPEED,
  isSolidTile,
  overlaps,
} from '../../../../apps/game/src/world/logic.ts';
import { ContentError, v2 } from '../../src/index.ts';

/*
 * THE REAL v2 CONTENT, GUARDED (PLAN.md Phase 9 step B).
 *
 * Every other suite in this directory drives the rules with `fixture.ts`, which is deliberately not
 * the game. This one loads `content/game.v2.json` -- the seven skills players will meet -- through
 * the same `v2.loadContent` the game and the server will call, with the launch rules on, and then
 * asks the questions only the real content can answer: does every character stand on a sprite
 * that exists, and can a careful reader make it inside the clock at the pace the real world walks.
 *
 * NOTHING HERE RESTATES A NUMBER THE CONTENT OR THE GAME ALREADY HOLDS (PAUL_BRIEF trap 1). The
 * walk speed, the talking radius and the tile size are imported from the game's own `logic.ts`;
 * the distances are walked over the shipped map's own collision layer; the sprite keys are read
 * from the shipped manifest as data. The only numbers written here are the reading model's, and
 * each one says where it came from.
 */

const content = v2.parseContent(raw);

/** The real content with its copy changed, for proving a guard by breaking it. */
const edited = (mutate: (c: typeof raw) => void): v2.Content => {
  const v = structuredClone(raw);
  mutate(v);
  return v2.parseContent(v);
};

const words = (...lines: string[]): number =>
  lines.flatMap((l) => l.split(/\s+/).filter(Boolean)).length;
const seeds = v2.everySeed(content);

describe('the real v2 content loads under the launch rules', () => {
  it('passes the schema, every lint rule and every trap check, with no errors', () => {
    // Asserted as the ISSUE LIST, not as "does not throw": a thrown ContentError prints truncated
    // in the failure, and the list is the diagnosis.
    const issues = ((): string[] => {
      try {
        v2.loadContent(raw, { launch: true });
        return [];
      } catch (e) {
        if (e instanceof ContentError) return e.issues;
        throw e;
      }
    })();
    expect(issues).toEqual([]);
    const { ok, checks } = v2.trapChecks(content);
    for (const c of checks) expect(c.ok, `${c.name}: ${c.detail}`).toBe(true);
    expect(ok).toBe(true);
  });

  it('has seven characters in walking order, each offering one skill, and 35 deals of three', () => {
    expect(content.characters.map((c) => c.id)).toEqual([
      'rabbit',
      'toadstool',
      'owl',
      'magpie',
      'snail',
      'lantern-keeper',
      'cat',
    ]);
    // Skills are listed in walking order too, so a deal reads in the order a player meets it.
    expect(content.skills.map((s) => v2.findCharacterForSkill(content, s.id)!.id)).toEqual(
      content.characters.map((c) => c.id),
    );
    expect(seeds).toHaveLength(35);
    expect(new Set(seeds.map((s) => v2.deal(content, s).join(','))).size).toBe(35);
  });

  /*
   * EVERY SKILL IS GOOD IN SOME DEALS AND BAD IN OTHERS, AND EQUALLY OFTEN: 15 good, 20 bad. That
   * is what retires the folklore, position and word guards: whatever a character is or says before
   * the card, it is the same character with a malicious skill in four deals of seven.
   */
  it('every skill is dealt good in 15 of the 35 deals and bad in the other 20', () => {
    for (const s of content.skills)
      expect(
        seeds.filter((seed) => v2.deal(content, seed).includes(s.id)),
        s.id,
      ).toHaveLength(15);
  });

  /*
   * ALL 128 RUNS IN ALL 35 DEALS, PLAYED: 4,480 runs through the reducer. The user's rule
   * (2026-10-22): 100 is only that deal's three good taken and its four bad left; a bad skill
   * lets the wolf in and ranks below every clean run.
   */
  it('in every deal, exactly one of the 128 runs scores 100 and it is the careful one; every wolf run is below every clean one', () => {
    for (const seed of seeds) {
      const runs = v2.everyRun(content, seed);
      const careful = v2.carefulVerdicts(content, v2.deal(content, seed));
      expect(
        runs.filter((r) => r.total === 100).map((r) => r.verdicts),
        `deal ${seed}`,
      ).toEqual([careful]);
      const wolf = runs.filter((r) => r.ending === 'wolf').map((r) => r.total);
      const clean = runs.filter((r) => r.ending === 'grandma').map((r) => r.total);
      expect(wolf).toHaveLength(128 - 8);
      expect(Math.max(...wolf)).toBeLessThan(Math.min(...clean));
    }
  });

  /*
   * THE SCORE TABLE, over every deal. The numbers are the report: greedy, leave-all and random all
   * low, the best a wolf run can do far below 100, and the best card-blind basket well under the
   * rote line. Since the client's floor (2026-10-25) every run that ends keeps 25 for playing, so
   * "low" is 25 for the wolf and 40 for a clean empty basket, against the rote line's 55.
   */
  it('greedy, leave-all and random score low in every deal; careful scores 100 in every one', () => {
    const rows = v2.table(content);
    const of = (name: string) => rows.filter((r) => r.strategy === name).map((r) => r.total);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(new Set(of('careful'))).toEqual(new Set([100]));
    expect(new Set(of('greedy'))).toEqual(new Set([content.scoring.played]));
    expect(new Set(of('leave-all'))).toEqual(
      new Set([content.scoring.played + content.scoring.clean]),
    );
    const random = seeds.flatMap((seed) =>
      Array.from(
        { length: 20 },
        (_x, k) => v2.play(content, 'random', { seed: seed + 35 * k }).total,
      ),
    );
    expect(mean(random)).toBeLessThan(content.scoring.played + 5);
    const bestWolf = Math.max(
      ...seeds.flatMap((seed) =>
        v2
          .everyRun(content, seed)
          .filter((r) => r.ending === 'wolf')
          .map((r) => r.total),
      ),
    );
    expect(bestWolf).toBe(content.scoring.played);
    // Leaving everything (40) and taking one blind (right in 15 deals of 35 at 60, the wolf in the
    // other 20 at 25) tie at the top, both well under the rote line of 55.
    const blind = v2.blindAverages(content)[0]!;
    expect(blind.mean).toBeCloseTo(40);
    expect(blind.mean).toBeCloseTo((15 / 35) * 60 + (20 / 35) * 25);
  });
});

/*
 * THE GIVEAWAY IS THE LESSON. The lint holds its shape (one line, short); these hold what a reader
 * needs from it, as tripwires. Whether each line is PLAIN -- "follows a stranger's instructions",
 * "sends your note somewhere else" -- is a human read (PAUL_BRIEF section 7).
 */
describe('the seven giveaway lines', () => {
  it('every bad card has one, it is short, and the good card does not have it', () => {
    for (const s of content.skills) {
      const line = v2.giveaway(s)!;
      expect(line, s.id).toBeTruthy();
      expect(words(line), `${s.id}: "${line}"`).toBeLessThanOrEqual(v2.GIVEAWAY_WORDS);
      expect(s.good.card.take).not.toContain(line);
    }
  });

  /*
   * NO SHAPE GIVES THE VERDICT AWAY ON REPLAY. The lint holds every bad card to its good card's
   * line count; this holds the swap's PLACE, read off the cards: if every giveaway stood on the same
   * line, "read only line two" would be a rote rule. Draft 6 failed both (two bad cards added a line,
   * the other five all swapped the last one).
   */
  it('every bad card is as long as its good card, and the giveaway is not always on the same line', () => {
    const at = content.skills.map((s) => {
      expect(s.bad.card.take, s.id).toHaveLength(s.good.card.take.length);
      return s.bad.card.take.indexOf(v2.giveaway(s)!);
    });
    expect(new Set(at).size, `giveaway lines: ${at.join(', ')}`).toBeGreaterThan(1);
  });

  /*
   * A CARD SAYS WHAT THE SKILL DOES, NEVER WHO IS BEHIND IT. If a card said "wolf", the careful
   * answer would be a word to spot rather than a capability to read about.
   */
  it('no card line, good or bad, names the wolf', () => {
    for (const s of content.skills)
      for (const k of ['good', 'bad'] as const)
        for (const line of [...s[k].card.take, s[k].card.leave])
          expect(line, `${s.id}.${k}`).not.toMatch(/\bwolf/i);
  });

  /*
   * "The wolf lines are the product." A bad skill still KEPT its promise, so its reveal names the
   * wolf and is not phrased as a denial; a good skill's reveal never mentions the wolf.
   */
  const DENIAL =
    /\b(not|never|no|nothing|nobody|didn't|couldn't|wasn't|isn't|but|instead|failed)\b/i;
  it('every bad reveal names the wolf and is not a denial; no good reveal names the wolf', () => {
    for (const s of content.skills) {
      expect(s.bad.reveal, `${s.id}: the bad reveal does not name the wolf`).toMatch(/\bwolf/i);
      expect(s.bad.reveal, `${s.id}: the bad reveal reads as a denial`).not.toMatch(DENIAL);
      expect(s.good.reveal, `${s.id}: the good reveal names the wolf`).not.toMatch(/\bwolf/i);
    }
  });

  /*
   * GLANCEABLE. Every sentence on the reveal is a short line, held to the same limit as the giveaway
   * (`v2.GIVEAWAY_WORDS`, the user's "short" for a line that has to be read, not waded through).
   *
   * THIS WAS THE CLIENT'S SKETCH (GAME_DESIGN_V2 section 6), whose longest row is six words, read
   * out of the design document. The client then approved the seven skills' reveal lines word for
   * word in chat on 2026-10-22, and two of their sentences are eight ("One note on a tree was the
   * wolf's.", "It flew you where the wolf's map said."). The approval is the later and more
   * specific word, so the sketch stopped being the bound; it is NOT replaced by the longest line
   * the content happens to have, which would be a bound written in terms of the thing it guards
   * (PAUL_BRIEF trap 5).
   */
  const sentences = (line: string): string[] =>
    line
      .replace(/\.\.\./g, '…')
      .split(/[.!?:]\s*/)
      .filter((x) => x.trim() !== '');
  const unglanceable = (c: v2.Content): string[] =>
    c.skills.flatMap((s) =>
      (['good', 'bad'] as const).flatMap((k) =>
        sentences(s[k].reveal)
          .filter((x) => words(x) > v2.GIVEAWAY_WORDS)
          .map((x) => `${s.id}.${k}: "${x}" is ${words(x)} words`),
      ),
    );

  it('every sentence on the reveal is a short line, no longer than a giveaway may be', () => {
    expect(unglanceable(content)).toEqual([]);
    const long = edited((v) => {
      v.skills.find((s) => s.id === 'way-teller')!.good.reveal =
        'Showed you who lived down every single path in the wood.';
    });
    expect(unglanceable(long)).toEqual([
      expect.stringMatching(/^way-teller\.good: .* is 11 words$/),
    ]);
  });
});

/*
 * THE PERKS ARE THE CLIENT'S (2026-10-22), one per character in walking order. The effect is the
 * skill's, not the variant's (content.ts), so a good and a bad copy cannot differ in the forest.
 * Pinned here because a perk moved to another skill would change the game without failing a rule.
 */
describe('the seven perks', () => {
  it('each character gives the perk the client approved, with the approved numbers', () => {
    expect(
      Object.fromEntries(
        content.characters.map((c) => [c.id, v2.findSkill(content, c.skillId)!.effect]),
      ),
    ).toEqual({
      rabbit: { kind: 'minimap' },
      toadstool: { kind: 'fork-signs' },
      owl: { kind: 'early-welcome' },
      magpie: { kind: 'wing-ride', flightMs: expect.any(Number) },
      snail: { kind: 'walk-faster', factor: 1.15 },
      'lantern-keeper': { kind: 'lantern' },
      cat: { kind: 'rewind', ms: 20_000 },
    });
    // Dusk from the HUD's 2:00, for everyone.
    expect(content.world.dusk.fromLeftMs).toBe(120_000);
  });

  it("the magpie's flight lands beside the next unmet friend in walking order, never at the door", () => {
    const order = content.characters.map((c) => c.id);
    const upTo = (id: string) => order.slice(0, order.indexOf(id) + 1);
    expect(v2.wingRideTarget(content, upTo('magpie'), 'magpie')).toBe('snail');
    // Everyone met but the rabbit: it wraps round to her.
    expect(v2.wingRideTarget(content, order.slice(1), 'magpie')).toBe('rabbit');
    expect(v2.wingRideTarget(content, order, 'magpie')).toBeNull();
  });
});

/*
 * THE HOW-TO NAMES THE CLOCK, so the clock it names is the rule's, read from `TIME_LIMIT_MS` and
 * formatted the way the HUD shows it (m:ss) -- not a number remembered in the copy (PAUL_BRIEF trap 1).
 */
describe('the screens say what the rules do', () => {
  it("the how-to's deadline is the rule's time limit", () => {
    const seconds = v2.TIME_LIMIT_MS / 1000;
    const face = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    expect(
      content.ui.howTo.steps.filter((l) => l.includes(face)),
      face,
    ).toHaveLength(1);
  });
});

describe('the cast stands on art that exists', () => {
  const spriteKeys = new Set(manifest.spritesheets.map((s) => s.key));
  const map = readForestMap(mapJson);

  it('every skill names a character that exists, and every character offers a skill that exists', () => {
    for (const s of content.skills)
      expect(v2.findCharacterForSkill(content, s.id), `nobody offers ${s.id}`).toBeDefined();
    for (const c of content.characters)
      expect(v2.findSkill(content, c.skillId), `${c.id} offers ${c.skillId}`).toBeDefined();
  });

  /*
   * The game draws a character with the texture named by its SPAWN: `forest-scene.ts`
   * `createCharacter` does `const key = spawn.spawnName` and throws "Missing sprite" otherwise. So
   * a spawn name that is not a spritesheet key in the manifest is a character Phase C would have
   * to paint, which this phase promised it would not (CLAUDE.md rule 5).
   */
  it('every character uses a sprite that exists in the shipped manifest, and none is the wolf', () => {
    for (const c of content.characters) {
      expect(spriteKeys.has(c.spawn), `${c.id}: no sprite "${c.spawn}" in manifest.json`).toBe(
        true,
      );
      expect(c.spawn, 'the wolf is the antagonist, not a skill-giver').not.toBe('npc-wolf');
    }
  });

  it('every character has a spawn on the shipped map today', () => {
    for (const c of content.characters)
      expect(findObject(map, c.spawn), `${c.id}: no "${c.spawn}" on map-forest.json`).toBeDefined();
  });

  /*
   * All seven skill icons exist as art since 2026-10-22, when the signpost, parcel, map and latch
   * were painted in tools/graybox/src/sprites/faces.ts, so the list is empty. Before that, four did
   * not, and nothing was invented in their place (CLAUDE.md rule 5): an icon awaiting art is named
   * here so the gap is visible, and the list is a RATCHET -- once the art lands, the second
   * assertion fails until the name is removed from this list.
   *
   * The first content reused icons that contradicted their rows, and the second put `item-letter`
   * on Word Weaver and `item-key` on Latch Lifter -- art that belonged to the retired rulebook's
   * starting basket, not to these skills. A reused icon that meant something else is worse than a
   * labelled gap, so both wait for art now.
   *
   * Later on 2026-10-22, the approved set: the Magpie's Wing Ride and the Cat's Long Evening take
   * two NEW icons the client named, `item-wings` and `item-hourglass`. Until a painter ships them
   * they are on the list; when they land, the second test fails until they come off it.
   */
  const AWAITING_ART: readonly string[] = [];

  it('no two skills share an icon, so every reveal row is told apart by its picture', () => {
    const icons = content.skills.map((s) => s.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
  it('every skill icon is shipped art, or is on the named list of icons awaiting art', () => {
    const images = new Set(manifest.images);
    for (const s of content.skills)
      expect(
        images.has(`${s.icon}.png`) || AWAITING_ART.includes(s.icon),
        `${s.id}: icon "${s.icon}" is neither in manifest.json nor awaiting art`,
      ).toBe(true);
    for (const icon of AWAITING_ART)
      expect(images.has(`${icon}.png`), `${icon} has arrived; take it off AWAITING_ART`).toBe(
        false,
      );
  });
});

/*
 * THE CLOCK, AT A PACE DERIVED FROM THE REAL GAME.
 *
 * `clockCheck` needs two numbers the content does not know: how long a walk between characters
 * takes, and how long a conversation takes before the card is opened. Both are derived here.
 *
 * WALKING. Purple moves at `WALK_SPEED` game pixels per second (logic.ts). The distance is walked
 * over the shipped map's collision layer by a breadth-first search, four-connected, tile to tile:
 * from `spawn-purple`, to a walkable tile within `INTERACT_RADIUS` of each character's spawn in
 * CONTENT ORDER (the simulator meets them in that order, so it is the order the pace must model),
 * then into `trigger-cottage`. Four-connected is the conservative choice: Purple walks diagonals
 * at full speed (`movementVector` normalises), so the true shortest walk is up to a root-two
 * shorter. Then the whole tour is DOUBLED, because a visitor does not walk the shortest path --
 * they look around, overshoot, and walk back. A careful reader must make it even so.
 *
 * TALKING AND READING. One rate for everything, `v2.READING` (sim.ts, where its source is cited):
 * a conversation is the longest greeting read at that rate, plus a second to press on; a card is
 * charged by the simulator itself, from the words on the card THE DEAL SHOWS -- so a bad card's
 * giveaway line costs its reading time too, and the check is run over all 35 deals.
 *
 * THE KNOCK AND THE PERKS. The simulator charges the knock at the door (`world.knockMs`) to every
 * paced arrival but an early-welcome one, and gives a careful basket the time its perks save. The
 * clock check is asked both ways: with the perks, each run held to its own deadline, and without
 * them, held to the bare three minutes -- the second is the layout's question, so the measured
 * edge below is the no-perk one.
 */
const PRESS_ON_MS = 1_000;
const WANDER = 2;

type Tile = readonly [number, number];
const key = ([x, y]: Tile): string => `${x},${y}`;
const centre = ([x, y]: Tile) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

/** Shortest four-connected walk, in tiles, from `from` to any tile `goal` accepts. */
function walk(
  map: ReturnType<typeof readForestMap>,
  from: Tile,
  goal: (t: Tile) => boolean,
): { tiles: number; at: Tile } {
  const seen = new Map<string, number>([[key(from), 0]]);
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i]!;
    const d = seen.get(key(t))!;
    if (goal(t)) return { tiles: d, at: t };
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n: Tile = [t[0] + dx, t[1] + dy];
      if (seen.has(key(n)) || isSolidTile(map.collision, n[0], n[1])) continue;
      seen.set(key(n), d + 1);
      queue.push(n);
    }
  }
  throw new Error(`no walkable path from ${key(from)}`);
}

const objectCentre = (o: MapObject) => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });
const tileOf = (o: MapObject): Tile => [Math.floor(o.x / TILE), Math.floor(o.y / TILE)];

/** The tour the careful simulator models, in content order, walked on the shipped map. */
function tour(): { legs: { to: string; tiles: number }[]; tiles: number } {
  const map = readForestMap(mapJson);
  const need = (name: string): MapObject => {
    const o = findObject(map, name);
    if (!o) throw new Error(`map-forest.json has no "${name}"`);
    return o;
  };
  let at = tileOf(need('spawn-purple'));
  const legs: { to: string; tiles: number }[] = [];
  for (const c of content.characters) {
    const spot = objectCentre(need(c.spawn));
    const leg = walk(map, at, (t) => {
      const p = centre(t);
      return Math.hypot(p.x - spot.x, p.y - spot.y) <= INTERACT_RADIUS;
    });
    legs.push({ to: c.id, tiles: leg.tiles });
    at = leg.at;
  }
  const door = need('trigger-cottage');
  const last = walk(map, at, (t) => overlaps(centre(t), door));
  legs.push({ to: 'cottage', tiles: last.tiles });
  return { legs, tiles: legs.reduce((n, l) => n + l.tiles, 0) };
}

/** The longest greeting, read, plus pressing on. The simulator charges one talk per character. */
const talkMs = (): number =>
  Math.max(...content.characters.map((c) => words(c.greet))) * v2.READING.msPerWord + PRESS_ON_MS;

/** The pace for a tour of `tiles`, doubled for wandering, spread evenly over every leg. */
function paceFor(tiles: number): v2.Pace {
  const walkTotalMs = ((tiles * TILE) / WALK_SPEED) * 1000 * WANDER;
  return { walkMs: Math.ceil(walkTotalMs / (content.characters.length + 1)), talkMs: talkMs() };
}

describe('the clock, at the pace of the real map', () => {
  it('a careful reader who reads every card makes it inside three minutes, walking twice the shortest path', () => {
    const { tiles, legs } = tour();
    const check = v2.clockCheck(content, paceFor(tiles));
    const why = `tour ${tiles} tiles (${legs.map((l) => `${l.to} ${l.tiles}`).join(', ')}); careful arrived at ${check.elapsedMs}ms in deal ${check.seed}, ${check.marginMs}ms to spare`;
    expect(check.ending, why).not.toBe('late');
    expect(check.ok, why).toBe(true);
    expect(check.marginMs, why).toBeGreaterThan(0);
    // And with no perk helping at all -- every walk walked, every knock knocked, no rewind counted.
    expect(v2.clockCheck(content, paceFor(tiles), { perks: false }).ok, why).toBe(true);
  });

  /*
   * WHAT THE PACE ASSUMES, FOR PHASE C: the longest content-order tour, in four-connected tiles,
   * that still lets a careful reader arrive. Phase C may move the cast anywhere that keeps the tour
   * inside it.
   *
   * Taken on its own, "the tour is under the bound" is implied by the test above and could never
   * fail alone (PAUL_BRIEF trap 5). So this asserts something the test above does not: that the
   * bound is TIGHT, from both sides, by playing it. A tour of exactly the bound arrives and a tour
   * one tile longer is late -- so the number Phase C reads is the real edge, not an estimate.
   */
  it("the longest tour Phase C can lay out is a measured edge, and today's map is inside it", () => {
    // The worst deal's talking and reading, with no walking at all: the clock check, unwalked.
    const readingMs = v2.clockCheck(
      content,
      { walkMs: 0, talkMs: talkMs() },
      { perks: false },
    ).elapsedMs;
    const maxTourTiles = Math.floor(
      (((v2.TIME_LIMIT_MS - readingMs) / 1000) * WALK_SPEED) / TILE / WANDER,
    );
    const noPerks = { perks: false };
    expect(v2.clockCheck(content, paceFor(maxTourTiles), noPerks).ok, `${maxTourTiles} tiles`).toBe(
      true,
    );
    expect(
      v2.clockCheck(content, paceFor(maxTourTiles + 1), noPerks).ok,
      `${maxTourTiles + 1} tiles`,
    ).toBe(false);
    expect(tour().tiles).toBeLessThanOrEqual(maxTourTiles);
  });
});

/*
 * PAR, THE TIME THAT EARNS THE WHOLE SPEED BONUS (scoring.ts `speedBonus`), DERIVED, NOT CHOSEN.
 *
 * The client's rule is "a combination of time and correct answers", correctness first. Par is the
 * arrival time of a careful run -- every card read, the three good taken -- by a player who walks
 * the shortest content-order tour of the shipped map ONCE (no wandering: `tour()` above, so the
 * same four-connected walk the clock check doubles) and reads every greeting and every card at
 * `v2.BRISK`: the adult silent-reading rate itself, 238 words a minute, with no pause to decide.
 * Taken in the SLOWEST deal, so a brisk reader can earn the whole bonus in every deal, not only in
 * the deals whose bad cards happen to be short.
 *
 * THE NO-PERK TOUR (2026-10-22): par is measured as if no perk saved a second -- every leg walked,
 * the knock at the door paid, the elapsed time read raw -- so a perk is a way to BEAT par, never
 * the price of reaching it. A deal whose good three include the wing ride, the faster walk, the
 * early welcome or the long evening is easier to bring in at par, and that is the perk.
 *
 * `scoring.parMs` in the content must sit at or above that and within ten seconds of it: under it
 * and no honest reader can reach 100; far over it and the bonus stops measuring anything. A copy
 * edit that lengthens a card by a few words moves the derived par by about a quarter of a second a
 * word, which is why this is a band and not an equality.
 */
describe('par is the brisk careful run on the shortest walk, in the slowest deal', () => {
  const briskTalkMs = (): number =>
    Math.max(...content.characters.map((c) => words(c.greet))) * v2.BRISK.msPerWord;

  const derivedPar = (): { ms: number; why: string } => {
    const { tiles } = tour();
    const walkMs = Math.ceil(
      (((tiles * TILE) / WALK_SPEED) * 1000) / (content.characters.length + 1),
    );
    const runs = seeds.map((seed) =>
      v2.play(content, 'careful', {
        seed,
        pace: { walkMs, talkMs: briskTalkMs() },
        reading: v2.BRISK,
        perks: false,
      }),
    );
    const slowest = runs.reduce((w, p) => (p.elapsedMs > w.elapsedMs ? p : w));
    return {
      ms: slowest.elapsedMs,
      why: `tour ${tiles} tiles; slowest brisk careful run ${Math.round(slowest.elapsedMs)}ms in deal ${slowest.seed}; parMs ${content.scoring.parMs}`,
    };
  };

  it('scoring.parMs is at or over the derived par, and within ten seconds of it', () => {
    const { ms, why } = derivedPar();
    expect(content.scoring.parMs, why).toBeGreaterThanOrEqual(ms);
    expect(content.scoring.parMs, why).toBeLessThanOrEqual(ms + 10_000);
  });

  it('a brisk careful run at par scores the ceiling, and the same run at the slower READING pace does not', () => {
    const { tiles } = tour();
    const walkMs = Math.ceil(
      (((tiles * TILE) / WALK_SPEED) * 1000) / (content.characters.length + 1),
    );
    for (const seed of seeds) {
      const brisk = v2.play(content, 'careful', {
        seed,
        pace: { walkMs, talkMs: briskTalkMs() },
        reading: v2.BRISK,
      });
      expect(brisk.total, `deal ${seed}`).toBe(content.scoring.outOf);
      const slow = v2.play(content, 'careful', { seed, pace: paceFor(tiles) });
      expect(slow.ending).toBe('grandma');
      expect(slow.total, `deal ${seed}`).toBeLessThan(content.scoring.outOf);
      expect(slow.total).toBeGreaterThanOrEqual(
        content.scoring.played + content.scoring.clean + content.scoring.good * 3,
      );
    }
  });
});
