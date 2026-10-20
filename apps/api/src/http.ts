/*
 * The three response shapes this service has, and the one place its headers are written.
 *
 * `nosniff` is set here rather than left to vercel.json: the top-level `headers` block applies to
 * the deployment, but whether it survives the rewrite into a second service is exactly the kind of
 * thing docs/ARCHITECTURE.md section 10 already records as unverified. A JSON endpoint costs
 * nothing to make certain of.
 */

const BASE_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, 'cache-control': 'no-store', ...headers },
  });

/**
 * An error the caller can act on and nothing more. No zod issues, no database status, no stack:
 * a forger should not be able to use our diagnostics to find the shape of a log we would accept.
 * The detail goes to the server log instead, where `note()` puts it.
 */
export const fail = (
  status: number,
  error: string,
  headers: Record<string, string> = {},
): Response => json({ error }, status, headers);

/** One line in the Vercel log. Never called with anything read out of the store. */
export const note = (message: string): void => {
  console.warn(`[leaderboard] ${message}`);
};
