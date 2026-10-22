import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleScore, handleStart, handleTop } from '../src/handlers.ts';
import { readWorkEmailFlag } from '../src/env.ts';
import { createStore } from '../src/store.ts';
import {
  CONFIG,
  CONTACT_RPC,
  contactCallsOf,
  functionTrue,
  harness,
  insertsOf,
  jsonResponse,
  postScore,
  table,
  ticketed,
  unreadable,
} from './fake.ts';
import type { Call, ContactArgs } from './fake.ts';
import { content } from './helpers.ts';

/*
 * THE WORK EMAIL (the client's decision, 2026-10-22), as the security boundary sees it.
 *
 * Four properties, each tested from both sides:
 *
 *   1. THE FLAG. OTP_WORK_EMAIL off is today's board exactly: the email fields of a post are not
 *      read and reach neither the table nor a log. On, a post must carry a work email and the
 *      consent, or it is refused with a reason -- before the run token is spent.
 *   2. THE WRITE IS ONE TRANSACTION. The score and its address go in through one function call
 *      (migration 0007) or not at all: a failed contact write is a failed post with no score row.
 *   3. THE ADDRESS NEVER COMES BACK. Not in any response body, not in any log line, not in a URL,
 *      and `GET /api/top` cannot reach the table it is in.
 *   4. THE CONSENT VERSION IS THE SERVER'S, read from its own copy of the content.
 */

const EMAIL = 'Jane.Doe@Acme-Research.com ';
const STORED = 'jane.doe@acme-research.com';
const VERSION = content.ui.contact.consentVersion;

/** Every console line the service wrote during a test. */
let logged: string[] = [];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Neither spelling of the address anywhere in this text. */
const expectNoAddress = (text: string, where: string): void => {
  expect(text.toLowerCase(), where).not.toContain(STORED);
  expect(text.toLowerCase(), where).not.toContain('jane.doe');
};

/** Everything the service said back and wrote down, as text. */
const everythingSaid = async (res: Response): Promise<string> =>
  [await res.clone().text(), JSON.stringify([...res.headers]), ...logged].join('\n');

describe('OTP_WORK_EMAIL', () => {
  it('is on only when it is exactly "required"', () => {
    expect(readWorkEmailFlag({ OTP_WORK_EMAIL: 'required' })).toEqual({ required: true });
  });

  it('is off, silently, when it is unset or empty: the default is today', () => {
    expect(readWorkEmailFlag({})).toEqual({ required: false });
    expect(readWorkEmailFlag({ OTP_WORK_EMAIL: '' })).toEqual({ required: false });
  });

  it('is off, and says so by name, for any other spelling -- a typo fails closed', () => {
    for (const value of ['Required', 'required ', ' required', 'true', '1', 'on', 'REQUIRED']) {
      const flag = readWorkEmailFlag({ OTP_WORK_EMAIL: value });
      expect(flag.required, JSON.stringify(value)).toBe(false);
      expect(flag.reason).toContain('OTP_WORK_EMAIL');
      // The value is not echoed: nothing read from the environment goes into a log line.
      if (value.trim() !== 'required') expect(flag.reason).not.toContain(value);
    }
  });
});

describe('with the flag OFF: exactly today', () => {
  it('ignores an email and a consent the post carries: neither reaches the table, a URL, or a log', async () => {
    const h = harness();
    const res = await handleScore(
      postScore({ ...ticketed(h.clock), email: EMAIL, consent: true }),
      h.deps,
    );

    expect(res.status).toBe(200);
    // The ordinary insert, two keys, and no call to the contact function at all.
    expect(insertsOf(h.calls)).toHaveLength(1);
    expect(new URL(h.inserts()[0]!.url).pathname).toBe('/rest/v1/leaderboard');
    expect(JSON.parse(String(h.inserts()[0]!.init.body))).toEqual([
      { handle: 'brave-lantern-42', score: 100 },
    ]);
    expect(contactCallsOf(h.calls)).toHaveLength(0);
    expectNoAddress(JSON.stringify(h.calls), 'requests to the database');
    expectNoAddress(await everythingSaid(res), 'the response and the log');
  });

  it('does not read the fields at all: an address it would refuse is not a refusal', async () => {
    const h = harness();
    const res = await handleScore(
      postScore({ ...ticketed(h.clock), email: 'someone@gmail.com', consent: false }),
      h.deps,
    );
    expect(res.status).toBe(200);
    expect(contactCallsOf(h.calls)).toHaveLength(0);
  });

  it('posts a body with no email fields, as every game before this one sends', async () => {
    const h = harness();
    const res = await handleScore(postScore(ticketed(h.clock)), h.deps);
    expect(res.status).toBe(200);
    expect(h.written()).toEqual({ handle: 'brave-lantern-42', score: 100 });
  });
});

describe('with the flag ON: a work email and the consent, or no post', () => {
  const on = (reply?: (call: Call) => Response) => harness(reply, { emailRequired: true });

  it('writes the score and the address in ONE call to the function, and never the plain insert', async () => {
    const rows: { handle: string; score: number }[] = [];
    const contacts: ContactArgs[] = [];
    const h = on(table(rows, contacts));

    const res = await handleScore(
      postScore({ ...ticketed(h.clock), email: EMAIL, consent: true }),
      h.deps,
    );

    expect(res.status).toBe(200);
    const writes = insertsOf(h.calls);
    expect(writes).toHaveLength(1);
    expect(new URL(writes[0]!.url).pathname).toBe(CONTACT_RPC);
    // The four named arguments: the tidy name, the recomputed score, the NORMALISED address, and
    // the consent version from this service's own content.
    expect(h.contacts()).toEqual([
      {
        p_handle: 'brave-lantern-42',
        p_score: 100,
        p_email: STORED,
        p_consent_version: VERSION,
      },
    ]);
    expect(VERSION).toBe('research-contact-v1');
    // Both rows landed, together.
    expect(rows).toEqual([{ handle: 'brave-lantern-42', score: 100 }]);
    expect(contacts).toHaveLength(1);
  });

  it('answers exactly what it answers with the flag off: a handle, a score, a rank, the board', async () => {
    const h = on();
    const res = await handleScore(
      postScore({ ...ticketed(h.clock), email: EMAIL, consent: true }),
      h.deps,
    );
    await expect(res.clone().json()).resolves.toEqual({
      handle: 'brave-lantern-42',
      score: 100,
      rank: 1,
      entries: [{ rank: 1, handle: 'brave-lantern-42', score: 100 }],
    });
    expectNoAddress(await everythingSaid(res), 'the response and the log');
  });

  it('sends the address in the body of a POST, never in a URL, with the key in headers only', async () => {
    const h = on();
    await handleScore(postScore({ ...ticketed(h.clock), email: EMAIL, consent: true }), h.deps);
    for (const call of h.calls) {
      expectNoAddress(call.url, `the URL of a ${String(call.init.method)}`);
      expect(call.url).not.toContain(CONFIG.serviceRoleKey);
    }
    const rpc = contactCallsOf(h.calls)[0]!;
    expect(rpc.init.method).toBe('POST');
    expect(String(rpc.init.body)).toContain(STORED);
    expect((rpc.init.headers as Record<string, string>)['apikey']).toBe(CONFIG.serviceRoleKey);
  });

  it('takes the consent version from its own content, and refuses a body that names one', async () => {
    const h = on();
    const res = await handleScore(
      postScore({ ...ticketed(h.clock), email: EMAIL, consent: true, consentVersion: 'v999' }),
      h.deps,
    );
    // The body schema is strict: a version is not the caller's to say.
    expect(res.status).toBe(400);
    expect(h.calls).toHaveLength(0);
  });

  describe('refuses, with a reason, before anything is spent', () => {
    const cases: [string, Record<string, unknown>, string][] = [
      ['no email at all', { consent: true }, 'email-missing'],
      ['an empty email', { email: '   ', consent: true }, 'email-missing'],
      ['an address that is not one', { email: 'jane.doe at acme', consent: true }, 'email-invalid'],
      ['a documentation domain', { email: 'jane.doe@example.com', consent: true }, 'email-invalid'],
      ['a personal address', { email: 'jane.doe@gmail.com', consent: true }, 'email-personal'],
      [
        'a disposable address',
        { email: 'jane.doe@mailinator.com', consent: true },
        'email-personal',
      ],
      ['no consent', { email: EMAIL }, 'consent-missing'],
      ['consent refused', { email: EMAIL, consent: false }, 'consent-missing'],
    ];

    it.each(cases)('%s', async (_why, extra, reason) => {
      const h = on();
      const run = ticketed(h.clock);
      const res = await handleScore(postScore({ ...run, ...extra }), h.deps);

      expect(res.status).toBe(422);
      const body = (await res.clone().json()) as { error: string; reason: string };
      expect(body.reason).toBe(reason);
      expect(Object.keys(body).sort()).toEqual(['error', 'reason']);
      // Nothing reached the database, and nothing of the address came back or was written down.
      expect(h.calls).toHaveLength(0);
      expectNoAddress(await everythingSaid(res), 'the refusal and the log');

      // The token was not spent: the same run posts once the player fixes it.
      const fixed = await handleScore(postScore({ ...run, email: EMAIL, consent: true }), h.deps);
      expect(fixed.status).toBe(200);
    });

    it('a consent that is the string "true" is a malformed body, not a yes', async () => {
      const h = on();
      const res = await handleScore(
        postScore({ ...ticketed(h.clock), email: EMAIL, consent: 'true' }),
        h.deps,
      );
      expect(res.status).toBe(400);
      expect(h.calls).toHaveLength(0);
    });

    it('a name refusal is still answered first, so the player hears one thing at a time', async () => {
      const h = on();
      const res = await handleScore(
        postScore({ ...ticketed(h.clock, { handle: 'cyera-admin-42' }), email: 'x@gmail.com' }),
        h.deps,
      );
      await expect(res.json()).resolves.toMatchObject({ reason: 'name' });
    });
  });

  describe('the write is one transaction: no score without its email', () => {
    const post = async (reply: (call: Call) => Response) => {
      const h = on(reply);
      const run = ticketed(h.clock);
      const res = await handleScore(postScore({ ...run, email: EMAIL, consent: true }), h.deps);
      return { h, run, res };
    };

    it('a refused contact write is a 503, with no second write of the score on its own', async () => {
      const { h, res } = await post(() =>
        jsonResponse(
          {
            code: '23514',
            message: `new row violates check constraint for ${STORED}`,
            details: `Failing row contains (1, 2, ${STORED}, research-contact-v1, now).`,
            hint: STORED,
          },
          400,
        ),
      );

      expect(res.status).toBe(503);
      await expect(res.clone().json()).resolves.toEqual({
        error: 'the leaderboard is unavailable',
      });
      // One call, to the function. The service did not fall back to writing the score alone.
      expect(h.calls).toHaveLength(1);
      expect(new URL(h.calls[0]!.url).pathname).toBe(CONTACT_RPC);
      // The failure is diagnosable by its code, and the address quoted in every field is not logged.
      expect(logged.join('\n')).toContain('23514');
      expectNoAddress(await everythingSaid(res), 'the 503 and the log');
    });

    it('releases the token when the transaction fails, so the retry writes both rows', async () => {
      let n = 0;
      const rows: { handle: string; score: number }[] = [];
      const contacts: ContactArgs[] = [];
      const ok = table(rows, contacts);
      const h = on((call) => (n++ === 0 ? new Response('', { status: 503 }) : ok(call)));
      const run = ticketed(h.clock);

      expect(
        (await handleScore(postScore({ ...run, email: EMAIL, consent: true }), h.deps)).status,
      ).toBe(503);
      expect(rows).toHaveLength(0);
      expect(
        (await handleScore(postScore({ ...run, email: EMAIL, consent: true }), h.deps)).status,
      ).toBe(200);
      expect(rows).toHaveLength(1);
      expect(contacts).toHaveLength(1);
    });

    it.each([
      ['the function is missing (schema cache)', () => jsonResponse({ code: 'PGRST202' }, 404)],
      ['the key may not execute it', () => jsonResponse({ code: '42501', message: 'no' }, 403)],
      [
        'a 200 with no body',
        () => new Response('', { status: 200, headers: { 'content-type': 'application/json' } }),
      ],
      ['a 200 of null', () => jsonResponse(null)],
      ['a 200 of false', () => jsonResponse(false)],
      ['a 200 of a row', () => jsonResponse([{ id: 1 }])],
      [
        'a 200 page of HTML',
        () =>
          new Response('<html>true</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ],
      ['a 200 with no content type', () => new Response('true', { status: 200 })],
      ['a 201, as a plain insert answers', () => new Response(null, { status: 201 })],
      [
        'a 200 whose body never arrives',
        () => {
          const r = unreadable(200);
          r.headers.set('content-type', 'application/json');
          return r;
        },
      ],
      ['a refusal whose body never arrives', () => unreadable(500)],
      ['a refusal with an HTML body', () => new Response('<h1>paused</h1>', { status: 540 })],
      ['a refusal whose code is not a code', () => jsonResponse({ code: STORED }, 400)],
    ])('%s: a 503, and no address in the log', async (_why, reply) => {
      const { res } = await post(reply);
      expect(res.status).toBe(503);
      expectNoAddress(await everythingSaid(res), 'the 503 and the log');
    });

    it('logs the code of a refusal, and only when it is shaped like one', async () => {
      await post(() => jsonResponse({ code: 'PGRST202', message: `quoting ${STORED}` }, 404));
      expect(logged.join('\n')).toContain('contact write refused with 404: PGRST202');
      logged = [];
      await post(() => jsonResponse({ code: STORED }, 400));
      expect(logged.join('\n')).toContain('contact write refused with 400: no error code');
      logged = [];
      await post(() => new Response('<h1>paused</h1>', { status: 540 }));
      expect(logged.join('\n')).toContain('no PostgREST error body');
    });

    it('believes the function only on 200, JSON, and a body of exactly true', async () => {
      const { res } = await post(() => functionTrue());
      expect(res.status).toBe(200);
      const spaced = await post(
        () =>
          new Response(' true\n', {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
      );
      expect(spaced.res.status).toBe(200);
    });
  });
});

describe('the store will not send an address in any form but the one the table takes', () => {
  const store = (calls: Call[]) =>
    createStore(CONFIG, (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(functionTrue());
    });
  const row = { handle: 'brave-lantern-42', score: 100 };

  it.each([
    ['not normalised', { email: EMAIL, consentVersion: VERSION }, 'normalised work email'],
    ['personal', { email: 'jane@gmail.com', consentVersion: VERSION }, 'normalised work email'],
    ['not an address', { email: 'jane', consentVersion: VERSION }, 'normalised work email'],
    ['a version that is not a slug', { email: STORED, consentVersion: 'V 1' }, 'consent version'],
  ])('%s', async (_why, contact, message) => {
    const calls: Call[] = [];
    const attempt = store(calls).addWithContact(row, contact);
    await expect(attempt).rejects.toThrow(message);
    await attempt.catch((err: Error) => expectNoAddress(err.message, 'the error'));
    expect(calls).toHaveLength(0);
  });

  it('refuses a name or a score the board refuses, as the plain insert does', async () => {
    const calls: Call[] = [];
    const contact = { email: STORED, consentVersion: VERSION };
    await expect(
      store(calls).addWithContact({ handle: 'Bad<Name>', score: 1 }, contact),
    ).rejects.toThrow('name');
    await expect(
      store(calls).addWithContact({ handle: 'brave-lantern-42', score: 1.5 }, contact),
    ).rejects.toThrow('whole number');
    await expect(
      store(calls).addWithContact({ handle: 'brave-lantern-42', score: -1 }, contact),
    ).rejects.toThrow('whole number');
    expect(calls).toHaveLength(0);
  });

  it('sends exactly the four named arguments, as JSON, to the function and nowhere else', async () => {
    const calls: Call[] = [];
    await store(calls).addWithContact(row, { email: STORED, consentVersion: VERSION });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${CONFIG.url}${CONTACT_RPC}`);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['authorization']).toBe(`Bearer ${CONFIG.serviceRoleKey}`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      p_handle: 'brave-lantern-42',
      p_score: 100,
      p_email: STORED,
      p_consent_version: VERSION,
    });
  });
});

describe('the board cannot reach the addresses', () => {
  it('GET /api/top asks the leaderboard table and nothing else, with the flag on', async () => {
    const h = harness(table([{ handle: 'brave-lantern-42', score: 100 }]), { emailRequired: true });
    const res = await handleTop(new Request('https://off-the-path.test/api/top'), h.deps);
    expect(res.status).toBe(200);
    expect(h.calls.map((c) => new URL(c.url).pathname)).toEqual(['/rest/v1/leaderboard']);
    expect(Object.keys(((await res.json()) as { entries: object[] }).entries[0]!).sort()).toEqual([
      'handle',
      'rank',
      'score',
    ]);
  });

  it('no request this service can build names the contact table: it writes through the function only', () => {
    // A source guard, because the property is "there is no code path", which no runtime test of
    // the paths that exist can show. The service role also holds no privilege on that table
    // (migration 0007), so a path added here would 401 -- this makes it fail in CI first.
    const src = readFileSync(new URL('../src/store.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/rest\/v1\/leaderboard_contact/);
    const paths = [...src.matchAll(/'(\/rest\/v1\/[^']*)'/g)].map((m) => m[1]);
    expect(paths.sort()).toEqual([
      '/rest/v1/leaderboard',
      '/rest/v1/rpc/leaderboard_post_with_contact',
    ]);
  });

  it('the start tells the game what to ask for, and nothing about anyone', async () => {
    const h = harness(undefined, { emailRequired: true });
    const res = handleStart(
      new Request('https://off-the-path.test/api/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      h.deps,
    );
    expect(Object.keys((await res.json()) as object).sort()).toEqual([
      'emailRequired',
      'seed',
      'token',
    ]);
    expect(h.calls).toHaveLength(0);
  });
});
