/*
 * The two environment variables this service reads, and nothing else.
 *
 * The Vercel project carries eleven Supabase-related variables. Exactly two are used here:
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The POSTGRES_* pair would need a driver (a new
 * dependency), and anything named NEXT_PUBLIC_* is by definition shipped to browsers, so reading
 * one here would be reading a secret that is not one. See README.md.
 *
 * The service role key bypasses row-level security, which is the whole design: the table has RLS
 * on with NO policies, so `anon` and `authenticated` can do nothing, and the only key that can read
 * or write lives in a server environment no visitor ever sees. It is therefore never put in a URL,
 * never logged, and never included in a response -- test/store.test.ts asserts all three.
 */

export interface StoreConfig {
  /** Origin only, no trailing slash: `https://<ref>.supabase.co`. */
  url: string;
  serviceRoleKey: string;
}

export type ConfigResult = { ok: true; config: StoreConfig } | { ok: false; reason: string };

/**
 * Reads the configuration, or says plainly which name is wrong. The reason names VARIABLES, never
 * values, because it ends up in a build log.
 */
export function readStoreConfig(env: Record<string, string | undefined>): ConfigResult {
  const url = env['SUPABASE_URL']?.trim();
  const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']?.trim();
  if (!url) return { ok: false, reason: 'SUPABASE_URL is not set' };
  if (!serviceRoleKey) return { ok: false, reason: 'SUPABASE_SERVICE_ROLE_KEY is not set' };

  /*
   * PARSED, not prefix-matched. A string test for `https://` accepted `https://evil.example/x/../`
   * and then concatenated it into the request path; `new URL(...).origin` is the host and nothing
   * else, so whatever a mistyped variable carries after the host is discarded rather than followed.
   * A path or a query here is a misconfiguration worth naming, not something to silently absorb.
   */
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'SUPABASE_URL is not a URL' };
  }
  // A service role key must never travel in the clear, so a non-https URL is a configuration
  // error rather than something to try once and find out.
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'SUPABASE_URL is not https' };
  if (parsed.username !== '' || parsed.password !== '')
    return { ok: false, reason: 'SUPABASE_URL carries credentials' };
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '')
    return { ok: false, reason: 'SUPABASE_URL is not a bare origin' };

  return { ok: true, config: { url: parsed.origin, serviceRoleKey } };
}

/*
 * THE WORK-EMAIL FLAG (the client's decision, 2026-10-22): `OTP_WORK_EMAIL`, a third variable and
 * the only one that is not a secret. ON WHEN IT IS EXACTLY `required` and off for anything else,
 * including unset, so the default is today's behaviour: a handle and a score, the email fields of
 * a post ignored and stored nowhere.
 *
 * EXACT, not trimmed or case-folded. The flag turns on the collection of personal data, so the
 * only spelling that does it is the one the runbook prints; `Required` or `required ` is a typo,
 * and a typo must fail closed -- to collecting nothing -- rather than open. It does not fail
 * silently: a value that is set and is not `required` is reported, by NAME (the value is not a
 * secret, but nothing from the environment is echoed into a log, so nobody has to decide which
 * ones are).
 *
 * It must not be switched on before migration 0007 has been run and Legal has signed off on
 * reopening D10 (apps/api/README.md, "Work email"): with the flag on and the function missing,
 * every post answers 503.
 */
export const WORK_EMAIL_REQUIRED = 'required';

export type WorkEmailFlag = { required: boolean; reason?: string };

export function readWorkEmailFlag(env: Record<string, string | undefined>): WorkEmailFlag {
  const value = env['OTP_WORK_EMAIL'];
  if (value === WORK_EMAIL_REQUIRED) return { required: true };
  if (value === undefined || value === '') return { required: false };
  return {
    required: false,
    reason: `OTP_WORK_EMAIL is set but is not exactly "${WORK_EMAIL_REQUIRED}", so work email is off`,
  };
}
