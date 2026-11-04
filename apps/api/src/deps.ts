import { content } from './content.ts';
import { readStoreConfig } from './env.ts';
import { note } from './http.ts';
import { createRecentRuns, createWriteBudget } from './limit.ts';
import { createPlayStore } from './plays.ts';
import type { PlayDeps } from './plays.ts';
import { createStatsReader, readStatsKey } from './stats.ts';
import type { StatsDeps } from './stats.ts';
import { createStore } from './store.ts';
import { createRunTokens, signingKey } from './token.ts';
import type { Deps } from './handlers.ts';

/*
 * The one place that touches `process.env`, read once per cold start.
 *
 * A missing or malformed variable is not a crash: the store and the token signer are null, every
 * route answers 503, and the game plays on a seed it drew itself with posting switched off. The
 * reason is logged by NAME so a deploy can be fixed from the Vercel log without the log ever
 * holding a secret.
 */

const configured = readStoreConfig(process.env);
if (!configured.ok) note(`not configured: ${configured.reason}`);

export const deps: Deps = {
  content,
  store: configured.ok ? createStore(configured.config, fetch) : null,
  // Derived from the service role key with a fixed label (src/token.ts): no second secret exists.
  tokens: configured.ok ? createRunTokens(signingKey(configured.config.serviceRoleKey)) : null,
  // Module scope, so one instance shares one budget and one set of recent runs across the
  // requests it serves. A cold start gets fresh ones, which is the bound src/limit.ts admits to.
  budget: createWriteBudget(),
  // Every run asks for a start, posted or not, so this bucket is four times the write budget.
  starts: createWriteBudget(120),
  recent: createRecentRuns(),
  // Called, not captured, so a test's fake clock reaches it.
  now: () => Date.now(),
};

/** The play stats' own wiring (src/plays.ts): the same key and signer, its own budget and memory. */
export const playDeps: PlayDeps = {
  content,
  plays: configured.ok ? createPlayStore(configured.config, fetch) : null,
  tokens: deps.tokens,
  // Up to three notes a run (start, then end or quit), so three times the start budget.
  budget: createWriteBudget(360),
  recent: createRecentRuns(1500),
  now: deps.now,
};

/** The dashboard's read (src/stats.ts): its own key, and the store's config to read the views. */
export const statsDeps: StatsDeps = {
  key: readStatsKey(process.env),
  reader: configured.ok ? createStatsReader(configured.config, fetch) : null,
};
