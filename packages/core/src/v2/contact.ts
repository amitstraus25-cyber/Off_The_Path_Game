/*
 * THE WORK EMAIL A PLAYER GIVES TO POST A SCORE, AND THE CONSENT THAT GOES WITH IT (2026-10-22).
 *
 * The client's decision, in their words: to post a score a player gives a WORK email and ticks a
 * consent line whose only purpose is that Cyera may contact them about this research. Personal
 * providers are refused. Same shape as `checkName` (board.ts): ONE pure function both ends call.
 *
 *   - the SERVER is the authority. `POST /api/score` refuses what this refuses, before the run
 *     token is spent, and stores only the normalised form it returns (apps/api handlers.ts);
 *   - the GAME calls it for a friendly message and to keep Post disabled until the form is valid.
 *     Nothing relies on that.
 *
 * WHAT IS CHECKED, in the order a player would want to hear it:
 *
 *   1. MISSING -- nothing typed, or only whitespace, or not a string at all.
 *   2. INVALID -- the address is not one mail could be delivered to: over 254 characters (the
 *      SMTP path limit less its brackets), a local part over 64, characters outside the ASCII
 *      `atext` set, a dot at either end or two in a row, a domain that is not at least two DNS
 *      labels ending in an alphabetic (or `xn--`) top-level label, an IP literal, or a domain
 *      reserved for testing and documentation (RFC 2606, RFC 6761: `example.*`, `.test`,
 *      `.localhost`, `.invalid`, and the private-use suffixes `.local`, `.internal`, `.lan`,
 *      `.home`, `.corp`). It is a REAL-LOOKING check, not a deliverability one: nothing here looks
 *      the domain up, and it must not -- core is pure, and a DNS lookup per keystroke would hand
 *      every address a player half-types to a resolver.
 *   3. PERSONAL -- a free or disposable provider (`FREE_EMAIL_PROVIDERS` below, the one list).
 *
 * The address is TRIMMED AND LOWER-CASED, both halves. The local part is formally case-sensitive
 * (RFC 5321 section 2.4); no corporate mail system of the last thirty years treats it so, and one
 * spelling per address is what lets the delete path find every row a person asked to remove.
 *
 * NON-ASCII ADDRESSES ARE REFUSED as invalid, including internationalised domains typed in
 * Unicode. The `xn--` form of the same domain passes. That is a narrowing, recorded rather than
 * hidden: an EAI address (RFC 6531) is legal mail, and it is rare enough at work that the
 * confusable-character problem it brings is not worth taking on for a research contact form.
 */

/** RFC 5321's 256-character path, less the two angle brackets around it. */
export const EMAIL_MAX_LENGTH = 254;
/** RFC 5321 section 4.5.3.1.1. */
const LOCAL_MAX_LENGTH = 64;
/** A raw value longer than this is refused before anything is done to it. */
const RAW_MAX = 1024;

/** Why a contact was refused. The game shows one sentence per reason (content `ui.contact`). */
export type ContactRefusal =
  'email-missing' | 'email-invalid' | 'email-personal' | 'consent-missing';
/** Every reason, in the order the checks run. Exported so both ends can enumerate them. */
export const CONTACT_REFUSALS: readonly ContactRefusal[] = [
  'email-missing',
  'email-invalid',
  'email-personal',
  'consent-missing',
];

export type EmailRefusal = Exclude<ContactRefusal, 'consent-missing'>;
export type EmailCheck = { ok: true; email: string } | { ok: false; reason: EmailRefusal };
export type ContactCheck = { ok: true; email: string } | { ok: false; reason: ContactRefusal };

/*
 * THE FREE AND DISPOSABLE PROVIDERS, AS DATA, IN ONE PLACE. Adding a provider is one line here and
 * nothing else; the test file walks every entry from both sides.
 *
 * TWO LISTS, because providers come in two shapes:
 *
 *   - `domains`: an exact domain. The address's domain matches if it IS one of these or is a
 *     subdomain of one (`x.mail.ru`). For providers whose name alone is too ordinary to match on --
 *     `mail.com` but not `mail.mil`, which is the US military's WORK mail; `me.com` but not every
 *     `me.*`; `hey.com`, `qq.com`, `163.com`.
 *   - `brands`: a provider that runs the same free service under many country suffixes
 *     (`yahoo.co.uk`, `hotmail.fr`, `gmx.de`, `yandex.ru`, `proton.me`). It matches when a label
 *     of the domain is the brand and everything after it looks like a public suffix: one or two
 *     labels of two or three letters (`com`, `co.uk`, `com.br`). So `gmail.com.br` is personal and
 *     `gmail.acme.co.uk` -- a company's own subdomain, however unwise -- is not.
 *
 * WHAT THIS IS NOT. It is not a complete list of every webmail service on earth, and a player who
 * wants to give a personal address can register a domain. It stops the obvious, which is the
 * client's ask; the contact is consented research outreach, not an identity check.
 */
export const FREE_EMAIL_PROVIDERS = {
  brands: [
    'gmail',
    'googlemail',
    'hotmail',
    'outlook',
    'live',
    'windowslive',
    'msn',
    'yahoo',
    'ymail',
    'rocketmail',
    'aol',
    'icloud',
    'proton',
    'protonmail',
    'gmx',
    'yandex',
    'zoho',
    'zohomail',
    'tutanota',
    'tutamail',
    'tuta',
    'fastmail',
    'mailinator',
    'yopmail',
    'guerrillamail',
  ],
  domains: [
    // Apple, Microsoft, the big webmail names under one suffix only
    'me.com',
    'mac.com',
    'pm.me',
    'hey.com',
    'mail.com',
    'email.com',
    'usa.com',
    'aim.com',
    'lycos.com',
    'excite.com',
    'inbox.com',
    'hushmail.com',
    'duck.com',
    'startmail.com',
    'runbox.com',
    'posteo.de',
    'posteo.net',
    'mailbox.org',
    'mail2world.com',
    // Russia, Ukraine and the region
    'mail.ru',
    'inbox.ru',
    'list.ru',
    'bk.ru',
    'ya.ru',
    'rambler.ru',
    'ukr.net',
    'i.ua',
    'abv.bg',
    'inbox.lv',
    // China, Korea, India
    'qq.com',
    'foxmail.com',
    '163.com',
    '126.com',
    'yeah.net',
    '139.com',
    '188.com',
    'sina.com',
    'sina.cn',
    'sohu.com',
    'aliyun.com',
    'naver.com',
    'daum.net',
    'hanmail.net',
    'rediffmail.com',
    // Europe
    'mail.de',
    'web.de',
    't-online.de',
    'freenet.de',
    'seznam.cz',
    'wp.pl',
    'o2.pl',
    'interia.pl',
    'onet.pl',
    'libero.it',
    'virgilio.it',
    'laposte.net',
    'orange.fr',
    'wanadoo.fr',
    'free.fr',
    'sfr.fr',
    'btinternet.com',
    'sky.com',
    'virginmedia.com',
    'ntlworld.com',
    'talktalk.net',
    // Israel
    'walla.co.il',
    'walla.com',
    // The Americas and Australia: consumer ISP mail
    'comcast.net',
    'verizon.net',
    'att.net',
    'sbcglobal.net',
    'cox.net',
    'charter.net',
    'earthlink.net',
    'shaw.ca',
    'rogers.com',
    'sympatico.ca',
    'uol.com.br',
    'bol.com.br',
    'terra.com.br',
    'bigpond.com',
    'optusnet.com.au',
    // Disposable inboxes
    'guerrillamail.com',
    'sharklasers.com',
    '10minutemail.com',
    'temp-mail.org',
    'tempmail.com',
    'trashmail.com',
    'getnada.com',
    'maildrop.cc',
    'dispostable.com',
    'throwawaymail.com',
    'mailnesia.com',
    'fakeinbox.com',
    'emailondeck.com',
  ],
} as const;

/** What may follow a brand label: one or two labels of two or three letters, `com` or `co.uk`. */
const PUBLIC_SUFFIX_LIKE = /^[a-z]{2,3}(?:\.[a-z]{2,3})?$/;

const BRANDS: ReadonlySet<string> = new Set(FREE_EMAIL_PROVIDERS.brands);

/**
 * Whether a (lower-case, already valid) domain belongs to a free or disposable provider. Exported
 * for the tests and for anyone who needs the same answer about a domain without an address.
 */
export function isPersonalDomain(domain: string): boolean {
  if (FREE_EMAIL_PROVIDERS.domains.some((d) => domain === d || domain.endsWith(`.${d}`)))
    return true;
  const labels = domain.split('.');
  return labels.some(
    (label, i) => BRANDS.has(label) && PUBLIC_SUFFIX_LIKE.test(labels.slice(i + 1).join('.')),
  );
}

/** RFC 5322 `atext`, ASCII only, lower case (the address is lower-cased first). */
const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
/** One DNS label: letters, digits, hyphens; 1 to 63; no hyphen at either end. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** The top-level label: alphabetic, or an internationalised one in its `xn--` form. */
const TOP = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** Suffixes reserved for testing, documentation and private networks: no work mail lives there. */
const RESERVED_TOPS: ReadonlySet<string> = new Set([
  'test',
  'example',
  'invalid',
  'localhost',
  'local',
  'internal',
  'lan',
  'home',
  'corp',
]);
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

const isRealLookingDomain = (domain: string): boolean => {
  const labels = domain.split('.');
  const top = labels.at(-1)!;
  return (
    labels.length >= 2 &&
    labels.every((label) => LABEL.test(label)) &&
    TOP.test(top) &&
    !RESERVED_TOPS.has(top) &&
    !RESERVED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
  );
};

/** The address as it is stored: trimmed, lower case. Nothing else is changed. */
export const tidyEmail = (raw: string): string => raw.trim().toLowerCase();

/**
 * Whether an address may be given to post a score, and the form it is stored in. Pure; the same
 * answer on both ends of the wire.
 */
export function checkWorkEmail(raw: unknown): EmailCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'email-missing' };
  if (raw.length > RAW_MAX) return { ok: false, reason: 'email-invalid' };
  const email = tidyEmail(raw);
  if (email === '') return { ok: false, reason: 'email-missing' };
  if (email.length > EMAIL_MAX_LENGTH) return { ok: false, reason: 'email-invalid' };

  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (
    at < 1 ||
    local.length > LOCAL_MAX_LENGTH ||
    !LOCAL.test(local) ||
    !isRealLookingDomain(domain)
  )
    return { ok: false, reason: 'email-invalid' };

  if (isPersonalDomain(domain)) return { ok: false, reason: 'email-personal' };
  return { ok: true, email };
}

/**
 * The whole contact: the address first, then the consent. Consent is the literal `true` and
 * nothing else -- not "true", not 1, not a truthy object -- because it is a person's recorded yes.
 */
export function checkContact(email: unknown, consent: unknown): ContactCheck {
  const checked = checkWorkEmail(email);
  if (!checked.ok) return checked;
  if (consent !== true) return { ok: false, reason: 'consent-missing' };
  return checked;
}

/**
 * A consent version's shape: lower-case words joined by hyphens, as `research-contact-v1`. The
 * content file carries the version beside the words it versions (`ui.contact`), and the database
 * checks the same shape (supabase/migrations/0007).
 */
export const CONSENT_VERSION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CONSENT_VERSION_MAX = 64;
