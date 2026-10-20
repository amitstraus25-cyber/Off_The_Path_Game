import './zod-config.ts';
import { z } from 'zod';

export const VERDICTS = ['allow', 'restrict', 'reject'] as const;
export const FLAGS = ['keyStolen', 'messagesLeaked', 'locationLeaked'] as const;
export const QUESTION_IDS = ['needs', 'who', 'show'] as const;
/**
 * The three capabilities of the lethal trifecta (Cyera Research, "When Language Becomes the Attack
 * Vector"). Any two are survivable; all three live at once is what turns an injected sentence into
 * data theft. See docs/RESEARCH_ALIGNMENT.md.
 */
export const CAPABILITIES = ['basket', 'strangers', 'word'] as const;
export const BASKET_SLOTS = 5;

export type Verdict = (typeof VERDICTS)[number];
export type Flag = (typeof FLAGS)[number];
export type Capability = (typeof CAPABILITIES)[number];
export type SkillId = string;
export type CharacterId = string;

const text = z.string().trim().min(1);
const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const verdict = z.enum(VERDICTS);
const flag = z.enum(FLAGS);
const questionId = z.enum(QUESTION_IDS);
const capability = z.enum(CAPABILITIES);
const copy = z.strictObject({ title: text, detail: text });

const outcome = z.strictObject({
  points: z.number().int().min(0),
  /** Capabilities this verdict leaves live for the rest of the run. */
  grants: z.array(capability),
  basketAdds: z.array(slug),
  basketRemoves: z.array(slug),
  flagsSet: z.array(flag),
  recap: text,
});

const skill = z.strictObject({
  id: slug,
  name: text,
  icon: slug,
  promise: copy,
  finePrint: z.strictObject({ title: text, detail: text, flag }).optional(),
  bestVerdict: verdict,
  outcomes: z.strictObject({ allow: outcome, restrict: outcome, reject: outcome }),
});

const character = z.strictObject({
  id: slug,
  name: text,
  portrait: slug,
  skillId: slug,
  spawn: slug,
  greet: text,
  asks: z.array(z.strictObject({ id: questionId, label: text, reply: text })),
});

/**
 * A thing in the world with words on it. Harmless on its own: it only does something when a skill
 * is there to read it, which is the zero-click beat the research describes.
 */
const notice = z.strictObject({
  id: slug,
  title: text,
  /** What anyone can see written on it. */
  visible: text,
  /**
   * The line only an agent that reads strangers' writing will act on. Optional, because not every
   * thing with words on it is a trap: the sign on Grandma's door is an ordinary domestic note, and
   * a world where every readable object is hostile teaches "read nothing" rather than "know what
   * is reading on your behalf".
   */
  hidden: text.optional(),
  whenExposed: z
    .strictObject({
      basketRemoves: z.array(slug),
      flagsSet: z.array(flag),
      recap: text,
    })
    .optional(),
});

/**
 * Someone Red can talk to who is not offering anything.
 *
 * Deliberately outside the rules: no skill, no capability, no verdict, nothing logged and nothing
 * scored. The game stays three decisions long. They exist because the walk between the three real
 * encounters was empty, and because the forest should contain people who are unhelpful in the
 * ordinary way rather than the dangerous way.
 */
const bystander = z.strictObject({
  id: slug,
  name: text,
  /** Object name in the map, e.g. `bystander-toad`. */
  spawn: slug,
  /** Sprite sheet key. */
  sprite: slug,
  /** Said the first time, then cycled through on repeat visits. */
  lines: z.array(text).min(1),
  /** Replaces `lines` once all three capabilities are live. The forest notices. */
  whenExposed: text.optional(),
});

const ending = z.strictObject({
  id: slug,
  title: text,
  lines: z.array(text).min(1),
  when: z.strictObject({
    minFlags: z.number().int().min(0),
    maxFlags: z.number().int().min(0).optional(),
    /**
     * Optional: also key on how much of the errand was carried out. Endings used to key on the flag
     * count alone, which meant refusing every skill drew the same card as a perfect run -- both set
     * no flags. Omit either bound to match any number of goals.
     */
    minGoals: z.number().int().min(0).optional(),
    maxGoals: z.number().int().min(0).optional(),
  }),
});

export const contentSchema = z.strictObject({
  version: text,
  status: text,
  scoring: z.strictObject({
    questionBonus: z.number().int().min(0),
    maxPerSkill: z.number().int().min(1),
    bonusQuestions: z.array(questionId),
    /** Awarded when the three capabilities were never all live at once. */
    boundaryBonus: z.number().int().min(0),
    /**
     * What an offer accepted without opening its card is worth, paid once at the end and only on
     * a clean arrival. An offer taken on trust scores nothing of its own, so this is the whole of
     * the gamble: it comes off, or it is worth nothing.
     */
    trustBonus: z.number().int().min(0),
    /**
     * What Grandma actually asked for. One goal per capability, so that refusing a skill costs
     * something concrete instead of being free: a goal needs its capability live AND, where `act`
     * is set, the thing itself done on the walk. Without this the whole capability vector is pure
     * downside and "grant nothing" is the dominant strategy, which is the opposite of the lesson.
     */
    errandGoals: z
      .array(
        z.strictObject({
          id: slug,
          /** Shown in the HUD and on the results recap, in Grandma's words. */
          label: text,
          /** The capability that has to be live for this to be possible at all. */
          needs: capability,
          /** Optional notice that has to have been read: the goal is an act, not a grant. */
          act: slug.optional(),
          points: z.number().int().min(0),
        }),
      )
      .min(1),
  }),
  capabilities: z.record(capability, z.strictObject({ label: text, detail: text, mark: text })),
  notices: z.array(notice),
  startBasket: z.array(slug),
  /** Basket item id to sprite asset key, so adding an item needs no code change. */
  items: z.record(slug, slug),
  characters: z.array(character).min(1),
  /** Optional: people in the forest who offer nothing. See the `bystander` schema. */
  bystanders: z.array(bystander).default([]),
  skills: z.array(skill).min(1),
  endings: z.array(ending).min(1),
  strings: z.record(z.string(), text),
});

export type Content = z.infer<typeof contentSchema>;
export type Skill = Content['skills'][number];
export type Character = Content['characters'][number];
export type Outcome = Skill['outcomes'][Verdict];
export type Ending = Content['endings'][number];
export type Notice = Content['notices'][number];

/**
 * Does an ending's `when` cover a run that set `flags` flags and carried out `goals` of the errand?
 *
 * ONE RULE, TWO CALLERS, AND THEY HAVE TO AGREE. `ending()` in outcomes.ts picks the card a player
 * is shown; `lintContent` below proves that every reachable (flags, goals) pair lands on exactly
 * one ending. The two were written out separately and were character-identical -- and `ending()`
 * leans on the lint for its non-null assertion, so a fifth `when` key added to one copy and not the
 * other would quietly hand a player `undefined` through a `!`. The predicate lives here, next to
 * the schema that defines the keys, so adding a key is one edit in one place.
 *
 * `maxFlags` and `maxGoals` are optional bounds: omitted means unbounded, not zero.
 */
export const endingMatches = (when: Ending['when'], flags: number, goals: number): boolean =>
  flags >= when.minFlags &&
  flags <= (when.maxFlags ?? Infinity) &&
  goals >= (when.minGoals ?? 0) &&
  goals <= (when.maxGoals ?? Infinity);

export const findSkill = (content: Content, id: SkillId): Skill | undefined =>
  content.skills.find((s) => s.id === id);
export const findCharacter = (content: Content, id: CharacterId): Character | undefined =>
  content.characters.find((c) => c.id === id);

/** The character who offers a skill. */
export const findCharacterForSkill = (content: Content, id: SkillId): Character | undefined =>
  content.characters.find((c) => c.skillId === id);

const BANNED_WORDS = [
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
];
const BANNED = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

export interface LintOptions {
  /** 'forbid' is used for launch builds (Phase 8): any PLACEHOLDER marker is an error. */
  placeholders?: 'allow' | 'forbid';
}

function collectStrings(value: unknown, path: string, out: [string, string][]): void {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
  else if (value !== null && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out);
}

const duplicates = (ids: string[]): string[] => ids.filter((id, i) => ids.indexOf(id) !== i);

/** Rules the schema cannot express. Returns human-readable issues; empty means clean. */
export function lintContent(content: Content, opts: LintOptions = {}): string[] {
  const issues: string[] = [];
  const add = (message: string): number => issues.push(message);

  for (const [kind, ids] of [
    ['character', content.characters.map((c) => c.id)],
    ['skill', content.skills.map((s) => s.id)],
    ['ending', content.endings.map((e) => e.id)],
    ['spawn', content.characters.map((c) => c.spawn)],
  ] as const)
    for (const d of duplicates([...ids])) add(`duplicate ${kind} id "${d}"`);

  for (const d of duplicates(content.bystanders.map((b) => b.id)))
    add(`duplicate bystander id "${d}"`);
  const characterIds = new Set(content.characters.map((c) => c.id));
  for (const b of content.bystanders) {
    if (characterIds.has(b.id))
      add(`bystander "${b.id}" shares an id with a character; they are different kinds of thing`);
    const occupant = content.characters.find((c) => c.spawn === b.spawn);
    if (occupant) add(`bystander "${b.id}" spawns where character "${occupant.id}" already stands`);
  }
  for (const d of duplicates(content.bystanders.map((b) => b.spawn)))
    add(`two bystanders share the spawn "${d}"`);

  const skillIds = new Set(content.skills.map((s) => s.id));
  for (const c of content.characters) {
    if (!skillIds.has(c.skillId)) add(`character "${c.id}" offers unknown skill "${c.skillId}"`);
    const asked = c.asks.map((a) => a.id).sort();
    if (asked.join() !== [...QUESTION_IDS].sort().join())
      add(`character "${c.id}" must have exactly one each of ${QUESTION_IDS.join(', ')}`);
  }
  for (const s of content.skills) {
    const offered = content.characters.filter((c) => c.skillId === s.id).length;
    if (offered !== 1)
      add(`skill "${s.id}" must be offered by exactly one character (found ${offered})`);
  }

  const { maxPerSkill, bonusQuestions } = content.scoring;
  if (bonusQuestions.length === 0) add('scoring.bonusQuestions must not be empty');
  if (bonusQuestions.includes('show'))
    add('"show" cannot earn the question bonus (opening the card is not a question)');

  if (!content.skills.some((s) => s.finePrint === undefined))
    add('at least one skill must have no finePrint (a genuinely safe skill)');

  // Every capability must be named, and every leg of the trifecta must be reachable, or the
  // combination the research is about can never arise.
  for (const c of CAPABILITIES)
    if (content.capabilities[c] === undefined)
      add(`capability "${c}" has no label in content.capabilities`);
  const reachable = new Set<Capability>();
  for (const s of content.skills)
    for (const v of VERDICTS) for (const g of s.outcomes[v].grants) reachable.add(g);
  for (const c of CAPABILITIES)
    if (!reachable.has(c)) add(`no skill can ever grant "${c}", so the trifecta cannot complete`);

  const possibleFlags = new Set<Flag>();
  const maxBasket = new Set(content.startBasket);
  const everInBasket = new Set(content.startBasket);
  for (const s of content.skills) {
    const points = VERDICTS.map((v) => s.outcomes[v].points);
    if (s.outcomes[s.bestVerdict].points !== Math.max(...points))
      add(`skill "${s.id}": bestVerdict "${s.bestVerdict}" does not have the maximum points`);
    if (s.outcomes[s.bestVerdict].points !== maxPerSkill)
      add(`skill "${s.id}": best verdict must score scoring.maxPerSkill (${maxPerSkill})`);
    // Allow grants everything the skill asks for; restrict can only ever grant less; reject nothing.
    const asked = new Set(s.outcomes.allow.grants);
    for (const g of s.outcomes.restrict.grants)
      if (!asked.has(g))
        add(`skill "${s.id}" restrict: grants "${g}", which allow does not ask for`);
    if (s.outcomes.reject.grants.length > 0) add(`skill "${s.id}": reject must grant nothing`);
    if (s.outcomes.restrict.grants.length > s.outcomes.allow.grants.length)
      add(`skill "${s.id}": restrict must not grant more than allow`);

    for (const v of VERDICTS) {
      const o = s.outcomes[v];
      if (o.points > maxPerSkill) add(`skill "${s.id}" ${v}: points exceed maxPerSkill`);
      if (new Set(o.grants).size !== o.grants.length) add(`skill "${s.id}" ${v}: duplicate grants`);
      for (const f of o.flagsSet) {
        possibleFlags.add(f);
        if (s.finePrint === undefined)
          add(`skill "${s.id}" has no finePrint but ${v} sets flag "${f}"`);
        else if (f !== s.finePrint.flag)
          add(
            `skill "${s.id}" ${v}: sets flag "${f}" but finePrint declares "${s.finePrint.flag}"`,
          );
      }
      o.basketAdds.forEach((i) => (maxBasket.add(i), everInBasket.add(i)));
    }
    if (s.finePrint !== undefined) {
      if (!s.outcomes.allow.flagsSet.includes(s.finePrint.flag))
        add(`skill "${s.id}": allow must set the finePrint flag "${s.finePrint.flag}"`);
      if (s.outcomes[s.bestVerdict].flagsSet.length > 0)
        add(`skill "${s.id}": the best verdict must not set flags`);
    }
  }
  for (const s of content.skills)
    for (const v of VERDICTS)
      for (const item of s.outcomes[v].basketRemoves)
        if (!everInBasket.has(item))
          add(`skill "${s.id}" ${v}: removes "${item}" which is never in the basket`);
  for (const item of maxBasket)
    if (content.items[item] === undefined)
      add(`basket item "${item}" has no icon in content.items`);
  for (const item of Object.keys(content.items))
    if (!maxBasket.has(item)) add(`content.items lists "${item}", which never reaches the basket`);
  if (maxBasket.size > BASKET_SLOTS)
    add(`basket can hold ${maxBasket.size} distinct items but has only ${BASKET_SLOTS} slots`);

  for (const d of duplicates(content.notices.map((n) => n.id))) add(`duplicate notice id "${d}"`);
  for (const n of content.notices) {
    if (!n.whenExposed) continue;
    for (const f of n.whenExposed.flagsSet) possibleFlags.add(f);
    for (const item of n.whenExposed.basketRemoves)
      if (!everInBasket.has(item))
        add(`notice "${n.id}": removes "${item}", which is never in the basket`);
  }
  // Every goal must be winnable: some verdict has to grant its capability, and where the goal is an
  // act, the notice it names has to exist. A goal nobody can reach is a silently lower ceiling.
  const grantable = new Set(
    content.skills.flatMap((s) => VERDICTS.flatMap((v) => s.outcomes[v].grants)),
  );
  for (const d of duplicates(content.scoring.errandGoals.map((g) => g.id)))
    add(`duplicate errand goal id "${d}"`);
  for (const g of content.scoring.errandGoals) {
    if (!grantable.has(g.needs))
      add(`errand goal "${g.id}" needs "${g.needs}", which no verdict ever grants`);
    if (g.act !== undefined && !content.notices.some((n) => n.id === g.act))
      add(`errand goal "${g.id}" names act "${g.act}", which is not a notice`);
  }

  for (const e of content.endings)
    if (e.when.maxFlags !== undefined && e.when.maxFlags < e.when.minFlags)
      add(`ending "${e.id}": maxFlags is below minFlags`);
  // Every reachable (flag count, goals met) pair must land on exactly one ending.
  for (let n = 0; n <= possibleFlags.size; n++)
    for (let met = 0; met <= content.scoring.errandGoals.length; met++) {
      const matches = content.endings.filter((e) => endingMatches(e.when, n, met));
      if (matches.length !== 1)
        add(
          `${n} flag(s) with ${met} goal(s) done must match exactly one ending (matched ${matches.length})`,
        );
    }

  const strings: [string, string][] = [];
  collectStrings(content, 'content', strings);
  for (const [path, value] of strings) {
    const hit = BANNED.exec(value);
    if (hit) add(`${path}: banned vendor word "${hit[0]}"`);
    if (opts.placeholders === 'forbid' && /placeholder/i.test(value))
      add(`${path}: placeholder text is not allowed in a launch build`);
  }
  return issues;
}

export class ContentError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid game content:\n- ${issues.join('\n- ')}`);
    this.name = 'ContentError';
    this.issues = issues;
  }
}

/** Parse, then lint. Throws ContentError listing every problem. */
export function loadContent(raw: unknown, opts: LintOptions = {}): Content {
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success)
    throw new ContentError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  const issues = lintContent(parsed.data, opts);
  if (issues.length > 0) throw new ContentError(issues);
  return parsed.data;
}
