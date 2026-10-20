import { content } from './content.ts';
import { readStoreConfig } from './env.ts';
import { note } from './http.ts';
import { createRecentRuns, createWriteBudget } from './limit.ts';
import { createStore } from './store.ts';
import type { Deps } from './handlers.ts';

/*
 * The one place that touches `process.env`, read once per cold start.
 *
 * A missing or malformed variable is not a crash: the store is null, both routes answer 503, and
 * the game shows "Leaderboard unavailable right now" with results and the CTA untouched. The
 * reason is logged by NAME so a deploy can be fixed from the Vercel log without the log ever
 * holding a secret.
 */

const configured = readStoreConfig(process.env);
if (!configured.ok) note(`not configured: ${configured.reason}`);

export const deps: Deps = {
  content,
  store: configured.ok ? createStore(configured.config, fetch) : null,
  // Module scope, so one instance shares one budget and one set of recent runs across the
  // requests it serves. A cold start gets fresh ones, which is the bound src/limit.ts admits to.
  budget: createWriteBudget(),
  recent: createRecentRuns(),
};
