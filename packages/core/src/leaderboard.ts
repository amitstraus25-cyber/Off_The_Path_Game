import './zod-config.ts';
import { z } from 'zod';
import { runEventSchema } from './state.ts';

/*
 * The leaderboard contract, shared by both ends of the wire.
 *
 * The game mints a handle, posts a RUN LOG, and validates whatever comes back. The server parses
 * the body with these same schemas, replays the log through the reducer, and recomputes the score
 * with `score()` -- CLAUDE.md golden rule 6. There is deliberately no `score` field in the request:
 * a number the client sends is not ignored, it is unspeakable, because `submitRequestSchema` is
 * strict and rejects any key it does not name.
 *
 * Handles are MINTED, never typed. A free-text handle on a Cyera-branded public page is a
 * moderation problem, so the game draws a word pair plus a number from the two lists below and the
 * server accepts nothing else. That also means no player-supplied string ever reaches the database,
 * which removes a class of injection worry -- but nothing here relies on that: every handle is
 * validated on the way in, on the way out, and again before it is stored.
 */

/**
 * The first word of a handle. Every entry is at most 5 characters, which is half of why a minted
 * handle always fits the `char_length(handle) between 1 and 16` check on the table (test/leaderboard
 * checks the whole cross product, so a longer word added here fails the suite rather than the
 * insert).
 *
 * The words are dull on purpose. The pair is drawn independently, so the list has to be one that
 * cannot produce an offensive pair in EITHER order with anything in the second list: no bodies, no
 * violence, no slang, nothing that reads as a person. Forest and fairy tale only.
 *
 * "Nothing that reads as a person" is the rule a first pass broke: `amber`, `hazel` and `misty` are
 * ordinary given names, and in front of a surname-shaped second word they minted `hazel-robin-42` --
 * a real person's name on a public Cyera board, which is the misleading case this game is about.
 * Adjectives only here, and `test/leaderboard.test.ts` holds both lists against a list of names so
 * the next tempting addition fails the suite instead of a reviewer.
 */
export const HANDLE_FIRST_WORDS = [
  'alert',
  'bold',
  'brave',
  'calm',
  'clear',
  'crisp',
  'deft',
  'eager',
  'fair',
  'fresh',
  'glad',
  'green',
  'happy',
  'hardy',
  'jolly',
  'keen',
  'kind',
  'light',
  'lucky',
  'merry',
  'neat',
  'noble',
  'quick',
  'quiet',
  'ready',
  'snug',
  'soft',
  'spry',
  'swift',
  'tidy',
  'warm',
  'wise',
] as const;

/** The second word. At most 7 characters, by the same argument as the first list. */
export const HANDLE_SECOND_WORDS = [
  'acorn',
  'apron',
  'badger',
  'basket',
  'bellows',
  'birch',
  'biscuit',
  'bonnet',
  'bramble',
  'burrow',
  'candle',
  'cinder',
  'cloak',
  'compass',
  'cottage',
  'hearth',
  'heron',
  'kettle',
  'lantern',
  'mitten',
  'moss',
  'nettle',
  'otter',
  'pebble',
  'ribbon',
  'satchel',
  'sparrow',
  'thicket',
  'thimble',
  'thistle',
  'turnip',
  'walnut',
] as const;

/** The table's own check constraint, written down where both ends can assert against it. */
export const HANDLE_MAX_LENGTH = 16;

/**
 * Two lowercase words and a two-digit number. The number never carries a leading zero, so one
 * handle has exactly one spelling and `brave-lantern-07` is not a second name for `...-7`.
 */
const HANDLE_PATTERN = /^([a-z]+)-([a-z]+)-([1-9][0-9])$/;

const FIRST: readonly string[] = HANDLE_FIRST_WORDS;
const SECOND: readonly string[] = HANDLE_SECOND_WORDS;

/** 10 to 99, as a list so one clamped pick covers the number too. */
const NUMBERS: readonly number[] = Array.from({ length: 90 }, (_, i) => i + 10);

/** Draws an index in range even from an rng that hands back 1, or something worse. */
const pick = <T>(list: readonly T[], unit: number): T =>
  list[Math.min(list.length - 1, Math.max(0, Math.floor(unit * list.length)))]!;

/**
 * Mints a handle such as `brave-lantern-42`. The randomness is injected (CLAUDE.md rule 2): the
 * game passes a crypto-backed unit interval, tests pass whatever they need to pin an outcome.
 */
export function mintHandle(rng: () => number): string {
  const first = pick(FIRST, rng());
  const second = pick(SECOND, rng());
  const number = pick(NUMBERS, rng());
  return `${first}-${second}-${number}`;
}

/** True only for a handle this game could have minted. The server accepts nothing else. */
export function isMintedHandle(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const parts = HANDLE_PATTERN.exec(raw);
  if (parts === null) return false;
  return FIRST.includes(parts[1]!) && SECOND.includes(parts[2]!);
}

export const handleSchema = z
  .string()
  .refine(isMintedHandle, { message: 'not a handle this game mints' });

/**
 * A bound on the log a submission may carry, so a hostile body cannot buy a long replay cheaply.
 * A real run is around twenty events; the reducer lets a notice be re-read while its hidden
 * instruction is still pending, so an honest log can be a little longer than the content's event
 * vocabulary suggests, and nothing legitimate comes anywhere near this.
 */
export const MAX_LOG_EVENTS = 256;

/** The one body `POST /api/score` accepts. Strict: an unknown key -- `score` above all -- is a 400. */
export const submitRequestSchema = z.strictObject({
  handle: handleSchema,
  log: z.array(runEventSchema).min(1).max(MAX_LOG_EVENTS),
});
export type SubmitRequest = z.infer<typeof submitRequestSchema>;

/*
 * The responses are parsed with `z.object` rather than `z.strictObject`: strict inbound, tolerant
 * outbound, so a later field added to the API does not make the deployed game treat every reply as
 * garbage. `handleSchema` still applies, which is what stops a poisoned row rendering as a name.
 */
export const submitResponseSchema = z.object({
  handle: handleSchema,
  score: z.number().int().min(0),
});
export type SubmitResponse = z.infer<typeof submitResponseSchema>;

export const DEFAULT_TOP_LIMIT = 10;
export const MAX_TOP_LIMIT = 25;

export const topEntrySchema = z.object({
  rank: z.number().int().min(1),
  handle: handleSchema,
  score: z.number().int().min(0),
});

export const topResponseSchema = z.object({
  entries: z.array(topEntrySchema).max(MAX_TOP_LIMIT),
});
export type TopResponse = z.infer<typeof topResponseSchema>;

/** Clamps a requested page size to something the board will actually serve. */
export const topLimit = (requested: unknown): number => {
  const n = typeof requested === 'string' ? Number(requested) : requested;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) return DEFAULT_TOP_LIMIT;
  return Math.min(n, MAX_TOP_LIMIT);
};
