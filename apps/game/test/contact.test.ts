import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rawV2 from '../../../content/game.v2.json';
import { v2 } from '@otp/core';
import { submitRunSchema } from '@otp/api/src/schema.ts';
import { contactMessages, forgetLastPost, submit } from '../src/net/leaderboard';
import { CONTACT_PROBLEM, contactReady, readContact } from '../src/ui/Results';

/*
 * THE WORK EMAIL ON THE GAME'S SIDE OF THE WIRE (the client, 2026-10-22).
 *
 * The server is the authority (apps/api test/work-email.test.ts); what this file holds is that the
 * game asks the same question first, words every answer from the content file, sends the address
 * only when asked to and only in the request body, and sends the body the server's own schema
 * accepts. With no contact, the body is exactly what it was before the flag existed.
 */

const content = v2.loadContent(rawV2);
const words = content.ui.contact;
const messages = contactMessages(words);
const log = v2.toRunLog(
  v2.play(content, 'careful', { seed: 99, pace: { walkMs: 1000, talkMs: 1000 } }).state,
);
const TOKEN = 'cGF5bG9hZA.c2lnbmF0dXJl';
const EMAIL = ' Jane.Doe@Acme.com ';

interface Sent {
  url: string;
  init: RequestInit;
}

function intercept(reply: () => Response): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return Promise.resolve(reply());
  });
  return sent;
}

const ok = (): Response =>
  new Response(JSON.stringify({ handle: 'Little Purple', score: 100 }), { status: 200 });
const bodyOf = (sent: Sent): Record<string, unknown> =>
  JSON.parse(String(sent.init.body)) as Record<string, unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  forgetLastPost();
});

describe('submit, with a contact', () => {
  it('sends the normalised address and the consent with the run, in a body the server accepts', async () => {
    const sent = intercept(ok);
    await submit('Little Purple', log, TOKEN, {}, { email: EMAIL, consent: true, messages });

    const body = bodyOf(sent[0]!);
    expect(Object.keys(body).sort()).toEqual(['consent', 'email', 'handle', 'log', 'token']);
    expect(body['email']).toBe('jane.doe@acme.com');
    expect(body['consent']).toBe(true);
    expect(submitRunSchema.safeParse(body).success, 'the server would refuse this body').toBe(true);
    // Never in a URL, never a header: the body of one POST to our own origin.
    expect(sent[0]!.url).toBe('/api/score');
    expect(JSON.stringify(sent[0]!.init.headers)).not.toContain('jane');
  });

  it('without one, sends exactly the body it sent before the flag existed', async () => {
    const sent = intercept(ok);
    await submit('Little Purple', log, TOKEN, {}, null);
    expect(Object.keys(bodyOf(sent[0]!)).sort()).toEqual(['handle', 'log', 'token']);
  });

  it.each([
    ['', true, 'email-missing'],
    ['jane', true, 'email-invalid'],
    ['jane@gmail.com', true, 'email-personal'],
    [EMAIL, false, 'consent-missing'],
  ] as const)(
    'answers %j / consent %s itself, in the content words, and posts nothing',
    async (email, consent, reason) => {
      const sent = intercept(ok);
      await expect(
        submit('Little Purple', log, TOKEN, {}, { email, consent, messages }),
      ).resolves.toEqual({ key: 'leaderboardRefused', text: messages[reason], reason });
      expect(sent).toHaveLength(0);
    },
  );

  it.each(v2.CONTACT_REFUSALS)('reads a server 422 of %s as that refusal', async (reason) => {
    intercept(() => new Response(JSON.stringify({ error: 'x', reason }), { status: 422 }));
    await expect(
      submit('Little Purple', log, TOKEN, {}, { email: EMAIL, consent: true, messages }),
    ).resolves.toEqual({ key: 'leaderboardRefused', text: messages[reason], reason });
  });

  it('words a contact refusal with a backstop when it was given no sentences, never the address', async () => {
    // The server requires an address this run was never told to ask for (a start from before the
    // flag): the game has no contact to send, and says so without inventing words.
    intercept(
      () => new Response(JSON.stringify({ error: 'x', reason: 'email-missing' }), { status: 422 }),
    );
    const outcome = await submit('Little Purple', log, TOKEN, {});
    expect(outcome).toMatchObject({ key: 'leaderboardRefused', reason: 'email-missing' });
    expect(outcome.text.length).toBeGreaterThan(0);
  });

  it('does not believe a 422 reason it has never heard of', async () => {
    intercept(
      () => new Response(JSON.stringify({ error: 'x', reason: 'email-shiny' }), { status: 422 }),
    );
    const outcome = await submit('Little Purple', log, TOKEN, {});
    expect(outcome).toEqual({ key: 'leaderboardRefused', text: 'That run could not be posted.' });
  });
});

describe('the form, as pure rules', () => {
  it('marks both problems at once, and neither for a work address with the box ticked', () => {
    expect(readContact('', false)).toEqual({ email: 'email-missing', consent: true });
    expect(readContact('jane@gmail.com', true)).toEqual({
      email: 'email-personal',
      consent: false,
    });
    expect(readContact(EMAIL, true)).toEqual({ email: null, consent: false });
  });

  it('is ready only when the core check passes', () => {
    expect(contactReady(EMAIL, true)).toBe(true);
    expect(contactReady(EMAIL, false)).toBe(false);
    expect(contactReady('jane@outlook.com', true)).toBe(false);
  });

  it('has a sentence in the content for every refusal core can give', () => {
    for (const reason of v2.CONTACT_REFUSALS) {
      expect(words[CONTACT_PROBLEM[reason]], reason).toBeTruthy();
      expect(messages[reason]).toBe(words[CONTACT_PROBLEM[reason]]);
    }
  });
});

describe('the address is never kept or shown', () => {
  const src = (path: string): string =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

  it('is written to no storage and no log by the screen or the adapter', () => {
    for (const path of ['ui/Results.tsx', 'net/leaderboard.ts', 'main.ts']) {
      const text = src(path);
      expect(text, path).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
      // No console line anywhere near the address.
      expect(text.match(/console\.\w+\([^)]*email/gi) ?? [], path).toEqual([]);
    }
  });

  it('asks the browser for an email field: type, autocomplete and a real label', () => {
    const results = src('ui/Results.tsx');
    expect(results).toContain('type="email"');
    expect(results).toContain('autocomplete="email"');
    expect(results).toContain('<label class="otp-email" for="otp-email-input">');
    expect(results).toContain('id="otp-email-input"');
    expect(results).toContain('type="checkbox"');
    expect(results).toContain('<label class="otp-consent" for="otp-consent-box">');
  });
});
