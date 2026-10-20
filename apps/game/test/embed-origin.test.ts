/*
 * THE ALLOW-LIST IN THE BUNDLE AND THE ONE IN THE HEADER HAVE TO BE THE SAME ALLOW-LIST.
 *
 * `vercel.json` decides which pages a browser will let frame this asset (`frame-ancestors`).
 * `src/embed/postMessage.ts` decides which parent origins the game will post its five analytics
 * events to. Those are two statements of one fact, kept in two files because a bundle cannot read
 * vercel.json at runtime -- and when they disagreed, every allowed embed except one host silently
 * received nothing, with Chrome reporting it as a console WARNING that no guard in this repo
 * watches.
 *
 * So this file never quotes the module's own list. It parses `frame-ancestors` out of the shipped
 * vercel.json, BUILDS origins from the sources it finds there -- one that each source must admit,
 * and the near-misses each source must refuse -- and asks the module. Widen the header and the
 * module goes red for refusing a page the policy now allows; widen the module and it goes red for
 * accepting a page the policy does not.
 *
 * The near-misses are the half that matters. `https://evilcyera.com` ends with `cyera.com` as a
 * string and is a different company; `https://cyera.com:8443` is a different origin a CSP host
 * source with no port does not name; `http://` is a different scheme.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allowedParentOrigin } from '../src/embed/postMessage';

const VERCEL = fileURLToPath(new URL('../../../vercel.json', import.meta.url));

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** Every host source `frame-ancestors` names, across every policy vercel.json ships. */
function frameAncestorSources(): string[] {
  const config = JSON.parse(readFileSync(VERCEL, 'utf8')) as { headers?: HeaderRule[] };
  const found: string[] = [];
  for (const rule of config.headers ?? [])
    for (const header of rule.headers) {
      if (header.key.toLowerCase() !== 'content-security-policy') continue;
      for (const chunk of header.value.split(';')) {
        const parts = chunk.trim().split(/\s+/).filter(Boolean);
        if (parts[0]?.toLowerCase() === 'frame-ancestors') found.push(...parts.slice(1));
      }
    }
  return found;
}

interface Probes {
  /** An origin this source names, which the module must accept. */
  admits: string[];
  /** Origins a reader might think this source names, which the module must refuse. */
  refuses: string[];
}

/**
 * Turns one CSP host source into the origins it does and does not cover.
 *
 * `'self'`, `'none'` and the like are keywords, not hosts: they cover no parent page, so they
 * contribute probes to neither list and are skipped rather than guessed at.
 */
function probesFor(source: string): Probes | null {
  if (source.startsWith("'")) return null;
  const wildcard = source.match(/^https:\/\/\*(\.[^/]+)$/);
  if (wildcard) {
    const suffix = wildcard[1]!; // ".cyera.com"
    const bare = suffix.slice(1); // "cyera.com"
    return {
      admits: [`https://www${suffix}`, `https://research${suffix}`, `https://a.b${suffix}`],
      refuses: [
        `https://evil${bare}`, // ends with the domain as a STRING, different company
        `https://www${suffix}.evil.test`, // the domain as a prefix of someone else's
        `http://www${suffix}`, // the policy names https only
        `https://www${suffix}:8443`, // a host source with no port means the default port
      ],
    };
  }
  const exact = source.match(/^https:\/\/([^/*]+)$/);
  if (exact) {
    const host = exact[1]!;
    return {
      admits: [`https://${host}`],
      refuses: [`http://${host}`, `https://${host}:8443`, `https://${host}.evil.test`],
    };
  }
  return null;
}

describe('the parent origins the game will post to', () => {
  const sources = frameAncestorSources();
  const probes = sources.map(probesFor).filter((p): p is Probes => p !== null);
  const admits = probes.flatMap((p) => p.admits);
  const refuses = probes.flatMap((p) => p.refuses);

  it('is a question this file could actually fail on', () => {
    // Both loops below pass trivially over an empty list, which is exactly how a guard like this
    // goes quiet: rename the header key, parse nothing, assert nothing, stay green.
    expect(sources.length, 'vercel.json declares no frame-ancestors').toBeGreaterThan(0);
    expect(admits.length, 'no host source parsed out of frame-ancestors').toBeGreaterThan(0);
    expect(refuses.length).toBeGreaterThan(0);
  });

  it('accepts every origin frame-ancestors allows to frame the game', () => {
    for (const origin of admits)
      expect(
        allowedParentOrigin(origin),
        `${origin} may frame the game, so its events must reach it`,
      ).toBe(origin);
  });

  it('refuses every near-miss of those origins', () => {
    for (const origin of refuses)
      expect(allowedParentOrigin(origin), `${origin} is not an origin the policy names`).toBeNull();
  });

  it('refuses a page that has nothing to do with the policy', () => {
    for (const origin of ['https://example.com', 'https://localhost', 'http://localhost:4173'])
      expect(allowedParentOrigin(origin)).toBeNull();
  });

  it('refuses what a sandboxed or unknown parent reports', () => {
    // `ancestorOrigins` reports the opaque origin of a sandboxed frame as the string "null", and
    // reports nothing at all in a browser that does not implement it.
    for (const reported of ['null', '', null, undefined])
      expect(allowedParentOrigin(reported)).toBeNull();
  });

  it('posts to a parsed origin, never to the string it was handed', () => {
    // Whatever shape the browser reports, what reaches postMessage is `new URL(...).origin`: a
    // path, a query or userinfo cannot ride along into the target origin.
    const host = admits[0]!;
    expect(allowedParentOrigin(`${host}/some/page?a=1#b`)).toBe(host);
    expect(allowedParentOrigin(`https://evil.test@${host.slice('https://'.length)}`)).toBe(host);
  });
});
