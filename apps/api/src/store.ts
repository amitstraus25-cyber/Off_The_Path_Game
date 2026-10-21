import { z } from 'zod';
import { isMintedHandle } from '@otp/core';
import type { StoreConfig } from './env.ts';

/*
 * The leaderboard table, over plain HTTP.
 *
 * Supabase exposes PostgREST, so this is `fetch` against /rest/v1/leaderboard with two headers.
 * That is the whole adapter, and it is why this service has no database driver: a Postgres client
 * would be a new dependency doing a job that four fetch options already do (CLAUDE.md rule 7).
 *
 * The table is `public.leaderboard (id, handle, score, created_at)` with RLS on and no policies.
 * Nothing but the service role can read or write it, and the service role key stays in headers --
 * PostgREST also accepts `?apikey=`, and this never uses it, because a key in a query string is a
 * key in every log and referrer on the way.
 */

const PATH = '/rest/v1/leaderboard';
/** Long enough for a cold Postgres, short enough that the game's own timeout is the backstop. */
const TIMEOUT_MS = 4000;
/** The most rows one read will ever ask the table for, however the page is filtered down after. */
const MAX_ROWS_READ = 100;

/**
 * The v2 launch. Rows written before it are v1 runs, scored out of 1,000, and would outrank every
 * v2 run (out of 100); the client chose on 2026-10-22 to clear them at launch. The board reads only
 * rows from this instant on, which clears them from every visitor's view without this service
 * holding a delete; removing the rows themselves is the human step in docs/DATABASE.md.
 */
export const V2_LAUNCH = '2026-10-21T23:45:00Z';

/**
 * The status PostgREST answers to an insert on a table.
 *
 * Taken from PostgREST's own documentation for the request THIS adapter sends, not from a memory
 * of what a database usually does: `POST /table` is `201 Created`, and the `Prefer: return=minimal`
 * below changes the BODY and not the status -- the documented examples for `return=representation`
 * and `return=headers-only` show the same 201 with a body and with a `Location` header. So the
 * check below is 201 and not "2xx", and not "201 or 200" either.
 *
 * Tests assert the literal 201 rather than importing this constant. A guard whose expected value
 * is read out of the thing it guards moves with the defect and passes in silence.
 */
const CREATED = 201;

/** The most of PostgREST's own wording that may reach a log line. Logs are storage too. */
const MAX_REASON_CHARS = 200;

export interface LeaderboardRow {
  handle: string;
  score: number;
}

export interface LeaderboardStore {
  add(row: LeaderboardRow): Promise<void>;
  /** Highest score first, then the earliest to get there. */
  top(limit: number): Promise<LeaderboardRow[]>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/*
 * Rows come back over the network, so they are parsed before they are believed (CLAUDE.md: treat
 * anything from the network as untrusted). A row whose handle is not one the game mints is dropped
 * rather than rendered: the only way one could exist is if somebody wrote to the table by hand.
 */
const rowsSchema = z.array(z.object({ handle: z.string(), score: z.number() }));

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/*
 * PostgREST's error body, and the two fields of it that are allowed out of this file.
 *
 * The body is `{ code, message, details, hint }`. Both calls below used to drop all four, so the
 * first real failure in production would have logged `insert refused with 400` and nothing about
 * WHICH constraint refused it -- the reason for a refusal lives in that body and nowhere else, and
 * by the time anyone reads the log the request is long gone.
 *
 * `code` and `message` are logged. `details` and `hint` are NOT, and the omission is the point:
 * PostgreSQL puts the VALUES in DETAIL -- a unique violation's detail is literally
 * `Key (handle)=(brave-lantern-42) already exists.` -- so `details` is the one field of the four
 * that carries a row back out of the database. This service stores a handle and a score and
 * nothing else by rule, and a log line is storage: it outlives the request, it is read by people
 * who were never shown the row, and on a data security company's own research asset it is the
 * last place to start keeping a copy of what a player did. Both fields are optional here because
 * Supabase's gateway answers some failures (a rejected key, most usefully) with a `message` and no
 * `code` at all, and that message is the whole diagnosis.
 *
 * `message` is not perfectly value-free either -- Postgres writes the offending text into a few of
 * them, `invalid input syntax for type integer: "..."` being the one to know about. It is kept
 * anyway: the only strings this service sends are a handle the game minted and an integer it
 * checked, so there is no player-composed text here to echo, and `MAX_REASON_CHARS` bounds
 * whatever does arrive. If that ever stops being true, log the code alone.
 *
 * WHY THE TWO FIELDS ARE READ ONE AT A TIME, AND NOT AS ONE OBJECT SCHEMA.
 *
 * This was `z.object({ code: z.string().optional(), message: z.string().optional() })`, and it
 * threw away the field that arrived whenever its sibling was the wrong type. Two separate
 * properties of zod combine into that, and neither is a bug in zod:
 *
 *   - `.optional()` means the key may be ABSENT. It does not mean the key may be NULL. A JSON
 *     `null` is a value, it is not a string, and `z.string().optional()` refuses it.
 *   - A zod object fails WHOLE. One field of the wrong type and `safeParse` returns no `data` at
 *     all, so a perfectly good sibling goes out with it.
 *
 * Measured on zod 4.6.5 against `{ code: null, message: "permission denied for table leaderboard" }`:
 * exactly one `invalid_type` issue, at path ["code"], and `success: false`. `reasonFrom()` then
 * fell through to 'no PostgREST error body' and the log read `select refused with 403: no PostgREST
 * error body`. The status was reported and the one sentence explaining it was dropped.
 *
 * That body is not a hypothetical. A revoked or rotated service role key is the single most likely
 * failure this service will ever have, and the gateway that answers one is under no obligation to
 * send PostgREST's own types for fields it did not generate. An all-or-nothing parse is the wrong
 * shape for a diagnostic: there is nothing to be gained by refusing to read a good `message`
 * because a `code` beside it came back null, and a whole incident to be lost by it.
 *
 * So the body is checked for being an object and nothing more, and each field is then taken when
 * it is a string and skipped when it is not, independently of the other. The leniency stops at the
 * key list: `REASON_FIELDS` is the only way into that object, `details` and `hint` are not in it,
 * and no wildcard reads it. A looser parse must not widen what may be read.
 */

/**
 * The only two keys that may ever be read out of an error body, in the order they are joined.
 *
 * This list IS the privacy rule, in the one place a reviewer can check it. `details` and `hint`
 * are absent on purpose -- see above, PostgreSQL puts the row VALUES in DETAIL -- and the body is
 * never iterated, spread, or indexed by anything but this list.
 */
const REASON_FIELDS = ['code', 'message'] as const;

/** The body has to be an object before a field can be read out of it. That is all this checks. */
const errorBodySchema = z.looseObject({});

/** One field, believed only when it is a string. A number is dropped rather than rendered. */
const reasonFieldSchema = z.string();

/**
 * One line, bounded, no control characters.
 *
 * What goes through here came off the network, so it is shaped before it is written: a newline in
 * a log line forges a second log line, an escape sequence is read by whatever renders the log, and
 * an unbounded `message` is an unbounded log entry.
 */
const oneLine = (value: string): string =>
  value
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REASON_CHARS);

/** The body as text, or null when it could not be read: a stream that errored tells us nothing. */
const bodyText = async (res: Response): Promise<string | null> => {
  try {
    return await res.text();
  } catch {
    return null;
  }
};

/** What PostgREST said went wrong, in a form fit for a log line. Never the row, never the body. */
const reasonFrom = (text: string | null): string => {
  if (text === null) return 'its error body could not be read';
  const body = errorBodySchema.safeParse(parse(text));
  // Not an object at all: an HTML error page, an empty body, a JSON list. Saying so is useful in
  // itself -- it means the answer did not come from the database.
  if (!body.success) return 'no PostgREST error body';
  const said = REASON_FIELDS.map((field) => {
    const value = reasonFieldSchema.safeParse(body.data[field]);
    return value.success ? value.data : '';
  })
    .filter(Boolean)
    .join(': ');
  // Reached by a body that is PostgREST-shaped and says nothing: both keys absent, both null, or
  // both some type this cannot read. There is no reason in it to report.
  return said === '' ? 'no PostgREST error body' : oneLine(said);
};

/** `application/json`, or one of PostgREST's `application/vnd.pgrst.*+json` variants. */
const isJsonType = (value: string): boolean => {
  const media = value.toLowerCase().replace(/;.*$/su, '').trim();
  return media === 'application/json' || media.endsWith('+json');
};

/**
 * Throws unless this response is PostgREST saying, in the only way it says it, that the row is in.
 *
 * `res.ok` was not that. It is true of every 2xx, and two of them are reachable with no row
 * written anywhere:
 *
 *   - A Supabase project on the free tier PAUSES after a week with no traffic, which is exactly
 *     the state of a research page nobody played last week. Whatever answers for a sleeping
 *     project is not PostgREST.
 *   - Anything in front of the database -- a gateway, a proxy, a captive network, an interstitial
 *     -- can answer 200 with a page of HTML. `return=minimal` means nothing here ever looked at a
 *     body, so nothing downstream would have noticed.
 *
 * Either way `POST /api/score` returned 200 and the player read "Posted to the board as
 * brave-lantern-42" for a row that does not exist. On a page about what a system tells you it did
 * with your instructions, that is the worst failure in the file.
 *
 * THE THREE CHECKS, AND WHERE EACH BOUND COMES FROM:
 *
 *  1. The status is `CREATED` exactly, which is derived above from the request this adapter sends
 *     rather than widened to a range that happens to contain it.
 *  2. The content type, when there is one, is JSON. A minimal 201 carries no body, so it need not
 *     carry a type either and an absent one is not held against it; `text/html` is the proxy error
 *     page this function exists for.
 *  3. The body is empty. That is what `Prefer: return=minimal` MEANS, which makes emptiness the
 *     signature of the preference we actually sent, and it is the check that costs an impostor the
 *     most: it has to answer 201, type it as JSON, and then say nothing.
 *
 * A body that cannot be READ is not an empty one, and it is refused. The trade is recorded on
 * purpose, because it is not free: a 201 header means PostgREST committed, so a connection torn
 * between the header and the empty body is a row that exists being reported as a failure, and the
 * player may post the same run again. That is the direction to be wrong in. The alternative --
 * believing a 201 whose body never arrived -- is the lie this whole function exists to stop, and
 * the handler already re-enables the post for exactly this case.
 *
 * TWO THINGS DELIBERATELY NOT CHECKED:
 *
 * `Prefer: return=representation` would make the stored row itself the proof, which is the
 * strongest answer available, and it is not used: it hands back the row on every post and the
 * generated id with it, and docs/DATABASE.md's delete-path reasoning leans on that id never
 * leaving the database. The cheap half of the same idea is check 3.
 *
 * PostgREST also sends a `Content-Range` header on an insert, and `Preference-Applied` when it
 * honours a preference. Neither is required here. Neither is documented as guaranteed for this
 * request, and a guard that fails on a header the server is free to drop takes the board down for
 * a reason nobody will find at three in the morning.
 */
async function believeInsert(res: Response): Promise<void> {
  if (res.status !== CREATED) {
    const reason = reasonFrom(await bodyText(res));
    throw new Error(
      res.ok
        ? `insert answered ${res.status}, and PostgREST answers ${CREATED}: ${reason}`
        : `insert refused with ${res.status}: ${reason}`,
    );
  }

  const type = res.headers.get('content-type');
  if (type !== null && !isJsonType(type))
    throw new Error(`insert answered ${CREATED} as ${oneLine(type)}, which PostgREST does not`);

  const text = await bodyText(res);
  if (text === null)
    throw new Error(`insert answered ${CREATED} with a body that could not be read`);
  // Never the body itself: whatever answered, it is not ours to copy into a log.
  if (text.trim() !== '')
    throw new Error(`insert answered ${CREATED} with a body, and return=minimal asks for none`);
}

export function createStore(config: StoreConfig, fetchImpl: FetchLike): LeaderboardStore {
  const headers = {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
  };

  return {
    async add({ handle, score }) {
      // Belt and braces over the schema at the edge: the last thing before the insert refuses to
      // write a handle the game did not mint, so no route can ever reach the table without it.
      if (!isMintedHandle(handle)) throw new Error('refusing to store an unminted handle');
      if (!Number.isInteger(score) || score < 0)
        throw new Error('refusing to store a score that is not a whole number of points');

      const res = await fetchImpl(`${config.url}${PATH}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json', prefer: 'return=minimal' },
        body: JSON.stringify([{ handle, score }]),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await believeInsert(res);
    },

    async top(limit) {
      /*
       * Ask for more rows than the page needs, because the handle filter below runs AFTER the
       * table has applied its limit. A row the game could not have minted -- a hand-written
       * insert, or one whose word was later taken out of the list -- would otherwise take a place
       * on the page and leave a hole where a real row should have fallen through. Over-fetching
       * four pages means the filter has somewhere to fall through to; it is not unbounded, and
       * `GET /api/top` serving a short page is still better than serving a poisoned one.
       */
      const window = Math.min(limit * 4, MAX_ROWS_READ);
      const query = new URLSearchParams({
        select: 'handle,score',
        created_at: `gte.${V2_LAUNCH}`,
        order: 'score.desc,created_at.asc',
        limit: String(window),
      });
      const res = await fetchImpl(`${config.url}${PATH}?${query.toString()}`, {
        method: 'GET',
        headers: { ...headers, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // The error body is read for the same reason the insert reads it: `select refused with 403`
      // names no privilege, no missing table and no schema cache, and PostgREST named all three.
      if (!res.ok)
        throw new Error(`select refused with ${res.status}: ${reasonFrom(await bodyText(res))}`);
      // Read as text and parse here, so a body that is not JSON at all fails with a sentence of
      // ours rather than a SyntaxError carrying a fragment of whatever came back.
      const rows = rowsSchema.safeParse(parse(await res.text()));
      if (!rows.success) throw new Error('the board came back in a shape it has never had');
      return rows.data
        .filter((r) => isMintedHandle(r.handle) && Number.isInteger(r.score))
        .slice(0, limit);
    },
  };
}
