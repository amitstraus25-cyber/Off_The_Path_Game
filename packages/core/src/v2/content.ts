import '../zod-config.ts';
import { z } from 'zod';
import { CONSENT_VERSION_MAX, CONSENT_VERSION_PATTERN } from './contact.ts';

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

/**
 * The most words a skill's real-world note may have, and the most sentences: the user's limits
 * (2026-10-22), "one or two plain sentences, 25 words max", for the reveal screen.
 */
export const REAL_WORLD_WORDS = 25;
export const REAL_WORLD_SENTENCES = 2;

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
   * it costs. The lint holds the bad card to the good card with ONE line swapped, same line count.
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
  /**
   * The real cybersecurity idea the forest story stands for, for the reveal: `term` names it and
   * `note` links the two in one or two plain sentences. One per skill, shared by both variants,
   * because it explains the bad card's giveaway line whichever variant the deal showed.
   */
  realWorld: z.strictObject({ term: text, note: text }),
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

/**
 * A line with named holes the screen fills in, such as `Offered by the {name}`. The schema holds
 * every hole the screen fills to being in the line, because a template that lost its `{name}`
 * renders as a sentence about nobody and nothing on screen says so.
 */
const template = (...holes: readonly string[]) =>
  text.refine((line) => holes.every((hole) => line.includes(`{${hole}}`)), {
    message: `must carry ${holes.map((hole) => `{${hole}}`).join(' and ')}`,
  });

/**
 * THE CHROME'S KEYS, ALL OF THEM. This was `z.record(z.string(), text)` -- free-keyed, the shape
 * v1's `strings` had -- so a key the UI read and the file lacked rendered as nothing and only
 * apps/game/test/strings.test.ts, scanning the source, could notice. Strict now, like every other
 * part of `ui`: a missing key fails `loadContent` at startup and a stray one fails it too.
 * Adding a key is one line here and one in content/game.v2.json.
 */
export const CHROME_KEYS = [
  'leaderboardDown',
  'leaderboardRefused',
  'leaderboardAlready',
  'leaderboardClosed',
  'handleAssigned',
  'howToPlayWalkTouch',
  'controlsHint',
  'controlsHintTouch',
  'touchWalkLabel',
  'touchWalkUp',
  'touchWalkDown',
  'touchWalkLeft',
  'touchWalkRight',
  'touchWalkStop',
  'touchInteract',
  'musicLabel',
  'musicOn',
  'musicOff',
  'loadFailedTitle',
  'loadFailedBody',
  'loadFailedRetry',
  'crashTitle',
  'crashBody',
  'crashReload',
  'arriveTitle',
  'arriveAsk',
  'arriveNext',
  'researchFooter',
  'postHeading',
  'postUnavailable',
  'postLate',
  'handleLabel',
  'handleReroll',
  'handleHint',
  'privacyLine',
  'leaderboardTitle',
  'leaderboardTitleHighlight',
  'boardLoading',
  'boardReady',
  'boardEmpty',
  'boardEmptyAfterPost',
  'boardDown',
  'boardRetry',
  'boardYouLabel',
  'boardRow',
  'boardRowYou',
  'post',
  'replay',
  'worldSummaryLabel',
  'worldTravellerMet',
  'worldTravellerUnmet',
  'worldTravellerNear',
  'worldBearings',
  'worldDistances',
  /*
   * The 2026-10-22 afternoon round's words (the client: "make it clear", "score first, then flip
   * cards", "let people put their own name"). In the chrome rather than in `landing` or `reveal`
   * on purpose: chrome keys are filled for the core fixtures from this list, so adding a screen's
   * words here does not reach into a test file another owner is editing.
   */
  'landingPremise',
  'revealChoices',
  'revealSpeed',
  'revealTime',
  'revealPar',
  'wolfNotPosted',
  'boardJoining',
  'revealZeroWolf',
  'revealZeroLate',
  'revealTilesHint',
  'revealFlip',
  'revealFlipBack',
  'handleShort',
  'handleLong',
  'handleChars',
  'handleContact',
  'handleBlocked',
  /*
   * The client's 2026-10-22 evening report: "how do i get to this? i cant find the character".
   * The minimap's one sentence for a screen reader, and the door's question when somebody in the
   * cast has not been met yet. `mapSummary` carries {met} and {total}; `doorAsk` {count} and {total}.
   */
  'mapSummary',
  'doorAsk',
  'doorStill',
  'doorStay',
  'doorGoIn',
  /*
   * The full UX/UI review on the same evening. The Explore header's notation chip (UI_FOUNDATIONS
   * section 5): `worldGoal` is its label and `worldMetCount` its muted count, carrying {met} and
   * {total}. And the reveal's verdict on the player's call, which leads each tile's face: whether
   * they were right, before what the skill was (`ui.reveal.good` / `bad`) and what they did.
   */
  'worldGoal',
  'worldMetCount',
  'revealCaught',
  'revealMissed',
] as const;
export type ChromeKey = (typeof CHROME_KEYS)[number];

const chrome = z.strictObject(
  Object.fromEntries(CHROME_KEYS.map((key) => [key, text])) as Record<ChromeKey, typeof text>,
);

/**
 * EVERY OTHER WORD THE v2 SCREENS SAY, strictly keyed so a screen cannot ask for a string that is
 * not here and a typo in the file cannot pass as a new key. `hud` is exactly `HudLabels` in
 * apps/game/src/ui/Hud.tsx, so it is passed through as the HUD's `labels`. A `titleHighlight` is
 * the one word of its title set in Season Mix (CLAUDE.md brand rules); the lint holds it to a word
 * the title actually has.
 */
const ui = z.strictObject({
  /** The landing: its frame's title, the wordmark and its one Season Mix word, and the way in. */
  landing: z.strictObject({
    frameTitle: text,
    title: text,
    titleHighlight: text,
    subtitle: text,
    start: text,
  }),
  /** The user's ask: three or four short lines, read before the clock starts; `go` starts it. */
  howTo: z.strictObject({ title: text, steps: z.array(text).min(3).max(4), go: text }),
  /** The arcade cabinet's marquee: the words beside the Cyera logo across the top of every screen. */
  cabinet: z.strictObject({ marquee: text }),
  /** 01 Explore: the forest's frame title, which is also its hidden h1. */
  world: z.strictObject({ title: text }),
  /**
   * 02 Offer: the frame title, the two answers and the way out. ONE PANEL since 2026-10-22 (the
   * client: "I want the card to open automatically"): who is speaking, then the card itself, then
   * the answers. There is no step between meeting someone and reading their card, so there is no
   * key for one; the game logs the card as read the moment it is shown (apps/game/src/main.ts).
   */
  offer: z.strictObject({ title: text, take: text, leave: text, walkOn: text }),
  /** The card inside the offer: the two row eyebrows, what taking it does and what leaving costs. */
  card: z.strictObject({ ifTake: text, ifLeave: text }),
  hud: z.strictObject({
    time: text,
    basket: text,
    twoMinutes: text,
    oneMinute: text,
    thirtySeconds: text,
    timeUp: text,
  }),
  reveal: z.strictObject({
    title: text,
    titleHighlight: text,
    /** Section headings: the skills in the basket, then the ones walked past. */
    took: text,
    left: text,
    /** What the dealt variant was, as words beside its shape (no red or green). */
    good: text,
    bad: text,
    /**
     * Row labels: the promise, the variant's reveal line, the giveaway, the real-world note. The
     * reveal line is labelled `did` on a row the player TOOK and `wouldHave` on one they left or
     * walked past: a left bad skill never ran, and "What it did: the wolf opened the door" above
     * "Clean arrival" taught that leaving it had not protected you (content review, 2026-10-22).
     */
    promised: text,
    did: text,
    wouldHave: text,
    giveaway: text,
    realWorld: text,
    score: text,
    /** The score's denominator, filled from `scoring.outOf` so the two cannot disagree. */
    outOf: template('outOf'),
    /**
     * "You spotted N of 4 bad skills" (the client, 2026-10-22). The screen counts a bad skill as
     * spotted only when its card was OPENED and it stayed out of the basket: a run that walked
     * past a card without meeting its owner spotted nothing, and is not told it did.
     */
    caught: template('caught', 'bad'),
    /** The reveal's frame title, and a row's eyebrow when the player never answered. */
    frameTitle: text,
    unanswered: text,
    /** The question the player should leave with, and the research link's label. */
    question: text,
    cta: text,
    again: text,
  }),
  /**
   * The words of the chrome the rules do not touch: the touch pad, the music switch, the problem
   * screens, the post form, the board, the forest's summary for a screen reader. Every key is
   * named in `CHROME_KEYS` above.
   */
  chrome,
  /**
   * THE WORK EMAIL AND THE CONSENT (the client, 2026-10-22), shown on Results only when the server
   * says it is required (`POST /api/start` answers `emailRequired`). Its own object rather than
   * chrome keys because one field is not a sentence: `consentVersion` names the exact `consent`
   * wording a player agreed to, the server stores it beside the address (it reads it from ITS copy
   * of this file, never from the request), and changing `consent` without a new version would make
   * every stored row claim agreement to words nobody was shown. core's real-content test pins each
   * version to its wording, so that change fails the suite.
   *
   * One sentence per refusal (core contact.ts `ContactRefusal`), and `privacy`, the line that
   * replaces chrome `privacyLine` while the email is asked for -- that one says "no email", which
   * would then be false.
   */
  contact: z.strictObject({
    consentVersion: z.string().max(CONSENT_VERSION_MAX).regex(CONSENT_VERSION_PATTERN),
    emailLabel: text,
    emailHint: text,
    consent: text,
    emailMissing: text,
    emailInvalid: text,
    emailPersonal: text,
    consentMissing: text,
    privacy: text,
  }),
});

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
   * A clean arrival scores `clean`, plus `good` for each good skill in the basket, plus a speed
   * bonus of up to `speed` that is scaled by the share of the good skills taken and falls from full
   * at `parMs` to nothing at the time limit. A run that let the wolf in scores 0, by rule
   * (scoring.ts). The lint holds `outOf` to the best run, and holds `speed` small enough that a
   * faster basket with one good skill fewer can never outscore a full one.
   */
  scoring: z.strictObject({
    outOf: z.number().int().min(1),
    good: z.number().int().min(1),
    clean: z.number().int().min(1),
    speed: z.number().int().min(0),
    /** Arriving at or under this many elapsed milliseconds earns the whole speed bonus. */
    parMs: z.number().int().min(1),
  }),
  characters: z.array(character).min(1),
  skills: z.array(skill).min(1),
  /** The copy for each ending. WHICH ending a run reaches is a rule (scoring.ts `ending`). */
  endings: z.strictObject({ grandma: ending, wolf: ending, late: ending }),
  ui,
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

/**
 * The best score any run can reach: a clean arrival with every dealt-good skill in the basket, at
 * or under par, so with the whole speed bonus.
 */
export const ceiling = (content: Content): number =>
  content.scoring.clean + content.scoring.good * content.deal.good + content.scoring.speed;

export const countWords = (line: string): number => line.split(/\s+/).filter(Boolean).length;

export const countSentences = (line: string): number =>
  line.split(/[.!?](?:\s|$)/).filter((x) => x.trim() !== '').length;

/**
 * THE LINE THAT GIVES A BAD SKILL AWAY: the one line of its bad card's `take` list that is not on
 * its good card, when the bad card is the good card with exactly that one line swapped for a new
 * one. Null when the two cards differ in any other way -- which the lint refuses.
 *
 * SWAPPED, NEVER ADDED (2026-10-22). Draft 6 let a bad card add its line, and two of seven did, so
 * a three-line card was a bad card and the line count gave the verdict away on replay without a
 * word being read. Every bad card is now the same length as its good card.
 */
export function giveaway(s: Skill): string | null {
  const good = s.good.card.take;
  const bad = s.bad.card.take;
  if (bad.length !== good.length) return null;
  const changed = bad.filter((line, i) => line !== good[i]);
  if (changed.length !== 1) return null;
  const [line] = changed as [string];
  return good.includes(line) ? null : line;
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
   * the same length and the same but for one swapped line, and that line is short.
   */
  for (const s of content.skills) {
    if (s.bad.card.leave !== s.good.card.leave)
      add(`skill "${s.id}": the bad card's leave line must be the good card's, word for word`);
    const line = giveaway(s);
    if (line === null)
      add(
        `skill "${s.id}": the bad card must be the good card with exactly one line swapped for a new one, same line count`,
      );
    else if (countWords(line) > GIVEAWAY_WORDS)
      add(
        `skill "${s.id}": the giveaway line is ${countWords(line)} words, at most ${GIVEAWAY_WORDS}`,
      );
    if (s.bad.reveal === s.good.reveal)
      add(`skill "${s.id}": the two variants need their own reveal lines`);
    const note = s.realWorld.note;
    if (countWords(note) > REAL_WORLD_WORDS || countSentences(note) > REAL_WORLD_SENTENCES)
      add(
        `skill "${s.id}": the real-world note is ${countWords(note)} words in ${countSentences(note)} sentences, at most ${REAL_WORLD_WORDS} in ${REAL_WORLD_SENTENCES}`,
      );
  }

  // A highlighted word that is not in its heading would be set on nothing.
  for (const [where, { title, titleHighlight }] of [
    ['landing', content.ui.landing],
    ['reveal', content.ui.reveal],
  ] as const)
    if (!title.split(/[\s.,!?]+/).includes(titleHighlight))
      add(`ui.${where}: the highlight "${titleHighlight}" is not a word of "${title}"`);

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

  /*
   * CORRECTNESS FIRST, THEN SPEED. The fastest basket one good skill short earns
   * (n-1) x good + speed x (n-1)/n; the slowest full basket that still arrives earns n x good and
   * no bonus. The first must never exceed the second, which is speed x (n-1) <= good x n. At the
   * shipped weights (20 a skill, 30 for speed, three good) the two meet exactly at 70, and a tie
   * ranks the earlier post first; it is never a win for the faster, emptier basket.
   */
  const { good: each, speed } = content.scoring;
  const g = content.deal.good;
  if (speed * (g - 1) > each * g)
    add(
      `a speed bonus of ${speed} lets a fast run with ${g - 1} good skills outscore a slow run with all ${g}`,
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
