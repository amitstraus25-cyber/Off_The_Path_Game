/**
 * Events the game posts to the page that embeds it (ARCHITECTURE section 9). The parent owns
 * analytics; the game ships none of its own. Standalone (not in an iframe) these are no-ops.
 */
export interface EmbedEvents {
  'otp:ready': { version: string };
  'otp:started': { runId: string | null };
  'otp:verdict': { skillId: string; verdict: string };
  'otp:completed': { score: number; ending: string };
  'otp:cta': Record<string, never>;
}

/** Set at build time; '' means "do not post". A wildcard is never used. */
const TARGET_ORIGIN = (import.meta.env['VITE_EMBED_ORIGIN'] as string | undefined) ?? '';

export function emit<K extends keyof EmbedEvents>(type: K, payload: EmbedEvents[K]): void {
  if (window.parent === window || TARGET_ORIGIN === '') return;
  try {
    window.parent.postMessage({ type, payload }, TARGET_ORIGIN);
  } catch {
    // A blocked postMessage must never break play.
  }
}
