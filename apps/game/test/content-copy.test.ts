/*
 * Two things the shipped copy was saying that were not true of the run in front of it, and one it
 * was not saying at all. Both are measured against the real reducer and the shipped content file,
 * because both faults were reproduced by playing, not by reading.
 *
 * 1. THE ENDING TALKED ABOUT A THING THE PLAYER WAS STILL HOLDING. `endings.close` matches on a
 *    flag COUNT of exactly one and the schema has no flag-identity test, so the card drew
 *    "Grandma, why do you need my key?" for the two single-flag runs that never lost the key --
 *    restrict/allow/reject (messages leaked) and restrict/restrict/allow plus the post
 *    (location leaked). The player read a question about a key that the basket, drawn on the same
 *    screen a moment later, still showed in slot one.
 *
 *    The guard below is not "close must not say key". It is the general rule the defect broke: an
 *    arrival may not name a thing the player can still see in the basket. That is what a player
 *    notices, it holds for every ending at once, and it keeps holding when a fifth ending or a
 *    sixth item arrives.
 *
 * 2. THE CARD DEFINED THE VERBS ONCE AND THE CAPABILITIES NOWHERE. The verbs are now three
 *    definitions on every card, one per pill, from strings.verdict*Means; e2e/card-rulebook.spec.ts
 *    proves they reach the second and third cards in a real browser, and this proves each one
 *    exists and stays a single line. The capability lesson moved to Results.
 *
 * 3. THE THREE "Show me." REPLIES ARE UNREACHABLE. `tryReduce` refuses ASK with q = 'show' and
 *    Dialogue.tsx filters that option out of the list, so three replies in the shipped content
 *    file have never been read by anyone. Reaching them wants a reducer case, which is not this
 *    round's file; until then the one sentence of the three that carries an argument -- the
 *    Keeper's claim that there is nothing in his card -- is surfaced as card copy, and that is
 *    asserted here so it cannot quietly go back to being unreachable.
 */
import { describe, expect, it } from 'vitest';
import raw from '../../../content/game.json';
import {
  QUESTION_IDS,
  VERDICTS,
  createState,
  ending,
  findCharacterForSkill,
  loadContent,
  tryReduce,
} from '@otp/core';
import type { Content, GameState, Verdict } from '@otp/core';
import { cardAsksFor } from '../src/ui/SkillCard';

const content: Content = loadContent(raw);

/** Plays a whole run through the real reducer and throws on any illegal step. */
function play(verdicts: readonly Verdict[], read: readonly string[]): GameState {
  let state = createState(content);
  let clock = 0;
  const step = (action: Parameters<typeof tryReduce>[1]): void => {
    const result = tryReduce(state, action, content);
    if (!result.ok) throw new Error(`${action.type} rejected: ${result.reason}`);
    state = result.state;
  };
  const at = (): number => (clock += 1000);

  step({ type: 'START', runId: 'copy-guard', at: at() });
  step({ type: 'BEGIN' });
  content.characters.forEach((character, i) => {
    step({ type: 'MEET', c: character.id, at: at() });
    step({ type: 'INSPECT', s: character.skillId, at: at() });
    step({ type: 'VERDICT', s: character.skillId, v: verdicts[i]!, at: at() });
  });
  // After the verdicts, so a notice that only bites with all three legs live can actually bite.
  for (const notice of read) step({ type: 'READ_NOTICE', n: notice, at: at() });
  step({ type: 'ENTER_COTTAGE', at: at() });
  return state;
}

/** Every verdict triple, crossed with every set of notices a player could have read. */
function everyRun(): { label: string; state: GameState }[] {
  const noticeSets: string[][] = [[], ...content.notices.map((n) => [n.id])];
  if (content.notices.length > 1) noticeSets.push(content.notices.map((n) => n.id));
  const runs: { label: string; state: GameState }[] = [];
  for (const a of VERDICTS)
    for (const b of VERDICTS)
      for (const c of VERDICTS)
        for (const read of noticeSets)
          runs.push({
            label: `${a}/${b}/${c}${read.length > 0 ? ` after reading ${read.join(' and ')}` : ''}`,
            state: play([a, b, c], read),
          });
  return runs;
}

/**
 * Every line of the arrival, in the order the player advances through them.
 *
 * Keyed the way Cottage.tsx keys them -- `arriveLines.<ending>`, falling back to the shared opener
 * -- then the ending's own lines. The approach lines and the ending lines are one card to the
 * player, so a claim in either half is a claim the ending makes.
 */
function arrivalLines(state: GameState): string[] {
  const chosen = ending(state, content);
  const script =
    content.strings[`arriveLines.${chosen.id}`] ?? content.strings['arriveLines'] ?? '';
  return [...script.split('|').filter(Boolean), ...chosen.lines];
}

describe('an arrival never names something the player is still carrying', () => {
  const runs = everyRun();

  it('plays every reachable run, and reaches every ending', () => {
    // A guard that silently stops covering the case it was written for is worse than no guard.
    expect(runs.length).toBe(VERDICTS.length ** 3 * (content.notices.length + 2));
    const reached = new Set(runs.map((r) => ending(r.state, content).id));
    expect([...reached].sort()).toEqual(content.endings.map((e) => e.id).sort());
  });

  it('names no basket item the basket still shows', () => {
    const wrong: string[] = [];
    for (const { label, state } of runs) {
      const chosen = ending(state, content);
      for (const line of arrivalLines(state))
        for (const item of Object.keys(content.items))
          if (state.basket.includes(item) && new RegExp(`\\b${item}\\b`, 'i').test(line))
            wrong.push(
              `"${chosen.id}" says "${line}" to a run (${label}) still carrying "${item}"`,
            );
    }
    expect(
      wrong,
      'an ending matches on a flag COUNT, so its copy has to be true of every run that lands on it',
    ).toEqual([]);
  });

  it('still says something: the endings are not empty of content', () => {
    for (const e of content.endings) expect(e.lines.join(' ').length).toBeGreaterThan(20);
  });
});

describe('every skill card carries the three verdicts, and only those', () => {
  /*
   * The card's whole small print is three definitions now, one per pill, read from these keys by
   * the VERDICTS table in src/ui/SkillCard.tsx. The paragraph that used to live here also taught
   * the three things a skill can be given, from content.capabilities[*].detail. That lesson is
   * still required to be discoverable and has moved to Results, beside the discs it explains.
   */
  const MEANS: Record<Verdict, string> = {
    allow: 'verdictAllowMeans',
    restrict: 'verdictRestrictMeans',
    reject: 'verdictRejectMeans',
  };

  it('says what each of the three verbs does', () => {
    for (const verdict of VERDICTS) {
      const line = content.strings[MEANS[verdict]];
      expect(line, `nothing on the card says what "${verdict}" does`).toBeTruthy();
      expect(line!.trim().length, `"${verdict}" is defined by an empty line`).toBeGreaterThan(20);
    }
  });

  it('keeps each definition to one line, so the card is not a paragraph again', () => {
    // What this replaced ran to nine lines at phone width. A definition that grows past a
    // sentence is how that comes back, one key at a time.
    for (const verdict of VERDICTS)
      expect(
        content.strings[MEANS[verdict]]!.length,
        `the "${verdict}" definition has grown into a paragraph`,
      ).toBeLessThan(110);
  });

  it('no longer teaches the capability lesson on the card', () => {
    const card = VERDICTS.map((v) => content.strings[MEANS[v]]!).join(' ');
    for (const leg of Object.values(content.capabilities))
      expect(
        card,
        'the B/S/W lesson belongs beside the discs, not on the inspect card',
      ).not.toContain(leg.label);
  });
});

describe('the dead "Show me." replies', () => {
  /*
   * Listed, not deleted: content lint requires exactly one ask of each id per character, so these
   * three cannot be removed from the file, and the reducer case that would make them readable is
   * packages/core, which this round does not own. The list can only shrink.
   */
  const UNREACHABLE = 'show';

  it('is still the reducer that makes them unreachable, and only that one ask', () => {
    for (const character of content.characters) {
      const met = tryReduce(
        tryReduce(createState(content), { type: 'START', runId: 'asks', at: 1 }, content).state,
        { type: 'BEGIN' },
        content,
      ).state;
      const dialogue = tryReduce(met, { type: 'MEET', c: character.id, at: 2 }, content).state;
      for (const q of QUESTION_IDS) {
        const asked = tryReduce(dialogue, { type: 'ASK', c: character.id, q, at: 3 }, content);
        expect(
          asked.ok,
          `ASK "${q}" of ${character.id}: the only unreachable ask is "${UNREACHABLE}"`,
        ).toBe(q !== UNREACHABLE);
      }
    }
  });

  it('has its one load-bearing sentence surfaced as card copy instead', () => {
    // The Keeper's card is the one with no fine print, and his reply is the only one of the three
    // that makes a claim a player can test. It is the honest card's whole argument.
    const honest = content.skills.find((s) => s.finePrint === undefined)!;
    const keeper = findCharacterForSkill(content, honest.id)!;
    const reply = keeper.asks.find((a) => a.id === UNREACHABLE)!.reply;
    const claim = reply
      .split('.')
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .at(-1)!;
    expect(
      cardAsksFor(content, honest).toLowerCase(),
      `"${claim}" is said only in an ask nothing can reach`,
    ).toContain(claim.toLowerCase());
  });
});
