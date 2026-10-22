import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TILE } from '../src/world/logic';
import { ready } from './helpers';
import type { RunState } from './helpers';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The shipped content, read as a file: Playwright's loader takes no JSON import. */
const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as {
  skills: { id: string; icon: string }[];
  ui: {
    cabinet: { marquee: string };
    reveal: { caught: string; again: string; did: string; wouldHave: string };
  };
};

/*
 * THE v2 GAME, PLAYED THROUGH THE PAGE: landing, how-to, seven offers in walking order, the
 * arrival, the reveal, the post and the board.
 *
 * THE DEAL COMES FROM `POST /api/start`, so a spec chooses it by answering that route: `serveStart`
 * hands back a seed and a token, exactly as apps/api would. Seeds 0 to 34 are the 35 deals in
 * order (core v2/deal.ts). With the route left alone the preview server answers it with a 404, the
 * game deals from its own seed, and the reveal says posting is unavailable for that run.
 *
 * Purple is PLACED beside each character rather than walked there: the walk is what
 * world-reach.spec.ts and core's tour test cover, and seven walks per run would make this the
 * slowest spec in the suite for nothing it does not already know. The keyboard-only test below
 * walks the first one for real.
 */

const WALKING_ORDER = ['rabbit', 'toadstool', 'owl', 'magpie', 'snail', 'lantern-keeper', 'cat'];
const TOKEN = 'dGVzdA.c2lnbmF0dXJl';

/** Answers `POST /api/start` with this seed. Returns how many times the game asked. */
async function serveStart(page: Page, seed: number): Promise<() => number> {
  let asked = 0;
  await page.route('**/api/start', (route) => {
    asked += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ seed, token: TOKEN }),
    });
  });
  return () => asked;
}

/** An empty board, so the reveal's board section has something true to say. */
const serveEmptyBoard = (page: Page) =>
  page.route('**/api/top**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"entries":[]}' }),
  );

const state = (page: Page): Promise<RunState> =>
  page.evaluate(() => window.__otp!.store.getState());

const cast = (page: Page) => page.evaluate(() => window.__otp!.content.characters);
const skills = (page: Page) => page.evaluate(() => window.__otp!.content.skills);

async function begin(page: Page): Promise<void> {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Begin the walk' }).click();
  await expect(page.locator('[data-howto]')).toBeVisible();
  await page.getByRole('button', { name: 'Start walking' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
}

/** Puts Purple's feet at a character's own anchor (their tile's bottom edge), well inside reach. */
async function standBeside(page: Page, spawn: string): Promise<void> {
  await page.evaluate(
    ([name, tile]) => {
      const otp = window.__otp!;
      const o = otp.mapObjects!.find((m) => m.name === name)!;
      otp.scene!.position = { x: o.x + tile / 2, y: o.y + tile };
      otp.scene!.placePurple();
    },
    [spawn, TILE] as const,
  );
}

async function walkIntoCottage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const otp = window.__otp!;
    const door = otp.mapObjects!.find((m) => m.name === 'trigger-cottage')!;
    otp.scene!.position = { x: door.x + door.width / 2, y: door.y + door.height / 2 };
    otp.scene!.placePurple();
  });
}

/**
 * Meets the seven in walking order and answers each with `choose`. Every offer opens with its card
 * already showing (the client, 2026-10-22); with `read`, its lines are collected before answering.
 */
async function walkTheCast(
  page: Page,
  choose: (skillId: string, good: boolean) => 'take' | 'leave',
  read: boolean,
): Promise<Record<string, string[]>> {
  const { good } = await state(page);
  const people = await cast(page);
  expect(people.map((c) => c.id)).toEqual(WALKING_ORDER);
  const shown: Record<string, string[]> = {};
  for (const c of people) {
    await standBeside(page, c.spawn);
    await page.keyboard.press('e');
    const offer = page.locator(`[data-offer="${c.id}"]`);
    await expect(offer, `${c.id} opens their own offer`).toBeVisible();
    // The card is the offer's own body: no step between meeting someone and reading it.
    const panel = offer;
    await expect(panel, `${c.id} shows their card`).toHaveAttribute('data-card', c.skillId);
    await expect(panel.locator('[data-card-take] li').first()).toBeVisible();
    if (read) shown[c.skillId] = await panel.locator('[data-card-take] li').allTextContents();
    /*
     * An answer pressed within 300ms of its panel mounting, by a pointer that has not moved since,
     * is read as the second half of the double-click that opened it and ignored (components.tsx
     * `activationIsDeliberate`). A spec is faster than any player, so it waits that out.
     */
    await page.waitForTimeout(320);
    await panel.locator(`[data-action="${choose(c.skillId, good.includes(c.skillId))}"]`).click();
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
  }
  return shown;
}

/** From the door to the reveal: every line of the ending, then the way in. */
async function throughTheDoor(page: Page, ending: string): Promise<void> {
  const arrive = page.locator(`[data-arrive="${ending}"]`);
  await expect(arrive).toBeVisible();
  const finish = arrive.locator('[data-action="finish"]');
  while (!(await finish.isVisible())) await arrive.getByRole('button', { name: 'Go on' }).click();
  await finish.click();
  await expect(page.locator('.otp-reveal')).toBeVisible();
}

test('the careful run reads every card, sorts the seven, scores 100 and posts', async ({
  page,
}) => {
  test.slow();
  const asked = await serveStart(page, 0);
  await serveEmptyBoard(page);
  let posted: unknown = null;
  await page.route('**/api/score', async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: (posted as { handle: string }).handle, score: 100 }),
    });
  });

  await begin(page);
  expect(asked(), 'the run is started on the server once, at Begin').toBe(1);
  const before = await state(page);
  expect(before.seed, 'the server seed deals the run').toBe(0);
  expect(before.good).toHaveLength(3);

  const shown = await walkTheCast(page, (_id, good) => (good ? 'take' : 'leave'), true);
  // Each card showed the variant this deal dealt.
  const all = await skills(page);
  for (const s of all)
    expect(shown[s.id], s.id).toEqual(
      before.good.includes(s.id) ? s.good.card.take : s.bad.card.take,
    );
  const after = await state(page);
  expect(after.basket.map((b) => b.s).sort()).toEqual([...before.good].sort());

  await walkIntoCottage(page);
  await throughTheDoor(page, 'grandma');
  await expect(page.locator('[data-score]')).toHaveAttribute('data-score', '100');
  await expect(page.locator('[data-ending="grandma"]')).toContainText('Clean arrival');

  // The one Lime on the reveal is the research link, and it goes somewhere.
  const cta = page.getByRole('link', { name: /Read the research/ });
  await expect(cta).toHaveAttribute('href', /^https:\/\//);
  await expect(cta).toHaveAttribute('target', '_blank');

  // Post: the body carries the run log dealt from the server's seed, and the server's token.
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.locator('[data-announce="post"]')).toHaveAttribute(
    'data-notice',
    'handleAssigned',
  );
  const body = posted as { handle: string; token: string; log: { rules: number; seed: number } };
  expect(body.token).toBe(TOKEN);
  expect(body.log.rules).toBe(2);
  expect(body.log.seed).toBe(0);
});

test('the reveal shows every offer in walking order: kind, choice, line, giveaway, real world', async ({
  page,
}) => {
  test.slow();
  await serveStart(page, 34);
  await serveEmptyBoard(page);
  await begin(page);
  const { good } = await state(page);
  // Take the even ones, leave the odd ones: every kind of row turns up.
  let i = 0;
  await walkTheCast(page, () => (i++ % 2 === 0 ? 'take' : 'leave'), false);
  await walkIntoCottage(page);
  const ending = (await state(page)).basket.some((b) => !good.includes(b.s)) ? 'wolf' : 'grandma';
  await throughTheDoor(page, ending);

  const rows = page.locator('[data-reveal]');
  await expect(rows).toHaveCount(7);
  const all = await skills(page);
  const people = await cast(page);
  const { verdicts } = await state(page);
  for (const [n, c] of people.entries()) {
    const s = all.find((k) => k.id === c.skillId)!;
    const row = rows.nth(n);
    const isGood = good.includes(s.id);
    await expect(row, 'walking order').toHaveAttribute('data-reveal', s.id);
    await expect(row).toHaveAttribute('data-kind', isGood ? 'good' : 'bad');
    // Shape and word, never colour alone.
    await expect(row.locator('.otp-recap__badge')).toHaveAttribute(
      'data-glyph',
      isGood ? 'check' : 'missed',
    );
    await expect(row.locator('.otp-recap__status')).toHaveText(isGood ? 'Safe' : 'Unsafe');
    // Its own picture, named by the skill, at the art's own size: every painted pixel whole.
    const icon = row.locator('img.otp-reveal__icon');
    await expect(icon).toHaveAttribute('alt', s.name);
    const iconName = raw.skills.find((k) => k.id === s.id)!.icon;
    await expect(icon).toHaveAttribute('src', new RegExp(`${iconName}[^/]*\\.png`));
    const drawn = await icon.evaluate((img: HTMLImageElement) => ({
      natural: img.naturalWidth,
      shown: img.getBoundingClientRect().width,
      rendering: getComputedStyle(img).imageRendering,
    }));
    expect(drawn.natural, `${s.id} icon loaded`).toBeGreaterThan(0);
    expect(drawn.shown / drawn.natural, `${s.id} icon at a whole scale`).toBe(
      Math.round(drawn.shown / drawn.natural),
    );
    expect(drawn.rendering).toBe('pixelated');
    await expect(row.locator('.otp-reveal__chose')).toHaveText(
      verdicts[s.id] === 'take' ? 'You took' : 'You left',
    );
    await expect(row.locator('[data-reveal-line]')).toHaveText(
      isGood ? s.good.reveal : s.bad.reveal,
    );
    // A skill left behind never ran: its line is what it WOULD have done, not what it did.
    await expect(row.locator('[data-reveal-label]')).toHaveText(
      verdicts[s.id] === 'take' ? raw.ui.reveal.did : raw.ui.reveal.wouldHave,
    );
    const giveaway = s.bad.card.take.find((line) => !s.good.card.take.includes(line))!;
    if (isGood) await expect(row.locator('[data-giveaway]')).toHaveCount(0);
    else {
      await expect(row.locator('[data-giveaway]')).toContainText(giveaway);
      // The bad card as it was dealt, every line of it, with exactly the giveaway marked.
      await expect(row.locator('.otp-reveal__card > li')).toHaveText(s.bad.card.take);
      await expect(row.locator('[data-giveaway-line]')).toHaveCount(1);
      await expect(row.locator('[data-giveaway-line] mark')).toContainText(giveaway);
    }
    await expect(row.locator('[data-real-world]')).toContainText(s.realWorld.term);
    await expect(row.locator('[data-real-world]')).toContainText(s.realWorld.note);
  }

  // The replay hook: the bad skills left (unanswered counts as left), out of the bad skills dealt.
  const dealtBad = people.filter((c) => !good.includes(c.skillId));
  const caught = dealtBad.filter((c) => verdicts[c.skillId] !== 'take').length;
  await expect(page.locator('.otp-replay__caught')).toHaveText(
    raw.ui.reveal.caught
      .replace('{caught}', String(caught))
      .replace('{bad}', String(dealtBad.length)),
  );
  // Walk it again is right there with it, and it is not the screen's Lime.
  const again = page.locator('.otp-replay [data-action="replay"]');
  await expect(again).toHaveText(raw.ui.reveal.again);
  await expect(again).toHaveClass(/\botp-button\b/);
});

test('the greedy run takes everything and lets the wolf in at 0', async ({ page }) => {
  test.slow();
  await serveStart(page, 34);
  await serveEmptyBoard(page);
  await begin(page);
  await walkTheCast(page, () => 'take', false);
  expect((await state(page)).basket).toHaveLength(7);
  await walkIntoCottage(page);
  await throughTheDoor(page, 'wolf');
  await expect(page.locator('[data-score]')).toHaveAttribute('data-score', '0');
  await expect(page.locator('[data-ending="wolf"]')).toContainText("That's not Grandma");
});

test('the clock override ends a run late, and a late run is not posted', async ({ page }) => {
  await serveStart(page, 7);
  await serveEmptyBoard(page);
  await begin(page);
  await expect(page.locator('.otp-hud2__clock')).toHaveText(/^(3:00|2:5\d)$/);
  await page.evaluate(() => window.__otp!.testClock.advance(180_000));
  await throughTheDoor(page, 'late');
  const run = await state(page);
  expect(run.phase).toBe('late');
  expect(run.log.at(-1)?.e).toBe('late');
  await expect(page.locator('[data-ending="late"]')).toContainText('After dark');
  // No "kept 4 of 4" beside a 0 the clock gave: the count is not shown on a late run, the way back is.
  await expect(page.locator('.otp-replay__caught')).toHaveCount(0);
  await expect(page.locator('.otp-replay [data-action="replay"]')).toBeVisible();
  await expect(page.locator('[data-post="unavailable"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toHaveCount(0);
});

test('with no board the game deals its own seed and says posting is unavailable', async ({
  page,
}) => {
  // No route: the preview server has no /api/start, so startRun() answers null.
  await serveEmptyBoard(page);
  await begin(page);
  const run = await state(page);
  expect(run.good).toHaveLength(3);
  await walkIntoCottage(page);
  await throughTheDoor(page, 'grandma');
  await expect(page.locator('[data-score]')).toHaveAttribute('data-score', '10');
  await expect(page.locator('[data-post="unavailable"]')).toHaveText(
    'Posting is unavailable for this run.',
  );
});

test('walk it again starts a new run on the server and skips the how-to', async ({ page }) => {
  const asked = await serveStart(page, 3);
  await serveEmptyBoard(page);
  await begin(page);
  const first = (await state(page)).runId;
  await walkIntoCottage(page);
  await throughTheDoor(page, 'grandma');
  await page.getByRole('button', { name: 'Walk it again' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
  await expect(page.locator('[data-howto]')).toHaveCount(0);
  expect(asked(), 'one start per run').toBe(2);
  const second = await state(page);
  expect(second.runId).not.toBe(first);
  expect(second.log).toEqual([]);
});

test('keyboard only: begin, talk, read, answer, arrive, reveal, replay', async ({ page }) => {
  test.slow();
  await serveStart(page, 0);
  await serveEmptyBoard(page);
  await page.goto('/');
  await ready(page);

  // Tab to the landing's one call to action, and Enter.
  const beginButton = page.getByRole('button', { name: 'Begin the walk' });
  for (let n = 0; n < 10 && !(await beginButton.evaluate((b) => b === document.activeElement)); n++)
    await page.keyboard.press('Tab');
  await expect(beginButton).toBeFocused();
  await page.keyboard.press('Enter');
  // The how-to takes focus, so Enter is the skip.
  await expect(page.getByRole('button', { name: 'Start walking' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');

  const { good } = await state(page);
  for (const c of await cast(page)) {
    await standBeside(page, c.spawn);
    await page.keyboard.press('e');
    const card = page.locator(`[data-offer="${c.id}"][data-card="${c.skillId}"]`);
    // The card is open and focus lands on it, so nothing is pre-selected; then Take, Leave, Walk on.
    await expect(card.locator('.otp-card'), 'focus starts on reading').toBeFocused();
    const want = good.includes(c.skillId) ? 'take' : 'leave';
    const target = card.locator(`[data-action="${want}"]`);
    for (let n = 0; n < 6 && !(await target.evaluate((b) => b === document.activeElement)); n++)
      await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
  }

  await walkIntoCottage(page);
  const arrive = page.locator('[data-arrive="grandma"]');
  await expect(arrive).toBeVisible();
  const finish = arrive.locator('[data-action="finish"]');
  for (let n = 0; n < 8 && !(await finish.isVisible()); n++) {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
  }
  for (let n = 0; n < 4 && !(await finish.evaluate((b) => b === document.activeElement)); n++)
    await page.keyboard.press('Tab');
  await expect(finish).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-score]')).toHaveAttribute('data-score', '100');

  // The replay is reachable from the keyboard alone.
  const again = page.getByRole('button', { name: 'Walk it again' });
  for (let n = 0; n < 30 && !(await again.evaluate((b) => b === document.activeElement)); n++)
    await page.keyboard.press('Tab');
  await expect(again).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
});

/*
 * The advance ring has a 44px floor that does not scale with --otp-ui, so on a phone it sat on the
 * end of the first arrive line ("waves" at 360 and 375). The text column must end before the ring
 * begins on every beat that shows it.
 */
for (const width of [360, 375, 390]) {
  test(`at ${width}px the advance ring never sits on an arrive line`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await serveStart(page, 0);
    await serveEmptyBoard(page);
    await begin(page);
    await walkIntoCottage(page);
    const arrive = page.locator('[data-arrive="grandma"]');
    await expect(arrive).toBeVisible();
    const advance = arrive.locator('.otp-advance');
    for (let beat = 0; beat < 10 && (await advance.isVisible()); beat++) {
      const ring = (await advance.boundingBox())!;
      const words = (await arrive.locator('.otp-arrive__text').boundingBox())!;
      expect(
        words.x + words.width,
        `beat ${beat}: the text runs under the advance ring at ${width}px`,
      ).toBeLessThanOrEqual(ring.x);
      await advance.click();
    }
  });
}

for (const [width, height] of [
  [375, 812],
  [768, 1024],
  [1280, 800],
] as const) {
  test(`every screen fits ${width}px: no sideways scroll, and each screen's controls on screen`, async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize({ width, height });
    await serveStart(page, 0);
    await serveEmptyBoard(page);
    const noSideways = async (where: string) =>
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${where} scrolls sideways at ${width}px`,
      ).toBe(true);
    const onScreen = async (selector: string, where: string) => {
      const box = await page.locator(selector).first().boundingBox();
      expect(box, `${where}: ${selector} has no box`).not.toBeNull();
      expect(box!.x, `${where}: ${selector} off the left`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${where}: ${selector} off the right`).toBeLessThanOrEqual(
        width + 0.5,
      );
      expect(box!.y + box!.height, `${where}: ${selector} below the fold`).toBeLessThanOrEqual(
        height + 0.5,
      );
    };

    await page.goto('/');
    await ready(page);
    await onScreen('.otp-title__foot .otp-cta', 'landing');
    // No placeholder on the public landing: its label was internal wording, and the art is pending.
    await expect(page.locator('[data-slot="landing-background"]')).toHaveCount(0);
    await noSideways('landing');
    await page.getByRole('button', { name: 'Begin the walk' }).click();
    await onScreen('.otp-title__foot .otp-cta', 'how-to');
    await noSideways('how-to');
    await page.getByRole('button', { name: 'Start walking' }).click();
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
    await onScreen('.otp-hud2__clock', 'forest');
    await noSideways('forest');

    const rabbit = (await cast(page))[0]!;
    await standBeside(page, rabbit.spawn);
    await page.keyboard.press('e');
    // One panel, card open: both answers and the way past are on screen without scrolling the
    // page, and the page itself never scrolls -- a card too tall scrolls inside its panel.
    await onScreen('[data-offer] [data-action="take"]', 'offer');
    await onScreen('[data-offer] [data-action="leave"]', 'offer');
    await onScreen('[data-offer] [data-action="walk-on"]', 'offer');
    await onScreen('[data-offer] [data-card-take]', 'offer');
    await noSideways('offer');
    expect(
      await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight),
      'the page does not scroll under an offer',
    ).toBeLessThanOrEqual(0);
    // The only way out of an offer without answering is a touch target, not a 14px link.
    // Measured once the panel has slid into place: mid-slide its box sits on a fractional offset,
    // and top and bottom rounded apart read 44 as 43.99997 (seen once in a full run).
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => (a as CSSAnimation).animationName === 'otp-panel-in')
          .map((a) => a.finished),
      ),
    );
    const walkOn = (await page.locator('[data-offer] [data-action="walk-on"]').boundingBox())!;
    expect(
      walkOn.height,
      `Walk on is ${walkOn.height}px tall at ${width}px`,
    ).toBeGreaterThanOrEqual(44);
    expect(walkOn.width, `Walk on is ${walkOn.width}px wide at ${width}px`).toBeGreaterThanOrEqual(
      44,
    );
    await page.locator('[data-offer] [data-action="walk-on"]').click();

    await walkIntoCottage(page);
    await onScreen('[data-arrive] button', 'arrive');
    await throughTheDoor(page, 'grandma');
    await noSideways('reveal');
    // The reveal is long and scrolls inside its own panel; every row fits the width.
    const rows = page.locator('[data-reveal]');
    for (let n = 0; n < (await rows.count()); n++) {
      const box = (await rows.nth(n).boundingBox())!;
      expect(box.x + box.width, `row ${n} is wider than ${width}px`).toBeLessThanOrEqual(width);
    }
  });

  /*
   * "Step inside" was absolutely placed in the caret's corner and sat on the wolf's last line at
   * 375 and 768. The wolf and late endings carry the longest lines, so all three are checked.
   */
  test(`at ${width}px the way inside never covers an ending's words`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height });
    for (const ending of ['grandma', 'wolf', 'late'] as const) {
      await page.unrouteAll();
      await serveStart(page, 0);
      await serveEmptyBoard(page);
      await begin(page);
      if (ending === 'late') {
        await page.evaluate(() => window.__otp!.testClock.advance(180_000));
      } else {
        if (ending === 'wolf') {
          const { good } = await state(page);
          const bad = (await cast(page)).find((c) => !good.includes(c.skillId))!;
          await standBeside(page, bad.spawn);
          await page.keyboard.press('e');
          await page.waitForTimeout(320);
          await page.locator(`[data-offer="${bad.id}"] [data-action="take"]`).click();
          await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
        }
        await walkIntoCottage(page);
      }
      const arrive = page.locator(`[data-arrive="${ending}"]`);
      await expect(arrive).toBeVisible();
      const finish = arrive.locator('[data-action="finish"]');
      while (!(await finish.isVisible()))
        await arrive.getByRole('button', { name: 'Go on' }).click();
      const button = (await finish.boundingBox())!;
      const words = (await arrive.locator('.otp-arrive__text').boundingBox())!;
      const apart =
        button.y >= words.y + words.height ||
        button.y + button.height <= words.y ||
        button.x >= words.x + words.width ||
        button.x + button.width <= words.x;
      expect(apart, `${ending}: Step inside overlaps the ending text at ${width}px`).toBe(true);
      expect(button.x + button.width, `${ending}: Step inside off the right`).toBeLessThanOrEqual(
        width + 0.5,
      );
      expect(button.y + button.height, `${ending}: Step inside below the fold`).toBeLessThanOrEqual(
        height + 0.5,
      );
    }
  });
}
