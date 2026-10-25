/**
 * THE TWO PLACES THIS GAME TOUCHES ANYTHING OUTSIDE ITS OWN ORIGIN, and the only two: the page that
 * embeds it, and the research page its one call to action points at. Both resolve here, from one
 * build-time variable each with its default and its meaning written down beside it, so this file is
 * the whole of the configuration. (An earlier version of this comment claimed a root
 * `.env.example` names them too; there is no such file in the tree, and saying so was the same
 * class of mistake as the baked-in origin below -- a note nobody could act on.)
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
 * WHY THE PARENT ORIGIN IS DERIVED AND NOT BAKED IN.
 *
 * A single origin used to be compiled in here, `https://www.cyera.com`, while `vercel.json` lets
 * the apex and every `*.cyera.com` host frame the asset. `postMessage` delivers only on an exact
 * origin match, so every page allowed to embed the game except that one host received nothing.
 * Measured on the built bundle, each parent origin fulfilled from `dist` with no DNS:
 *
 *     parent https://www.cyera.com       -> otp:ready delivered
 *     parent https://cyera.com           -> nothing delivered
 *     parent https://research.cyera.com  -> nothing delivered
 *
 * and in both failing cases Chrome reported it as a console WARNING ("The target origin provided
 * ... does not match the recipient window's origin"), which is why no guard in this repo saw it:
 * e2e/smoke.spec.ts fails the suite on console *errors*. All five events go through one `emit`, so
 * one wrong constant drops the parent page's whole analytics channel (ARCHITECTURE section 9 / D9).
 *
 * So the parent is read from the browser and checked against the same allow-list the policy
 * encodes, rather than guessed at build time. The failure mode is the gentle one in both
 * directions: an origin we refuse gets no event, and an origin we accept is passed to
 * `postMessage` as the exact target, so a browser still drops the message unless the parent really
 * is that origin. Nothing can leak to a page outside the list; at worst an event goes nowhere.
 */

/**
 * The host sources `frame-ancestors` names in vercel.json, in CSP's own notation.
 *
 * This is a copy, because a bundle cannot read vercel.json at runtime -- so it is a copy with a
 * guard on it: test/embed-origin.test.ts parses `frame-ancestors` out of the shipped vercel.json
 * and fails if this list and that directive stop describing the same set of origins. Change the
 * policy and this goes red; change this and the policy goes red.
 */
const FRAME_ANCESTOR_HOSTS: readonly string[] = [
  'cyera.com',
  '*.cyera.com',
  // The web agency's Webflow staging site (2026-10-25). One exact host, NOT `*.webflow.io`: that
  // would let every Webflow customer's site frame the game and receive its events.
  'cyera-staging.webflow.io',
];

/** `VITE_EMBED_ORIGIN=none` turns posting off outright. Unset means "whatever the policy allows". */
const DISABLED = 'none';

/** A build variable that is absent, empty or whitespace is absent. */
const EMBED_ORIGIN_RAW = (import.meta.env.VITE_EMBED_ORIGIN as string | undefined)?.trim();
const RESEARCH_URL_RAW = (import.meta.env.VITE_RESEARCH_URL as string | undefined)?.trim();

/**
 * The research page the one call to action points at.
 *
 * A build-time default, overridden by VITE_RESEARCH_URL. The client set it on 2026-10-23 to Cyera's
 * research hub, "in the mean time": the game's own page will be cyera.com/research/malicious-skills
 * (not live yet), and whether the call to action then links there or scrolls the page it is embedded
 * in is a question out with the web agency. The old default, /off-the-path, was a 404.
 */
export const DEFAULT_RESEARCH_URL = 'https://www.cyera.com/research';

/**
 * Where events go when the browser will not say who the parent is.
 *
 * Firefox implements neither `ancestorOrigins` nor, under some referrer policies, a referrer worth
 * parsing. Posting to this origin in that case is exactly as safe as posting to any other: it is
 * the exact target origin, so a parent that is not this host receives nothing. It is a last resort
 * and not the normal path.
 */
export const DEFAULT_EMBED_ORIGIN = 'https://www.cyera.com';

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

/** CSP host-source matching: `*.cyera.com` matches any prefix of labels, never the apex itself. */
function hostMatches(pattern: string, host: string): boolean {
  return pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host === pattern;
}

/**
 * `VITE_EMBED_ORIGIN=<https url>` pins the allow-list to exactly that origin, for an embed outside
 * cyera.com. Unset is the normal case and means "the origins frame-ancestors names".
 */
const PINNED_ORIGIN: string | null =
  EMBED_ORIGIN_RAW === undefined || EMBED_ORIGIN_RAW === DISABLED
    ? null
    : httpsUrl(EMBED_ORIGIN_RAW, DEFAULT_EMBED_ORIGIN, 'VITE_EMBED_ORIGIN').origin;

/**
 * The canonical origin to post to for a candidate parent, or null if it is not one we accept.
 *
 * Returning the PARSED origin rather than the string handed in is the point: whatever shape the
 * browser reports, `postMessage` is given `url.origin`, so a userinfo or path trick in the input
 * cannot become the target. A port is refused because a CSP host source with no port means the
 * default port only, and `https://cyera.com:8443` is a different origin the policy does not name.
 */
export function allowedParentOrigin(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null; // "null", the opaque origin of a sandboxed frame, lands here.
  }
  if (url.protocol !== 'https:' || url.port !== '') return null;
  if (PINNED_ORIGIN !== null) return url.origin === PINNED_ORIGIN ? url.origin : null;
  return FRAME_ANCESTOR_HOSTS.some((p) => hostMatches(p, url.hostname)) ? url.origin : null;
}

/**
 * The allowed parent origin for what a browser reported, or null. PURE, so the decision is unit
 * tested without a window: `ancestor` is `location.ancestorOrigins[0]` (undefined where the browser
 * has none -- Firefox) and `referrer` is `document.referrer`.
 *
 * `ancestorOrigins[0]` is the IMMEDIATE parent -- the window we post to -- not the top one, and
 * when the browser offers it, it is the answer: a referrer is only the parent's URL as filtered by
 * the parent's referrer policy. Without it the referrer's origin stands in: for an https parent
 * under `strict-origin-when-cross-origin`, Firefox's default and what we send, a cross-origin frame
 * still gets the parent's origin. Either way the result is checked against the allow-list and is
 * the PARSED origin, so what reaches `postMessage` is never the string the browser handed over.
 */
export function resolveParentOrigin(ancestor: string | undefined, referrer: string): string | null {
  if (ancestor !== undefined) return allowedParentOrigin(ancestor);
  if (referrer === '') return null;
  return allowedParentOrigin(referrer);
}

/** The raw report, for `emit`'s fallback logic: what the browser said, allowed or not. */
function reportedParentOrigin(): string | null {
  const ancestors: DOMStringList | undefined = location.ancestorOrigins;
  const immediate = ancestors && ancestors.length > 0 ? ancestors[0] : undefined;
  if (immediate !== undefined) return immediate;
  if (document.referrer === '') return null;
  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

/** The message "Read the Research" posts to an allowed parent, which scrolls its own page. */
export const READ_RESEARCH_MESSAGE = 'OFF_THE_PATH_READ_RESEARCH';

/**
 * Asks the embedding page to take the visitor to the research, if there is one that may be asked.
 *
 * Returns true when the message was posted -- the caller then cancels the link's navigation -- and
 * false in every other case, which the caller treats as STANDALONE: not framed, posting switched
 * off, a parent the browser will not name, or a parent that is not on the allow-list. Unlike
 * `emit` there is no default-origin fallback here: guessing a target and posting into the void
 * while also cancelling the link would leave the visitor with a button that does nothing. An
 * unknown parent gets the plain link instead.
 *
 * The target is the parent's exact allowed origin, never `*`. Nothing is received: the channel
 * stays outbound only (ARCHITECTURE section 9).
 */
export function requestReadResearch(): boolean {
  if (window.parent === window || EMBED_ORIGIN_RAW === DISABLED) return false;
  const ancestors: DOMStringList | undefined = location.ancestorOrigins;
  const target = resolveParentOrigin(
    ancestors && ancestors.length > 0 ? ancestors[0] : undefined,
    document.referrer,
  );
  if (target === null) return false;
  try {
    window.parent.postMessage({ type: READ_RESEARCH_MESSAGE }, target);
    return true;
  } catch {
    return false;
  }
}

/** What `readResearchClick` reads off the click, so a test can hand it a plain object. */
export type ResearchClick = Pick<
  MouseEvent,
  'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'preventDefault'
>;

/**
 * The click handler of the payoff screen's one link. The link keeps its href, so with no script, on
 * a middle-click and for assistive technology it is simply a link; this only changes what a plain
 * click does, and only when the game is embedded in an allowed parent (`requestReadResearch`).
 *
 * `otp:cta` is still emitted on every click for the parent's analytics. A modified click
 * (ctrl, cmd, shift, alt, or a non-primary button) is the visitor asking for a new tab or window,
 * so it is left to the browser and posts no scroll request.
 */
export function readResearchClick(event: ResearchClick): void {
  emit('otp:cta', {});
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    return;
  if (requestReadResearch()) event.preventDefault();
}

export function emit<K extends keyof EmbedEvents>(type: K, payload: EmbedEvents[K]): void {
  if (window.parent === window || EMBED_ORIGIN_RAW === DISABLED) return;

  const reported = reportedParentOrigin();
  const target = allowedParentOrigin(reported ?? PINNED_ORIGIN ?? DEFAULT_EMBED_ORIGIN);
  if (target === null) {
    complain(
      reported === null
        ? 'the browser will not say who the parent is, and the fallback origin is not allowed'
        : `parent ${reported} is not an origin this build posts to`,
    );
    return;
  }
  if (reported === null) complain(`parent origin unknown; posting to the default ${target}`);

  try {
    window.parent.postMessage({ type, payload }, target);
  } catch {
    // A blocked postMessage must never break play.
  }
}
