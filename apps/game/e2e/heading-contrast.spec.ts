/*
 * EVERY HEADING IS READABLE AGAINST WHAT IS ACTUALLY BEHIND IT, AT THE THREE WIDTHS THE BRIEF NAMES.
 *
 * The a11y round turned four panel titles into headings: 02 Question (h2), 03 Inspect (h2), the
 * post's title (h2) and 04 Arrive's frame title (h1, visible from 560px up). Headings pick up
 * `h1, h2, ... { color: var(--cyera-heading) }` from reference/brand/cyera-theme.css -- Deep Purple,
 * which is right on a light page and is the panel's own BORDER colour here. On the Black header
 * that is a purple-on-purple-black title nobody can read, and it shipped to every sighted player
 * under 274 green tests, because not one of them measured a colour. Spans had inherited the
 * header's Off-white; the elements that replaced them did not.
 *
 * So this computes, for every text run inside every heading on every screen, the WCAG 2.x contrast
 * ratio of its rendered colour against the background it is really drawn on -- the ancestors' own
 * background colours composited from the first opaque one down, not a token -- and requires AA:
 * 4.5:1, or 3:1 for large text (>= 24px, or >= 18.66px and bold).
 *
 * WHAT THE MEASUREMENT REFUSES TO GUESS. A heading over a background IMAGE or a gradient, or with
 * no opaque layer behind it at all, has no single background colour, and the honest answer is "this
 * cannot be measured" -- which fails. The first cut treated "nothing opaque found" as white, and a
 * check that quietly assumes a background is the same shape as the defect it exists to catch.
 *
 * WHAT IT REFUSES TO SKIP. Elements clipped to a pixel (`.otp-visually-hidden`, and Arrive's frame
 * title below 560px) have no visible colour to measure, so they are not measured -- but each screen
 * names the headings that MUST have been measured, so a selector that drifts and measures nothing
 * fails with a message instead of passing on an empty list.
 *
 * It waits for the panel's 180ms slide-in to finish before it measures, because a colour read
 * mid-animation is the colour of a frame nobody sees.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { ready, startGame } from './helpers';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** The player-facing words, read from the file the game reads, so a retitled heading is followed. */
const STRINGS = (
  JSON.parse(read('../../../content/game.json')) as { strings: Record<string, string> }
).strings;

/**
 * The text a heading is required BY: its first words, read from content, not typed here. The
 * measured name is the heading's own text cut at 40 characters, so a prefix always matches it.
 */
const named = (key: string): string => {
  const text = STRINGS[key];
  expect(
    text,
    `content/game.json has no string "${key}", so a heading cannot be required by it`,
  ).toBeTruthy();
  return text!.trim().slice(0, 24);
};

const manifest = JSON.parse(read('../src/assets/manifest.json')) as { tilesets: string[] };

const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/** The three widths the brief names. Heights are a phone, a tablet and a desktop. */
const SIZES = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

/** AA, from WCAG 2.x 1.4.3. */
const AA_NORMAL = 4.5;
const AA_LARGE = 3;

interface Measured {
  /** `h2 "Question"`, for a message a person can act on. */
  what: string;
  text: string;
  tag: string;
  ratio: number;
  need: number;
  fg: string;
  bg: string;
  /** Set when there is no single background colour to measure against. */
  unmeasurable: string | null;
}

/**
 * The contrast of every visible text run in every visible heading on the page right now.
 *
 * Runs in the page so that it reads COMPUTED style and composites real layers. The colour parser is
 * a 1x1 canvas, which accepts whatever syntax the cascade resolved to (`rgb()`, `color(srgb ...)`,
 * `oklch()`) rather than a regex that handles the one a token happens to use today.
 */
async function measureHeadings(page: Page): Promise<Measured[]> {
  // Only the finite ones: a looping animation (a blinking caret) never finishes, and waiting on it
  // is how the first cut of this hung for the whole test timeout.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  return page.evaluate(
    ({ aaNormal, aaLarge }) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      type Rgba = [number, number, number, number];
      const parse = (css: string): Rgba => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        // getImageData returns premultiplied-then-unpremultiplied bytes; alpha is exact enough for AA.
        return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
      };
      const over = (top: Rgba, under: Rgba): Rgba => {
        const a = top[3] + under[3] * (1 - top[3]);
        if (a === 0) return [0, 0, 0, 0];
        const mix = (i: 0 | 1 | 2): number =>
          (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
        return [mix(0), mix(1), mix(2), a];
      };
      const lin = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lum = (c: Rgba): number => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const ratio = (a: Rgba, b: Rgba): number => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
        return (hi + 0.05) / (lo + 0.05);
      };
      const hex = (c: Rgba): string =>
        `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}${c[3] < 1 ? `,${c[3].toFixed(2)}` : ''})`;

      /** What is painted behind `el`: its ancestors' colour layers, bottom-up, to the first opaque one. */
      const backdrop = (start: Element): { bg: Rgba; unmeasurable: string | null } => {
        const layers: Rgba[] = [];
        let unmeasurable: string | null = null;
        let opaque = false;
        for (let el: Element | null = start; el; el = el.parentElement) {
          const cs = getComputedStyle(el);
          const colour = parse(cs.backgroundColor);
          if (cs.backgroundImage !== 'none' && !opaque) {
            unmeasurable = `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '')} paints a background image or gradient behind the text (${cs.backgroundImage.slice(0, 60)})`;
          }
          if (colour[3] > 0) layers.push(colour);
          if (colour[3] === 1) {
            opaque = true;
            break;
          }
        }
        if (!opaque && !unmeasurable) {
          unmeasurable =
            'no ancestor paints an opaque background colour, so what is behind the text is whatever the page or the canvas is';
        }
        let bg: Rgba = [255, 255, 255, 1];
        for (const layer of layers.reverse()) bg = over(layer, bg);
        return { bg, unmeasurable };
      };

      const out: Measured[] = [];
      const headings = Array.from(
        document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[role="heading"]'),
      ).filter((el) => !el.closest('[aria-hidden="true"], [inert], [hidden]'));

      for (const heading of headings) {
        const hcs = getComputedStyle(heading);
        if (hcs.display === 'none' || hcs.visibility === 'hidden') continue;
        const box = heading.getBoundingClientRect();
        // A box clipped to a pixel is `.otp-visually-hidden`: there is no visible colour to measure.
        if (box.width <= 2 || box.height <= 2) continue;

        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = (node.textContent ?? '').trim();
          const holder = node.parentElement;
          if (!text || !holder) continue;
          const cs = getComputedStyle(holder);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;

          let opacity = 1;
          for (let el: Element | null = holder; el; el = el.parentElement) {
            opacity *= Number(getComputedStyle(el).opacity);
          }
          const { bg, unmeasurable } = backdrop(holder);
          const raw = parse(cs.color);
          // Text with alpha, or inside a translucent subtree, is blended onto what is behind it.
          const alpha = raw[3] * opacity;
          const fg = over([raw[0], raw[1], raw[2], alpha], bg);

          const px = parseFloat(cs.fontSize);
          const bold = Number(cs.fontWeight) >= 700;
          const large = px >= 24 || (px >= 18.66 && bold);
          out.push({
            what: `${heading.tagName.toLowerCase()} "${(heading.textContent ?? '').trim().slice(0, 40)}"`,
            text,
            tag: holder.tagName.toLowerCase(),
            ratio: ratio(fg, bg),
            need: large ? aaLarge : aaNormal,
            fg: hex(fg),
            bg: hex(bg),
            unmeasurable,
          });
        }
      }
      return out;
    },
    { aaNormal: AA_NORMAL, aaLarge: AA_LARGE },
  ) as Promise<Measured[]>;
}

/**
 * Every measured run clears AA, and every heading named in `required` was measured at all.
 *
 * `required` are substrings of the heading's text. "Measured at all" is the half that stops a
 * drifted selector from passing: it fails on an empty list instead of succeeding on one.
 */
async function expectReadable(
  page: Page,
  where: string,
  required: readonly string[],
): Promise<void> {
  const runs = await measureHeadings(page);
  for (const name of required) {
    expect(
      runs.some((r) => r.what.includes(name)),
      `${where}: the heading "${name}" was not measured -- it is hidden, absent, or the selector drifted. ` +
        `Measured: ${JSON.stringify(runs.map((r) => r.what))}`,
    ).toBe(true);
  }
  for (const r of runs) {
    // Soft, so one run names EVERY heading that fails rather than only the first.
    expect
      .soft(
        r.unmeasurable,
        `${where}: ${r.what} has no single background to measure against -- ${r.unmeasurable ?? ''}`,
      )
      .toBeNull();
    expect
      .soft(
        r.ratio,
        `${where}: ${r.what} is ${r.fg} on ${r.bg}, a contrast of ${r.ratio.toFixed(2)}:1 ` +
          `against the ${r.need}:1 that AA needs`,
      )
      .toBeGreaterThanOrEqual(r.need);
  }
}

/** Plays the three encounters through the store, the way a run is played, ending at the door. */
const toTheDoor = (page: Page): Promise<void> =>
  page.evaluate((skillOf) => {
    const { store } = window.__otp!;
    for (const [c, s] of Object.entries(skillOf)) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v: 'restrict' });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, SKILL_OF);

for (const size of SIZES) {
  test(`every heading clears AA against its rendered background at ${size.width}px`, async ({
    browser,
  }) => {
    test.slow();
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    const at = (screen: string): string => `${size.width}px, ${screen}`;
    try {
      await page.goto('/');
      await ready(page);

      // 00 Title: the h1, and the "How to play" h2 under it. Both are named, so a selector that
      // drifts onto nothing, or a heading that drops out of view, fails here rather than passing.
      await expectReadable(page, at('title'), [named('title'), named('howToPlayLabel')]);

      // 01 Explore: the frame's own title is aria-hidden and the h1 is visually hidden, so there
      // is nothing visible to measure here and nothing is required of it.
      await startGame(page);
      await expect(page.locator('.otp-world-frame')).toBeVisible();
      await expectReadable(page, at('explore'), []);

      // 02 Question.
      await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
      await expect(page.locator('.otp-dialogue__text')).toBeFocused();
      await expectReadable(page, at('question'), ['Question']);

      // 03 Inspect, with the card's own title (an h3 on a light surface) alongside.
      await page.locator('.otp-dialogue__show').click();
      await expect(page.locator('.otp-card')).toBeFocused();
      await expectReadable(page, at('inspect'), ['Inspect']);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(page.locator('.otp-dialogue')).toBeHidden();

      // The post by the path, unread and read.
      await page.evaluate(() =>
        window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }),
      );
      await expect(page.locator('.otp-notice')).toBeVisible();
      // The title is in the panel's header, which is a sibling of `.otp-notice` and not inside it.
      const noticeTitle = (await page
        .locator('.otp-layer--modal .otp-panel__title')
        .textContent())!.trim();
      await expectReadable(page, at('the post, unread'), [noticeTitle]);
      await page.getByRole('button', { name: /Read the notice/ }).click();
      await expectReadable(page, at('the post, read'), [noticeTitle]);
      await page.keyboard.press('Escape');
      await expect(page.locator('.otp-notice')).toHaveCount(0);

      // 04 Arrive. Its frame title is the page's h1 and is only visible from 560px up; the
      // ending's title is the h2 under it, and mounts late.
      await toTheDoor(page);
      await expect(page.locator('.otp-arrive')).toBeVisible();
      await expectReadable(page, at('arrive, first line'), size.width >= 560 ? ['Arrive'] : []);
      for (let i = 0; i < 8; i++) {
        const go = page.getByRole('button', { name: 'Go on' });
        if ((await go.count()) === 0) break;
        await go.click();
      }
      await expect(page.locator('.otp-ending__title')).toBeVisible();
      await expectReadable(page, at('arrive, ending'), [
        ...(size.width >= 560 ? ['Arrive'] : []),
        (await page.locator('.otp-ending__title').textContent())!.trim().slice(0, 20),
      ]);

      // 05 Results: the score is the h1, and the sections below it are h2s. Every one is named:
      // the h1 by the one word of its `<small>` that is content (`scoreOutOf`), the three h2s by
      // their own text. Before this only the h1 was required, so the other three could vanish.
      await page.getByRole('button', { name: /Step inside/ }).click();
      await expect(page.locator('.otp-hero__score')).toBeVisible();
      await expectReadable(page, at('results'), [
        named('scoreOutOf'),
        named('trifectaLabel'),
        named('recapHeading'),
        named('leaderboardTitle'),
      ]);
    } finally {
      await context.close();
    }
  });
}

for (const size of SIZES) {
  test(`the load-failure screen's heading clears AA against its rendered background at ${size.width}px`, async ({
    browser,
  }) => {
    /*
     * ProblemScreen is the one screen in the game that is not reached by playing it, so the tour
     * above never visited it. Its h1 is Deep Purple on a Shell card -- a light surface, the case the
     * panel-title defect was NOT, which is why it passes -- and that is a fact about two colour
     * tokens that nothing was holding. A missing tileset is how it is reached for real: the
     * loader's `loaderror` is what mounts it, exactly as `load-failure.spec.ts` blocks it.
     */
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    try {
      const file = manifest.tilesets[0]!;
      const dot = file.lastIndexOf('.');
      const stem = file.slice(0, dot).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await page.route(
        new RegExp(`/assets/${stem}-[A-Za-z0-9_-]{8}\\.${file.slice(dot + 1)}$`),
        (route: Route) => route.fulfill({ status: 404, body: 'not found' }),
      );
      await page.goto('/');
      await expect(page.locator('.otp-problem[data-problem="load"]')).toBeVisible();
      await expectReadable(page, `${size.width}px, load failure`, [named('loadFailedTitle')]);
    } finally {
      await context.close();
    }
  });
}
