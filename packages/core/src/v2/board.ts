import '../zod-config.ts';
import { z } from 'zod';
import { HANDLE_MAX_LENGTH, MAX_TOP_LIMIT } from '../leaderboard.ts';

/*
 * THE NAME A PLAYER TYPES, AND THE BOARD'S WIRE SHAPES THAT CARRY IT (2026-10-22).
 *
 * The client's words: "I want people to put their own name." Until today the board took only
 * minted handles (`brave-lantern-42`, packages/core/src/leaderboard.ts), and its reasoning was
 * sound: a free-text name on a Cyera-branded public page is a moderation problem. So the name is
 * free, and FENCED, and the fence is here, in one pure function both ends call:
 *
 *   - the SERVER is the authority. `POST /api/score` refuses a name this rejects and stores the
 *     tidied form it returns, never the raw string (apps/api handlers.ts);
 *   - the GAME calls the same function for a friendly message before it posts, and that is all the
 *     client check is for. Nothing relies on it.
 *
 * WHAT IS ALLOWED: 3 to 16 characters (code points, which is what the table's
 * `char_length(handle) between 1 and 16` counts) of letters in any language with their accents,
 * the digits 0-9, spaces, hyphens and apostrophes. Whitespace is trimmed and collapsed, curly
 * apostrophes and Unicode dashes are straightened, and the text is NFC-normalised, so one name has
 * one spelling on the board. It starts with a letter or digit, ends with one, and never doubles a
 * separator.
 *
 * WHAT IS REFUSED, AND WHY EACH:
 *
 *   - anything that looks like CONTACT DETAILS: more than four digits in all (a phone number, a
 *     long digit run), a `www`/`http` word or a trailing domain word, a mail provider's name, `dot`.
 *     `@`, `.`, `/` and `:` are not allowed characters at all, so a literal address cannot be typed.
 *     The board stores a handle and a score; a name that smuggles a phone number in turns it into
 *     a contact list.
 *   - a SHORT blocklist of slurs and rude words, compared after folding case and accents and
 *     undoing the common digit swaps (0 o, 1 i, 3 e, 4 a, 5 s, 7 t, 8 b, 9 g) -- and also with runs
 *     of a repeated letter squeezed to one. Two lists, because a substring list is how
 *     "Scunthorpe" and "Kshitij" get refused: ROOTS are matched anywhere and are kept to stems that
 *     do not occur inside ordinary names; WORDS are matched only as a whole word, or as the whole
 *     name with its separators removed (so "a s s" is the word it spells).
 *   - three RESERVED words (admin, moderator, official), because a row reading "Cyera Admin" on
 *     Cyera's own page is the misleading-instructions problem this game is about.
 *
 * WHAT THIS IS NOT. It is not a moderation system and does not claim to be one: a determined
 * person will find a rude name in sixteen characters that no list anticipates. The list exists to
 * stop the obvious, and docs/DATABASE.md's delete path removes the rest by hand. Every rule here is
 * tested from both sides in test/v2/board.test.ts, including the ordinary names it must let
 * through.
 */

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = HANDLE_MAX_LENGTH;
/** A whole name, generously: the raw input is refused long before it costs anything to tidy. */
const RAW_MAX = 64;
const MAX_DIGITS = 4;

/** Why a name was refused. The game shows one sentence per reason (content `ui.chrome`). */
export type NameRefusal = 'short' | 'long' | 'characters' | 'contact' | 'blocked';
export type NameCheck = { ok: true; name: string } | { ok: false; reason: NameRefusal };

const SEPARATOR = /[ '-]/u;
const ALLOWED = /^[\p{L}\p{M}0-9 '-]+$/u;
const STARTS = /^[\p{L}0-9]/u;
const ENDS = /[\p{L}\p{M}0-9]$/u;

/** The name as it will be stored: NFC, straight apostrophes and hyphens, spaces collapsed. */
export const tidyName = (raw: string): string =>
  raw
    .normalize('NFC')
    .replace(/[‘’ʼ`´]/gu, "'")
    .replace(/[‐-―−]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim();

const URLISH = /(^|[ -])(www|https?|dot)([ -]|$)|[ '-](com|net|org|io|info|biz|xyz|ru)$/iu;
const MAIL = /gmail|hotmail|yahoo|outlook|icloud|proton/iu;

/**
 * Stems refused wherever they occur. Each one was checked against ordinary names before it went in,
 * and four were moved to WORDS for failing that: `porn` (Thai given names such as Pornchai),
 * `rapist` (therapist), `wank` (swanky) and `twat`.
 */
const ROOTS = [
  'fuck',
  'cunt',
  'nigg',
  'bitch',
  'whore',
  'slut',
  'dildo',
  'penis',
  'vagin',
  'faggot',
  'fagot',
  'retard',
  'hitler',
  'paedo',
] as const;

/** Words refused only as a whole word, or as the whole name with its separators taken out. */
const WORDS = new Set([
  'ass',
  'arse',
  'anal',
  'anus',
  'bastard',
  'bollocks',
  'boob',
  'boobs',
  'cock',
  'crap',
  'cum',
  'dick',
  'fag',
  'fags',
  'fck',
  'fuk',
  'homo',
  'jizz',
  'kike',
  'negro',
  'niga',
  'nazi',
  'piss',
  'prick',
  'rape',
  'sex',
  'sexy',
  'shit',
  'shite',
  'shitty',
  'spic',
  'tit',
  'tits',
  'tosser',
  'twat',
  'wank',
  'wanker',
  'porn',
  'porno',
  'rapist',
  'admin',
  'moderator',
  'official',
]);

const SWAPS: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
};

/** Lower case, accents off, digit swaps undone, nothing but letters left. */
const fold = (word: string): string =>
  word
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[0-9]/gu, (d) => SWAPS[d] ?? '')
    .replace(/[^\p{L}]/gu, '');

/** Every run of one repeated letter, squeezed to one: "fuuuck" is "fuck". */
const squeeze = (word: string): string => word.replace(/(\p{L})\1+/gu, '$1');

const isBlocked = (name: string): boolean => {
  const words = name.split(SEPARATOR).map(fold);
  const whole = words.join('');
  const forms = [whole, squeeze(whole)];
  if (forms.some((f) => ROOTS.some((root) => f.includes(root)))) return true;
  return [...words, whole].some((w) => WORDS.has(w) || WORDS.has(squeeze(w)));
};

/**
 * Whether a typed name may go on the board, and the form it goes on in. Pure; the same answer on
 * both ends of the wire. The order of the checks is the order a player would want to hear them.
 */
export function checkName(raw: unknown): NameCheck {
  if (typeof raw !== 'string' || raw.length > RAW_MAX) return { ok: false, reason: 'long' };
  const name = tidyName(raw);
  const length = [...name].length;
  if (length < NAME_MIN_LENGTH) return { ok: false, reason: 'short' };
  if (length > NAME_MAX_LENGTH) return { ok: false, reason: 'long' };
  if (
    !ALLOWED.test(name) ||
    !STARTS.test(name) ||
    !ENDS.test(name) ||
    /[ '-]{2}/u.test(name) ||
    /[ '-]\p{M}|\p{M}{4}/u.test(name) ||
    !/\p{L}/u.test(name)
  )
    return { ok: false, reason: 'characters' };
  if ((name.match(/[0-9]/gu) ?? []).length > MAX_DIGITS || URLISH.test(name) || MAIL.test(name))
    return { ok: false, reason: 'contact' };
  if (isBlocked(name)) return { ok: false, reason: 'blocked' };
  return { ok: true, name };
}

/** True only for a name already in the form the board stores: accepted, and already tidy. */
export const isBoardName = (raw: unknown): raw is string => {
  const check = checkName(raw);
  return check.ok && check.name === raw;
};

/** A name on the wire, either direction. Refuses anything `isBoardName` refuses. */
export const boardNameSchema = z
  .string()
  .refine(isBoardName, { message: 'not a name for the board' });

/*
 * THE WIRE SHAPES, v2 (`POST /api/score` and `GET /api/top`). They replace the minted-only
 * `submitResponseSchema` and `topResponseSchema` in ../leaderboard.ts for the v2 game, which would
 * drop a whole board the moment one free name reached it. Tolerant outbound (`z.object`), so a
 * field added later does not make the deployed game distrust every reply; the name check still
 * applies to every row, which is what stops a poisoned row rendering as a name.
 */

export const boardEntrySchema = z.object({
  rank: z.number().int().min(1),
  handle: boardNameSchema,
  score: z.number().int().min(0),
});
export type BoardEntry = z.infer<typeof boardEntrySchema>;

export const boardResponseSchema = z.object({
  entries: z.array(boardEntrySchema).max(MAX_TOP_LIMIT),
});

/**
 * What a post answers. `rank` is where the row landed when the server counted, right after writing
 * it: null when the count failed, and the row is in the table regardless. `entries` is the top of
 * the board read straight from the table after the write -- never from the edge cache -- and is
 * absent when that read failed. Both are what let the game show the player their own row the
 * moment they post, rather than a cached board from before they did.
 */
export const postResponseSchema = z.object({
  handle: boardNameSchema,
  score: z.number().int().min(0),
  rank: z.number().int().min(1).nullable().optional(),
  entries: z.array(boardEntrySchema).max(MAX_TOP_LIMIT).optional(),
});
export type PostResponse = z.infer<typeof postResponseSchema>;
