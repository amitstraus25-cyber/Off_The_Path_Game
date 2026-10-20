/*
 * The CSP is the single most security-relevant artefact in the repo and nothing looked at it.
 *
 * Three guards already carry parts of CLAUDE.md's security rules and none of them reaches this one.
 * e2e/smoke.spec.ts's page.on('request') handler watches what the *running* page fetches, which is
 * the zero-third-party-origins rule and is deliberately left alone here. eslint.config.js restricts
 * eval and the HTML sinks in *source*. Neither can see the policy we ship or the page it applies
 * to, because `vite preview` serves no headers and the policy lives in vercel.json, outside every
 * workspace. So this file reads the two shipped artefacts as text: no browser, no deploy.
 *
 * What it is for: the policy and the built page have to stay consistent with each other. `script-src
 * 'self'` works today only because the built index.html carries one external module script and one
 * stylesheet link and nothing inline. Add an inline <script>, a <style> block or an on*= handler to
 * index.html and the page keeps working in `vite dev` and in `vite preview`, and breaks only in
 * production, where nothing in this repo looks. That is the failure this file exists to catch, and
 * it catches it from either side: relaxing the policy, or adding the thing the policy forbids.
 *
 * On the dist half: `dist` is gitignored, so the assertions over the built page run only where a
 * build has happened. .github/workflows/ci.yml therefore runs `pnpm build` BEFORE `pnpm test` and
 * says so -- reorder those two and this half of the file goes quiet in CI, which is the failure
 * mode this project has already shipped once. The test asserts the page it reads is a real Vite
 * build before asserting what it does not contain, so it cannot pass on an empty or stale stub.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url);
const VERCEL = fileURLToPath(new URL('vercel.json', ROOT));
const DIST_INDEX = fileURLToPath(new URL('apps/game/dist/index.html', ROOT));

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

/** Every Content-Security-Policy vercel.json declares, with the path pattern it is served on. */
function policies(): { source: string; value: string }[] {
  const config = JSON.parse(readFileSync(VERCEL, 'utf8')) as { headers?: HeaderRule[] };
  return (config.headers ?? []).flatMap((rule) =>
    rule.headers
      .filter((header) => header.key.toLowerCase() === 'content-security-policy')
      .map((header) => ({ source: rule.source, value: header.value })),
  );
}

/** `script-src 'self'; img-src 'self' data:` -> { 'script-src': ["'self'"], 'img-src': [...] }. */
function directives(value: string): Map<string, string[]> {
  const parsed = new Map<string, string[]>();
  for (const chunk of value.split(';')) {
    const parts = chunk.trim().split(/\s+/).filter(Boolean);
    const name = parts[0];
    if (name) parsed.set(name.toLowerCase(), parts.slice(1));
  }
  return parsed;
}

/** `https:` and `data:` are schemes; `https://*.cyera.com` is a host and is not one of these. */
const SCHEME_ONLY = /^[a-z][a-z0-9+.-]*:$/i;

/** The built page without its comments: an on*= inside a comment is not a handler. */
function builtPage(): string {
  return readFileSync(DIST_INDEX, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
}

describe('the Content-Security-Policy we ship', () => {
  const declared = policies();

  it('is declared, on every path', () => {
    // The self-check. Every assertion below is over `declared`, so an empty list would pass them
    // all while the game shipped with no policy at all.
    expect(declared.map((p) => p.source)).toContain('/(.*)');
  });

  it('names the directives that make the rest of this file mean anything', () => {
    // "No 'unsafe-inline' in script-src" is a true sentence about a policy with no script-src.
    for (const { value } of declared) {
      const named = directives(value);
      for (const required of [
        'default-src',
        'script-src',
        'style-src',
        'object-src',
        'base-uri',
        'frame-ancestors',
      ]) {
        expect([...named.keys()], `${required} is missing from the policy`).toContain(required);
      }
    }
  });

  it('relaxes nothing: no unsafe-inline, no unsafe-eval, no unsafe-hashes', () => {
    for (const { value } of declared) {
      for (const [name, sources] of directives(value)) {
        for (const source of sources) {
          expect(source.toLowerCase(), `${name} relaxes the policy with ${source}`).not.toMatch(
            /^'unsafe-/,
          );
        }
      }
    }
  });

  it('opens nothing to a whole scheme or to everything', () => {
    /*
     * Two shapes only: a bare `*`, and a scheme with no host (`https:`, `data:`, `blob:`).
     * A wildcard HOST is deliberately not one of them -- frame-ancestors carries
     * https://*.cyera.com so the research page and its subdomains can frame the game, and
     * narrowing that would stop the asset embedding where it is meant to live.
     * The one scheme source is `data:` under img-src, which Phaser's default textures are, and
     * which boot does not survive without.
     */
    for (const { value } of declared) {
      for (const [name, sources] of directives(value)) {
        for (const source of sources) {
          expect(source, `${name} is open to everything`).not.toBe('*');
          if (name === 'img-src' && source === 'data:') continue;
          expect(SCHEME_ONLY.test(source), `${name} is open to the whole ${source} scheme`).toBe(
            false,
          );
        }
      }
    }
  });
});

describe.runIf(existsSync(DIST_INDEX))('the page that policy applies to', () => {
  it('is a real build, loading its script and its styles from files', () => {
    // The self-check again: the three absence assertions below all pass on an empty file.
    const scripts = [...builtPage().matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1] ?? '');
    expect(scripts.length, 'no <script> at all -- is this a built page?').toBeGreaterThan(0);
    expect(scripts.some((attrs) => /\bsrc\s*=\s*["']\/assets\/[^"']+\.js["']/i.test(attrs))).toBe(
      true,
    );
    expect(builtPage()).toMatch(/<link\b[^>]*rel\s*=\s*["']stylesheet["']/i);
  });

  it('carries no inline script for script-src to reject', () => {
    for (const [, attrs = '', body = ''] of builtPage().matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
    )) {
      expect(attrs, 'a <script> with no src is an inline script').toMatch(/\bsrc\s*=/i);
      expect(body.trim(), 'a <script> with a body is an inline script').toBe('');
    }
  });

  it('carries no inline CSS for style-src to reject', () => {
    // style-src 'self' rejects a <style> block and a style="" attribute alike.
    expect(builtPage()).not.toMatch(/<style[\s>]/i);
    expect(builtPage()).not.toMatch(/\sstyle\s*=/i);
  });

  it('carries no event-handler attribute, which no CSP can make safe', () => {
    expect(builtPage()).not.toMatch(/\son[a-z]+\s*=/i);
  });

  /*
   * THE DEBUG HANDLE MUST NOT REACH PRODUCTION. `window.__otp` exposes the store, the bus, the
   * content and (from forest-scene.ts) the live Phaser scene. Both gates read `import.meta.env`,
   * and the form matters: Vite constant-folds `import.meta.env.VITE_E2E` so the minifier drops
   * the branch, but `import.meta.env['VITE_E2E']` is a runtime lookup that survives it. That is
   * not hypothetical -- a plain `pnpm build` shipped the whole payload, and the bundle was
   * byte-identical to a VITE_E2E one, which is the signature of a gate that is not being
   * eliminated rather than of a dist built with the flag.
   *
   * The names are asserted, not the gate, so this cannot pass by being rewritten alongside what
   * it watches. It is skipped on an e2e build, where the hooks are supposed to be present.
   */
  it.runIf(process.env['VITE_E2E'] !== '1')(
    'ships no debug handle and no scene hooks to a player',
    () => {
      const page = builtPage();
      const script = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(page)?.[1];
      expect(script, 'no module script in the built page -- is this a real build?').toBeTruthy();

      const bundle = readFileSync(fileURLToPath(new URL(`apps/game/dist${script!}`, ROOT)), 'utf8');
      expect(bundle.length, 'the bundle is empty').toBeGreaterThan(1000);
      for (const hook of ['__otp', 'isSolidAt', 'mapObjects'])
        expect(
          bundle.includes(hook),
          `"${hook}" is in a plain production bundle, so an e2e gate is not being eliminated -- ` +
            'check that both gates use dot access, not import.meta.env["VITE_E2E"]',
        ).toBe(false);
    },
  );
});
