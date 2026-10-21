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

/** Two verdicts: take it or leave it (the user's decision, 2026-10-22). */
export const VERDICTS = ['take', 'leave'] as const;
/** The one verdict that puts a skill in the basket. */
export const TAKES = ['take'] as const;

export type Verdict = (typeof VERDICTS)[number];
export type Take = (typeof TAKES)[number];
export type SkillId = string;
export type CharacterId = string;
/** Which of its two variants a skill is in this run. Decided by the deal (deal.ts), never by data. */
export type Kind = 'good' | 'bad';

/** Seven characters, each offering one skill; three are dealt good each run. Launch builds only. */
export const LAUNCH_CAST = { skills: 7, good: 3 } as const;

/**
 * The most words the giveaway line may have. "Short" is the user's word: the line is the lesson,
 * and a lesson a player has to wade through is one they skip under a three-minute clock. Ten is
 * the longest line the shipped cast needs (eight) with a little room, not a reading-science figure.
 */
export const GIVEAWAY_WORDS = 10;

const text = z.string().trim().min(1);
const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);

/**
 * ONE VARIANT OF A SKILL: its card and its reveal, and nothing else. Strict, so a variant cannot
 * carry a name, promise, icon or greeting of its own -- which is how "nothing before the card is
 * opened differs between the variants" is held: not by a lint comparing two copies, but by there
 * being only one copy to compare.
 */
const variant = z.strictObject({
  /**
   * The inspect card. `take` is what taking it does, one short line each; `leave` is what leaving
   * it costs. The lint holds the bad card to the good card plus or instead of ONE line.
   */
  card: z.strictObject({ take: z.array(text).min(1), leave: text }),
  /** What it did on the way, as the end of the run says it. */
  reveal: text,
});

const skill = z.strictObject({
  id: slug,
  name: text,
  icon: slug,
  /** One line, in the character's voice. True in both variants: a bad skill keeps it too. */
  promise: text,
  good: variant,
  bad: variant,
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
  /** How many skills each run deals good. The rest are dealt bad. */
  deal: z.strictObject({ good: z.number().int().min(1) }),
  /**
   * A clean arrival scores `clean`, plus `good` for each good skill in the basket. A run that let
   * the wolf in scores 0, by rule (scoring.ts). The lint holds `outOf` to the best run.
   */
  scoring: z.strictObject({
    outOf: z.number().int().min(1),
    good: z.number().int().min(1),
    clean: z.number().int().min(1),
  }),
  characters: z.array(character).min(1),
  skills: z.array(skill).min(1),
  /** The copy for each ending. WHICH ending a run reaches is a rule (scoring.ts `ending`). */
  endings: z.strictObject({ grandma: ending, wolf: ending, late: ending }),
  strings: z.record(z.string(), text),
});

export type Content = z.infer<typeof contentSchema>;
export type Skill = Content['skills'][number];
export type Variant = Skill['good'];
export type Character = Content['characters'][number];

export const findSkill = (content: Content, id: SkillId): Skill | undefined =>
  content.skills.find((s) => s.id === id);
export const findCharacter = (content: Content, id: CharacterId): Character | undefined =>
  content.characters.find((c) => c.id === id);
/** The character who offers a skill. */
export const findCharacterForSkill = (content: Content, id: SkillId): Character | undefined =>
  content.characters.find((c) => c.skillId === id);

/** The best score any run can reach: a clean arrival with every dealt-good skill in the basket. */
export const ceiling = (content: Content): number =>
  content.scoring.clean + content.scoring.good * content.deal.good;

export const countWords = (line: string): number => line.split(/\s+/).filter(Boolean).length;

/**
 * THE LINE THAT GIVES A BAD SKILL AWAY: the one line of its bad card's `take` list that is not on
 * its good card, when the bad card is the good card with exactly that one line added or put in
 * place of another. Null when the two cards differ in any other way -- which the lint refuses.
 */
export function giveaway(s: Skill): string | null {
  const good = s.good.card.take;
  const bad = s.bad.card.take;
  for (const [i, line] of bad.entries()) {
    const replaced = bad.length === good.length && bad.every((l, j) => j === i || l === good[j]);
    const rest = bad.filter((_l, j) => j !== i);
    const added = bad.length === good.length + 1 && rest.every((l, j) => l === good[j]);
    if ((replaced || added) && !good.includes(line)) return line;
  }
  return null;
}

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
  /** A launch build: seven skills, three dealt good, and no PLACEHOLDER text anywhere. */
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
 * Rules the schema cannot express. Returns human-readable issues; empty means clean. Whether the
 * content still makes a game is measured by playing it, in `sim.ts`, and `load.ts` runs both.
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

  /*
   * THE TWO VARIANTS, ONE LINE APART. What is shared before the card is shared by construction
   * (the schema has one copy of it). On the card, the leave line is the same and the take list is
   * the same but for one line -- added, or in place of another -- and that line is short.
   */
  for (const s of content.skills) {
    if (s.bad.card.leave !== s.good.card.leave)
      add(`skill "${s.id}": the bad card's leave line must be the good card's, word for word`);
    const line = giveaway(s);
    if (line === null)
      add(
        `skill "${s.id}": the bad card must be the good card with exactly one new line, added or in place of one`,
      );
    else if (countWords(line) > GIVEAWAY_WORDS)
      add(
        `skill "${s.id}": the giveaway line is ${countWords(line)} words, at most ${GIVEAWAY_WORDS}`,
      );
    if (s.bad.reveal === s.good.reveal)
      add(`skill "${s.id}": the two variants need their own reveal lines`);
  }

  // Every deal must hold both kinds, or there is nothing to tell apart.
  const n = content.skills.length;
  if (content.deal.good >= n)
    add(`a deal of ${content.deal.good} good among ${n} skills leaves nothing bad`);

  // "Out of 100" is a promise to the player. If no run can reach it, the denominator is a lie.
  const best = ceiling(content);
  if (best !== content.scoring.outOf)
    add(
      `the best possible run scores ${best}, but the score is shown out of ${content.scoring.outOf}`,
    );

  if (opts.launch && (n !== LAUNCH_CAST.skills || content.deal.good !== LAUNCH_CAST.good))
    add(
      `a launch build needs ${LAUNCH_CAST.skills} skills, ${LAUNCH_CAST.good} dealt good (found ${n}, ${content.deal.good} good)`,
    );

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
