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
 *   - a BLOCKLIST of slurs, sexual and violent abuse and common profanity, compared after folding
 *     (below). Three lists, because a substring list is how "Scunthorpe" and "Kshitij" get refused:
 *     ROOTS are matched anywhere in the name with its separators taken out, and are kept to stems
 *     that do not occur inside or across ordinary names; STEMS are matched anywhere inside ONE word,
 *     for the compounds that an ordinary first name and surname spell across their join ("Vince
 *     Stone" holds `incest`, "Fred Skinner" `redskin`, "Karim Jobs" `rimjob`); WORDS are matched
 *     only as a whole word, or as the whole name with its separators removed (so "a s s" is the
 *     word it spells). Single letters typed apart are read as the word they spell wherever they
 *     stand, so "big a s s" is "big ass".
 *   - RESERVED words, the brand's and the staff's (cyera, support, staff, official, admin,
 *     moderator, anthropic, claude), anywhere in the name with its separators taken out, because a
 *     row reading "Cyera Support" on Cyera's own page is the misleading-instructions problem this
 *     game is about, and "Cy Era" is the first thing a forger tries. The two SHORT ones (ceo, team)
 *     are matched anywhere inside one word instead: across the join they are in "Grace Owen",
 *     "Joyce O'Neil" and "Kate Amis", and those are people, not forgeries. Two ordinary words that
 *     hold a reserved one are read past by name (Stafford, badminton). The cost that is KNOWN and
 *     accepted: "Claude" is also a French given name, and "Lucy Erasmus" spells cyera across her
 *     join; both are refused, and "Please pick a different name." is what they are told.
 *   - the hate number 1488, however its digits are spaced.
 *
 * HOW A NAME IS FOLDED FOR EVERY CHECK ABOVE (contact, blocklist and reserved alike): NFKD with the
 * accents taken off, which also makes fullwidth and mathematical letters plain ASCII; then every
 * LOOKALIKE letter from another script mapped to the Latin letter it is dressed as (Cyrillic,
 * Greek, Armenian, Cherokee, the small capitals, and Latin letters NFKD leaves alone such as ł, ø
 * and ı); then lower case. For the blocklist and the reserved list, digits are swapped back too
 * (0 o, 1 i, 3 e, 4 a, 5 s, 7 t, 8 b, 9 g) and everything but letters dropped. Every entry is
 * matched STRETCHED, each of its letters allowed to repeat ("fuuuck", "asssss", "suppport"), which
 * replaced squeezing the NAME's repeats, because squeezing turned "ass" into "as" and "support"
 * into "suport", and so missed every entry with a double letter in it. The board stores what the
 * player typed, never the fold: a Russian or Greek name is shown as written.
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
 * LETTERS DRESSED AS LATIN, and the Latin letter each is taken for (the security review,
 * 2026-10-22). `fold` used to be NFKD and nothing more, and NFKD leaves another script's letters
 * alone, so "Аdmin" with a Cyrillic А was not the word "admin" to any list and went on the board.
 * Each pair is one letter and what a reader sees; both cases are listed because the map runs
 * before lower-casing (a capital Greek Η is an H, its small η is an n). Fullwidth and
 * mathematical letters need no entry: NFKD makes them ASCII first. Only the CHECKS see this map.
 */
const LOOKALIKE_PAIRS = [
  // Cyrillic
  'Аa Вb Еe Ѕs Іi Јj Кk Мm Нh Оo Рp Сc Тt Уy Хx Үy Һh Ԁd Ԛq Ԝw Ӏl Ьb',
  'аa вb гr еe ѕs іi јj кk мm нh оo пn рp сc тt уy хx үy һh ԁd ԛq ԝw ӏl ьb',
  // Greek
  'Αa Βb Εe Ζz Ηh Ιi Κk Μm Νn Οo Ρp Τt Υy Χx αa βb γy εe ηn ιi κk νv οo ρp τt υu χx ωw',
  // Armenian and Cherokee
  'Օo օo Սu սu հh ոn ցg զq Ꭺa Ᏼb Ꮯc Ꭰd Ꭼe Ꮐg Ꮋh Ꭵi Ꭻj Ꮶk Ꮮl Ꮇm Ꮲp Ꮢr Ꮪs Ꭲt Ꮩv Ꮃw Ꮓz',
  // Latin letters NFKD does not take apart, and the small capitals
  'ıi ȷj Łl łl Øo øo Đd đd Ðd ðd Ħh ħh Ŧt ŧt ƀb ɨi ɑa ɡg ẞss ßss Æae æae Œoe œoe',
  'ᴀa ʙb ᴄc ᴅd ᴇe ɢg ʜh ɪi ᴊj ᴋk ʟl ᴍm ɴn ᴏo ᴘp ʀr ꜱs ᴛt ᴜu ᴠv ᴡw ʏy ᴢz',
];
const LOOKALIKES: ReadonlyMap<string, string> = new Map(
  LOOKALIKE_PAIRS.flatMap((row) => row.split(' ')).map((pair) => {
    const [letter, ...latin] = [...pair];
    return [letter!, latin.join('')];
  }),
);

/** The name as every check reads it: accents off, lookalikes made Latin, lower case. */
const unmask = (text: string): string =>
  [...text.normalize('NFKD').replace(/\p{M}/gu, '')]
    .map((ch) => LOOKALIKES.get(ch) ?? ch)
    .join('')
    .toLowerCase();

/**
 * Refused anywhere in the name with its separators taken out. Each one was checked against
 * ordinary names before it went in, and some were sent to STEMS or WORDS for failing that: `porn`
 * (Thai given names such as Pornchai), `rapist` (therapist), `wank` (swanky), `twat`, `shit`
 * (Kshitij, Yamashita), `nazi` (Nazim, Nazia), `pedo` (Torpedo), `coon` (raccoon) and `tranny`
 * (the Vietnamese "Tran Ny"). The phrases here are the ones typed with spaces in them.
 */
const ROOTS = [
  'fuck',
  'fck',
  'fuker',
  'cunt',
  'nigg',
  'bitch',
  'whore',
  'slut',
  'dildo',
  'penis',
  'vagin',
  'pussy',
  'jizz',
  'blowjob',
  'handjob',
  'masturbat',
  'clitoris',
  'testicle',
  'scrotum',
  'bukkake',
  'bestiality',
  'faggot',
  'fagot',
  'retard',
  'hitler',
  'paedo',
  'pedophil',
  'siegheil',
  'whitepower',
  'gasthejews',
  'genocide',
  'swastika',
  'killyourself',
  'killurself',
  'killyoself',
  'hangyourself',
  'wetback',
  'raghead',
  'towelhead',
  'jigaboo',
  'junglebunny',
  'porchmonkey',
  'zipperhead',
  'golliwog',
] as const;

/**
 * Refused anywhere inside ONE word: the compounds an ordinary first name and surname spell across
 * their join. Typed apart, each is caught by its own WORD ("dumb ass", "bull shit") or is harmless.
 */
const STEMS = [
  'asshole',
  'arsehole',
  'asshat',
  'assface',
  'asswipe',
  'dumbass',
  'jackass',
  'smartass',
  'fatass',
  'badass',
  'bullshit',
  'horseshit',
  'dipshit',
  'batshit',
  'shithead',
  'shitface',
  'shithole',
  'dickhead',
  'cocksuck',
  'douchebag',
  'cumshot',
  'rimjob',
  'ballsack',
  'nutsack',
  'shemale',
  'tranny',
  'trannie',
  'orgasm',
  'incest',
  'molest',
  'behead',
  'redskin',
] as const;

/** Refused only as a whole word, or as the whole name with its separators taken out. */
const WORDS = [
  'ass',
  'arse',
  'anal',
  'anus',
  'bastard',
  'bollocks',
  'bellend',
  'boob',
  'boobs',
  'boobies',
  'boner',
  'bugger',
  'cock',
  'cocks',
  'crap',
  'cum',
  'dick',
  'dicks',
  'douche',
  'fag',
  'fags',
  'fuk',
  'goddamn',
  'gtfo',
  'hentai',
  'homo',
  'horny',
  'milf',
  'nude',
  'nudes',
  'orgy',
  'piss',
  'pissed',
  'prick',
  'sex',
  'sexy',
  'shit',
  'shite',
  'shits',
  'shitty',
  'skank',
  'sperm',
  'stfu',
  'thot',
  'tit',
  'tits',
  'titties',
  'tosser',
  'twat',
  'wank',
  'wanker',
  'wtf',
  'xxx',
  'porn',
  'porno',
  'rape',
  'raped',
  'rapes',
  'raping',
  'rapist',
  'pedo',
  'pedos',
  'kys',
  // slurs
  'beaner',
  'chink',
  'chinks',
  'chinky',
  'coon',
  'coons',
  'gook',
  'gooks',
  'injun',
  'kike',
  'kyke',
  'negro',
  'niga',
  'paki',
  'pakis',
  'spaz',
  'spic',
  'spick',
  'squaw',
  'tard',
  'wog',
  'wogs',
  'kkk',
  'nazi',
  'nazis',
  'neonazi',
] as const;

/** The brand's and the staff's words, refused anywhere in the name with its separators taken out. */
const RESERVED = [
  'cyera',
  'support',
  'staff',
  'official',
  'admin',
  'moderator',
  'anthropic',
  'claude',
] as const;
/** The short reserved words, refused anywhere inside one word only (see the header: Grace Owen). */
const RESERVED_SHORT = ['ceo', 'team'] as const;
/** Ordinary words that hold a reserved one, read past before the reserved list is asked. */
const RESERVED_INNOCENT = /stafford|badminton/gu;

/** A number that is a hate symbol however it is written, and is refused as such. */
const HATE_NUMBERS = ['1488'] as const;

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

/** Unmasked, digit swaps undone, nothing but letters left. */
const fold = (word: string): string =>
  unmask(word)
    .replace(/[0-9]/gu, (d) => SWAPS[d] ?? '')
    .replace(/[^\p{L}]/gu, '');

/**
 * An entry as a pattern that also matches it stretched: each run of a letter may be typed longer,
 * never shorter, so `ass` is a+s{2,} -- "asssss" is refused and "as" is not.
 */
const stretch = (entry: string): string =>
  entry.replace(/(\p{L})\1*/gu, (run, letter: string) =>
    run.length === 1 ? `${letter}+` : `${letter}{${run.length},}`,
  );
const anywhere = (list: readonly string[]): RegExp => new RegExp(list.map(stretch).join('|'), 'u');
const exactly = (list: readonly string[]): RegExp =>
  new RegExp(`^(?:${list.map(stretch).join('|')})$`, 'u');

const IN_NAME = anywhere(ROOTS);
const IN_WORD = anywhere(STEMS);
const AS_WORD = exactly(WORDS);
const RESERVED_IN_NAME = anywhere(RESERVED);
const RESERVED_IN_WORD = anywhere(RESERVED_SHORT);

/** Single letters typed apart, read as the one word they spell: "a s s" is "ass". */
const spellOut = (words: readonly string[]): string[] => {
  const out: string[] = [];
  let spelling = false;
  for (const word of words) {
    if (spelling && word.length === 1) out[out.length - 1] += word;
    else out.push(word);
    spelling = word.length === 1;
  }
  return out;
};

const isBlocked = (name: string): boolean => {
  const words = spellOut(name.split(SEPARATOR).map(fold));
  const whole = words.join('');
  const digits = name.replace(/[^0-9]/gu, '');
  return (
    HATE_NUMBERS.some((n) => digits.includes(n)) ||
    IN_NAME.test(whole) ||
    RESERVED_IN_NAME.test(whole.replace(RESERVED_INNOCENT, '')) ||
    words.some((w) => IN_WORD.test(w) || RESERVED_IN_WORD.test(w)) ||
    [...words, whole].some((w) => AS_WORD.test(w))
  );
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
  const seen = unmask(name);
  if ((name.match(/[0-9]/gu) ?? []).length > MAX_DIGITS || URLISH.test(seen) || MAIL.test(seen))
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
