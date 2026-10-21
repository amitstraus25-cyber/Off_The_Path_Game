import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

/*
 * THE RUN TOKEN: what `POST /api/start` hands the browser and `POST /api/score` takes back.
 *
 * Why it exists. A v2 run log carries its own seed and its own timestamps, and both are
 * client-reported (packages/core/src/v2/runlog.ts says so in as many words). Replay proves a log is
 * consistent with its seed; it cannot prove the seed was drawn fairly or that the times are real.
 * So the server draws the seed itself and seals it, with the moment it was drawn, into this token.
 * On submit the log must carry the token's seed, and its claimed duration is bounded by the time
 * the server actually saw pass (handlers.ts).
 *
 * The format is `base64url(payload).base64url(HMAC-SHA256(payload))`. The payload is three fields:
 * a random id (single use, per instance), the seed and the issue time. NOTHING ABOUT THE VISITOR is
 * in it -- no IP, no user agent, no cookie -- and none of it is ever written to the table.
 *
 * THE KEY IS DERIVED, NOT CONFIGURED. HKDF-SHA256 over SUPABASE_SERVICE_ROLE_KEY with a fixed label,
 * so no new environment variable exists and the database key itself never signs anything. The
 * consequence worth knowing: rotating the service role key invalidates every token outstanding at
 * that moment (at most one run's worth -- see the window in handlers.ts). The key is never logged,
 * never returned and never leaves this module's closure.
 */

/** The HKDF `info`. Changing it invalidates every outstanding token, which is the way to revoke. */
const LABEL = 'otp/run-token/v1';

export interface RunTicket {
  /** Random, 22 base64url characters. The single-use key. */
  id: string;
  seed: number;
  /** Server clock, epoch milliseconds, when the token was issued. */
  issuedAt: number;
}

export interface RunTokens {
  /** Draws a seed and seals it with `now`. */
  issue(now: number): { seed: number; token: string };
  /** The ticket inside a token this service signed, or null for anything else. */
  open(token: string): RunTicket | null;
}

export const signingKey = (serviceRoleKey: string): Buffer =>
  Buffer.from(hkdfSync('sha256', serviceRoleKey, '', LABEL, 32));

const b64 = (bytes: Buffer): string => bytes.toString('base64url');

/** `draw` is injectable only so a test can pin the seed; the default is the CSPRNG. */
export function createRunTokens(key: Buffer, draw: (n: number) => Buffer = randomBytes): RunTokens {
  const sign = (payload: string): Buffer => createHmac('sha256', key).update(payload).digest();

  return {
    issue(now) {
      const random = draw(20);
      const ticket: RunTicket = {
        id: b64(random.subarray(0, 16)),
        // 0 to 2^32 - 1: exactly what core's `isSeed` accepts and what the browser's own
        // `crypto.getRandomValues(new Uint32Array(1))` would have drawn.
        seed: random.readUInt32BE(16),
        issuedAt: now,
      };
      const payload = b64(Buffer.from(JSON.stringify(ticket)));
      return { seed: ticket.seed, token: `${payload}.${b64(sign(payload))}` };
    },

    open(token) {
      const [payload, mac, extra] = token.split('.');
      if (payload === undefined || mac === undefined || extra !== undefined) return null;
      const given = Buffer.from(mac, 'base64url');
      const expected = sign(payload);
      // Length first: timingSafeEqual throws on unequal lengths rather than answering false.
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
      // Signed by us, so the payload is the JSON `issue` wrote; nothing else can carry this MAC.
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as RunTicket;
    },
  };
}
