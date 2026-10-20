/*
 * The results card must not be wrong about the player's own run.
 *
 * This is the same rule docs/UX_REVIEW.md findings 1, 13 and 15 are three instances of, and
 * test/results.test.ts already holds the errand half of it. What that file does not cover is the
 * SKILL rows, the grammar of the sentence that explains the score, and the one string in
 * content/game.json that was never written for a player at all. Measured on the shipped build
 * before any of this changed:
 *
 *  - a run scoring the full 1,000 printed "Missed it", on the Haze ground reserved for a hidden
 *    action that ran, against Night Light -- because the row's only question was "full marks?";
 *  - the breakdown read "100 for 1 of 3 of what Grandma asked", two `of`s in one sentence, the
 *    second governing no noun;
 *  - `content.status` shipped an internal review note naming two repository documents into the
 *    public JS bundle (`grep -c COPY_REVIEW dist/assets/*.js` -> 1).
 *
 * Every bound below is derived from the content file by playing runs, never typed. A guard that
 * names the number it watches passes on the day the number is wrong.
 */
import { describe, expect, it } from 'vitest';
import raw from '../../../content/game.json';
import { createState, loadContent, recap, reduce, score } from '@otp/core';
import type { Action, Content, GameState, RecapRow, Verdict } from '@otp/core';
import { breakdown, skillState } from '../src/ui/Results';
import type { SkillState } from '../src/ui/Results';

const content: Content = loadContent(raw);
const VERDICTS: Verdict[] = ['allow', 'restrict', 'reject'];

/** One whole run through the real reducer: verdicts in content order, then the notices read. */
function play(verdicts: Verdict[], read: readonly string[]): GameState {
  let clock = 0;
  let state = createState(content);
  const send = (a: Action): void => {
    state = reduce(state, a, content);
  };
  send({ type: 'START', runId: 'results-truth', at: clock });
  send({ type: 'BEGIN' });
  content.characters.forEach((character, i) => {
    send({ type: 'MEET', c: character.id, at: (clock += 1000) });
    // The bonus question, so the enumeration reaches the top of the range rather than 100 below it.
    send({ type: 'ASK', c: character.id, q: content.scoring.bonusQuestions[0]!, at: (clock += 1) });
    send({ type: 'INSPECT', s: character.skillId, at: (clock += 1) });
    send({ type: 'VERDICT', s: character.skillId, v: verdicts[i]!, at: (clock += 1) });
  });
  for (const notice of read) send({ type: 'READ_NOTICE', n: notice, at: (clock += 1) });
  send({ type: 'ENTER_COTTAGE', at: (clock += 1) });
  send({ type: 'FINISH', at: clock + 1 });
  return state;
}

/** Every notice-reading a walk can produce: the empty set through all of them. */
function readings(): string[][] {
  let out: string[][] = [[]];
  for (const notice of content.notices) out = out.flatMap((r) => [r, [...r, notice.id]]);
  return out;
}

/** Every full run: each skill on each verdict, against each set of notices read. */
function everyRun(): { verdicts: Verdict[]; read: string[]; state: GameState }[] {
  let combos: Verdict[][] = [[]];
  for (let i = 0; i < content.skills.length; i++)
    combos = combos.flatMap((c) => VERDICTS.map((v) => [...c, v]));
  return combos.flatMap((verdicts) =>
    readings().map((read) => ({ verdicts, read, state: play(verdicts, read) })),
  );
}

const RUNS = everyRun();

describe('the enumeration plays the game it thinks it does', () => {
  // A guard that silently stops matching is worse than no guard: this project has shipped one.
  it('covers every verdict on every skill, against every notice-reading', () => {
    expect(RUNS).toHaveLength(
      VERDICTS.length ** content.skills.length * 2 ** content.notices.length,
    );
  });

  it('every run reaches the results screen with all three verdicts given', () => {
    for (const run of RUNS) {
      expect(run.state.phase).toBe('results');
      expect(recap(run.state.log, content)).toHaveLength(content.skills.length);
    }
  });
});

/*
 * docs/UX_REVIEW.md 15, on the skill rows this time.
 *
 * Stated so wording cannot satisfy it: on a run that scores as well as this game can be scored, no
 * skill row may wear the mark that means something was taken. The ceiling is found by playing every
 * run, so rebalancing content/game.json moves the guard with it -- which is what CLAUDE.md rule 3
 * promises a content change can do without reddening a test.
 */
describe('a run that scores the ceiling carries no failure mark', () => {
  const ceiling = Math.max(...RUNS.map((r) => score(r.state.log, content).total));
  const best = RUNS.filter((r) => score(r.state.log, content).total === ceiling);

  it('the ceiling was reached by playing, not by arithmetic', () => {
    // Without this the assertion below is vacuous: a short-circuited run scores 0, and every row
    // of a 0-point run would also have to be clean for the wrong reason.
    expect(ceiling).toBeGreaterThan(content.scoring.maxPerSkill * content.skills.length);
    expect(best.length).toBeGreaterThan(0);
  });

  it('more than one line reaches it, including one that is not the best verdict everywhere', () => {
    /*
     * The defect lived on the OTHER ceiling line. If the game ever has only the best-verdict line
     * at the top, this guard is still true but no longer about anything, so say so here rather
     * than keep passing quietly.
     */
    const bestEverywhere = content.skills.map((s) => s.bestVerdict).join('/');
    const lines = new Set(best.map((r) => r.verdicts.join('/')));
    expect(lines.size).toBeGreaterThan(1);
    expect([...lines].some((line) => line !== bestEverywhere)).toBe(true);
  });

  it('no skill row on any of those lines is marked as a miss', () => {
    const wrong: string[] = [];
    for (const run of best)
      for (const row of recap(run.state.log, content))
        if (skillState(row) === 'missed')
          wrong.push(`${run.verdicts.join('/')} read=[${run.read.join('+')}]: ${row.skillName}`);
    expect(wrong, 'a run that scored everything is told it failed').toEqual([]);
  });
});

/*
 * What the three states are allowed to mean.
 *
 * `missed` is the Haze ground and the "!" disc, and UI_FOUNDATIONS section 5 gives it one meaning:
 * the hidden action ran. `recap()` already measures exactly that as `compromised`, so the mark and
 * the measurement must be the same set -- not "roughly", and not "whichever the view happens to
 * compute". The row's other two states differ only in whether the verdict took full marks.
 */
describe('the failure mark means what the screen says it means', () => {
  const rows: RecapRow[] = RUNS.flatMap((run) => recap(run.state.log, content));

  it('marks as missed exactly the rows where something was taken', () => {
    const wrong = rows
      .filter((row) => (skillState(row) === 'missed') !== row.compromised)
      .map((row) => `${row.skillName} ${row.verdict} -> ${skillState(row)}`);
    expect([...new Set(wrong)], 'the mark and the flag disagree').toEqual([]);
  });

  it('calls a row caught only when it took full marks', () => {
    const wrong = rows
      .filter((row) => (skillState(row) === 'caught') !== (row.success && !row.compromised))
      .map((row) => `${row.skillName} ${row.verdict}`);
    expect([...new Set(wrong)]).toEqual([]);
  });

  it('reaches all three states on the shipped content', () => {
    // A third state nothing can reach is a third state nobody has to keep true.
    const reached = new Set<SkillState>(rows.map(skillState));
    expect([...reached].sort()).toEqual(['caught', 'costly', 'missed']);
  });

  it('puts the failure mark first when a row could claim both', () => {
    // Content lint forbids flags on a skill's DECLARED best verdict, not on any maximum-scoring
    // one, so a row that both took full marks and lost the key is possible in data. It must not
    // wear a check mark. Asserted on a fabricated row, because the shipped file has none.
    expect(skillState({ success: true, compromised: true })).toBe('missed');
  });
});

/*
 * The sentence under the headline is the one place the screen explains itself, and it is read
 * aloud as one sentence by a screen reader. "1 of 3 of what Grandma asked" is two prepositions
 * deep with nothing at the bottom of it.
 *
 * The guard is about the shape, not the wording: no clause may stack two `of`s, so the next clause
 * added to `breakdown()` cannot reintroduce it under different words.
 */
describe('the breakdown is one readable sentence', () => {
  const sentences = RUNS.map((run) => breakdown(score(run.state.log, content), content));

  it('prints the clause this is about on at least one run', () => {
    expect(
      sentences.some((s) => /Grandma/.test(s)),
      'the errand clause is reachable',
    ).toBe(true);
  });

  it('stacks no two prepositions in one clause', () => {
    const stacked = sentences
      .flatMap((s) => s.split(' · '))
      .filter((clause) => (clause.match(/\bof\b/g) ?? []).length > 1);
    expect([...new Set(stacked)], 'the reader parses the second "of" and finds no noun').toEqual(
      [],
    );
  });
});

/*
 * content/game.json ships whole, inside the JS bundle, to anyone who opens the research page. It
 * had a `status` field written for the team: an internal review note naming two repository
 * documents. Nothing renders it, so no screenshot review could ever have caught it -- only a grep
 * of `dist`, which is what this is, run against the source instead.
 *
 * The rule is about the shape of an internal reference rather than the two names that shipped, so
 * the next note to be parked in this file fails too.
 */
describe('the content file ships nothing written for the team', () => {
  /** Every string in the file, at any depth, with the path that holds it. */
  function strings(
    value: unknown,
    path = 'content',
    out: [string, string][] = [],
  ): [string, string][] {
    if (typeof value === 'string') out.push([path, value]);
    else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out));
    else if (value !== null && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) strings(v, `${path}.${k}`, out);
    return out;
  }

  /** A repository document, a path into the repo, or a SCREAMING_SNAKE document name. */
  const internal = (value: string): boolean =>
    /[A-Za-z0-9_]+\.(md|ts|tsx|json)\b/.test(value) ||
    /\b(docs|packages|apps|tools)\//.test(value) ||
    /\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/.test(value);

  it('the scanner walks the whole file and recognises what it is looking for', () => {
    const all = strings(raw);
    expect(all.length).toBeGreaterThan(100);
    expect(all.some(([path]) => path === 'content.status')).toBe(true);
    // The positive control: the note that shipped, and the two shapes it was made of.
    expect(internal('docs/COPY_REVIEW.md is stale against this file (UX_REVIEW finding 13)')).toBe(
      true,
    );
    expect(internal('see UX_REVIEW finding 13')).toBe(true);
    expect(internal('Come straight in, love. The kettle is filled.')).toBe(false);
  });

  it('names no repository document or path in any shipped string', () => {
    const leaked = strings(raw)
      .filter(([, value]) => internal(value))
      .map(([path, value]) => `${path}: ${value.slice(0, 60)}`);
    expect(leaked, 'this string is in the public bundle').toEqual([]);
  });
});
