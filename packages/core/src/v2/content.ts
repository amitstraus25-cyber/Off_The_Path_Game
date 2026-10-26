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

/**
 * WHAT A TAKEN SKILL DOES IN THE FOREST: its perk (the client, 2026-10-22). One per skill, at the
 * SKILL's level and not the variant's, so a good and a bad copy of a skill cannot do different
 * things in the game -- the same "one copy to compare" construction as the promise. The bad skill
 * keeps its promise; what it also does is only ever said on its card and its reveal.
 *
 * The kinds are the code the game has; everything else is data. A new skill picks one of these
 * and needs nothing more. NONE OF THEM POINTS AT THE COTTAGE, and that is a rule of this list, not
 * a promise per skill: a kind that led Purple to the door would be a new kind, reviewed as one.
 *
 *  - `minimap`        the minimap is drawn, from the take on; without it there is none.
 *  - `bridge-gate`    the bridge gate opens at the take, and stays open: the bridge is walkable.
 *                     One of the two ways over the river (`world.crossing`).
 *  - `early-welcome`  word went ahead (`chrome.doorWelcome`): the knock beat (`world.knockMs`)
 *                     is skipped.
 *  - `wing-ride`      once, at the take, a flight to the map point `lands` names (the far bank's
 *                     `wing-landing` in the shipped content), lasting `flightMs`. The other way
 *                     over the river. It used to land beside the next unmet character; rules 3
 *                     re-aimed it (docs/GATEKEEPER.md), and the landing is a map point, not a
 *                     person, so it is never the cottage either.
 *  - `walk-faster`    Purple walks `factor` times as fast for the rest of the run.
 *  - `lantern`        a warm light around Purple as the dusk comes on (`world.dusk`).
 *  - `rewind`         `ms` given back to the clock: to the time left, and off the time the
 *                     speed bonus counts. Never past the start (the reducer clamps it).
 */
export const EFFECT_KINDS = [
  'minimap',
  'bridge-gate',
  'early-welcome',
  'wing-ride',
  'walk-faster',
  'lantern',
  'rewind',
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

/** The longest a timed perk may be, so no single perk is a second clock. */
export const EFFECT_MAX_MS = 30_000;

const effect = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('minimap') }),
  z.strictObject({ kind: z.literal('bridge-gate') }),
  z.strictObject({ kind: z.literal('early-welcome') }),
  z.strictObject({
    kind: z.literal('wing-ride'),
    /** How long the flight takes, in ms, during which the clock runs and Purple cannot act. */
    flightMs: z.number().int().min(0).max(EFFECT_MAX_MS),
    /** The map object the flight lands on: a point, never a character and never the cottage. */
    lands: slug,
  }),
  z.strictObject({ kind: z.literal('walk-faster'), factor: z.number().gt(1).max(2) }),
  z.strictObject({ kind: z.literal('lantern') }),
  z.strictObject({ kind: z.literal('rewind'), ms: z.number().int().min(1).max(EFFECT_MAX_MS) }),
]);
export type Effect = z.infer<typeof effect>;

const skill = z.strictObject({
  id: slug,
  name: text,
  icon: slug,
  /** One line, in the character's voice. True in both variants: a bad skill keeps it too. */
  promise: text,
  /** What taking it does in the forest, the same in both variants (see `effect` above). */
  effect,
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
  /** The first line of the conversation: who they are. */
  greet: text,
  /**
   * The second line, after Purple asks what they have: what they offer, in their own voice. One
   * copy for both variants, like the greeting, so nothing said before the card gives it away.
   */
  offer: text,
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
  'handleLabel',
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
  'revealPlayed',
  'revealChoices',
  'revealSpeed',
  'revealTime',
  'revealPar',
  'boardJoining',
  'revealFloorWolf',
  'revealFloorLate',
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
  // P17 (the review of 2026-10-25): the door also names who was met and never answered.
  'doorAskUnanswered',
  'doorStillAnswer',
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
  /*
   * The client's review of 2026-10-25 (P9, P10). A good skill taken is `revealRight`, not "Caught
   * it" (nothing was caught); a skill never answered is `revealPast`, neutral, not "Missed it". And
   * a SAFE tile shows its unsafe copy's giveaway under `revealUnsafeSaid`, so every run teaches all
   * seven giveaways and not only the dealt-bad four.
   */
  'revealRight',
  'revealPast',
  'revealUnsafeSaid',
  /*
   * The same review: `postJump` is the plain link beside Walk it again that takes a phone down to
   * the post form (P13), and `saidTook` / `saidLeft` are what a screen reader hears after each
   * choice (P14), carrying {skill}, {basket} and {left}.
   */
  'postJump',
  'saidTook',
  'saidLeft',
  /*
   * The A/B tests' other halves (the client, 2026-10-25, apps/game/src/ab.ts): `postNext` and
   * `postNextNote` are the two-step post form's first step (P21), `startPar` is the par line on
   * the one-screen start (P20), carrying {par}.
   */
  'postNext',
  'postNextNote',
  'startPar',
  /*
   * THE PERKS, as the forest says them (the client, 2026-10-22). One line per effect KIND, never per
   * skill, so a new skill that picks an existing kind needs no new words; `perkRewind` carries
   * {seconds}, the time the rewind gave back. `doorKnock` and `doorWelcome` are the knock beat and its skip (`early-welcome`), and
   * `revealWatchFor` labels a SAFE tile's real-world note, which must not read as if the skill had
   * done the harmful thing.
   */
  'revealWatchFor',
  'perkMinimap',
  'perkBridgeGate',
  'perkEarlyWelcome',
  'perkWingRide',
  'perkWalkFaster',
  'perkLantern',
  'perkRewind',
  'doorKnock',
  'doorWelcome',
  /*
   * Paul's design round of 2026-10-22, every word of it for the human read in COPY_REVIEW.
   * `landingAgent` is the premise's first sentence on a line of its own, so the fit ladder can
   * never hide the one that ties the game to the research; `landingChip` is the notation chip on the
   * Title, How-to and Results headers; `howToGoing` is the start button while the server answers.
   * `arriveChipLabel` is the Arrive header's chip, `arriveSpeaker` the name over Purple's lines, and
   * `arriveAskLate` the late ending's way on, which does not invite anyone inside a door they never
   * found.
   */
  'landingAgent',
  'landingChip',
  'howToGoing',
  'arriveAskLate',
  'arriveChipLabel',
  'arriveSpeaker',
  /*
   * The Gatekeeper and the river (rules 3, docs/GATEKEEPER.md): `gateLocked` is the notice at the
   * raised drawbridge, walked up to without the Bridge Key; `gateLockedLeft` is the same notice
   * once the Bridge Key has been LEFT, which points the player at the other way over instead of
   * at a Gatekeeper they already said no to. `noWayOver` is said once a run has left BOTH ways
   * over (`world.crossing`): it can no longer reach the door. (`perkBridgeGate`, the drawbridge
   * coming down, is with the other perks above; `perkForkSigns` went with the fork signs.)
   */
  'gateLocked',
  'gateLockedLeft',
  'noWayOver',
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
  /**
   * The user's ask: three or four short lines, read before the clock starts; `go` starts it.
   * `stress` names, by position, the lines the screen sets heavier (the client, 2026-10-22: "take
   * only the good ones" and "at 2:00 it gets darker" must be unmissable). Optional, and a weight
   * only: the words are the same words with or without it. apps/game/test/reveal.test.ts holds
   * every index to a line that exists.
   */
  howTo: z.strictObject({
    title: text,
    steps: z.array(text).min(3).max(4),
    stress: z.array(z.number().int().min(0)).optional(),
    go: text,
  }),
  /** The arcade cabinet's marquee: the words beside the Cyera logo across the top of every screen. */
  cabinet: z.strictObject({ marquee: text }),
  /**
   * 01 Explore: the forest's frame title, which is also its hidden h1; and what the three Cyera
   * signs in the wood say (the client, 2026-10-23). Each sign is a `sign-<key>` object on the map,
   * and its `caption` is the one line shown politely while Purple is near it. `spoken`, where given,
   * is what a screen reader hears instead -- the caption's heart is a glyph, and "I black heart suit"
   * is not what the sign says. apps/game/test/signs.test.ts holds the keys to the map's objects.
   */
  world: z.strictObject({
    title: text,
    signs: z.strictObject({
      research: z.strictObject({ caption: text, spoken: text.optional() }),
      'dead-end': z.strictObject({ caption: text, spoken: text.optional() }),
      logo: z.strictObject({ caption: text, spoken: text.optional() }),
    }),
  }),
  /**
   * 02 Offer: the frame title, the two answers and the way out, and Purple's three replies in the
   * conversation before the card (the client, 2026-10-26: "like a ping pong"). The character greets,
   * Purple `ask`s, they offer, and `showMe` opens the card -- which is what logs it as read.
   * `noThanks` is Walk on in Purple's voice: no answer, and the character waits. `purple` is the
   * name over her side of the conversation.
   */
  offer: z.strictObject({
    title: text,
    take: text,
    leave: text,
    walkOn: text,
    purple: text,
    ask: text,
    showMe: text,
    noThanks: text,
  }),
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
     * "You kept N of 4 bad skills out of your basket" (Paul's round, 2026-10-22, replacing "You
     * spotted"). The screen counts every bad skill that stayed out of the basket, read or not --
     * the thing the score and the ending turn on -- so a run that walked past all four to a 100 is
     * not told it got 0. Each tile's Caught / Missed still counts only the cards that were read.
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
    /** Beside a greyed Post, what is still missing (the review of 2026-10-25, P13). */
    postNeeds: text,
    privacy: text,
  }),
});

export const contentSchema = z.strictObject({
  /**
   * Which rules this content is written for. v1 content has no such key and v1's schema is strict,
   * so neither version's content can load as the other's.
   */
  rules: z.literal(3),
  version: text,
  status: text,
  /**
   * How many skills each run deals good; the rest are dealt bad (deal.ts). `always` names skills
   * dealt good in every run, and each `oneOf` group has exactly one good member; the rest of `good`
   * is drawn from the skills named in neither. Both optional, and absent means no constraint. The
   * lint holds every id to a skill, no skill to two places, and the counts to a deal that exists.
   */
  deal: z.strictObject({
    good: z.number().int().min(1),
    always: z.array(slug).optional(),
    oneOf: z.array(z.array(slug).min(2)).optional(),
  }),
  /**
   * Every run that ENDS -- at Grandma's, with the wolf, or late -- scores `played` for playing (the
   * client, 2026-10-25: "anyone who starts playing gets 25, so they can at least leave their
   * email"). A clean arrival adds `clean`, plus `good` for each good skill in the basket, plus a
   * speed bonus of up to `speed` that is scaled by the share of the good skills taken and falls from
   * full at `parMs` to nothing at the time limit. A run that let the wolf in, or ran out of time,
   * scores `played` and nothing more, by rule (scoring.ts). The lint holds `outOf` to the best run,
   * and holds `speed` small enough that a faster basket with one good skill fewer can never
   * outscore a full one.
   */
  scoring: z.strictObject({
    outOf: z.number().int().min(1),
    played: z.number().int().min(0),
    good: z.number().int().min(1),
    clean: z.number().int().min(1),
    speed: z.number().int().min(0),
    /** Arriving at or under this many elapsed milliseconds earns the whole speed bonus. */
    parMs: z.number().int().min(1),
  }),
  /**
   * THE FOREST'S TIMED BEATS, as data so the game and the server read the same numbers.
   *
   * `knockMs` is the knock at the cottage door: after Purple's feet reach the door and before the
   * run's `arrived` stamp, on the clock, for every run but one with an `early-welcome` perk. The
   * game must hold the beat at least this long; the server's walk floor charges it (floor.ts).
   *
   * `dusk` is the evening coming on, for everyone: from `fromLeftMs` left on the clock (120000 is
   * the HUD's 2:00) it deepens in a straight line to `darkest` at time up, and never further.
   * `darkest` is the share of the light taken away, capped by the schema at a half so the path and
   * the cast are always visible. A rewind adds to the time left, so it pushes the dusk back with it
   * (`duskLevel`, perks.ts).
   */
  world: z.strictObject({
    knockMs: z.number().int().min(0).max(EFFECT_MAX_MS),
    /**
     * THE RIVER (rules 3, docs/GATEKEEPER.md). Present, the walk to the cottage crosses a river,
     * and these are the effect kinds that carry Purple over it: the reducer refuses the arrival of
     * a run that took no skill of one of them (`ENTER_COTTAGE`, 'not-across'), so a log that
     * reached the door without crossing is not a run. Such a run stays on the near bank until the
     * clock runs out, which is the late ending. Absent, there is no river.
     */
    crossing: z.array(z.enum(EFFECT_KINDS)).min(1).optional(),
    dusk: z.strictObject({
      fromLeftMs: z.number().int().min(1),
      darkest: z.number().gt(0).max(0.5),
    }),
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
 * The best score any run can reach: `played`, and a clean arrival with every dealt-good skill in
 * the basket, at or under par, so with the whole speed bonus.
 */
export const ceiling = (content: Content): number =>
  content.scoring.played +
  content.scoring.clean +
  content.scoring.good * content.deal.good +
  content.scoring.speed;

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

  /*
   * THE DEAL'S CONSTRAINTS (rules 3): every id a skill, no skill in two places -- always and a
   * group, two groups, or twice in one -- and counts that make at least one deal. A skill in two
   * places would make "exactly one of this group" and "always" disagree, and deal.ts would quietly
   * deal one of them.
   */
  const always = content.deal.always ?? [];
  const groups = content.deal.oneOf ?? [];
  for (const id of always) if (!skillIds.has(id)) add(`deal.always names unknown skill "${id}"`);
  groups.forEach((g, i) => {
    for (const id of g) if (!skillIds.has(id)) add(`deal.oneOf[${i}] names unknown skill "${id}"`);
  });
  const named = [...always, ...groups.flat()];
  for (const d of new Set(duplicates(named)))
    add(`deal: skill "${d}" is named more than once across always and oneOf`);
  const fixed = always.length + groups.length;
  const others = content.skills.filter((s) => !named.includes(s.id)).length;
  if (fixed > content.deal.good)
    add(
      `a deal of ${content.deal.good} good has no room for ${always.length} always-good skills and ${groups.length} oneOf groups`,
    );
  else if (content.deal.good - fixed > others)
    add(
      `a deal of ${content.deal.good} good must draw ${content.deal.good - fixed} more from the ${others} skills outside always and oneOf`,
    );

  /*
   * THE RIVER NEEDS A WAY OVER. With `world.crossing`, a run that took no crossing skill cannot
   * arrive, so content with none of those kinds is content nobody can finish. Whether a CAREFUL
   * run can cross in every deal is the trap check's question (sim.ts): it is measured by playing.
   */
  const crossing = content.world.crossing;
  if (crossing && !content.skills.some((s) => crossing.includes(s.effect.kind)))
    add(`world.crossing: no skill has an effect that crosses the river (${crossing.join(', ')})`);

  // "Out of 100" is a promise to the player. If no run can reach it, the denominator is a lie.
  const best = ceiling(content);
  if (best !== content.scoring.outOf)
    add(
      `the best possible run scores ${best}, but the score is shown out of ${content.scoring.outOf}`,
    );

  /*
   * CORRECTNESS FIRST, THEN SPEED. The fastest basket one good skill short earns
   * (n-1) x good + speed x (n-1)/n; the slowest full basket that still arrives earns n x good and
   * no bonus (`played` and `clean` are the same on both sides). The first must never exceed the
   * second, which is speed x (n-1) <= good x n. At the shipped weights (15 a skill, 15 for speed,
   * three good) the fastest two-good basket is 80 and the slowest full one 85; a tie, at weights
   * that make one, ranks the earlier post first and is never a win for the faster, emptier basket.
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
