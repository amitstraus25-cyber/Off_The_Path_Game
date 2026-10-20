/*
 * THE FIRST SCREEN MUST NOT BE BLANK, AND NOTHING MAY QUEUE AHEAD OF THE SCRIPT THAT PAINTS IT.
 *
 * Two font faces totalling 705,680 bytes of uncompressed TTF were preloaded in index.html, which is
 * always the highest priority a browser has, in front of the 390,978-byte module script that is the
 * only thing in the build able to render a screen. Measured on the built game over Lighthouse
 * Slow-4G (1638.4 kbps, 150ms RTT) with a 4x CPU throttle at 390x844, median of three runs: the
 * script did not finish downloading until 5,261ms and first contentful paint was 5,692ms. That is
 * the blank hero in the client's "laggy" report, and it was boot cost, not frame pacing.
 *
 * Both faces also carried `font-display: block`, so every character set in them painted as nothing
 * until the face landed -- which, with the preloads removed, now happens AFTER the script rather
 * than before it. The preload removal and the swap are one fix in two files and neither half is
 * safe alone, so this file guards both halves together.
 *
 * WHY THESE ASSERTIONS AND NOT A BYTE COUNT OVER public/fonts. A font file nothing fetches costs a
 * player nothing: Vite copies public/ into dist verbatim, but the browser only asks for a face a
 * live `src` names and a text node needs. What a player actually waits for is (a) a face that
 * hides text while it loads and (b) bytes that a preload puts ahead of the script. Those are the
 * two things measured here. The one bound that is not yet assertable is the size of the faces
 * themselves -- Haffer is 459,792 bytes and no honest budget passes that -- because the woff2
 * subset that fixes it (39,032 B, parity-verified) is held behind a licence question. tokens.css
 * carries the recipe and the number to raise when it clears.
 *
 * BOTH FILES ARE READ WITH THEIR COMMENTS STRIPPED, and that is load-bearing rather than tidy:
 * index.html's replacement comment quotes the `<link rel="preload" as="font" type="font/ttf">` tag
 * it replaced, and tokens.css's quotes a `font-display` and a woff2 `src`. A naive text search
 * finds those and reports the opposite of the truth in both directions.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = new URL('../', import.meta.url);
const INDEX = fileURLToPath(new URL('index.html', APP));
const TOKENS = fileURLToPath(new URL('src/ui/tokens.css', APP));
const PUBLIC = fileURLToPath(new URL('public/', APP));
const DIST_INDEX = fileURLToPath(new URL('dist/index.html', APP));

/**
 * How many bytes of font may be preloaded ahead of the module script, independent of what any
 * font on disk happens to weigh today.
 *
 * 50 KiB. At the throughput the figures above were taken at -- 1638.4 kbps, i.e. 204,800 bytes a
 * second -- that is a quarter of a second of pipe taken away from the thing that paints the
 * screen, which is a cost worth paying for a face that is then ready before the first text node
 * exists. The 39,032-byte Haffer subset fits inside it with room to spare. Neither shipped TTF
 * comes close, which is the point: this is the assertion that was missing when they were added.
 */
const PRELOAD_BUDGET_BYTES = 50 * 1024;

/** A face that hides text until it loads. `auto` is `block` at every engine that ships today. */
const HIDES_TEXT = new Set(['block', 'auto']);

const withoutCssComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const withoutHtmlComments = (html: string): string => html.replace(/<!--[\s\S]*?-->/g, '');

interface Face {
  family: string;
  display: string | null;
  urls: string[];
}

/** Every live `@font-face` in tokens.css, comments already gone. */
function faces(): Face[] {
  const css = withoutCssComments(readFileSync(TOKENS, 'utf8'));
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body = '']) => ({
    family: (body.match(/font-family\s*:\s*([^;]+)/)?.[1] ?? '').trim().replace(/['"]/g, ''),
    display: body.match(/font-display\s*:\s*([a-z-]+)/)?.[1] ?? null,
    urls: [...body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(([, u = '']) => u),
  }));
}

/** Every `<link rel="preload" as="font">` href in a page, comments already gone. */
function preloadedFonts(html: string): string[] {
  return [...withoutHtmlComments(html).matchAll(/<link\b([^>]*)>/g)]
    .map(([, attrs = '']) => attrs)
    .filter(
      (attrs) => /\brel\s*=\s*["']preload["']/.test(attrs) && /\bas\s*=\s*["']font["']/.test(attrs),
    )
    .map((attrs) => attrs.match(/\bhref\s*=\s*["']([^"']+)["']/)?.[1] ?? '');
}

/** `/fonts/HafferUprightsVF.ttf` -> the file Vite will copy out of public/. */
const onDisk = (url: string): string => fileURLToPath(new URL(`.${url}`, `file://${PUBLIC}`));

describe('the faces the first screen is set in', () => {
  const declared = faces();

  it('are declared at all, and every one of them names a file that exists', () => {
    /*
     * The self-check. Every assertion below is a statement about `declared`, and all of them are
     * true of an empty list -- a renamed stylesheet or a regex that stopped matching would turn
     * this whole file green while saying nothing. Two faces are what the brand ships: Haffer for
     * UI text and Season Mix for the one highlighted word per heading.
     */
    expect(declared.length, 'no @font-face found in tokens.css at all').toBeGreaterThanOrEqual(2);
    expect(declared.map((f) => f.family)).toContain('Haffer');
    expect(declared.map((f) => f.family)).toContain('Season Mix');
    for (const face of declared) {
      for (const url of face.urls) {
        expect(
          existsSync(onDisk(url)),
          `${face.family} is declared from ${url}, which is not in public/`,
        ).toBe(true);
      }
    }
  });

  it.each(faces())('$family does not paint its text as nothing while it loads', (face) => {
    /*
     * This is the whole of the blank hero. `block` means the browser draws the text in no font at
     * all until the face arrives; on the measured phone profile Haffer arrives at 6.8 seconds.
     * Leaving font-display off entirely is the same defect spelled differently, so a face with no
     * declaration fails here too rather than being waved through.
     */
    expect(
      face.display,
      `${face.family} declares no font-display, which means block`,
    ).not.toBeNull();
    expect(
      HIDES_TEXT.has(face.display ?? 'auto'),
      `${face.family} is font-display: ${face.display} -- text set in it is invisible until ` +
        `${face.urls.join(', ')} has downloaded, which is the blank first screen this guards`,
    ).toBe(false);
  });
});

describe('what the page puts in front of the script that paints it', () => {
  const html = readFileSync(INDEX, 'utf8');

  it('is read from a page this file can actually parse', () => {
    // Second self-check: "no font preload" is trivially true of a file the regex cannot read.
    expect(
      [...withoutHtmlComments(html).matchAll(/<link\b([^>]*)>/g)].length,
      'no <link> at all -- has index.html moved?',
    ).toBeGreaterThan(0);
    expect(withoutHtmlComments(html)).toMatch(/<link\b[^>]*rel\s*=\s*["']icon["']/);
  });

  it('preloads no more font than a quarter-second of phone bandwidth', () => {
    const preloaded = preloadedFonts(html);
    const total = preloaded.reduce((sum, url) => sum + statSync(onDisk(url)).size, 0);
    expect(
      total,
      `index.html preloads ${preloaded.join(', ')} = ${total} bytes of font at the highest ` +
        `priority there is, ahead of the module script. Budget is ${PRELOAD_BUDGET_BYTES} bytes. ` +
        `See the note in index.html: this cost 5,692ms to first contentful paint.`,
    ).toBeLessThanOrEqual(PRELOAD_BUDGET_BYTES);
  });

  it('preloads nothing that no @font-face then uses', () => {
    // A preload for a face no `src` names is bandwidth spent on a file the browser never asks for
    // again, and Chromium says so in the console. Cheap to check while we are here.
    const used = new Set(faces().flatMap((f) => f.urls));
    for (const url of preloadedFonts(html)) {
      expect(used.has(url), `${url} is preloaded but no @font-face names it`).toBe(true);
    }
  });
});

/*
 * And the same question of the page that actually ships. `dist` is gitignored, so this runs only
 * where a build has happened; .github/workflows/ci.yml runs `pnpm build` before `pnpm test`, which
 * is what csp.test.ts relies on for the same reason.
 */
describe.runIf(existsSync(DIST_INDEX))('the built page', () => {
  it('carries no font preload the source does not', () => {
    const built = readFileSync(DIST_INDEX, 'utf8');
    expect(
      [...withoutHtmlComments(built).matchAll(/<link\b([^>]*)>/g)].length,
      'no <link> in the built page -- is this a real build?',
    ).toBeGreaterThan(0);
    const total = preloadedFonts(built).reduce((sum, url) => sum + statSync(onDisk(url)).size, 0);
    expect(total, `the built page preloads ${total} bytes of font`).toBeLessThanOrEqual(
      PRELOAD_BUDGET_BYTES,
    );
  });
});
