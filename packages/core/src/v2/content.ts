import '../zod-config.ts';
import { z } from 'zod';

/*
 * v2 CONTENT: what Phase B writes, and the rules the schema alone cannot say.
 *
 * Built BESIDE v1, not over it (the lead's decision, stated to the client): production runs v1 and
 * `apps/game` and `apps/api` import it from this package, so nothing under `src/` outside `v2/` is
 * touched until Phase D switches over. The spec is docs/GAME_DESIGN_V2.md; the rule decisions this
 * module makes are recorded in its section 9.
 */

/**
 * The three verdicts, in collection language (GAME_DESIGN_V2 section 4): take it, take it limited,
 * leave it. The ORDER is the tie-break order of `bestVerdict`, read right to left: when two are
 * worth the same, the safer one wins.
 */
export const VERDICTS = ['take', 'limit', 'leave'] as const;
/** The two verdicts that put a skill in the basket. Leaving is nothing, by rule rather than data. */
export const TAKES = ['take', 'limit'] as const;

export type Verdict = (typeof VERDICTS)[number];
export type Take = (typeof TAKES)[number];
export type SkillId = string;
export type CharacterId = string;

/** GAME_DESIGN_V2 section 3: "six or seven". Enforced on a launch build only. */
export const LAUNCH_CAST = { min: 6, max: 7 } as const;

const text = z.string().trim().min(1);
const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);

/**
 * What a skill did on the way, under one verdict. This is the field that carries the whole lesson
 * (GAME_DESIGN_V2 section 5): "sent word ahead, so she expects you" and "sent word ahead, and the
 * wolf reads the post" are the same sentence until the last clause, so the last clause is its own
 * field and its PRESENCE is the fact the rules score.
 */
const did = z.strictObject({
  /** What it did, as the reveal says it. True to the promise, always: the promise is never a lie. */
  line: text,
  /** What the kept promise was worth to the player. */
  points: z.number().int().min(0),
  /**
   * Present when the skill ALSO served the wolf: the sentence that makes the lesson land. A skill
   * can carry this and still have earned its points -- that is the point.
   */
  wolf: text.optional(),
});

const skill = z.strictObject({
  id: slug,
  name: text,
  icon: slug,
  /** One line, in the character's voice. Always true. */
  promise: text,
  /**
   * The inspect card: three verbs, three one-line explanations -- the shape the client approved in
   * v1 and the best thing in that round. One line per verdict, about THIS skill.
   */
  card: z.strictObject({ take: text, limit: text, leave: text }),
  /**
   * Its cost in a hurry: how long a player takes to read the card, against a three-minute clock.
   * The reducer never charges it -- real reading takes real time, and the clock the game injects is
   * the only time the rules know. It is the SIMULATOR's model of that reading, so Phase B can ask
   * whether a careful player can make it.
   */
  inspectMs: z.number().int().min(0),
  /**
   * Per verdict, what it did. There is no `leave` entry and the schema refuses one: a skill that
   * was left did nothing, earned nothing and served nobody. That is a rule, not a tuning knob.
   */
  did: z.strictObject({ take: did, limit: did }),
});

const character = z.strictObject({
  id: slug,
  name: text,
  /** Object name in the map. */
  spawn: slug,
  /** The ONE skill this character offers. */
  skillId: slug,
  greet: text,
});

const ending = z.strictObject({ title: text, lines: z.array(text).min(1) });

export const contentSchema = z.strictObject({
  /**
   * Which rules this content is written for. v1 content has no such key and v1's schema is strict,
   * so neither version's content can load as the other's.
   */
  rules: z.literal(2),
  version: text,
  status: text,
  scoring: z.strictObject({
    /** What the score is shown out of. The lint holds it equal to the best possible run. */
    outOf: z.number().int().min(1),
    /** What each skill that served the wolf costs, against the points its kept promise earned. */
    wolfCost: z.number().int().min(1),
  }),
  characters: z.array(character).min(1),
  skills: z.array(skill).min(1),
  /** The copy for each ending. WHICH ending a run reaches is a rule (scoring.ts `ending`). */
  endings: z.strictObject({ grandma: ending, wolf: ending, late: ending }),
  strings: z.record(z.string(), text),
});

export type Content = z.infer<typeof contentSchema>;
export type Skill = Content['skills'][number];
export type Character = Content['characters'][number];
export type Did = Skill['did'][Take];

export const findSkill = (content: Content, id: SkillId): Skill | undefined =>
  content.skills.find((s) => s.id === id);
export const findCharacter = (content: Content, id: CharacterId): Character | undefined =>
  content.characters.find((c) => c.id === id);
/** The character who offers a skill. */
export const findCharacterForSkill = (content: Content, id: SkillId): Character | undefined =>
  content.characters.find((c) => c.skillId === id);

/**
 * What one verdict on one skill is worth: the points its kept promise earned, less `wolfCost` if it
 * also served the wolf. Leaving is worth exactly 0.
 *
 * ONE RULE, THREE CALLERS. `score()` sums it, the lint below holds the ceiling to it, and the
 * simulator's careful player maximises it. They are the same function so they cannot disagree.
 */
export function worth(s: Skill, v: Verdict, content: Content): number {
  if (v === 'leave') return 0;
  const d = s.did[v];
  return d.points - (d.wolf === undefined ? 0 : content.scoring.wolfCost);
}

/** The verdict worth most for this skill. A tie goes to the safer verdict: leave, then limit. */
export function bestVerdict(s: Skill, content: Content): Verdict {
  let best: Verdict = 'leave';
  for (const v of ['limit', 'take'] as const)
    if (worth(s, v, content) > worth(s, best, content)) best = v;
  return best;
}

export const bestWorth = (s: Skill, content: Content): number =>
  worth(s, bestVerdict(s, content), content);

/** The best score any run can reach: every skill given its best verdict. Never below 0. */
export const ceiling = (content: Content): number =>
  content.skills.reduce((t, s) => t + bestWorth(s, content), 0);

/**
 * Vendor names the content may not mention. COPIED from v1's `content.ts`, which does not export
 * its list and which this module may not edit. When Phase D retires v1, this becomes the only copy;
 * until then the two must be kept in step by hand.
 */
export const BANNED_WORDS = [
  'openai',
  'anthropic',
  'claude',
  'chatgpt',
  'gemini',
  'copilot',
  'microsoft',
  'google',
  'github',
  'slack',
  'amazon',
  'aws',
] as const;
const BANNED = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

export interface LintOptions {
  /** A launch build: six or seven skills, and no PLACEHOLDER text anywhere. */
  launch?: boolean;
}

function collectStrings(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value !== null && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out);
}

const duplicates = (ids: string[]): string[] => ids.filter((id, i) => ids.indexOf(id) !== i);

/**
 * Rules the schema cannot express. Returns human-readable issues; empty means clean.
 *
 * These are STRUCTURAL: each is a statement about one skill or about the whole set that holds
 * whatever the numbers are tuned to. Whether the tuned numbers still make a game -- greed punished,
 * limiting everything not a rote win -- is measured by playing it, in `sim.ts`, and `load.ts` runs
 * both.
 */
export function lintContent(content: Content, opts: LintOptions = {}): string[] {
  const issues: string[] = [];
  const add = (message: string): number => issues.push(message);

  for (const [kind, ids] of [
    ['character', content.characters.map((c) => c.id)],
    ['skill', content.skills.map((s) => s.id)],
    ['spawn', content.characters.map((c) => c.spawn)],
  ] as const)
    for (const d of duplicates([...ids])) add(`duplicate ${kind} id "${d}"`);

  const skillIds = new Set(content.skills.map((s) => s.id));
  for (const c of content.characters)
    if (!skillIds.has(c.skillId)) add(`character "${c.id}" offers unknown skill "${c.skillId}"`);
  for (const s of content.skills) {
    const offered = content.characters.filter((c) => c.skillId === s.id).length;
    if (offered !== 1)
      add(`skill "${s.id}" must be offered by exactly one character (found ${offered})`);
  }

  for (const s of content.skills) {
    const { take, limit } = s.did;
    // A boundary takes capability away. It can never add value or exposure that full trust lacks.
    if (limit.points > take.points)
      add(`skill "${s.id}": limit earns more than take (${limit.points} > ${take.points})`);
    if (limit.wolf !== undefined && take.wolf === undefined)
      add(`skill "${s.id}": limit serves the wolf and take does not`);
    /*
     * THE LESSON, as a rule on every skill: a skill that kept its promise AND served the wolf must
     * leave the player worse off than leaving it. Not merely worse than limiting it -- worse than
     * nothing. Otherwise "take it anyway, the points outweigh the wolf" is a correct reading of the
     * card, and the game teaches the opposite of its thesis.
     */
    for (const v of TAKES)
      if (s.did[v].wolf !== undefined && worth(s, v, content) >= 0)
        add(
          `skill "${s.id}": ${v} serves the wolf but is worth ${worth(s, v, content)}; ` +
            `serving the wolf must cost the player (worth below 0)`,
        );
  }

  // "Out of 1,000" is a promise to the player. If no run can reach it, the denominator is a lie.
  const best = ceiling(content);
  if (best !== content.scoring.outOf)
    add(
      `the best possible run scores ${best}, but the score is shown out of ${content.scoring.outOf}`,
    );

  if (opts.launch) {
    const n = content.skills.length;
    if (n < LAUNCH_CAST.min || n > LAUNCH_CAST.max)
      add(`a launch build needs ${LAUNCH_CAST.min} to ${LAUNCH_CAST.max} skills (found ${n})`);
  }

  const strings: [string, string][] = [];
  collectStrings(content, 'content', strings);
  for (const [path, value] of strings) {
    const hit = BANNED.exec(value);
    if (hit) add(`${path}: banned vendor word "${hit[0]}"`);
    if (opts.launch && /placeholder/i.test(value))
      add(`${path}: placeholder text is not allowed in a launch build`);
  }
  return issues;
}
