import { describe, expect, it } from 'vitest';
import { readStoreConfig } from '../src/env.ts';
import { BOARD_SINCE } from '../src/store.ts';
import { CONFIG, created, harness, jsonResponse, unreadable } from './fake.ts';

/*
 * The adapter over PostgREST, and the environment it reads.
 *
 * The service role key bypasses row-level security, which is what makes an RLS-on-no-policies
 * table work at all. The assertions about where that key may and may not appear are the point of
 * this file.
 */

describe('the service role key', () => {
  it('travels in headers and never in the URL', async () => {
    // Answered per method now that the insert checks what came back: a 200 with a JSON array is
    // what the SELECT gets, and it is not an answer the insert believes.
    const h = harness((call) => (call.init.method === 'POST' ? created() : jsonResponse([])));
    await h.store.add({ handle: 'brave-lantern-42', score: 500 });
    await h.store.top(10);

    expect(h.calls).toHaveLength(2);
    for (const call of h.calls) {
      expect(call.url).not.toContain(CONFIG.serviceRoleKey);
      // PostgREST accepts `?apikey=`; a key in a query string is a key in every log on the way.
      expect(call.url).not.toContain('apikey=');
      const headers = call.init.headers as Record<string, string>;
      expect(headers['apikey']).toBe(CONFIG.serviceRoleKey);
      expect(headers['authorization']).toBe(`Bearer ${CONFIG.serviceRoleKey}`);
    }
  });

  it('is read from the two variables this service is allowed to read', () => {
    const result = readStoreConfig({
      SUPABASE_URL: ' https://project-ref.supabase.co/ ',
      SUPABASE_SERVICE_ROLE_KEY: ' key ',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'never',
      POSTGRES_PASSWORD: 'never',
    });
    expect(result).toEqual({
      ok: true,
      config: { url: 'https://project-ref.supabase.co', serviceRoleKey: 'key' },
    });
  });

  it('keeps the origin and nothing after it', () => {
    // `https://evil.example/x/../` passed a prefix test and was then concatenated into the request
    // path. `new URL(...).origin` is the host alone, so a path cannot ride along in the variable.
    const result = readStoreConfig({
      SUPABASE_URL: 'https://project-ref.supabase.co/x/../',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    expect(result.ok && result.config.url).toBe('https://project-ref.supabase.co');
  });

  it('refuses a configuration that would send it somewhere it should not go', () => {
    const secret = 'sbp-pretend-secret';
    const cases: [Record<string, string | undefined>, string][] = [
      [{ SUPABASE_SERVICE_ROLE_KEY: secret }, 'SUPABASE_URL is not set'],
      [{ SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: secret }, 'SUPABASE_URL is not set'],
      [{ SUPABASE_URL: 'https://p.supabase.co' }, 'SUPABASE_SERVICE_ROLE_KEY is not set'],
      [
        { SUPABASE_URL: 'http://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL is not https',
      ],
      // Parsed, not prefix-matched. A string test for `https://` took all four of these.
      [
        { SUPABASE_URL: 'https://', SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL is not a URL',
      ],
      [
        { SUPABASE_URL: `https://user:${secret}@p.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL carries credentials',
      ],
      [
        { SUPABASE_URL: 'https://p.supabase.co/rest/v1', SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL is not a bare origin',
      ],
      [
        { SUPABASE_URL: 'https://p.supabase.co/?apikey=leak', SUPABASE_SERVICE_ROLE_KEY: secret },
        'SUPABASE_URL is not a bare origin',
      ],
    ];
    for (const [env, reason] of cases) {
      const result = readStoreConfig(env);
      expect(result.ok, reason).toBe(false);
      expect(result.ok === false && result.reason).toBe(reason);
      // Whatever went wrong, the reason names variables and never values.
      expect(result.ok === false && result.reason).not.toContain(secret);
    }
  });
});

describe('the table adapter', () => {
  it('writes exactly one row, of exactly two columns', async () => {
    const h = harness();
    await h.store.add({ handle: 'brave-lantern-42', score: 500 });

    expect(h.calls[0]?.url).toBe('https://project-ref.supabase.co/rest/v1/leaderboard');
    expect(h.calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(h.calls[0]?.init.body))).toEqual([
      { handle: 'brave-lantern-42', score: 500 },
    ]);
    // Handle and score only (CLAUDE.md): no run id, no duration, no address, nothing else.
    expect(Object.keys(JSON.parse(String(h.calls[0]?.init.body))[0] as object)).toEqual([
      'handle',
      'score',
    ]);
  });

  it('refuses to write a row the game could not have produced, before the network', async () => {
    const h = harness();
    await expect(h.store.add({ handle: '<b>wolf</b>', score: 10 })).rejects.toThrow();
    // Only the tidy form the board stores: the handler tidies, and this refuses anything it missed.
    await expect(h.store.add({ handle: ' Amit', score: 10 })).rejects.toThrow();
    await expect(h.store.add({ handle: 'sh1t', score: 10 })).rejects.toThrow();
    await expect(h.store.add({ handle: 'brave-lantern-42', score: -1 })).rejects.toThrow();
    await expect(h.store.add({ handle: 'brave-lantern-42', score: 1.5 })).rejects.toThrow();
    expect(h.calls).toHaveLength(0);
  });

  it('throws rather than inventing a board when the table answers oddly', async () => {
    await expect(harness(() => new Response('', { status: 503 })).store.top(5)).rejects.toThrow();
    await expect(harness(() => jsonResponse('not rows')).store.top(5)).rejects.toThrow();
    await expect(
      harness(() => jsonResponse([{ handle: 'brave-lantern-42' }])).store.top(5),
    ).rejects.toThrow();
  });

  it('asks for the two columns it renders and no others', async () => {
    const h = harness(() => jsonResponse([]));
    await h.store.top(7);
    expect(h.calls[0]?.url).toContain('select=handle%2Cscore');
    // Four pages asked for, one page served: the filter below runs after the table's own limit,
    // so it needs rows to fall through to. See the comment on `top`.
    expect(h.calls[0]?.url).toContain('limit=28');
  });

  it('reads only rows scored by the speed rule, so no older run outranks one that had to be fast', async () => {
    const h = harness(() => jsonResponse([]));
    await h.store.top(7);
    const asked = new URL(h.calls[0]!.url);
    expect(asked.searchParams.get('created_at')).toBe(`gte.${BOARD_SINCE}`);
    // Later than the v2 launch it replaced, so the v1 rows out of 1,000 stay out too.
    expect(Date.parse(BOARD_SINCE)).toBeGreaterThan(Date.parse('2026-10-21T23:45:00Z'));
    // And after the push that shipped rules 3, so no run from before the river is ranked.
    expect(Date.parse(BOARD_SINCE)).toBeGreaterThan(Date.parse('2026-10-25T22:44:44Z'));
  });

  it('reads no zero: the wolf runs written before they stopped being posted stay off the board', async () => {
    const h = harness(() => jsonResponse([]));
    await h.store.top(7);
    expect(new URL(h.calls[0]!.url).searchParams.get('score')).toBe('gt.0');
  });

  it('never asks the table for more than a bounded window', async () => {
    const h = harness(() => jsonResponse([]));
    await h.store.top(25);
    expect(h.calls[0]?.url).toContain('limit=100');
  });

  it('falls through junk rows instead of serving a short page', async () => {
    /*
     * A row the game could not have minted takes a place in the table's own ordering. Filtering
     * after the limit meant a page of them answered with nothing while real rows sat behind them;
     * asking for a wider window means the real rows arrive and the junk is dropped from the middle.
     */
    const junk = Array.from({ length: 10 }, (_, i) => ({
      handle: `<hand written ${i}>`,
      score: 1e9,
    }));
    const real = Array.from({ length: 3 }, (_, i) => ({
      handle: 'brave-lantern-42',
      score: 9 - i,
    }));
    const h = harness(() => jsonResponse([...junk, ...real]));

    await expect(h.store.top(3)).resolves.toEqual(real);
  });

  it('carries the reason the select was refused into the message it throws', async () => {
    // `select refused with 403` names no privilege, no missing table and no schema cache; the
    // body PostgREST sent named one of them and the old code dropped it on the floor.
    await expect(
      harness(() =>
        jsonResponse(
          { code: '42501', message: 'permission denied for table leaderboard', hint: null },
          403,
        ),
      ).store.top(5),
    ).rejects.toThrow('42501: permission denied for table leaderboard');
  });

  it('throws on a 200 that is not JSON at all', async () => {
    // The branch the comment above `parse()` claims and nothing reached: a proxy's HTML error page
    // served with a 200 must read as "the board cannot be read", not as a SyntaxError with a
    // fragment of someone else's response in the message.
    await expect(
      harness(() => new Response('<!doctype html><title>nope</title>', { status: 200 })).store.top(
        5,
      ),
    ).rejects.toThrow('shape');
  });
});

/*
 * THE INSERT, AND WHAT IT IS ALLOWED TO BELIEVE.
 *
 * `if (!res.ok)` believed every 2xx. Two of them arrive without a row being written: a Supabase
 * free-tier project pauses after a week without traffic -- the normal week of a research page --
 * and anything in front of the database can answer 200 with a page of HTML. The player then reads
 * "Posted to the board as brave-lantern-42" for a row that does not exist.
 *
 * Every status in this block is written as a LITERAL, never as `CREATED` imported from the
 * adapter. The expected 201 comes from PostgREST's documentation for the request the adapter
 * sends; a test that read the number out of `src/store.ts` would follow the defect if somebody
 * widened the constant, pass, and prove nothing (trap 4, the bound that moves with the thing it
 * guards).
 */
/** The row every test below writes. One minted handle, one whole number of points. */
const ROW = { handle: 'brave-lantern-42', score: 500 };

/** The error a call threw, typed. Fails loudly rather than passing when nothing was thrown. */
async function refusal(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (err) {
    return err as Error;
  }
  throw new Error('expected that answer to be refused, and it was believed');
}

describe('the insert believes only what PostgREST says', () => {
  it('sends the Prefer header the whole check is derived from', async () => {
    /*
     * This is the premise, so it is asserted rather than assumed. `Prefer: return=minimal` is why
     * an empty body is the success signature below: PostgREST returns 201 for all three return
     * modes and only the BODY differs. Change this header to `return=representation` and a real
     * insert starts answering with a row, which the emptiness check would refuse -- so this test
     * failing is the warning that the rest of this block has to be re-derived, not patched.
     */
    const h = harness();
    await h.store.add(ROW);
    expect((h.calls[0]?.init.headers as Record<string, string>)['prefer']).toBe('return=minimal');
  });

  it('believes a 201 with the empty body return=minimal asks for', async () => {
    const typed = harness(
      () => new Response(null, { status: 201, headers: { 'content-type': 'application/json' } }),
    );
    await expect(typed.store.add(ROW)).resolves.toBeUndefined();

    // And with no content type at all, which is what a response with no body is entitled to send.
    await expect(
      harness(() => new Response(null, { status: 201 })).store.add(ROW),
    ).resolves.toBeUndefined();
  });

  it('believes a 201 typed as one of the PostgREST JSON media types', async () => {
    // `application/vnd.pgrst.object+json` and friends are PostgREST's; refusing them would take
    // the board down over content negotiation rather than over a lie.
    const h = harness(
      () =>
        new Response(null, {
          status: 201,
          headers: { 'content-type': 'application/vnd.pgrst.object+json; charset=utf-8' },
        }),
    );
    await expect(h.store.add(ROW)).resolves.toBeUndefined();
  });

  it('refuses a 200, which is what a paused project or a gateway answers', async () => {
    /*
     * The whole defect in one line: this used to resolve, and `POST /api/score` answered 200 with
     * a handle for a row nothing had written.
     *
     * ISOLATED ON PURPOSE -- empty body, JSON content type -- so that the STATUS is the only check
     * that can catch it. The first version of this test sent a 200 carrying an HTML page, and when
     * the status check was broken to prove this guard, the content-type check caught the page
     * instead: the test failed, which looked like proof, and the guard under test had not fired at
     * all. A reply that trips three checks proves whichever one runs first and nothing about the
     * other two.
     */
    const h = harness(
      () => new Response(null, { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await expect(h.store.add(ROW)).rejects.toThrow(
      'insert answered 200, and PostgREST answers 201',
    );
  });

  it('refuses an HTML page served with a 200, which is the shape a proxy sends', async () => {
    // The same lie with a body on it. Caught by whichever check reaches it first; the point here
    // is that it is caught, not which.
    const h = harness(
      () => new Response('<!doctype html><title>project paused</title>', { status: 200 }),
    );
    await expect(h.store.add(ROW)).rejects.toThrow();
  });

  it('refuses a 2xx that is not the created status either', async () => {
    // 202 Accepted is a perfectly good answer from something that is not a database.
    await expect(harness(() => new Response(null, { status: 202 })).store.add(ROW)).rejects.toThrow(
      'insert answered 202, and PostgREST answers 201',
    );
  });

  it('refuses a 201 that is not typed as anything PostgREST sends', async () => {
    // Isolated the same way: the body is empty, so the content TYPE is the only check that can
    // catch this. A 201 with an HTML page in it would be caught by the emptiness check as well.
    const h = harness(
      () =>
        new Response(null, {
          status: 201,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    );
    await expect(h.store.add(ROW)).rejects.toThrow('as text/html; charset=utf-8, which PostgREST');
  });

  it('refuses a 201 carrying a body, because return=minimal asked for none', async () => {
    const h = harness(() => jsonResponse([{ id: 7, handle: ROW.handle, score: ROW.score }], 201));
    const error = await refusal(h.store.add(ROW));
    expect(error.message).toContain('with a body, and return=minimal asks for none');
    // The body is refused, not quoted: whatever answered, it is not ours to copy into a log.
    expect(error.message).not.toContain(ROW.handle);
    expect(error.message).not.toContain('"id"');
  });

  it('refuses a 201 whose body never arrived, rather than reading nothing as empty', async () => {
    await expect(harness(() => unreadable(201)).store.add(ROW)).rejects.toThrow(
      'with a body that could not be read',
    );
  });
});

/*
 * WHAT THE LOG IS TOLD WHEN THE TABLE REFUSES.
 *
 * Both calls dropped PostgREST's error body, so the first real failure in production would have
 * logged `insert refused with 400` and nothing about which constraint refused it. The reason lives
 * in that body and nowhere else. These tests are as much about what must NOT reach the log: a log
 * line is storage, and this service stores a handle and a score by rule.
 */
describe('a refusal names the reason and nothing about the player', () => {
  it("carries PostgREST's code and message, and leaves details and hint behind", async () => {
    const h = harness(() =>
      jsonResponse(
        {
          code: '23505',
          message: 'duplicate key value violates unique constraint "leaderboard_log_hash_key"',
          // DETAIL is where PostgreSQL writes the VALUES. This is the field that carries a row
          // back out of the database, and it is the reason the schema in store.ts reads two keys.
          details: 'Key (handle)=(brave-lantern-42) already exists.',
          hint: 'try a different brave-lantern-42',
        },
        400,
      ),
    );
    const error = await refusal(h.store.add(ROW));

    expect(error.message).toContain('insert refused with 400');
    expect(error.message).toContain('23505');
    expect(error.message).toContain('leaderboard_log_hash_key');
    // Never the row, never the handle, never anything a player was shown.
    expect(error.message).not.toContain(ROW.handle);
    expect(error.message).not.toContain('Key (');
    expect(error.message).not.toContain('try a different');
    expect(error.message).not.toContain(CONFIG.serviceRoleKey);
  });

  it('reads a gateway message that carries no code, which is how a rejected key arrives', async () => {
    await expect(
      harness(() => jsonResponse({ message: 'Invalid API key' }, 401)).store.add(ROW),
    ).rejects.toThrow('insert refused with 401: Invalid API key');
  });

  it('reads a PostgREST code that carries no message', async () => {
    await expect(
      harness(() => jsonResponse({ code: 'PGRST205' }, 404)).store.add(ROW),
    ).rejects.toThrow('insert refused with 404: PGRST205');
  });

  it('says plainly when nothing PostgREST-shaped came back at all', async () => {
    for (const reply of [
      () => new Response('<!doctype html><h1>502 Bad Gateway</h1>', { status: 502 }),
      () => new Response('', { status: 503 }),
      // Shaped like the body, saying nothing: two keys read, both absent.
      () => jsonResponse({ details: null, hint: null }, 400),
      // Valid JSON that is not an object. A field cannot be read out of a list.
      () => jsonResponse(['not', 'an', 'object'], 400),
    ]) {
      await expect(harness(reply).store.add(ROW)).rejects.toThrow('no PostgREST error body');
    }
  });

  /*
   * ONE FIELD'S TYPE MUST NOT COST THE OTHER FIELD'S VALUE.
   *
   * The schema here was `z.object({ code: z.string().optional(), message: z.string().optional() })`,
   * and `.optional()` means "may be ABSENT". It does not mean "may be null". A zod object also
   * fails WHOLE: one field of the wrong type and `safeParse` returns no data at all, so the sibling
   * that arrived perfectly well is discarded along with it. Measured on zod 4.6.5, against the
   * exact body in the first test below: one `invalid_type` issue at path ["code"], `success: false`,
   * and `reasonFrom()` fell straight through to 'no PostgREST error body'.
   *
   * That is not a theoretical shape. A revoked or rotated service role key is the most likely
   * failure this service will ever have, and the gateway in front of the database is under no
   * obligation to send PostgREST's own types when it answers one. Under the old schema the log
   * read `select refused with 403: no PostgREST error body` -- the status was reported and the one
   * sentence that explains it was thrown away, which is the entire defect `reasonFrom()` exists to
   * stop, reintroduced one level further in.
   *
   * Each field is now read on its own: taken when it is a string, skipped when it is anything else,
   * and never conditional on its sibling. These four tests pin all four combinations.
   */
  it('keeps a message whose sibling code arrived as null rather than absent', async () => {
    const h = harness(() =>
      jsonResponse(
        {
          code: null,
          message: 'permission denied for table leaderboard',
          // Still refused, null code or no null code: the reader names the two keys it may read,
          // so there is no path from this body to DETAIL even when the parse is at its most lenient.
          details: 'Key (handle)=(brave-lantern-42) already exists.',
          hint: 'grant select on leaderboard to brave-lantern-42',
        },
        403,
      ),
    );
    const error = await refusal(h.store.top(5));

    expect(error.message).toBe('select refused with 403: permission denied for table leaderboard');
    expect(error.message).not.toContain('Key (');
    expect(error.message).not.toContain('grant select');
    expect(error.message).not.toContain(ROW.handle);
  });

  it('keeps a code whose sibling message arrived as something other than a string', async () => {
    // The mirror of the case above, so that neither field is merely lucky in its position.
    await expect(
      harness(() =>
        jsonResponse({ code: 'PGRST301', message: { nested: 'object' } }, 401),
      ).store.add(ROW),
    ).rejects.toThrow('insert refused with 401: PGRST301');
  });

  it('drops a field of the wrong type instead of coercing it, and keeps the other', async () => {
    // A numeric code is not rendered as "42501": the log says what actually arrived, or says
    // nothing. Coercion here would be this file inventing a PostgREST code that was never sent.
    await expect(
      harness(() => jsonResponse({ code: 42501, message: 'permission denied' }, 403)).store.add(
        ROW,
      ),
    ).rejects.toThrow('insert refused with 403: permission denied');
  });

  it('says nothing PostgREST-shaped came back when neither field is a string', async () => {
    await expect(
      harness(() => jsonResponse({ code: null, message: null }, 400)).store.add(ROW),
    ).rejects.toThrow('no PostgREST error body');
  });

  it('says so when the error body could not be read either', async () => {
    await expect(harness(() => unreadable(500)).store.add(ROW)).rejects.toThrow(
      'insert refused with 500: its error body could not be read',
    );
  });

  it('folds a hostile message onto one bounded line', async () => {
    /*
     * The body came off the network, so it is shaped before it is written. A newline in a log line
     * forges a second log line; an escape sequence is read by whatever renders the log; an
     * unbounded message is an unbounded log entry. The assertions are on the SHAPE -- one line, no
     * control characters, a small fraction of the 2,000 characters that arrived -- and not on the
     * cap in store.ts, so the test does not move when that constant does.
     */
    const flood = 'x'.repeat(2000);
    const h = harness(() =>
      jsonResponse(
        {
          code: '23514',
          message: `violates check constraint\n\u001b[2Kinjected log line\r\n${flood}`,
        },
        400,
      ),
    );
    const error = await refusal(h.store.add(ROW));

    expect(error.message.split('\n')).toHaveLength(1);
    expect(error.message).not.toContain('\u001b');
    expect(error.message).not.toContain('\r');
    expect(error.message).toContain('23514: violates check constraint');
    expect(error.message.length).toBeLessThan(400);
    expect(error.message.length).toBeLessThan(flood.length);
  });

  it('counts a rank with a HEAD over the same board the read shows, and no row comes back', async () => {
    const h = harness(
      () => new Response(null, { status: 200, headers: { 'content-range': '0-6/7' } }),
    );
    await expect(h.store.rank(70)).resolves.toBe(7);
    const { url, init } = h.calls[0]!;
    const asked = new URL(url);
    expect(init.method).toBe('HEAD');
    expect((init.headers as Record<string, string>)['prefer']).toBe('count=exact');
    expect((init.headers as Record<string, string>)['apikey']).toBe(CONFIG.serviceRoleKey);
    expect(url).not.toContain(CONFIG.serviceRoleKey);
    expect(asked.searchParams.get('select')).toBe('score');
    expect(asked.searchParams.get('score')).toBe('gte.70');
    expect(asked.searchParams.get('created_at')).toBe(`gte.${BOARD_SINCE}`);
  });

  it('never counts zeros, even for a score of zero', async () => {
    const h = harness(
      () => new Response(null, { status: 200, headers: { 'content-range': '*/3' } }),
    );
    await expect(h.store.rank(0)).resolves.toBe(3);
    expect(new URL(h.calls[0]!.url).searchParams.get('score')).toBe('gte.1');
  });

  it('throws rather than inventing a rank', async () => {
    await expect(harness(() => new Response(null, { status: 403 })).store.rank(10)).rejects.toThrow(
      'count refused with 403',
    );
    await expect(harness(() => new Response(null, { status: 200 })).store.rank(10)).rejects.toThrow(
      'without a total',
    );
    // The row was just written, so a count of none is not a count of this board.
    await expect(
      harness(
        () => new Response(null, { status: 200, headers: { 'content-range': '*/0' } }),
      ).store.rank(10),
    ).rejects.toThrow('without a total');
  });
});
