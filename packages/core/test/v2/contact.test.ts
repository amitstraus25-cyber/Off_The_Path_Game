import { describe, expect, it } from 'vitest';
import raw from '../../../../content/game.v2.json';
import {
  CONSENT_VERSION_PATTERN,
  CONTACT_REFUSALS,
  EMAIL_MAX_LENGTH,
  FREE_EMAIL_PROVIDERS,
  checkContact,
  checkWorkEmail,
  isPersonalDomain,
  tidyEmail,
} from '../../src/v2/contact.ts';
import type { ContactRefusal } from '../../src/v2/contact.ts';
import { parseContent } from '../../src/v2/load.ts';

/*
 * THE WORK EMAIL, FENCED (contact.ts). Every rule from both sides: what it refuses, and the
 * ordinary work addresses it must let through. A work-email check that refuses `amit.straus@
 * cyera.io` is a worse defect than one that lets a personal address in, because the first loses a
 * score and the second only loses a lead.
 */

const refused = (email: unknown): ContactRefusal | null => {
  const c = checkWorkEmail(email);
  return c.ok ? null : c.reason;
};

describe('an address is tidied into one spelling', () => {
  it('trims and lower-cases both halves, and changes nothing else', () => {
    expect(tidyEmail('  Amit.Straus@Cyera.IO \t')).toBe('amit.straus@cyera.io');
    expect(checkWorkEmail(' Jane.Doe+Research@ACME.co.uk ')).toEqual({
      ok: true,
      email: 'jane.doe+research@acme.co.uk',
    });
  });
});

describe('ordinary work addresses pass', () => {
  it.each([
    'amit.straus@cyera.io',
    'a@b.co',
    "o'brien@law-firm.ie",
    'first_last@sub.dept.example-corp.com',
    'it-security@bank.com.au',
    'ops@xn--bcher-kva.ch',
    'x!#$%&*+/=?^_`{|}~-y@acme.com',
    // A brand word inside a company's own domain is not the provider.
    'me@livenation.com',
    'ceo@gmail.acme.co.uk',
    'ops@outlook-partners.com',
    // `mail.mil` is the US military's WORK mail; only `mail.com`, `mail.ru` and `mail.de` are free.
    'officer@mail.mil',
    'staff@mail.acme.com',
  ])('%s', (email) => {
    expect(checkWorkEmail(email)).toEqual({ ok: true, email });
  });

  it('takes the longest legal address and refuses one character more', () => {
    const local = 'l'.repeat(64);
    const domain = `${'d'.repeat(63)}.${'e'.repeat(63)}.${'f'.repeat(57)}.com`;
    const longest = `${local}@${domain}`;
    expect(longest).toHaveLength(EMAIL_MAX_LENGTH);
    expect(refused(longest)).toBeNull();
    expect(refused(`${local}@x${domain}`)).toBe('email-invalid');
  });
});

describe('missing', () => {
  it.each([undefined, null, 42, true, {}, '', '   ', '\t\n'])('%j', (email) => {
    expect(refused(email)).toBe('email-missing');
  });
});

describe('invalid', () => {
  it.each([
    ['no at sign', 'amit.cyera.io'],
    ['nothing before the at', '@cyera.io'],
    ['nothing after the at', 'amit@'],
    ['two at signs', 'amit@straus@cyera.io'],
    ['a space inside', 'amit straus@cyera.io'],
    ['a leading dot', '.amit@cyera.io'],
    ['a trailing dot', 'amit.@cyera.io'],
    ['two dots in a row', 'amit..straus@cyera.io'],
    ['a quoted local part', '"amit"@cyera.io'],
    ['non-ascii local part', 'amít@cyera.io'],
    ['a one-label domain', 'amit@localhost'],
    ['a numeric top label', 'amit@cyera.123'],
    ['an IP literal', 'amit@[192.168.0.1]'],
    ['a bare IP', 'amit@192.168.0.1'],
    ['a label starting with a hyphen', 'amit@-cyera.io'],
    ['a label ending with a hyphen', 'amit@cyera-.io'],
    ['an empty label', 'amit@cyera..io'],
    ['a one-letter top label', 'amit@cyera.i'],
    ['a Unicode domain', 'amit@bücher.ch'],
    ['an underscore in the domain', 'amit@cy_era.io'],
    ['a local part of 65', `${'l'.repeat(65)}@cyera.io`],
    ['an angle-bracketed address', '<amit@cyera.io>'],
    ['a display name', 'Amit <amit@cyera.io>'],
    ['a control character', 'amit\u0000@cyera.io'],
    ['a newline in the middle', 'amit\n@cyera.io'],
  ])('%s', (_why, email) => {
    expect(refused(email)).toBe('email-invalid');
  });

  it.each(['test', 'example', 'invalid', 'localhost', 'local', 'internal', 'lan', 'home', 'corp'])(
    'a reserved top label: .%s',
    (top) => {
      expect(refused(`amit@acme.${top}`)).toBe('email-invalid');
    },
  );

  it.each(['amit@example.com', 'amit@example.net', 'amit@example.org', 'amit@mx.example.com'])(
    'a documentation domain: %s',
    (email) => {
      expect(refused(email)).toBe('email-invalid');
    },
  );

  it('refuses a raw value over a kilobyte before tidying it', () => {
    expect(refused(`${' '.repeat(1025)}a@acme.com`)).toBe('email-invalid');
    // Padding under the raw cap is trimmed away and the address inside it is fine.
    expect(refused(`${' '.repeat(1000)}a@acme.com`)).toBeNull();
  });
});

describe('personal: free and disposable providers', () => {
  // The client's list, by name. Each must be refused on its own, so no entry hides behind another.
  it.each([
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'yahoo.com',
    'ymail.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
    'pm.me',
    'gmx.com',
    'gmx.de',
    'mail.com',
    'yandex.ru',
    'yandex.com',
    'mail.ru',
    'zoho.com',
    'tutanota.com',
    'fastmail.com',
    'hey.com',
    'qq.com',
    '163.com',
    '126.com',
    'naver.com',
  ])('%s', (domain) => {
    expect(refused(`someone@${domain}`)).toBe('email-personal');
  });

  it.each([
    'yahoo.co.uk',
    'yahoo.co.jp',
    'yahoo.com.br',
    'hotmail.fr',
    'hotmail.co.uk',
    'outlook.de',
    'outlook.com.au',
    'live.co.za',
    'gmx.net',
    'protonmail.ch',
    'tuta.io',
    'fastmail.fm',
    'GMAIL.COM',
  ])('a brand under another country suffix: %s', (domain) => {
    expect(refused(`someone@${domain}`)).toBe('email-personal');
  });

  it('refuses a subdomain of a listed domain', () => {
    expect(refused('someone@eu.mail.ru')).toBe('email-personal');
    expect(refused('someone@x.mailinator.com')).toBe('email-personal');
  });

  it('refuses every entry on the list, so a typo in it cannot pass silently', () => {
    for (const domain of FREE_EMAIL_PROVIDERS.domains)
      expect(isPersonalDomain(domain), domain).toBe(true);
    for (const brand of FREE_EMAIL_PROVIDERS.brands) {
      expect(isPersonalDomain(`${brand}.com`), brand).toBe(true);
      expect(isPersonalDomain(`${brand}.co.uk`), brand).toBe(true);
    }
  });

  it('keeps the list free of duplicates, lower case, and every domain a valid address domain', () => {
    const { brands, domains } = FREE_EMAIL_PROVIDERS;
    expect(new Set(brands).size).toBe(brands.length);
    expect(new Set(domains).size).toBe(domains.length);
    for (const brand of brands) expect(brand).toMatch(/^[a-z0-9]+$/);
    // A listed domain that is not itself valid could never be matched: it is dead weight.
    for (const domain of domains)
      expect(checkWorkEmail(`x@${domain}`), domain).toEqual({
        ok: false,
        reason: 'email-personal',
      });
  });

  it('does not take a brand followed by more than a public-suffix-shaped tail', () => {
    expect(isPersonalDomain('gmail.acme.com')).toBe(false);
    expect(isPersonalDomain('yahoo.example-corp.co.uk')).toBe(false);
    expect(isPersonalDomain('acme.com')).toBe(false);
  });

  it('answers personal before checking consent, and invalid before personal', () => {
    expect(refused('not an address@gmail.com')).toBe('email-invalid');
    expect(checkContact('someone@gmail.com', false)).toEqual({
      ok: false,
      reason: 'email-personal',
    });
  });
});

describe('the consent', () => {
  it('is the literal true and nothing else', () => {
    expect(checkContact('amit@cyera.io', true)).toEqual({ ok: true, email: 'amit@cyera.io' });
    for (const consent of [false, undefined, null, 'true', 1, {}, []])
      expect(checkContact('amit@cyera.io', consent), JSON.stringify(consent)).toEqual({
        ok: false,
        reason: 'consent-missing',
      });
  });

  it('is asked about after the address, so a player fixes one thing at a time', () => {
    expect(checkContact('', false)).toEqual({ ok: false, reason: 'email-missing' });
    expect(checkContact('nope', false)).toEqual({ ok: false, reason: 'email-invalid' });
  });

  it('names every refusal, in the order the checks run', () => {
    expect(CONTACT_REFUSALS).toEqual([
      'email-missing',
      'email-invalid',
      'email-personal',
      'consent-missing',
    ]);
  });
});

/*
 * THE CONSENT WORDING IS PINNED TO ITS VERSION. The server stores `consentVersion` beside every
 * address as the record of WHAT the person agreed to, so the words a version names may never
 * change under it. Change the wording and this fails until the version is bumped AND the new
 * pair is added here -- and docs/DATABASE.md's table of versions, which is where Legal reads them.
 * The old entries stay: rows stored under them still mean those words.
 */
const CONSENT_WORDING: Record<string, string> = {
  'research-contact-v1': 'Cyera may contact me about this research.',
};

describe('the shipped consent', () => {
  const content = parseContent(raw);

  it('says exactly the words its version was recorded with', () => {
    const { consentVersion, consent } = content.ui.contact;
    expect(CONSENT_WORDING[consentVersion], `no recorded wording for ${consentVersion}`).toBe(
      consent,
    );
  });

  it('has a version the database will accept', () => {
    expect(content.ui.contact.consentVersion).toMatch(CONSENT_VERSION_PATTERN);
  });

  it('is refused by the schema when its version is not a slug', () => {
    const bad = structuredClone(raw);
    bad.ui.contact.consentVersion = 'Research Contact v1';
    expect(() => parseContent(bad)).toThrow();
  });

  it("swaps chrome's privacy line for one that does not say 'no email'", () => {
    // Shown only while the email is asked for: the flag-off line says "no email", and would lie.
    expect(content.ui.chrome.privacyLine).toMatch(/no email/i);
    expect(content.ui.contact.privacy).not.toMatch(/no email/i);
    expect(content.ui.contact.privacy).toMatch(/never shown/i);
    expect(content.ui.contact.emailHint).toMatch(/never shown on the board/i);
  });
});
