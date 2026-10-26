/*
 * WHAT THE PUBLIC PAGE IS ALLOWED TO CONTAIN, WHICH IS NOT OUR NOTES.
 *
 * `index.html` carried 2,561 bytes of HTML comments -- a paragraph on why a favicon is the black
 * symbol and twenty lines of Lighthouse figures about a font preload that is no longer there.
 * Vite copies HTML comments into the build verbatim, so that was 79.4% of the page a visitor
 * downloaded on a Cyera-branded marketing asset: measured on the built file, 2,561 comment bytes
 * of 3,225 total.
 *
 * The cost is not the bytes, which are small. It is that the comments were a running commentary on
 * our own mistakes, addressed to us, on a page anyone can View Source on -- the one file in this
 * repo whose contents are read by people who do not work here.
 *
 * None of what was removed is lost. The font-preload reasoning, with the same measurements, is in
 * test/fonts.test.ts, where it is attached to assertions that fail if the preloads come back,
 * which a comment could never do. What a comment carries, a guard should carry.
 *
 * This file is the guard on the removal. It deliberately does not say "no bigger than it is
 * today": the budget below is a statement about what belongs on the page, not a snapshot of it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = new URL('../', import.meta.url);
const SOURCE = fileURLToPath(new URL('index.html', APP));
const DIST_INDEX = fileURLToPath(new URL('dist/index.html', APP));

/**
 * 2 KiB of markup.
 *
 * The page is a head, two empty mount points, a <noscript> and a script tag: everything a player
 * sees is rendered by Preact and Phaser after that script runs. Two kilobytes is roughly three
 * times what those elements need and leaves room for a meta description, an Open Graph block or a
 * preload when one is earned -- while being far too small to hold a paragraph of prose. A page
 * that fails this has had something put on it that belongs in a doc or a test.
 */
const MARKUP_BUDGET_BYTES = 2 * 1024;

const pages = (): { name: string; html: string }[] => [
  { name: 'index.html', html: readFileSync(SOURCE, 'utf8') },
  // `dist` is gitignored, so this half runs only where a build has happened. CI builds first.
  ...(existsSync(DIST_INDEX)
    ? [{ name: 'dist/index.html', html: readFileSync(DIST_INDEX, 'utf8') }]
    : []),
];

describe('the page a visitor downloads', () => {
  it('is the page this file thinks it is', () => {
    // The self-check: both assertions below pass on an empty string.
    for (const { name, html } of pages()) {
      expect(html, `${name} is empty`).toMatch(/<script\b/i);
      expect(html, `${name} has no doctype`).toMatch(/^<!doctype html>/i);
    }
  });

  it('carries no commentary', () => {
    for (const { name, html } of pages()) {
      const comments = [...html.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1] ?? '');
      expect(
        comments,
        `${name} explains itself to the public; put it in a doc or a test instead`,
      ).toEqual([]);
    }
  });

  it('stays within the markup budget', () => {
    for (const { name, html } of pages()) {
      const bytes = Buffer.byteLength(html, 'utf8');
      expect(bytes, `${name} is ${bytes} bytes of markup`).toBeLessThanOrEqual(MARKUP_BUDGET_BYTES);
    }
  });
});

/*
 * A SHARED LINK SHOWS THE LANDING (the client, 2026-10-26: "when posting on LinkedIn I want the
 * landing page to show up"). LinkedIn, Slack, X and iMessage draw their preview from these tags in
 * the static HTML; none of them runs the script, so nothing rendered later can stand in for them.
 *
 * `public/og-landing.png` is the landing itself, not drawn for the purpose: the real page in its
 * wide layout (the client, 2026-10-26: "the landing picture of a web page like this"), captured at
 * 1716x940 with the deck's stick and T hidden, cut to the header and the framed scene and scaled to
 * LinkedIn's own 1200x627. A capture at 1200x627 itself is the narrow cabinet, controls at the
 * sides, and was the wrong picture. A NEW picture takes a NEW file name: LinkedIn keeps an image by
 * its URL. The image URL must be absolute, so it names the live host; when
 * the game moves to its research-page address, these move with it. (A page that embeds the game in
 * an iframe shares ITS tags, not these: the research page needs its own og:image.)
 */
describe('a link to the game, shared', () => {
  const html = readFileSync(SOURCE, 'utf8');
  const tag = (property: string): string | undefined =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`))?.[1];

  it('previews as the landing, large', () => {
    expect(tag('og:title')).toBe("Off the Path: That's Not My Grandma");
    expect(tag('og:image')).toMatch(/^https:\/\/[^/]+\/og-landing\.png$/);
    expect(tag('og:image:width')).toBe('1200');
    expect(tag('og:image:height')).toBe('627');
    expect(tag('twitter:card')).toBe('summary_large_image');
    expect(tag('og:description')).toBe(tag('description'));
  });

  it('points at an image that ships, at the size it claims', () => {
    const png = readFileSync(fileURLToPath(new URL('public/og-landing.png', APP)));
    // The IHDR chunk: width and height, big-endian, at bytes 16 and 20.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 627]);
  });
});
