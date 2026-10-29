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
