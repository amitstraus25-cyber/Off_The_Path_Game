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
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  READ_RESEARCH_MESSAGE,
  allowedParentOrigin,
  readResearchClick,
  requestReadResearch,
  resolveParentOrigin,
} from '../src/embed/postMessage';

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

/** The Webflow staging site the agency asked for (2026-10-25): one exact host, nothing around it. */
const STAGING = 'https://cyera-staging.webflow.io';

describe('the Webflow staging origin', () => {
  it('is named by frame-ancestors, exactly', () => {
    expect(frameAncestorSources()).toContain(STAGING);
  });

  it('is accepted, and nothing around it is', () => {
    expect(allowedParentOrigin(STAGING)).toBe(STAGING);
    for (const near of [
      'https://other.webflow.io',
      'https://webflow.io',
      'https://www.cyera-staging.webflow.io', // an exact host source names no subdomains
      'https://evil-cyera-staging.webflow.io',
      'https://cyera-staging.webflow.io.evil.test',
      'http://cyera-staging.webflow.io',
      'https://cyera-staging.webflow.io:8443',
    ])
      expect(allowedParentOrigin(near), near).toBeNull();
  });
});

describe('which parent the game believes (resolveParentOrigin)', () => {
  const allowed = ['https://cyera.com', 'https://www.cyera.com', STAGING];

  it('takes ancestorOrigins where the browser has it, and checks it against the list', () => {
    for (const origin of allowed) expect(resolveParentOrigin(origin, '')).toBe(origin);
    expect(resolveParentOrigin('https://example.com', '')).toBeNull();
    expect(resolveParentOrigin('null', '')).toBeNull();
  });

  it('does not fall back to the referrer when ancestorOrigins names a refused parent', () => {
    expect(resolveParentOrigin('https://example.com', 'https://www.cyera.com/')).toBeNull();
  });

  it('falls back to the referrer origin where there is no ancestorOrigins', () => {
    expect(resolveParentOrigin(undefined, 'https://www.cyera.com/research/malicious-skills')).toBe(
      'https://www.cyera.com',
    );
    expect(resolveParentOrigin(undefined, `${STAGING}/research/malicious-skills?x=1#y`)).toBe(
      STAGING,
    );
  });

  it('is null when nothing can be learned, or what is learned is refused', () => {
    expect(resolveParentOrigin(undefined, '')).toBeNull();
    expect(resolveParentOrigin(undefined, 'not a url')).toBeNull();
    expect(resolveParentOrigin(undefined, 'https://example.com/')).toBeNull();
    expect(resolveParentOrigin(undefined, 'https://evilcyera.com/')).toBeNull();
    expect(resolveParentOrigin(undefined, 'http://www.cyera.com/')).toBeNull();
  });
});

describe('the Read the Research click', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A framed (or not) window, as far as the module reads one. */
  function world(opts: { framed: boolean; ancestors?: string[]; referrer?: string }) {
    const posted: { message: unknown; target: unknown }[] = [];
    const self = {} as { parent: unknown };
    self.parent = opts.framed
      ? {
          postMessage: (message: unknown, target: unknown) => {
            posted.push({ message, target });
          },
        }
      : self;
    vi.stubGlobal('window', self);
    vi.stubGlobal('location', {
      ancestorOrigins: opts.ancestors === undefined ? undefined : opts.ancestors,
    });
    vi.stubGlobal('document', { referrer: opts.referrer ?? '' });
    return posted;
  }

  const click = (over: Partial<Parameters<typeof readResearchClick>[0]> = {}) => {
    const event = {
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...over,
    };
    readResearchClick(event);
    return event;
  };

  it('is the contract the agency was given', () => {
    expect(READ_RESEARCH_MESSAGE).toBe('OFF_THE_PATH_READ_RESEARCH');
  });

  it('posts the message to the parent exact origin and cancels the navigation', () => {
    for (const origin of ['https://cyera.com', 'https://www.cyera.com', STAGING]) {
      const posted = world({ framed: true, ancestors: [origin] });
      const event = click();
      const research = posted.filter(
        (p) => (p.message as { type: string }).type === READ_RESEARCH_MESSAGE,
      );
      expect(research, origin).toEqual([
        { message: { type: READ_RESEARCH_MESSAGE }, target: origin },
      ]);
      expect(event.defaultPrevented, origin).toBe(true);
      expect(
        posted.every((p) => p.target !== '*'),
        'never a wildcard target',
      ).toBe(true);
    }
  });

  it('reads the parent from the referrer where ancestorOrigins does not exist', () => {
    const posted = world({ framed: true, referrer: `${STAGING}/research/malicious-skills` });
    expect(click().defaultPrevented).toBe(true);
    expect(posted.some((p) => p.target === STAGING)).toBe(true);
  });

  it('behaves as standalone when not framed: nothing posted, link left to navigate', () => {
    const posted = world({ framed: false });
    expect(click().defaultPrevented).toBe(false);
    expect(posted).toEqual([]);
    expect(requestReadResearch()).toBe(false);
  });

  it('behaves as standalone under a parent that is not on the list, or that is unknown', () => {
    for (const w of [
      { framed: true, ancestors: ['https://example.com'] },
      { framed: true, ancestors: ['null'] },
      { framed: true, referrer: 'https://evilcyera.com/' },
      { framed: true },
    ]) {
      const posted = world(w);
      expect(click().defaultPrevented, JSON.stringify(w)).toBe(false);
      // `emit` may still send the analytics event to its default origin (unchanged behaviour);
      // what must not exist is a scroll request.
      expect(
        posted.filter((p) => (p.message as { type: string }).type === READ_RESEARCH_MESSAGE),
        JSON.stringify(w),
      ).toEqual([]);
    }
  });

  it('leaves a modified or non-primary click to the browser, which opens a new tab', () => {
    for (const over of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      const posted = world({ framed: true, ancestors: [STAGING] });
      expect(click(over).defaultPrevented, JSON.stringify(over)).toBe(false);
      expect(
        posted.some((p) => (p.message as { type: string }).type === READ_RESEARCH_MESSAGE),
        JSON.stringify(over),
      ).toBe(false);
    }
  });

  it('still tells the parent about the click for analytics', () => {
    const posted = world({ framed: true, ancestors: [STAGING] });
    click();
    expect(posted.map((p) => (p.message as { type: string }).type)).toContain('otp:cta');
  });
});
