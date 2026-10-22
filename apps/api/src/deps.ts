import { content } from './content.ts';
import { readStoreConfig, readWorkEmailFlag } from './env.ts';
import { note } from './http.ts';
import { createRecentRuns, createWriteBudget } from './limit.ts';
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
const workEmail = readWorkEmailFlag(process.env);
if (workEmail.reason) note(workEmail.reason);

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
  // OTP_WORK_EMAIL, exactly `required`, or off (src/env.ts). Read once per cold start, like the rest.
  emailRequired: workEmail.required,
  // Called, not captured, so a test's fake clock reaches it.
  now: () => Date.now(),
};
