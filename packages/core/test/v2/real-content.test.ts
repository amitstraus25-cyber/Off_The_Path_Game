import { describe, expect, it } from 'vitest';
import raw from '../../../../content/game.v2.json';
import v1 from '../../../../content/game.json';
import design from '../../../../docs/GAME_DESIGN_V2.md?raw';
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

/** The real content with its casting or copy changed, for proving a guard by breaking it. */
const edited = (mutate: (c: typeof raw) => void): v2.Content => {
  const v = structuredClone(raw);
  mutate(v);
  return v2.parseContent(v);
};
/** The same characters offering each other's skills: the copy and numbers are untouched. */
const swapOffers = (a: string, b: string) =>
  edited((v) => {
    const x = v.characters.find((c) => c.id === a)!;
    const y = v.characters.find((c) => c.id === b)!;
    [x.skillId, y.skillId] = [y.skillId, x.skillId];
  });

const words = (...lines: string[]): number =>
  lines.flatMap((l) => l.split(/\s+/).filter(Boolean)).length;

const ROTE_LINE = Math.floor(content.scoring.outOf * v2.ROTE_SHARE + 1e-9);
const bestOf = (c: v2.Content, s: v2.Skill): v2.Verdict => v2.bestVerdict(s, c);
const offerer = (c: v2.Content, s: v2.Skill): string => v2.findCharacterForSkill(c, s.id)!.id;
/** Every run's total, keyed by its verdicts, so a rule over the cast is scored by the reducer. */
const playedTable = (c: v2.Content): Map<string, v2.Run> =>
  new Map(v2.everyRun(c).map((r) => [r.verdicts.join(','), r]));

describe('the real v2 content loads under the launch rules', () => {
  it('passes the schema, every lint rule and every trap check, with no errors', () => {
    // Asserted as the ISSUE LIST, not as "does not throw": a thrown ContentError prints truncated
    // in the failure, and the list is the diagnosis. Proved by breaking wolfCost: the failure then
    // reads `trap: greedy scores near zero (taking everything scores 300; at most 200 allowed)`.
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
    expect(v2.lintContent(content, { launch: true })).toEqual([]);
  });

  it('has six or seven skills, each offered by exactly one character', () => {
    const n = content.skills.length;
    expect(n).toBeGreaterThanOrEqual(v2.LAUNCH_CAST.min);
    expect(n).toBeLessThanOrEqual(v2.LAUNCH_CAST.max);
    expect(content.characters).toHaveLength(n);
  });

  it('every trap check holds when the content is played', () => {
    const { ok, checks } = v2.trapChecks(content);
    for (const c of checks) expect(c.ok, `${c.name}: ${c.detail}`).toBe(true);
    expect(ok).toBe(true);
  });

  /*
   * GAME_DESIGN_V2 section 5 asks for three shapes, and the rules give each a definition that can
   * be read off the data rather than off a label somebody wrote:
   *
   *   safe in full     taking it in full serves nobody but you
   *   safe if limited  taking it in full serves the wolf; the boundary removes that
   *   dangerous        it serves the wolf however it is taken; the danger IS the job
   *
   * The lint already forbids the fourth combination (limit serves the wolf, take does not). This
   * asserts every skill is one of the three and that the mix holds all three, so a retune cannot
   * quietly collapse it into "every skill is safe if limited".
   */
  it('the mix holds all three shapes the spec asks for', () => {
    const shape = (s: v2.Skill): string =>
      s.did.take.wolf === undefined
        ? 'safe in full'
        : s.did.limit.wolf === undefined
          ? 'safe if limited'
          : 'dangerous';
    const mix = new Map<string, string[]>();
    for (const s of content.skills) mix.set(shape(s), [...(mix.get(shape(s)) ?? []), s.id]);
    expect([...mix.keys()].sort()).toEqual(['dangerous', 'safe if limited', 'safe in full']);
    // Each shape's best verdict is the one the shape implies -- the careful answer is learnable.
    for (const s of content.skills)
      expect(v2.bestVerdict(s, content), s.id).toBe(
        { 'safe in full': 'take', 'safe if limited': 'limit', dangerous: 'leave' }[shape(s)],
      );
  });

  /*
   * "The wolf lines are the product." A skill that served the wolf must still have KEPT its
   * promise, so every wolf-serving verdict carries both halves: what it did (`line`) and what it
   * did for the wolf (`wolf`).
   *
   * THIS TEST USED TO ASSERT `line !== wolf`, and was dropped for it: two different sentences can
   * contradict each other, so the assertion could not catch a wolf line that took back its own line
   * ("Walked you to her door." / "It never got there.") and passed in silence on exactly the defect
   * it was named for (trap 6). What replaced it is what CAN be read off the data, named for what it
   * checks and nothing more:
   *
   *   - the kept promise EARNED something (`points > 0`), which is the data's own statement that
   *     the promise was kept;
   *   - the wolf line names the wolf, so the row says who it served rather than hinting;
   *   - a TRIPWIRE: no wolf line is phrased as a denial. A wolf line that contradicts "it kept its
   *     promise" almost always does it with a negation or a contrast word. This catches that common
   *     form; it does not read meaning, and a contradiction phrased without one of these words
   *     passes. Whether each pair is TRUE together stays a human read (PAUL_BRIEF section 7).
   */
  const DENIAL =
    /\b(not|never|no|nothing|nobody|didn't|couldn't|wasn't|isn't|but|instead|failed)\b/i;
  it('every verdict that served the wolf kept its promise, names the wolf, and is not phrased as a denial', () => {
    let wolves = 0;
    for (const s of content.skills)
      for (const v of v2.TAKES) {
        const d = s.did[v];
        if (d.wolf === undefined) continue;
        wolves++;
        expect(d.points, `${s.id}.${v} kept no promise`).toBeGreaterThan(0);
        expect(d.wolf, `${s.id}.${v}: the wolf line does not name the wolf`).toMatch(/\bwolf/i);
        expect(d.wolf, `${s.id}.${v}: the wolf line reads as a denial`).not.toMatch(DENIAL);
      }
    // The loop must have had something to check, or it proves nothing.
    expect(wolves).toBeGreaterThan(0);
  });

  /*
   * GLANCEABLE, AGAINST THE CLIENT'S OWN DRAWING. The reveal sketch in GAME_DESIGN_V2 section 6
   * gives each skill one row: a name, then one short phrase ("kept its promise", "sent word
   * ahead... to the wolf", "reached into your basket").
   *
   * THE BOUND IS READ OUT OF THE DOCUMENT, not copied from it. The last version wrote the longest
   * row into this file as a string and then added one word, and a refuter saw that the result (7)
   * was exactly the longest wolf line then shipping, and that its second cap (10) was exactly three
   * of the lines -- a bound fitted to the content rather than to the drawing (PAUL_BRIEF trap 5).
   * Now the rows are parsed from the sketch block itself (an indented "Two Capitalised" name, two
   * or more spaces, a phrase), so editing the sketch moves the bound and editing the content never
   * does. There is no "+ 1": the rule is that NO SENTENCE on the reveal is longer than the longest
   * row the client drew, which is the claim the sketch actually supports. A line may be two short
   * sentences, as the sketch's own row is two clauses either side of its ellipsis.
   */
  const SKETCH = (() => {
    const from = design.indexOf("The client's own sketch");
    const block = design.slice(from).split('```')[1] ?? '';
    return block.split('\n').flatMap((l) => {
      const m = /^\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s{2,}(\S.*)$/.exec(l);
      return m ? [{ name: m[1]!, phrase: m[2]!.trim() }] : [];
    });
  })();
  const SKETCH_LONGEST_ROW = Math.max(...SKETCH.map((r) => words(r.phrase)));
  const sentences = (line: string): string[] =>
    line
      .replace(/\.\.\./g, '…')
      .split(/[.!?:]\s*/)
      .filter((x) => x.trim() !== '');
  /** Every sentence longer than the sketch's longest row, across every reveal line and wolf line. */
  const unglanceable = (c: v2.Content): string[] =>
    c.skills.flatMap((s) =>
      v2.TAKES.flatMap((v) =>
        (['line', 'wolf'] as const).flatMap((k) =>
          sentences(s.did[v][k] ?? '')
            .filter((x) => words(x) > SKETCH_LONGEST_ROW)
            .map((x) => `${s.id}.${v}.${k}: "${x}" is ${words(x)} words`),
        ),
      ),
    );

  it('the sketch is read from the design document, and its rows are the ones the client drew', () => {
    // If this fails the sketch moved or changed shape, and the bound below means nothing until the
    // parser follows it.
    expect(SKETCH.map((r) => r.name)).toEqual(['Night Light', 'Word Weaver', 'Basket Helper']);
    expect(SKETCH_LONGEST_ROW).toBeGreaterThan(0);
  });

  it('every sentence on the reveal is no longer than the longest row of the sketch', () => {
    expect(unglanceable(content)).toEqual([]);
    // Proved by breaking: the first content's Night Light limited line, put back, is one sentence
    // over the drawing.
    const long = edited((v) => {
      v.skills.find((s) => s.id === 'night-light')!.did.limit.line =
        "Read every sign, even the wolf's, and lit only your feet.";
    });
    expect(unglanceable(long)).toEqual([
      expect.stringMatching(/^night-light\.limit\.line: .* is 11 words$/),
    ]);
  });

  /*
   * A CARD DESCRIBES WHAT THE SKILL CAN DO, NEVER WHO IS BEHIND IT. If a card line said "wolf",
   * the careful answer would be a word to spot on inspection rather than a capability to reason
   * about -- the vocabulary lesson again, one screen later.
   */
  it('no card line names the wolf', () => {
    for (const s of content.skills)
      for (const v of v2.VERDICTS) expect(s.card[v], `${s.id}.card.${v}`).not.toMatch(/\bwolf/i);
  });

  /*
   * THE DANGER NO CARD SHOWS, AND THE BOUNDARY THAT HOLDS ANYWAY (GAME_DESIGN_V2 section 10). The
   * research's headline is that some attacks are not on any card -- an instruction hidden in content
   * the skill reads -- and v2 still asks careful play to reach the ceiling. Both hold because what
   * protects the player is the boundary they set, not spotting a bad word: at least one skill is
   * best limited, and its LIMITED reveal still meets the wolf -- the attack arrived -- without
   * serving him. Its card names no wolf (asserted above), so nothing on it warned the player; what
   * it does say is what the skill can do, and that is what the limit cuts.
   *
   * Read off the data: safe if limited, no wolf clause on the limited verdict, and a limited line
   * that mentions the wolf. Whether that line reads as "the attack came and the boundary held" is a
   * human read; that the structure exists at all is what this asserts.
   */
  const heldBeat = (c: v2.Content): v2.Skill[] =>
    c.skills.filter(
      (s) =>
        s.did.take.wolf !== undefined &&
        s.did.limit.wolf === undefined &&
        /\bwolf/i.test(s.did.limit.line) &&
        v2.bestVerdict(s, c) === 'limit',
    );
  it('at least one skill meets the wolf even when limited, and the limit is what stops him', () => {
    expect(heldBeat(content).map((s) => s.id)).not.toEqual([]);
  });

  /*
   * ...AND ITS CARD DOES NOT GIVE THE DANGER AWAY. A refuter found the beat living only in the
   * reveal: Night Light's card said it "shines where they say", which names the signs' writers as
   * plainly as Way Teller's "follows a stranger's directions", so reading the cards for danger
   * reached the ceiling on all seven and the game still taught that careful reading is enough
   * (RESEARCH_ALIGNMENT section 1). Now at least one held skill's card names NOBODY outside the
   * player -- no stranger, maker, "anyone" or "they" -- in its full or its limited line. Its full
   * line reads as a plain upgrade ("lights the way ahead"); what is left to see is that it does more
   * than the promise asked for, and the only defence against that is least privilege. The reason
   * limiting wins arrives in the reveal: the sign nobody saw, read and held.
   *
   * A word list, so a tripwire, not a reading: a card that hints with other words passes. Proved by
   * putting back the old card.
   */
  const OUTSIDE_PARTY =
    /\b(anyone|anybody|someone|somebody|strangers?|makers?|whoever|they|them|helpers?|wolf|travellers?|others?)\b/i;
  const unwarned = (c: v2.Content): string[] =>
    heldBeat(c)
      .filter((s) => !OUTSIDE_PARTY.test(s.card.take) && !OUTSIDE_PARTY.test(s.card.limit))
      .map((s) => s.id);
  it("at least one held skill's card names nobody but the player: least privilege, not reading, is the defence", () => {
    expect(unwarned(content)).toEqual(['night-light']);
    const old = edited((v) => {
      v.skills.find((s) => s.id === 'night-light')!.card.take =
        'Reads every sign, and shines where they say.';
    });
    expect(unwarned(old)).toEqual([]);
  });

  /*
   * NO WORD PREDICTS A VERDICT, which is stronger than the trap's bound and is a rule for THIS
   * content rather than for any content. The trap check (`ROTE_SHARE`) bounds what a rule read off
   * the cast can EARN; it does not forbid a word that merely correlates. That gap was measured, not
   * supposed: "lanterns" put back in the Rabbit's greeting gives the Rabbit and the Lantern Keeper,
   * both best limited, a word nobody else says -- and every trap check still passed, because one
   * such word with nothing to pair it cannot lift a rule past 700. The first draft of this content
   * had exactly that word AND a second ("very", on the two skills best taken in full), and together
   * they scored 850.
   *
   * So: for every word two or more skills say before their cards are read, the skills that say it
   * must not all share one best verdict -- and nor may the skills that DON'T say it, when there are
   * two or more of them, because "leave anyone who never mentions Grandma" is a rule too.
   */
  /** Every word two or more skills are seen with that sorts them, or the rest, into one verdict. */
  const tellsIn = (c: v2.Content, seen: (s: v2.Skill) => Set<string>): string[] => {
    const said = c.skills.map(seen);
    const best = c.skills.map((s) => v2.bestVerdict(s, c));
    const vocabulary = new Set(said.flatMap((w) => [...w]));
    const tells: string[] = [];
    for (const word of vocabulary)
      for (const saying of [true, false]) {
        const group = best.filter((_v, i) => said[i]!.has(word) === saying);
        if (said.filter((w) => w.has(word)).length >= 2 && group.length >= 2)
          if (new Set(group).size === 1)
            tells.push(`${saying ? '' : 'not '}"${word}" -> ${group[0]} (${group.length} skills)`);
      }
    return tells.sort();
  };
  const wordTells = (c: v2.Content): string[] => tellsIn(c, (s) => v2.surfaceWords(c, s));
  it('no word the cast says sorts two or more skills into one verdict, by saying it or by not', () => {
    expect(wordTells(content)).toEqual([]);
  });

  /*
   * ...AND NO WORD ON AN OPENED CARD DOES EITHER. A refuter of draft 3 read the cards the way a rote
   * player reads greetings: "'maker' anywhere on the card -> leave, 'only' -> limit, else take" was
   * exactly the careful run and scored 1000. "maker" was on Word Weaver's and Short Cut's cards and
   * nowhere else; "only" was on every card but the two best taken in full. Every word check above
   * stopped at the card's edge, because rote meant "without opening a card" -- and a player who opens
   * every card and spots words is still not reasoning about what the skill can do.
   *
   * So the same rule, single words only (GAME_DESIGN_V2 section 10 records why deeper lists over card
   * words are not bounded), over two views of an opened card: its three lines alone, which is what
   * opening the card adds, and everything seen by then -- who offers it, the greeting, the name, the
   * promise and the three lines. A word could hide in either view and not the other ("only" on
   * every limited line and in a take skill's promise is a tell on the lines and not in the whole).
   * Same fold as everywhere else, so the same limit: synonyms are a human read.
   */
  const folded = (...lines: string[]): Set<string> =>
    new Set(
      [
        ...lines
          .join(' ')
          .toLowerCase()
          .matchAll(/[a-z]+(?:'[a-z]+)*/g),
      ].map(([w]) => v2.foldWord(w)),
    );
  const cardLines = (s: v2.Skill): Set<string> => folded(s.card.take, s.card.limit, s.card.leave);
  const cardTells = (c: v2.Content): string[] => [
    ...tellsIn(c, cardLines).map((t) => `lines: ${t}`),
    ...tellsIn(
      c,
      (s) => new Set([...v2.surfaceWords(c, s), ...folded(s.name, s.promise), ...cardLines(s)]),
    ).map((t) => `opened: ${t}`),
  ];
  /** Draft 3's cards, put back over today's copy: the refuter's evidence. */
  const DRAFT_3_CARDS: Record<string, { take: string; limit: string; leave: string }> = {
    'way-teller': {
      take: 'Walks you the old way. Asks for nothing.',
      limit: 'Shows you one turn at a time.',
      leave: 'You find your own way.',
    },
    'cottage-finder': {
      take: 'Opens your whole basket for her address.',
      limit: 'Reads only the address on her note.',
      leave: 'You guess the way.',
    },
    'short-cut': {
      take: 'Goes whatever way its maker sends tonight.',
      limit: 'Goes only the first way its maker sent.',
      leave: 'You keep to the long way.',
    },
    'slow-post': {
      take: 'Carries your parcel sealed, to her alone.',
      limit: 'Carries it sealed, as far as her gate.',
      leave: 'You carry it yourself.',
    },
  };
  const draft3Cards = (): v2.Content =>
    edited((v) => {
      for (const s of v.skills) if (DRAFT_3_CARDS[s.id]) s.card = DRAFT_3_CARDS[s.id]!;
    });
  it('no word on an opened card sorts two or more skills into one verdict, by saying it or by not', () => {
    expect(cardTells(content)).toEqual([]);
    // Proved by breaking: draft 3's cards put back over today's greetings and promises. Both of the
    // refuter's words fire on the lines, by name, and so do three it did not use. In the opened view
    // "maker" no longer does, because today's Rabbit and Owl say it in their greetings -- which is
    // the point of the provenance cues: the word is on skills of every verdict now.
    expect(cardTells(draft3Cards())).toEqual([
      'lines: "its" -> leave (2 skills)',
      'lines: "maker" -> leave (2 skills)',
      'lines: "read" -> limit (2 skills)',
      'lines: "send" -> leave (2 skills)',
      'lines: not "only" -> take (2 skills)',
      'opened: "its" -> leave (2 skills)',
      'opened: "open" -> limit (2 skills)',
      'opened: "read" -> limit (2 skills)',
      'opened: "send" -> leave (2 skills)',
      'opened: "walk" -> take (2 skills)',
      'opened: not "only" -> take (2 skills)',
      'opened: not "to" -> limit (3 skills)',
    ]);
  });

  it("the refuter's card rule no longer reaches the ceiling: 'maker' -> leave, 'only' -> limit, else take", () => {
    const scoreOf = (c: v2.Content): number => {
      const verdicts = c.skills.map((s): v2.Verdict => {
        const w = cardLines(s);
        return w.has('maker') ? 'leave' : w.has('only') ? 'limit' : 'take';
      });
      return playedTable(c).get(verdicts.join(','))!.total;
    };
    expect(scoreOf(draft3Cards())).toBe(content.scoring.outOf);
    expect(scoreOf(content)).toBeLessThanOrEqual(ROTE_LINE);
  });

  /*
   * THE REFUTER'S SCRATCH CASE, REPLAYED. With the old fold (a trailing "s" and nothing else), four
   * greeting edits -- a fox and Foxes on the two skills best left, a wish and Wishes on the two best
   * taken -- passed every v2 test, and "fox" -> leave, "wish" -> take, else limit scored 1000 clean.
   * Each spelling was said by one skill only, so none was ever a candidate. With the fold that
   * handles -es, both checks see it.
   */
  it('inflected tells are caught: the fox/foxes, wish/wishes scratch case fails the trap and the word test', () => {
    const oldFold = (w: string): string => w.replace(/'s$/, '').replace(/^([a-z]{2,}[^s])s$/, '$1');
    expect(oldFold('foxes')).not.toBe(oldFold('fox'));
    expect(oldFold('wishes')).not.toBe(oldFold('wish'));
    const greet = (v: typeof raw, id: string, extra: string): void => {
      const ch = v.characters.find((c) => c.id === id)!;
      ch.greet = `${extra} ${ch.greet}`;
    };
    const c = edited((v) => {
      greet(v, 'owl', 'Mind the fox.');
      greet(v, 'magpie', 'Foxes about.');
      greet(v, 'toadstool', 'I wish you well.');
      greet(v, 'snail', 'Best wishes.');
    });
    expect(
      ['owl', 'magpie'].map((id) => bestOf(c, v2.findSkill(c, v2.findCharacter(c, id)!.skillId)!)),
    ).toEqual(['leave', 'leave']);
    expect(wordTells(c)).toEqual(['"fox" -> leave (2 skills)', '"wish" -> take (2 skills)']);
    const rote = v2.trapChecks(c).checks.find((x) => x.name.startsWith('no rule of two clauses'))!;
    expect(rote.ok).toBe(false);
    expect(rote.detail).toMatch(/^best rote rule scores 1000 \(/);
  });

  /*
   * NO THREE-CLAUSE RULE BEATS THE ROTE LINE EITHER. `trapChecks` stops at two clauses, because it
   * runs on every load. A refuter found that the second content's 650 at two words became 850 at
   * three, so this measures the real content one level deeper, once, here -- words AND where an
   * offer stands, since position became a clause. Four-clause lists are NOT bounded and are recorded
   * in GAME_DESIGN_V2 section 10: a four-word list that sorts seven skills one by one is memorising
   * this cast, which no fixed content can prevent.
   */
  const deepest = (rs: v2.RoteRun[]): v2.RoteRun =>
    rs.reduce((m, r) => (r.total > m.total ? r : m));
  it('no rule of three clauses or fewer read off the cast beats the rote line', () => {
    const rote = v2.roteRuns(content, v2.everyRun(content), 3);
    const top = deepest(rote);
    expect(top.total, `${top.rule} (${top.ending})`).toBeLessThanOrEqual(ROTE_LINE);
    expect(rote.reduce((d, r) => Math.max(d, r.depth), 0)).toBe(3);
    // The family has positions in it, or the bound above says nothing about them.
    expect(rote.some((r) => r.rule.includes('the first offer ->'))).toBe(true);
    expect(rote.some((r) => r.rule.includes('the last offer ->'))).toBe(true);
  });

  /*
   * WHERE AN OFFER STANDS IS NOT A TELL (`roteRuns`). A refuter of draft 3 found the Toadstool next
   * to the spawn, so Way Teller -- the one skill best taken in full -- was the first offer every
   * player met, and "the first offer -> take" added to the best two-word rule scored 850 clean. No
   * check modelled position at all. Now it is a clause, and the cast is ORDERED so the first and the
   * last offers are both best limited: the answer the best rules' "else" already gives, so knowing
   * where an offer stands buys nothing. Content order is the walking order Phase C lays out.
   *
   * Proved by breaking, two ways. Draft 3's order, with today's copy, is the refuter's exact line at
   * three clauses. And with one shared word that picks out the two skills best left ("every" in the
   * Owl's greeting, beside Short Cut's "new every night"), the Toadstool first fails the two-clause
   * trap that runs on every load -- where the same edit with today's order does not, and where the
   * words alone do not either. So the order is what the trap is holding.
   */
  const toadstoolFirst = (v: typeof raw): void => {
    const i = v.characters.findIndex((c) => c.id === 'toadstool');
    v.characters.unshift(...v.characters.splice(i, 1));
  };
  it('the first and the last offer are both best limited, and the order is what the trap holds', () => {
    const first = v2.findSkill(content, content.characters[0]!.skillId)!;
    const last = v2.findSkill(content, content.characters.at(-1)!.skillId)!;
    expect([bestOf(content, first), bestOf(content, last)]).toEqual(['limit', 'limit']);

    const draft3Order = edited(toadstoolFirst);
    expect(deepest(v2.roteRuns(draft3Order, v2.everyRun(draft3Order), 3))).toMatchObject({
      total: 850,
      ending: 'grandma',
      rule: 'the first offer -> take, "i" -> limit, "it" -> leave, else limit',
    });

    const every = (v: typeof raw): void => {
      v.characters.find((c) => c.id === 'owl')!.greet += ' Every word.';
    };
    const rote = (c: v2.Content) =>
      v2.trapChecks(c).checks.find((x) => x.name.startsWith('no rule of two clauses'))!;
    const wordsOnly = (c: v2.Content) =>
      deepest(v2.roteRuns(c).filter((r) => !r.rule.includes(' offer ->'))).total;
    const today = edited(every);
    expect(rote(today).ok, rote(today).detail).toBe(true);
    const broken = edited((v) => {
      every(v);
      toadstoolFirst(v);
    });
    expect(wordsOnly(broken)).toBeLessThanOrEqual(ROTE_LINE);
    expect(rote(broken).ok).toBe(false);
    expect(rote(broken).detail).toMatch(
      /^best rote rule scores 850 \("every" -> leave, the first offer -> take, else limit, ending grandma\)/,
    );
  });

  /*
   * FOLKLORE IS NOT A TELL. A refuter found the cast sorted by reputation: the Toadstool (poison) and
   * the Magpie (thief) offered the two skills best left and the Owl (wisdom) the one best taken, so
   * "leave the toadstool and the magpie, limit the rest" scored 750 clean and adding "take the owl"
   * scored 900, with no card read -- and no word check saw it, because each name is said by one skill.
   *
   * A reputation is not in the content, so it is RECORDED here, per character, as the folk tradition
   * a European reader brings to the wood. It is a declaration (PAUL_BRIEF section 7's limit, again):
   * the test can hold the casting against it, not decide whether a cat is sinister. Every character
   * must have an entry, so a new one cannot arrive unclassified.
   */
  const FOLK: Record<string, 'sinister' | 'benign'> = {
    toadstool: 'sinister', // poison
    rabbit: 'benign',
    owl: 'benign', // wisdom
    magpie: 'sinister', // thief
    snail: 'benign',
    'lantern-keeper': 'benign', // the helper with a light
    cat: 'sinister', // the witch's familiar
  };
  /*
   * WHO MADE IT. RESEARCH_ALIGNMENT sections 3 and 4.4 want "who made it?" load-bearing, and the
   * second content had the opposite: the Owl's "a traveller left this with me" was the skill best
   * taken in full. So provenance is recorded too, each with the CUE in the copy that says so. An
   * unknown maker is never best taken in full.
   *
   * THE CUE HAS TO SAY WHO MADE IT, not merely be present. Draft 3's record held the Toadstool's
   * maker as known on "I have stood here longer than the path" -- the Toadstool's age, not who made
   * Way Teller -- and a refuter read it, fairly, as an unknown maker on the one skill best taken in
   * full. The test only checked the string was in the copy, which the same hand that wrote the
   * record had made true. So the record now says WHO, and the cue is read for it:
   *
   *   - it is in that character's greeting, promise or card, so it cannot drift from the copy;
   *   - it uses a word of making ("made", "maker"), so it is about provenance and not something else;
   *   - a maker who is the SPEAKER is claimed in the character's own greeting, in the first person
   *     ("I made it myself"); a maker who is someone else is NAMED in the cue ("Grandma made it");
   *   - an unknown maker is stated AS unknown ("No maker's mark", "Never saw who made it") rather
   *     than left for the reader to infer from where the thing came from.
   *
   * Still a word test, so still a tripwire for meaning: "I made it myself" is read as a claim of
   * making, not checked as true in the story. That stays the copy read (PAUL_BRIEF section 7).
   */
  type Provenance =
    { maker: 'unknown'; cue: string } | { maker: 'known'; by: 'speaker' | string; cue: string };
  const PROVENANCE: Record<string, Provenance> = {
    toadstool: { maker: 'known', by: 'speaker', cue: 'I made it myself' },
    rabbit: { maker: 'unknown', cue: "No maker's mark" },
    owl: { maker: 'unknown', cue: 'Maker unknown' },
    magpie: { maker: 'unknown', cue: 'Never saw who made it' },
    snail: { maker: 'known', by: 'speaker', cue: 'I made the post' },
    'lantern-keeper': { maker: 'known', by: 'speaker', cue: 'I made this lamp' },
    cat: { maker: 'known', by: 'Grandma', cue: 'Grandma made it' },
  };
  const MAKING = /\b(?:made|make|makes|maker|maker's|makers)\b/i;
  const FIRST_PERSON = /\b(?:I|me|my|myself|mine)\b/;
  const ABSENT = /\b(?:no|nobody|never|unknown|none|not)\b/i;
  /** Every character whose recorded maker its cue does not actually state, and why. */
  const unstatedMakers = (c: v2.Content, record: Record<string, Provenance>): string[] =>
    c.characters.flatMap((ch) => {
      const p = record[ch.id]!;
      const s = v2.findSkill(c, ch.skillId)!;
      const copy = [ch.greet, s.promise, s.card.take, s.card.limit, s.card.leave].join(' ');
      const why = (problem: string) => [`${ch.id}: "${p.cue}" ${problem}`];
      if (!copy.includes(p.cue)) return why('is not in its copy');
      if (!MAKING.test(p.cue)) return why('says nothing about who made it');
      if (p.maker === 'unknown')
        return ABSENT.test(p.cue) ? [] : why('does not say the maker is unknown');
      if (p.by !== 'speaker') return p.cue.includes(p.by) ? [] : why(`does not name ${p.by}`);
      return ch.greet.includes(p.cue) && FIRST_PERSON.test(p.cue)
        ? []
        : why('is not the speaker claiming it in their own greeting');
    });

  /** Rules a player could follow by WHO is offering, scored over every combination. */
  const classRules = (
    c: v2.Content,
    classOf: (characterId: string) => string,
  ): { rule: string; total: number }[] => {
    const played = playedTable(c);
    const classes = [...new Set(c.characters.map((ch) => classOf(ch.id)))].sort();
    const out: { rule: string; total: number }[] = [];
    for (let i = 0; i < v2.VERDICTS.length ** classes.length; i++) {
      const pick = new Map(classes.map((k, j) => [k, v2.VERDICTS[Math.floor(i / 3 ** j) % 3]!]));
      const verdicts = c.skills.map((s) => pick.get(classOf(offerer(c, s)))!);
      out.push({
        rule: classes.map((k) => `${k} -> ${pick.get(k)}`).join(', '),
        total: played.get(verdicts.join(','))!.total,
      });
    }
    return out;
  };

  const folkloreTells = (c: v2.Content): string[] => {
    const tells: string[] = [];
    const by = (v: v2.Verdict) =>
      c.skills.filter((s) => bestOf(c, s) === v).map((s) => FOLK[offerer(c, s)]);
    const leave = by('leave');
    const take = by('take');
    if (leave.every((t) => t === 'sinister') && take.every((t) => t === 'benign'))
      tells.push(
        'every skill best left is offered by a sinister character, every one best taken by a benign one',
      );
    if (leave.every((t) => t === 'benign') && take.every((t) => t === 'sinister'))
      tells.push('the same, inverted: reputation predicts the verdict backwards');
    if (!take.includes('sinister'))
      tells.push('nothing a sinister character offers is best taken in full');
    if (!leave.includes('benign')) tells.push('nothing a benign character offers is best left');
    for (const type of ['sinister', 'benign'] as const) {
      const verdicts = c.skills
        .filter((s) => FOLK[offerer(c, s)] === type)
        .map((s) => bestOf(c, s));
      if (new Set(verdicts).size === 1)
        tells.push(`every ${type} character's skill is best ${verdicts[0]}`);
    }
    for (const [name, classOf] of [
      ['reputation', (id: string) => FOLK[id]!],
      ['reputation and maker', (id: string) => `${FOLK[id]}/${PROVENANCE[id]!.maker}`],
    ] as const) {
      const top = classRules(c, classOf).reduce((m, r) => (r.total > m.total ? r : m));
      if (top.total > ROTE_LINE) tells.push(`a rule by ${name} scores ${top.total}: ${top.rule}`);
    }
    return tells;
  };

  it('every character has a recorded reputation and maker, and each cue in its copy states that maker', () => {
    const ids = content.characters.map((c) => c.id).sort();
    expect(Object.keys(FOLK).sort()).toEqual(ids);
    expect(Object.keys(PROVENANCE).sort()).toEqual(ids);
    expect(unstatedMakers(content, PROVENANCE)).toEqual([]);
  });

  it("draft 3's maker cues are refused, each for the reason a reader would give", () => {
    // Draft 3's copy and record, put back: every cue was present, and none but the Magpie's said
    // anything about making -- and the Magpie's named a maker it never identified.
    const draft3 = edited((v) => {
      const greet = (id: string, g: string) =>
        void (v.characters.find((c) => c.id === id)!.greet = g);
      greet('toadstool', 'I have stood here longer than the path.');
      greet('rabbit', 'Fresh from the crate. Mind the straw.');
      greet('owl', 'A traveller left this with me. Very kind.');
      greet('lantern-keeper', 'I trimmed the wick myself, for the pines.');
    });
    const record: Record<string, Provenance> = {
      ...PROVENANCE,
      toadstool: { maker: 'known', by: 'speaker', cue: 'I have stood here longer than the path' },
      rabbit: { maker: 'unknown', cue: 'Fresh from the crate' },
      owl: { maker: 'unknown', cue: 'A traveller left this with me' },
      magpie: { maker: 'unknown', cue: 'its maker picks tonight' },
      'lantern-keeper': { maker: 'known', by: 'speaker', cue: 'I trimmed the wick myself' },
    };
    expect(unstatedMakers(draft3, record)).toEqual([
      'rabbit: "Fresh from the crate" says nothing about who made it',
      'toadstool: "I have stood here longer than the path" says nothing about who made it',
      'owl: "A traveller left this with me" says nothing about who made it',
      'magpie: "its maker picks tonight" does not say the maker is unknown',
      'lantern-keeper: "I trimmed the wick myself" says nothing about who made it',
    ]);
    // A named maker must be the one named, and a speaker's claim must be the speaker's own words.
    expect(
      unstatedMakers(content, {
        ...PROVENANCE,
        cat: { maker: 'known', by: 'the Cat', cue: 'Grandma made it' },
        snail: { maker: 'known', by: 'speaker', cue: 'its maker' },
      }),
    ).toEqual([
      'snail: "its maker" is not in its copy',
      'cat: "Grandma made it" does not name the Cat',
    ]);
    expect(
      unstatedMakers(content, {
        ...PROVENANCE,
        toadstool: { maker: 'known', by: 'speaker', cue: 'its maker knew' },
      }),
    ).toEqual(['toadstool: "its maker knew" is not the speaker claiming it in their own greeting']);
  });

  it("a character's reputation does not predict its skill's verdict, and the cast plays against type", () => {
    expect(folkloreTells(content)).toEqual([]);
    // Against type, at least once each way.
    const against = content.skills.flatMap((s) => {
      const [type, best] = [FOLK[offerer(content, s)], bestOf(content, s)];
      return (type === 'sinister' && best === 'take') || (type === 'benign' && best === 'leave')
        ? [`${offerer(content, s)} ${best}`]
        : [];
    });
    expect(against).toEqual(expect.arrayContaining(['toadstool take', 'owl leave']));
  });

  it("the second content's casting is refused: the toadstool and the owl trading skills is the folklore tell", () => {
    // Swapping two offers re-creates the refuted shape: the Toadstool offers the skill best left,
    // the Owl the one best taken. Copy and numbers are untouched.
    const c = swapOffers('toadstool', 'owl');
    expect(folkloreTells(c)).toEqual(
      expect.arrayContaining([
        'every skill best left is offered by a sinister character, every one best taken by a benign one',
        'nothing a sinister character offers is best taken in full',
        'nothing a benign character offers is best left',
      ]),
    );
  });

  const unknownTakenInFull = (c: v2.Content): string[] =>
    c.skills
      .filter((s) => PROVENANCE[offerer(c, s)]!.maker === 'unknown' && bestOf(c, s) === 'take')
      .map((s) => `${offerer(c, s)} offers ${s.id}, best taken in full, maker unknown`);
  it('a skill whose maker is unknown is never best taken in full', () => {
    expect(content.characters.some((c) => PROVENANCE[c.id]!.maker === 'unknown')).toBe(true);
    expect(unknownTakenInFull(content)).toEqual([]);
    // The Owl's "a traveller left this with me" is the skill best LEFT: v1's exfiltrator, restored.
    expect(bestOf(content, v2.findSkill(content, 'word-weaver')!)).toBe('leave');
    expect(unknownTakenInFull(swapOffers('toadstool', 'owl'))).toEqual([
      'owl offers way-teller, best taken in full, maker unknown',
    ]);
  });

  /*
   * THE REFUTING LINES, REPLAYED. Two rote strategies beat the first content without a card read:
   * "leave the two travellers, limit everyone else" (750, clean ending) and "leave anyone who says
   * 'traveller', limit anything 'popular', take the rest" (six of seven right). They are rebuilt
   * here from the content's own words with the same `surfaceWords` the trap uses, and scored by the
   * real reducer. The trap check covers every such rule; these two are named so the regression that
   * started this is visible by name.
   */
  it('the two rote lines that refuted the first content score under the rote line now', () => {
    const said = content.skills.map((s) => v2.surfaceWords(content, s));
    const played = new Map(v2.everyRun(content).map((r) => [r.verdicts.join(','), r]));
    const scoreOf = (decide: (w: Set<string>) => v2.Verdict): number =>
      played.get(said.map(decide).join(','))!.total;
    const travellers = scoreOf((w) => (w.has('traveller') ? 'leave' : 'limit'));
    const popular = scoreOf((w) =>
      w.has('traveller') ? 'leave' : w.has('popular') ? 'limit' : 'take',
    );
    expect(travellers).toBeLessThanOrEqual(content.scoring.outOf * v2.ROTE_SHARE);
    expect(popular).toBeLessThanOrEqual(content.scoring.outOf * v2.ROTE_SHARE);
  });

  /*
   * A COMPROMISED RUN NEVER OUTRANKS A CAREFUL ONE ON THE BOARD. The trap check bounds the best
   * wolf run at WOLF_SHARE of the ceiling; this states the leaderboard consequence directly, over
   * every combination: every run that let the wolf in scores below every clean run that got at
   * least as many verdicts right.
   *
   * ONE EXCEPTION, AND IT IS THE FLOOR. Taking everything and leaving everything each get the two
   * safe-in-full skills' verdicts right, and both score 0 -- the total is floored, so they TIE. The
   * first draft of this test said "strictly below" and failed on exactly that pair. That is the
   * case `scoring.ts` already records: at the floor the number cannot tell them apart and the
   * ending ('wolf' against 'grandma') does. So a tie is allowed at 0 and nowhere else.
   */
  /*
   * ONE ASSERTION OVER A COMPUTED LIST, NOT ONE PER PAIR. The first version of this test walked
   * every (wolf run, clean run) pair and called expect() on each: 141,631 calls, 3 to 4 seconds
   * without coverage, and 6 to 12 seconds under load -- past the 5-second default, so the core
   * suite exited 1 for a reason that had nothing to do with the content (PAUL_BRIEF trap 9). The
   * pairs are not needed. For a wolf run w with k verdicts right, the only clean run that can
   * refute it is the CHEAPEST clean run with k or more right: if w scores below that one, it
   * scores below all of them. A wolf run at 0 can only tie a clean 0, which is allowed (below). So
   * the cheapest clean run is kept per count, carried down from the top, and each wolf run is
   * compared once.
   */
  const wolfOutranks = (c: v2.Content): { violations: string[]; pairs: number } => {
    const careful = c.skills.map((s) => v2.bestVerdict(s, c));
    const right = (r: v2.Run): number => r.verdicts.filter((v, i) => v === careful[i]).length;
    const runs = v2.everyRun(c);
    const n = c.skills.length;
    const cheapest: (v2.Run | undefined)[] = Array.from({ length: n + 2 }, () => undefined);
    const clean = Array.from({ length: n + 2 }, () => 0);
    for (const g of runs.filter((r) => r.ending === 'grandma')) {
      const k = right(g);
      clean[k]!++;
      if (cheapest[k] === undefined || g.total < cheapest[k]!.total) cheapest[k] = g;
    }
    for (let k = n - 1; k >= 0; k--) {
      clean[k]! += clean[k + 1]!;
      const up = cheapest[k + 1];
      if (up !== undefined && (cheapest[k] === undefined || up.total < cheapest[k]!.total))
        cheapest[k] = up;
    }
    let pairs = 0;
    const violations: string[] = [];
    for (const w of runs.filter((r) => r.ending === 'wolf')) {
      pairs += clean[right(w)]!;
      const g = cheapest[right(w)];
      if (g !== undefined && w.total > 0 && w.total >= g.total)
        violations.push(`${w.verdicts} (${w.total}) against ${g.verdicts} (${g.total})`);
    }
    return { violations, pairs };
  };

  /*
   * A COMPROMISED RUN NEVER OUTRANKS A CAREFUL ONE ON THE BOARD. The trap check bounds the best
   * wolf run at WOLF_SHARE of the ceiling; this states the leaderboard consequence directly, over
   * every combination: every run that let the wolf in scores below every clean run that got at
   * least as many verdicts right.
   *
   * ONE EXCEPTION, AND IT IS THE FLOOR. Taking everything and leaving everything each get the two
   * safe-in-full skills' verdicts right, and both score 0 -- the total is floored, so they TIE. The
   * first draft of this test said "strictly below" and failed on exactly that pair. That is the
   * case `scoring.ts` already records: at the floor the number cannot tell them apart and the
   * ending ('wolf' against 'grandma') does. So a tie is allowed at 0 and nowhere else.
   */
  it('no run that let the wolf in outscores a clean run with as many verdicts right', () => {
    const { violations, pairs } = wolfOutranks(content);
    expect(violations).toEqual([]);
    expect(pairs).toBeGreaterThan(0);
    // Proved by breaking: a wolf at 400 lets a careful run that took one maker-unknown skill in
    // full (750) tie a clean run that left the Toadstool's (750).
    const cheap = edited((v) => void (v.scoring.wolfCost = 400));
    expect(wolfOutranks(cheap).violations).not.toEqual([]);
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
   * Three skill icons exist as art. Four do not, and nothing is invented in their place (CLAUDE.md
   * rule 5): they are named here so the gap is visible, and the list is a RATCHET -- once the art
   * lands, the second assertion fails until the name is removed from this list.
   *
   * The first content reused icons that contradicted their rows (v1's ear-trumpet on a skill that
   * pinned notes to a post). The second then put `item-letter` on Word Weaver and `item-key` on
   * Latch Lifter -- and those are v1's STARTING BASKET, Grandma's note and the cottage key, the
   * things the player carries rather than the skills they are offered. A reused icon that meant
   * something else in v1 is worse than a labelled gap, so both wait for art now.
   */
  const AWAITING_ART = ['item-latch', 'item-parcel', 'item-shortcut', 'item-signpost'];

  /*
   * THE RULE, read off v1's own content rather than remembered: no v2 skill wears the icon of
   * something in v1's starting basket, and a v2 skill that wears any other v1 item's icon wears the
   * one v1 gave THAT SAME SKILL. Word Weaver keeps v1's ear-trumpet because it is v1's Word Weaver
   * again ("sends what you say out of the forest"); Cottage Finder and Night Light keep theirs.
   */
  const v1Basket = new Set(v1.startBasket.map((k) => v1.items[k as keyof typeof v1.items]));
  const v1Items = new Set(Object.values(v1.items));
  const v1IconOf = new Map(v1.skills.map((s) => [s.id, s.icon]));
  const borrowedIcons = (c: v2.Content): string[] =>
    c.skills.flatMap((s) =>
      v1Basket.has(s.icon)
        ? [`${s.id}: "${s.icon}" is v1's starting basket`]
        : v1Items.has(s.icon) && v1IconOf.get(s.id) !== s.icon
          ? [`${s.id}: "${s.icon}" meant another skill in v1`]
          : [],
    );
  it("no skill icon is one of v1's basket items, or an icon v1 gave a different skill", () => {
    expect([...v1Basket].sort()).toEqual(['item-key', 'item-letter']);
    expect(borrowedIcons(content)).toEqual([]);
    const round2 = edited((v) => {
      v.skills.find((s) => s.id === 'latch-lifter')!.icon = 'item-key';
      v.skills.find((s) => s.id === 'short-cut')!.icon = 'item-compass';
    });
    expect(borrowedIcons(round2)).toEqual([
      'short-cut: "item-compass" meant another skill in v1',
      'latch-lifter: "item-key" is v1\'s starting basket',
    ]);
  });

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
 * TALKING AND READING. One reading rate for everything: 200 words a minute. The meta-analysis
 * figure for adults reading English non-fiction silently is about 238 (Brysbaert 2019, Journal of
 * Memory and Language 109); 200 is that, slowed for a reader who is reading to decide. The dialogue
 * typewriter (55 characters a second, `Dialogue.tsx`) outruns it -- about ten words a second --
 * and can be skipped, so reading is what binds, not typing.
 *   - a conversation is the greeting read at that rate, plus a second to press on;
 *   - a card is every word on it -- the skill's name, its promise and its three lines -- plus one
 *     word for each of the three buttons, read at that rate, plus three seconds to decide.
 * Each skill's `inspectMs` must be at least that model of its own card, so content cannot buy
 * itself a clock by understating how long its card takes to read.
 *
 * WHY THE BUTTONS COUNT ONE WORD EACH, recorded because the first draft counted them in full. The
 * labels GAME_DESIGN_V2 section 4 gives ("Take it", "Take it, limited", "Leave it") are seven
 * words, identical on all seven cards. Charged in full on every card they cost 49 words, about
 * fifteen seconds, for text the reader has already learned by the second card -- and with them
 * the draft copy ran 6.7 seconds LATE at this pace. Charging one word per button keeps a glance at
 * each verb in the model without pretending it is read from scratch seven times. That change alone,
 * on the draft copy, would have arrived with 1.7 seconds to spare -- so the copy was ALSO cut, from
 * 218 card words to 189 and every greeting to ten words or fewer, to reach the margin. The model
 * was not bent to fit long copy alone.
 */
const MS_PER_WORD = 60_000 / 200;
const PRESS_ON_MS = 1_000;
const DECIDE_MS = 3_000;
const WANDER = 2;
const BUTTONS = 3;

const cardWords = (s: v2.Skill): number =>
  words(s.name, s.promise, s.card.take, s.card.limit, s.card.leave) + BUTTONS;
const cardModelMs = (s: v2.Skill): number => cardWords(s) * MS_PER_WORD + DECIDE_MS;

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
  Math.max(...content.characters.map((c) => words(c.greet))) * MS_PER_WORD + PRESS_ON_MS;

/** The pace for a tour of `tiles`, doubled for wandering, spread evenly over every leg. */
function paceFor(tiles: number): v2.Pace {
  const walkTotalMs = ((tiles * TILE) / WALK_SPEED) * 1000 * WANDER;
  return { walkMs: Math.ceil(walkTotalMs / (content.characters.length + 1)), talkMs: talkMs() };
}

describe('the clock, at the pace of the real map', () => {
  it("each card's inspectMs is at least the time its own words take to read and decide", () => {
    for (const s of content.skills)
      expect(
        s.inspectMs,
        `${s.id}: ${cardWords(s)} words need ${cardModelMs(s)}ms, content says ${s.inspectMs}`,
      ).toBeGreaterThanOrEqual(cardModelMs(s));
  });

  it('a careful reader who reads every card makes it inside three minutes, walking twice the shortest path', () => {
    const { tiles, legs } = tour();
    const check = v2.clockCheck(content, paceFor(tiles));
    const why = `tour ${tiles} tiles (${legs.map((l) => `${l.to} ${l.tiles}`).join(', ')}); careful arrived at ${check.elapsedMs}ms`;
    expect(check.ending, why).not.toBe('late');
    expect(check.ok, why).toBe(true);
    expect(check.marginMs, why).toBeGreaterThan(0);
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
    const readingMs =
      content.characters.length * talkMs() + content.skills.reduce((t, s) => t + s.inspectMs, 0);
    const maxTourTiles = Math.floor(
      (((v2.TIME_LIMIT_MS - readingMs) / 1000) * WALK_SPEED) / TILE / WANDER,
    );
    expect(v2.clockCheck(content, paceFor(maxTourTiles)).ok, `${maxTourTiles} tiles`).toBe(true);
    expect(v2.clockCheck(content, paceFor(maxTourTiles + 1)).ok, `${maxTourTiles + 1} tiles`).toBe(
      false,
    );
    expect(tour().tiles).toBeLessThanOrEqual(maxTourTiles);
  });
});
