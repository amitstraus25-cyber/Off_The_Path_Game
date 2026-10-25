import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { answerAllAndArrive, crossTheRiver, startGame, toTheReveal } from './helpers';

/*
 * PAUL'S DESIGN ROUND OF 2026-10-22, MEASURED. One spec for the fixes in that round a browser can
 * measure -- positions, sizes, landmarks and accessible names -- each written against the bound
 * the fix list gave, read off the page rather than off the constant that moved (PAUL_BRIEF trap 5).
 * What no test can confirm, the meaning of the new and changed sentences, goes to the human read in
 * docs/COPY_REVIEW.md (PAUL_BRIEF section 7).
 *
 * Every measurement first asserts that the thing it measures is on screen, so none of these can
 * pass on an empty list (trap 6).
 */

const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as {
  endings: Record<string, { title: string }>;
  ui: { chrome: Record<string, string>; reveal: { unanswered: string } };
};
const say = (key: string): string => raw.ui.chrome[key]!;

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function pageAt(browser: Browser, width: number, height: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height } });
  return context.newPage();
}

/* ------------------------------------------------------ 1, 3, 10, 27: the Arrive payoff */

/**
 * Answers every offer through the store and walks in, letting the wolf in with one bad skill (never
 * the Wing Ride, whose flight carries Purple off the doorstep) and taking the Word Weaver or not.
 * It crosses the river by the Bridge Key, which lets the wolf in itself when it is the bad one.
 */
async function arriveAsWolf(page: Page, weaver: boolean): Promise<void> {
  await page.evaluate((w) => {
    const { store, content } = window.__otp!;
    const good = store.getState().good;
    let wolf = false;
    for (const c of content.characters) {
      store.dispatch({ type: 'MEET', c: c.id });
      store.dispatch({ type: 'INSPECT', s: c.skillId });
      let v: 'take' | 'leave' = 'leave';
      if (c.skillId === 'word-weaver') v = w ? 'take' : 'leave';
      else if (c.skillId === 'bridge-key') {
        // Over the river by the bridge, never the flight (rules 3: no crossing, no door).
        v = 'take';
        if (!good.includes(c.skillId)) wolf = true;
      } else if (!wolf && c.skillId !== 'short-cut' && !good.includes(c.skillId)) {
        v = 'take';
        wolf = true;
      }
      store.dispatch({ type: 'VERDICT', s: c.skillId, v });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, weaver);
}

/** The Arrive panel's box, Purple's feet and every print in CSS pixels, after the last beat. */
async function payoff(page: Page) {
  return page.evaluate(() => {
    const scene = window.__otp!.scene as unknown as {
      cameras: { main: { x: number; y: number; scrollX: number; scrollY: number } };
      purple: { y: number };
      paws: { visible: boolean; y: number; displayHeight: number }[];
    };
    const canvas = document.querySelector('#game canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const zoom = rect.width / canvas.width;
    const cam = scene.cameras.main;
    const atY = (wy: number): number => rect.top + (cam.y + wy - cam.scrollY) * zoom;
    const panel = document.querySelector('.otp-arrive')!.getBoundingClientRect();
    return {
      panelTop: panel.top,
      canvas: { left: rect.left, right: rect.right },
      panel: { left: panel.left, right: panel.right },
      feet: atY(scene.purple.y),
      paws: scene.paws.filter((p) => p.visible).map((p) => atY(p.y + p.displayHeight / 2)),
    };
  });
}

for (const [width, height] of [
  [1280, 800],
  [1024, 768],
  [844, 390],
  [375, 812],
] as const)
  for (const weaver of [false, true])
    test(`at ${width}x${height} the Arrive panel is one size and leaves Purple and the prints in view${weaver ? ', with the welcome' : ''}`, async ({
      browser,
    }) => {
      test.slow();
      const page = await pageAt(browser, width, height);
      await page.goto('/');
      await startGame(page);
      await arriveAsWolf(page, weaver);
      const arrive = page.locator('[data-arrive="wolf"]');
      await expect(arrive).toBeVisible();
      const heights: number[] = [];
      const finish = arrive.locator('[data-action="finish"]');
      heights.push((await arrive.locator('.otp-arrive').boundingBox())!.height);
      while (!(await finish.isVisible())) {
        await arrive.getByRole('button', { name: say('arriveNext') }).click();
        heights.push((await arrive.locator('.otp-arrive').boundingBox())!.height);
      }
      // Item 27: the panel is its final height from the first beat.
      for (const h of heights)
        expect(
          Math.abs(h - heights[0]!),
          `the panel grew between beats: ${heights.join(', ')}`,
        ).toBeLessThanOrEqual(0.5);
      // Let the cut settle (the panel measures itself, the camera re-cuts on the next frame).
      await page.waitForTimeout(300);
      const shot = await payoff(page);
      // Item 1: feet and every print above the panel's top edge.
      expect(shot.paws.length, 'the wolf ending laid no prints').toBe(3);
      expect(shot.feet, `Purple's feet are under the panel at ${width}x${height}`).toBeLessThan(
        shot.panelTop,
      );
      for (const y of shot.paws)
        expect(y, `a print is under the panel at ${width}x${height}`).toBeLessThan(shot.panelTop);
      // Item 9: below the wide-window cap, the panel's sides are the canvas's.
      if (width < 1000) {
        expect(Math.abs(shot.panel.left - Math.max(0, shot.canvas.left))).toBeLessThanOrEqual(0.5);
        expect(Math.abs(shot.panel.right - Math.min(width, shot.canvas.right))).toBeLessThanOrEqual(
          0.5,
        );
      }
      // Item 10: the header carries a chip, inside the frame.
      const chip = (await page.locator('.otp-world-frame .otp-chip').boundingBox())!;
      const frame = (await page.locator('.otp-world-frame').boundingBox())!;
      expect(chip.x + chip.width).toBeLessThanOrEqual(frame.x + frame.width - 10);
      await expect(page.locator('.otp-world-frame .otp-chip__label')).toHaveText(
        say('arriveChipLabel'),
      );
      await page.context().close();
    });

test('the late ending says After dark, shows Purple and does not invite anyone inside', async ({
  page,
}) => {
  await page.goto('/');
  await startGame(page);
  await page.evaluate(() => window.__otp!.testClock.advance(180_000));
  const arrive = page.locator('[data-arrive="late"]');
  await expect(arrive).toBeVisible();
  const finish = arrive.locator('[data-action="finish"]');
  while (!(await finish.isVisible()))
    await arrive.getByRole('button', { name: say('arriveNext') }).click();
  await expect(finish).toHaveText(say('arriveAskLate'));
  await expect(page.locator('.otp-world-frame h1')).toHaveText(raw.endings['late']!.title);
  const face = await arrive
    .locator('.otp-portrait')
    .evaluate((el) => (el as HTMLElement).style.backgroundImage);
  expect(face).toContain('portrait-purple');
});

/* ---------------------------------------------------------- 2: the deck on the first Tab */

for (const [width, height] of [
  [375, 812],
  [768, 1024],
  [1280, 800],
  [844, 390],
] as const)
  test(`at ${width}x${height} reaching the walk buttons by keyboard leaves the deck where it was`, async ({
    browser,
  }) => {
    const page = await pageAt(browser, width, height);
    await page.goto('/');
    await startGame(page);
    const boxes = async () =>
      Promise.all(
        ['.otp-stick', '.otp-a-button', '.otp-touch'].map(
          async (s) => (await page.locator(s).boundingBox())!,
        ),
      );
    const before = await boxes();
    let inRow = false;
    for (let i = 0; i < 6 && !inRow; i++) {
      await page.keyboard.press('Tab');
      inRow = await page.evaluate(
        () => !!document.activeElement?.closest('.otp-touch [role="group"]'),
      );
    }
    expect(inRow, 'no Tab reached the walk buttons').toBe(true);
    const after = await boxes();
    for (let i = 0; i < before.length; i++) expect(after[i]).toEqual(before[i]);
    const row = (await page.locator(".otp-touch > [role='group']").boundingBox())!;
    for (const sel of ['.otp-hud2__timer', '.otp-hud2__basket']) {
      const box = (await page.locator(sel).boundingBox())!;
      expect(overlaps(row, box), `the walk row covers ${sel}`).toBe(false);
    }
    await page.context().close();
  });

/* ---------------------------------------------- 5, 7, 8, 10: the title and the how-to */

for (const [width, height] of [
  [844, 390],
  [667, 375],
  [568, 320],
  [375, 812],
  [1280, 800],
] as const)
  test(`at ${width}x${height} the title says Purple is your agent and its headings keep their word spaces`, async ({
    browser,
  }) => {
    const page = await pageAt(browser, width, height);
    await page.goto('/');
    await page.waitForSelector('#game[data-ready="true"]');
    const agent = page.locator('.otp-title__agent');
    await expect(agent).toHaveText(say('landingAgent'));
    const box = (await agent.boundingBox())!;
    expect(box.height, 'the agent line has no height').toBeGreaterThan(0);
    expect(await agent.evaluate((el) => getComputedStyle(el).clipPath)).toBe('none');
    // Item 7: -2% tracking in em, and a word space of at least a fifth of the size.
    const mark = await page.locator('.otp-title__mark').evaluate((el) => {
      const cs = getComputedStyle(el);
      const node = el.firstChild as Text;
      const at = (i: number) => {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + 1);
        return r.getBoundingClientRect();
      };
      const space = node.data.indexOf(' ');
      return {
        size: parseFloat(cs.fontSize),
        tracking: parseFloat(cs.letterSpacing),
        gap: at(space + 1).left - at(space - 1).right,
      };
    });
    expect(Math.abs(mark.tracking - -0.02 * mark.size)).toBeLessThan(0.05);
    expect(mark.gap).toBeGreaterThanOrEqual(0.2 * mark.size);
    // Item 10: a chip in the header, inside the frame.
    const chip = (await page.locator('.otp-world-frame .otp-chip').boundingBox())!;
    const frame = (await page.locator('.otp-world-frame').boundingBox())!;
    expect(chip.x + chip.width).toBeLessThanOrEqual(frame.x + frame.width - 10);
    // Item 8: the slim ring on the title's call to action.
    const cta = page.locator('.otp-title-panel .otp-cta');
    for (let i = 0; i < 8 && !(await cta.evaluate((el) => el === document.activeElement)); i++)
      await page.keyboard.press('Tab');
    await expect(cta).toBeFocused();
    const ring = await cta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { shadow: cs.boxShadow, width: cs.outlineWidth };
    });
    expect(ring).toEqual({ shadow: 'none', width: '2px' });
    await page.context().close();
  });

test('the how-to names itself once: its header title is not read', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await expect(page.locator('.otp-howto')).toBeVisible();
  await expect(page.locator('.otp-world-frame .otp-panel__title')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'How to play' })).toHaveCount(1);
});

/* ------------------------------------------------------- 13, 28: the reveal's cards */

test('every reveal card is named in words with their commas, and the odd seventh spans the row', async ({
  browser,
}) => {
  const page = await pageAt(browser, 1280, 800);
  await page.goto('/');
  await startGame(page);
  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  // A clean run opens its first caught card by itself (P8); this measures the grid face down.
  for (const tile of await page.locator('.otp-tile[data-open="true"]').all())
    await tile.locator('.otp-tile__face').click();
  await expect(page.locator('.otp-tile[data-open="true"]')).toHaveCount(0);
  const faces = page.locator('.otp-tile__face');
  await expect(faces).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    const name = await faces.nth(i).evaluate((el) => el.textContent ?? '');
    await expect(faces.nth(i)).toHaveAccessibleName(/(Safe|Unsafe), You/);
    await expect(faces.nth(i)).not.toHaveAccessibleName(/(Safe|Unsafe)You/);
    expect(name.length).toBeGreaterThan(0);
  }
  // Item 28: the seventh card, alone on its row, takes the row.
  const list = (await page.locator('.otp-tiles').boundingBox())!;
  const last = (await page.locator('.otp-tile').last().boundingBox())!;
  expect(Math.abs(last.width - list.width)).toBeLessThanOrEqual(1);
  // And a missed card's picture lines up with a caught card's, from each card's own left edge.
  const inset = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((tile) => {
        const icon = tile.querySelector('.otp-reveal__icon')!.getBoundingClientRect();
        return icon.left - tile.getBoundingClientRect().left;
      });
  const caught = await inset('.otp-tile:not(.otp-tile--missed)');
  const missed = await inset('.otp-tile--missed');
  expect(Math.abs(caught - missed), 'a missed card steps its picture right').toBeLessThanOrEqual(
    0.5,
  );
  await page.context().close();
});

test('a card walked past says so on one line at every width', async ({ browser }) => {
  for (const [width, height] of [
    [375, 812],
    [768, 1024],
    [1280, 800],
  ] as const) {
    const page = await pageAt(browser, width, height);
    await page.goto('/');
    await startGame(page);
    // Over the river first (rules 3): the door refuses a run that has not crossed.
    await crossTheRiver(page);
    await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
    await toTheReveal(page);
    const labels = page.locator('.otp-reveal__chose');
    await expect(labels.first()).toHaveText(raw.ui.reveal.unanswered);
    for (let i = 0; i < (await labels.count()); i++) {
      const lines = await labels.nth(i).evaluate((el) => el.getClientRects().length);
      expect(lines, `a "${raw.ui.reveal.unanswered}" label wraps at ${width}`).toBe(1);
    }
    await page.context().close();
  }
});

/* ------------------------------------------------------------------- 14: one main */

test('the page has exactly one main landmark, holding the world and the UI', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#game[data-ready="true"]');
  const shape = await page.evaluate(() => ({
    mains: document.querySelectorAll('main').length,
    game: document.querySelector('#game')?.parentElement?.tagName,
    ui: document.querySelector('#ui')?.parentElement?.tagName,
  }));
  expect(shape).toEqual({ mains: 1, game: 'MAIN', ui: 'MAIN' });
  await expect(page.getByRole('main')).toHaveCount(1);
});

/* ------------------------------------------------- 20, 21, 22, 23: the HUD and the deck */

for (const [width, height] of [
  [375, 812],
  [1280, 800],
  [844, 390],
] as const)
  test(`at ${width}x${height} the HUD's wells are square, the clock holds its width and the header is framed evenly`, async ({
    browser,
  }) => {
    const page = await pageAt(browser, width, height);
    await page.goto('/');
    await startGame(page);
    const well = (await page.locator('.otp-hud2__basket .otp-hud-slot').first().boundingBox())!;
    expect(Math.abs(well.width - well.height)).toBeLessThanOrEqual(0.5);
    // Item 21: the pill is the same width either side of the 0:30 change.
    const timer = page.locator('.otp-hud2__timer');
    await page.evaluate(() => window.__otp!.testClock.advance(180_000 - 31_500));
    await expect(page.locator('.otp-hud2__clock')).toHaveText('0:31');
    const calm = (await timer.boundingBox())!.width;
    await page.evaluate(() => window.__otp!.testClock.advance(2_000));
    await expect(page.locator('.otp-hud2__clock')).toHaveText('0:29');
    await expect(timer).toHaveAttribute('data-urgent', 'true');
    const urgent = (await timer.boundingBox())!.width;
    expect(Math.abs(calm - urgent)).toBeLessThanOrEqual(0.5);
    // Item 22: the music word on the caption floor, and the header framed evenly.
    const word = await page
      .locator('.otp-music__state')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(word).toBeGreaterThanOrEqual(11);
    const frame = (await page.locator('.otp-world-frame').boundingBox())!;
    const numeral = (await page.locator('.otp-world-frame .otp-panel__number').boundingBox())!;
    const music = (await page.locator('.otp-music').boundingBox())!;
    expect(music.height).toBeGreaterThanOrEqual(44);
    expect(
      Math.abs(frame.x + frame.width - (music.x + music.width) - (numeral.x - frame.x)),
    ).toBeLessThanOrEqual(0.5);
    await page.context().close();
  });

for (const [width, height] of [
  [1280, 800],
  [375, 812],
] as const)
  test(`at ${width}x${height} the stick and A sit the same distance from the deck's centre`, async ({
    browser,
  }) => {
    const page = await pageAt(browser, width, height);
    await page.goto('/');
    await startGame(page);
    const deck = (await page.locator('.otp-touch').boundingBox())!;
    const stick = (await page.locator('.otp-stick').boundingBox())!;
    const a = (await page.locator('.otp-a-button').boundingBox())!;
    const mid = deck.x + deck.width / 2;
    const left = mid - (stick.x + stick.width / 2);
    const right = a.x + a.width / 2 - mid;
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    await page.context().close();
  });

/* --------------------------------------------- 9, 11, 24, 25, 26: the offer on a phone */

test('at 375x812 the offer sits on the canvas edges, steps its type and puts Walk on in its header', async ({
  browser,
}) => {
  const page = await pageAt(browser, 375, 812);
  await page.goto('/');
  await startGame(page);
  const tops: number[] = [];
  const heights: number[] = [];
  for (const id of ['rabbit', 'owl', 'cat']) {
    await page.evaluate((c) => window.__otp!.store.dispatch({ type: 'MEET', c }), id);
    const offer = page.locator(`[data-offer="${id}"]`);
    await expect(offer).toBeVisible();
    await page.waitForTimeout(300);
    const m = await offer.evaluate((root) => {
      const fs = (s: string) => parseFloat(getComputedStyle(root.querySelector(s)!).fontSize);
      const panel = root.querySelector('.otp-panel')!.getBoundingClientRect();
      const canvas = document.querySelector('#game canvas')!.getBoundingClientRect();
      const link = root.querySelector('[data-action="walk-on"]')!.getBoundingClientRect();
      const pills = root.querySelector('.otp-verdicts')!.getBoundingClientRect();
      const lines = root.querySelectorAll('[data-card-take] li');
      const row = fs('.otp-row__heading');
      return {
        line: fs('.otp-dialogue__line'),
        promise: fs('.otp-card__promise'),
        row,
        eyebrow: fs('.otp-row__eyebrow'),
        edges: [panel.left - canvas.left, panel.right - canvas.right],
        title: root.querySelector('.otp-card__title')!.getBoundingClientRect().top,
        height: panel.height,
        // Walk on is the panel's close control since 2026-10-25: top right, in the header.
        walkOn: {
          right: panel.right - link.right,
          top: link.top - panel.top,
          ring: (() => {
            const x = root.querySelector('.otp-offer__walk-on-x')!.getBoundingClientRect();
            const head = root.querySelector('.otp-panel__header')!.getBoundingClientRect();
            return x.top + x.height / 2 - (head.top + head.height / 2);
          })(),
          below: link.bottom <= pills.top,
        },
        pitch:
          lines.length > 1
            ? lines[1]!.getBoundingClientRect().top - lines[0]!.getBoundingClientRect().top
            : 1.3 * row,
        rowSize: row,
      };
    });
    expect(m.line).toBeGreaterThan(m.promise);
    expect(m.promise).toBeGreaterThan(m.row);
    expect(m.row).toBeGreaterThan(m.eyebrow);
    for (const e of m.edges) expect(Math.abs(e)).toBeLessThanOrEqual(0.5);
    expect(m.walkOn.right).toBeGreaterThanOrEqual(0);
    expect(m.walkOn.right).toBeLessThanOrEqual(24);
    expect(m.walkOn.top).toBeGreaterThanOrEqual(0);
    expect(Math.abs(m.walkOn.ring), 'the ring is centred on the header').toBeLessThanOrEqual(1.5);
    expect(m.walkOn.below, 'above the answers, not beside them').toBe(true);
    expect(Math.abs(m.pitch - 1.3 * m.rowSize)).toBeLessThanOrEqual(1);
    tops.push(m.title);
    heights.push(m.height);
    await page.evaluate(() => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'BACK' });
      store.dispatch({ type: 'BACK' });
    });
    await expect(offer).toBeHidden();
  }
  // The title does not ride up and down, and the panel does not jump, card to card.
  for (const t of tops) expect(Math.abs(t - tops[0]!)).toBeLessThanOrEqual(0.5);
  for (const h of heights) expect(Math.abs(h - heights[0]!)).toBeLessThanOrEqual(0.5);
  await page.context().close();
});

/* ----------------------------------------------- 29: the post's outcome has a shape */

for (const [outcome, status, glyph] of [
  ['posted', 200, 'check'],
  ['refused', 400, 'missed'],
] as const)
  test(`a ${outcome} post shows the ${glyph} badge beside the same sentence`, async ({ page }) => {
    await page.route('**/api/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ seed: 0, token: 'dGVzdA.c2lnbmF0dXJl' }),
      }),
    );
    await page.route('**/api/top**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"entries":[]}' }),
    );
    await page.route('**/api/score', async (route) => {
      const sent = JSON.parse(route.request().postData() ?? '{}') as { handle?: string };
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(status === 200 ? { handle: sent.handle, score: 90 } : { error: 'no' }),
      });
    });
    await page.goto('/');
    await startGame(page);
    await answerAllAndArrive(page, 'leave');
    await toTheReveal(page);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const notice = page.locator('.otp-error');
    await expect(notice).not.toHaveText('');
    // The status carries the sentence and nothing else: the badge is its aria-hidden sibling.
    await expect(
      page.locator(`.otp-outcome .otp-recap__badge[data-glyph="${glyph}"]`),
    ).toBeVisible();
    await expect(page.locator('.otp-outcome .otp-recap__badge')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    // The footer's logo is never under 12px tall (item 29).
    const logo = (await page.locator('.otp-foot .otp-mark').boundingBox())!;
    expect(logo.height).toBeGreaterThanOrEqual(12);
  });

test('at 375 a name the board would refuse is said directly under its field', async ({
  browser,
}) => {
  const page = await pageAt(browser, 375, 812);
  await page.route('**/api/start', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ seed: 0, token: 'dGVzdA.c2lnbmF0dXJl' }),
    }),
  );
  await page.route('**/api/top**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"entries":[]}' }),
  );
  await page.goto('/');
  await startGame(page);
  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  const field = page.locator('#otp-handle-input');
  await field.fill('ab');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const problem = page.locator('#otp-handle-problem');
  await expect(problem).toBeVisible();
  await expect(field).toHaveAttribute('aria-describedby', 'otp-handle-problem otp-handle-hint');
  const input = (await field.boundingBox())!;
  const said = (await problem.boundingBox())!;
  const post = (await page.getByRole('button', { name: 'Post', exact: true }).boundingBox())!;
  expect(said.y).toBeGreaterThanOrEqual(input.y + input.height);
  expect(said.y - (input.y + input.height)).toBeLessThanOrEqual(16);
  expect(said.y + said.height).toBeLessThanOrEqual(post.y);
  await page.context().close();
});
