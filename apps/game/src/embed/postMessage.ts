/**
 * THE TWO PLACES THIS GAME TOUCHES ANYTHING OUTSIDE ITS OWN ORIGIN, and the only two: the page that
 * embeds it, and the research page its one call to action points at. Both resolve here, from one
 * build-time variable each with a default written down beside it, so pointing the asset at the real
 * page is a `.env` line and not a hunt. `.env.example` is the only other file that names them.
 *
 * Why this file and not a component: `VITE_EMBED_ORIGIN` had exactly one occurrence repo-wide -- the
 * line that read it -- with no `.env` anywhere, nothing in `vercel.json` and nothing in CI, so every
 * build this repo could produce resolved it to `''`. `emit()` returned early on that, which silently
 * dropped otp:ready/started/verdict/completed, the parent page's only analytics channel
 * (ARCHITECTURE section 9 / D9), and the call to action beside it was a <button> with no destination
 * at all. A second such value belongs next to the first, not scattered.
 *
 * Events the game posts to the page that embeds it. The parent owns analytics; the game ships none
 * of its own. Standalone (not in an iframe) these are no-ops.
 */
export interface EmbedEvents {
  'otp:ready': { version: string };
  'otp:started': { runId: string | null };
  'otp:verdict': { skillId: string; verdict: string };
  'otp:completed': { score: number; ending: string };
  'otp:cta': Record<string, never>;
}

/**
 * The defaults, and how much of each is known.
 *
 * The HOST is not a guess: `vercel.json` ships `frame-ancestors https://cyera.com
 * https://*.cyera.com`, so the only pages a browser will let frame this asset are on cyera.com, and
 * that header has been in the repo since the policy landed. The research page's PATH is the one part
 * nobody has confirmed -- it is the open question this task hands back -- so it is written down
 * once, here, rather than guessed at in a component.
 *
 * A wrong default costs one redirect. A wrong default that is also invisible costs a round, which is
 * what the `''` did, so these are deliberately values and never the empty string.
 */
export const DEFAULT_EMBED_ORIGIN = 'https://www.cyera.com';
export const DEFAULT_RESEARCH_URL = 'https://www.cyera.com/off-the-path';

/** `VITE_EMBED_ORIGIN=none` turns posting off outright. Unset means "use the default". */
const DISABLED = 'none';

/** A build variable that is absent, empty or whitespace is absent. */
const EMBED_ORIGIN_RAW = (import.meta.env.VITE_EMBED_ORIGIN as string | undefined)?.trim();
const RESEARCH_URL_RAW = (import.meta.env.VITE_RESEARCH_URL as string | undefined)?.trim();

/**
 * Shouts once, in dev only, so a misconfigured build is loud where someone can act on it and silent
 * in the shipped bundle -- `e2e/smoke.spec.ts` fails the suite on a console error, and a marketing
 * asset should not narrate its own build variables to a visitor's console either way.
 */
let warned = false;
function complain(message: string): void {
  if (warned || !import.meta.env.DEV) return;
  warned = true;
  console.warn(`[otp] ${message}`);
}

/**
 * An absolute https URL, or the default.
 *
 * The scheme is checked rather than trusted: a `javascript:` URL in a build variable would be script
 * execution from the one <a> on the payoff screen, and "treat anything from outside as untrusted"
 * (CLAUDE.md) does not stop being true because the untrusted thing arrived at build time.
 */
function httpsUrl(raw: string | undefined, fallback: string, name: string): URL {
  if (raw === undefined) return new URL(fallback);
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return url;
    complain(`${name} is not https (${url.protocol}); falling back to ${fallback}`);
  } catch {
    complain(`${name} is not an absolute URL; falling back to ${fallback}`);
  }
  return new URL(fallback);
}

/**
 * Where "Read the Research" goes. Always a real absolute https URL, so the screen's one conversion
 * action works standalone, works with no `.env` present at all, and is a destination a browser can
 * middle-click -- none of which a click handler on a <button> can be.
 */
export const RESEARCH_URL: string = httpsUrl(
  RESEARCH_URL_RAW,
  DEFAULT_RESEARCH_URL,
  'VITE_RESEARCH_URL',
).href;

/**
 * The one origin events are posted to. A wildcard is never used: `postMessage` delivers only when
 * the parent's origin matches this exactly, so naming the wrong cyera.com host drops the event
 * rather than leaking it, and naming the right one is the whole configuration.
 */
const TARGET_ORIGIN: string | null =
  EMBED_ORIGIN_RAW === DISABLED
    ? null
    : httpsUrl(EMBED_ORIGIN_RAW, DEFAULT_EMBED_ORIGIN, 'VITE_EMBED_ORIGIN').origin;

export function emit<K extends keyof EmbedEvents>(type: K, payload: EmbedEvents[K]): void {
  if (window.parent === window || TARGET_ORIGIN === null) return;
  if (EMBED_ORIGIN_RAW === undefined)
    complain(`VITE_EMBED_ORIGIN is unset; posting to the default ${TARGET_ORIGIN}`);
  try {
    window.parent.postMessage({ type, payload }, TARGET_ORIGIN);
  } catch {
    // A blocked postMessage must never break play.
  }
}
