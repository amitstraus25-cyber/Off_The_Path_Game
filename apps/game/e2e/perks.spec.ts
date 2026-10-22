import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { v2 } from '@otp/core';
import { INTERACT_RADIUS, TILE } from '../src/world/logic';
import { answerAllAndArrive, ready, toTheReveal } from './helpers';

/*
 * THE SEVEN PERKS, PLAYED (the client, 2026-10-22). Each skill's `effect` is what taking it does in
 * the forest, and it is the SAME in the good copy and the bad one -- so every perk is taken here in
 * both, from a pinned seed, and must do exactly the same thing. What the bad copy also does is only
 * ever said on its card and its reveal.
 *
 * THE SEEDS ARE PINNED AND CHECKED. Each row of `DEALS` says which skills a seed deals good, and
 * `deal()` asserts it against the real deal before a test leans on it, so a change to the deal fails
 * loudly here rather than quietly testing the wrong variant (PAUL_BRIEF trap 1). Everything else --
 * the rewind's ms, the knock, the dusk's start and cap, the flight's length -- is read from the
 * content, never written down.
 */

const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as unknown;
const content = v2.loadContent(raw);
const say = (key: string): string => content.ui.chrome[key as v2.ChromeKey];

const skillOf = (kind: v2.EffectKind) => content.skills.find((s) => s.effect.kind === kind)!;
const giverOf = (kind: v2.EffectKind) =>
  content.characters.find((c) => c.skillId === skillOf(kind).id)!;

/** Pinned seeds and what each deals good. Checked against the real deal in `deal()`. */
const DEALS: Readonly<Record<number, readonly string[]>> = {
  1: ['cottage-finder', 'way-teller', 'short-cut'],
  27: ['word-weaver', 'short-cut', 'latch-lifter'],
  28: ['word-weaver', 'slow-post', 'night-light'],
};

/** A seed that deals `kind`'s skill in the variant asked for. */
function seedFor(kind: v2.EffectKind, variant: 'good' | 'bad'): number {
  const id = skillOf(kind).id;
  const seed = Object.keys(DEALS)
    .map(Number)
    .find((s) => DEALS[s]!.includes(id) === (variant === 'good'));
  if (seed === undefined) throw new Error(`no pinned seed deals ${id} ${variant}`);
  return seed;
}

async function intoTheForest(page: Page): Promise<void> {
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Begin the walk' }).click();
  await page.getByRole('button', { name: 'Start walking' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-phase', 'forest');
}

/** Re-deals the run from `seed`, back in the forest at 0:00, and checks the deal is the pinned one. */
async function deal(page: Page, seed: number): Promise<void> {
  const good = await page.evaluate((s) => {
    const { store } = window.__otp!;
    store.dispatch({ type: 'RESET', seed: s });
    store.dispatch({ type: 'START', runId: `perks-${s}` });
    store.dispatch({ type: 'BEGIN' });
    return store.getState().good;
  }, seed);
  expect([...good].sort(), `seed ${seed} no longer deals what DEALS pins`).toEqual(
    [...DEALS[seed]!].sort(),
  );
}

/** Meets the giver of `kind` and takes it, through the store, from the card that opened itself. */
async function take(page: Page, kind: v2.EffectKind): Promise<void> {
  const giver = giverOf(kind);
  await page.evaluate(
    ({ c, s }) => {
      const { store } = window.__otp!;
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'VERDICT', s, v: 'take' });
    },
    { c: giver.id, s: giver.skillId },
  );
  await expect
    .poll(() => page.evaluate((s) => window.__otp!.store.getState().verdicts[s], giver.skillId))
    .toBe('take');
}

/** Meets and leaves everyone except the givers named, through the store. */
async function meetAllBut(page: Page, keep: readonly string[]): Promise<void> {
  await page.evaluate((skip) => {
    const { store, content } = window.__otp!;
    for (const c of content.characters) {
      if (skip.includes(c.id)) continue;
      store.dispatch({ type: 'MEET', c: c.id });
      store.dispatch({ type: 'VERDICT', s: c.skillId, v: 'leave' });
    }
  }, keep);
}

const toast = (page: Page) => page.locator('[data-toast]');

interface Scene {
  npcs: {
    id: string;
    x: number;
    y: number;
    sprite: { texture: { key: string }; flipX: boolean };
  }[];
  forkBoards: { visible: boolean }[];
  glow: { visible: boolean; alpha: number; blendMode: number; x: number; y: number } | null;
  flight: { fade: boolean } | null;
  flying: boolean;
  duskShown: number;
  doorOpen: boolean;
  paperBirdFlight: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    door: { x: number; y: number };
    flipped: boolean;
  } | null;
  position: { x: number; y: number };
  purplePosition: { x: number; y: number };
  placePurple(): void;
  move(x: number, y: number, deltaMs: number, carry: number | null): void;
  cameras: { main: { scrollX: number; scrollY: number } };
  children: { list: { texture?: { key: string } }[] };
}
/**
 * Reads the scene. An expression, not `new Function` in the page: the shipped CSP has no
 * 'unsafe-eval', and the devtools protocol that runs this is not subject to it.
 */
const scene = <T>(page: Page, read: (s: Scene) => T): Promise<T> =>
  page.evaluate(`(${read.toString()})(window.__otp.scene)`) as Promise<T>;

for (const variant of ['good', 'bad'] as const) {
  test.describe(`taken ${variant}`, () => {
    test(`the Wood Map draws the minimap, which nobody has without it (${variant})`, async ({
      page,
    }) => {
      await intoTheForest(page);
      await deal(page, seedFor('minimap', variant));
      await expect(page.locator('[data-minimap]')).toHaveCount(0);
      await take(page, 'minimap');
      await expect(page.locator('[data-minimap]')).toBeVisible();
      await expect(toast(page)).toHaveText(say('perkMinimap'));
    });

    test(`the Way Teller stands a sign at each fork naming who lives that way (${variant})`, async ({
      page,
    }) => {
      await intoTheForest(page);
      await deal(page, seedFor('fork-signs', variant));
      await expect(page.locator('[data-fork-signs]')).toHaveCount(0);
      expect(await scene(page, (s) => s.forkBoards.map((b) => b.visible))).not.toContain(true);
      await take(page, 'fork-signs');
      await expect(toast(page)).toHaveText(say('perkForkSigns'));
      // The toast is said in the store subscriber; the boards are shown by drawPerks() on the next
      // Phaser frame, so a single read straight after the toast can land before that frame.
      await expect
        .poll(() => scene(page, (s) => s.forkBoards.map((b) => b.visible)))
        .not.toContain(false);

      const chips = page.locator('.otp-forksign__chip');
      await expect(chips.first()).toBeAttached();
      const cast = new Set(content.characters.map((c) => c.id));
      const named = await chips.evaluateAll((all) =>
        all.map((c) => ({ who: c.getAttribute('data-who')!, heading: c.dataset['heading']! })),
      );
      const met = await page.evaluate(() => window.__otp!.store.getState().met);
      for (const n of named) {
        // A character, never the cottage, and somebody not met yet.
        expect(cast.has(n.who), n.who).toBe(true);
        expect(met, `${n.who} is already met and still on a sign`).not.toContain(n.who);
      }
      // The labels are DOM, over the canvas, and the canvas draws no words: the chip carries the name.
      await expect(chips.first().locator('.otp-forksign__name')).not.toBeEmpty();

      // Meet whoever the first fork names, and that heading moves on to somebody else (or empties).
      const first = page.locator('[data-fork="fork-1"] .otp-forksign__chip').first();
      const heading = await first.getAttribute('data-heading');
      const who = (await first.getAttribute('data-who'))!;
      await page.evaluate((id) => {
        const { store } = window.__otp!;
        store.dispatch({ type: 'MEET', c: id });
        store.dispatch({ type: 'BACK' });
        store.dispatch({ type: 'BACK' });
      }, who);
      await expect(
        page.locator(`[data-fork="fork-1"] [data-heading="${heading}"][data-who="${who}"]`),
      ).toHaveCount(0);

      // The sign near the spawn stands on screen, inside the world, on top of its board.
      const sign = (await page.locator('[data-fork="fork-1"] .otp-forksign__list').boundingBox())!;
      const world = (await page.locator('.otp-world-anchor').boundingBox())!;
      expect(sign.width).toBeGreaterThan(0);
      expect(sign.x).toBeGreaterThanOrEqual(world.x - 0.5);
      expect(sign.y + sign.height).toBeLessThanOrEqual(world.y + world.height + 0.5);
      await expect(page.locator('[data-fork-signs]')).toHaveAttribute('aria-hidden', 'true');
    });

    test(`the Word Weaver's bird flies towards Grandma, her door stands open, and there is no knock (${variant})`, async ({
      page,
    }) => {
      await intoTheForest(page);
      await deal(page, seedFor('early-welcome', variant));
      expect(await scene(page, (s) => s.doorOpen), 'the door stood open before the welcome').toBe(
        false,
      );
      await take(page, 'early-welcome');
      await expect(toast(page)).toHaveText(say('perkEarlyWelcome'));
      expect(
        await scene(page, (s) => s.children.list.some((c) => c.texture?.key === 'fx-paperbird')),
        'no paper bird took off',
      ).toBe(true);
      /*
       * THE BIRD FLIES TOWARDS GRANDMA (the client, 2026-10-22: "make sure it flies in the direction
       * of grandma and not the other direction"). Where it is headed is nearer the door than where
       * it took off, and the art -- drawn facing east -- is mirrored exactly when the door is west.
       */
      const flight = await scene(page, (s) => s.paperBirdFlight);
      expect(flight, 'the bird has no flight to read').not.toBeNull();
      const gap = (a: { x: number; y: number }) =>
        Math.hypot(flight!.door.x - a.x, flight!.door.y - a.y);
      expect(gap(flight!.to), 'the bird flew away from the door').toBeLessThan(gap(flight!.from));
      expect(Math.sign(flight!.to.x - flight!.from.x), 'east or west, as the door lies').toBe(
        Math.sign(flight!.door.x - flight!.from.x),
      );
      expect(flight!.flipped).toBe(flight!.door.x < flight!.from.x);
      // And the door stands open for the walk up the lane, on the next frame the forest draws.
      await expect.poll(() => scene(page, (s) => s.doorOpen), { timeout: 2000 }).toBe(true);
      await meetAllBut(page, []);
      const waited = await knockAtTheDoor(page);
      expect(waited, 'the welcome still made her knock and wait').toBeLessThan(
        content.world.knockMs,
      );
      // On arrival, Grandma is at the door already: the arrival opens on it.
      await expect(page.locator('[data-arrive] .otp-arrive__line').first()).toHaveText(
        say('doorWelcome'),
      );
    });

    test(`the Magpie's Wing Ride lands Purple at the next unmet friend (${variant})`, async ({
      page,
    }) => {
      await intoTheForest(page);
      await deal(page, seedFor('wing-ride', variant));
      const giver = giverOf('wing-ride');
      const expected = v2.wingRideTarget(content, [giver.id], giver.id)!;
      const ride = skillOf('wing-ride').effect as { flightMs: number };
      const scrollBefore = await scene(page, (s) => s.cameras.main.scrollX);
      await take(page, 'wing-ride');
      await expect(toast(page)).toHaveText(say('perkWingRide'));
      expect(await scene(page, (s) => s.flying), 'no flight took off').toBe(true);
      // Still in the forest while she is in the air; then the offer opens beside the right friend.
      expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('forest');
      await expect
        .poll(() => page.evaluate(() => window.__otp!.store.getState().active), {
          timeout: ride.flightMs + 5000,
        })
        .toBe(expected);
      await expect(page.locator('#game')).toHaveAttribute('data-phase', 'card');

      const landed = await scene(page, (s) => s.purplePosition);
      const spot = await page.evaluate(
        (spawn) => window.__otp!.mapObjects!.find((o) => o.name === spawn)!,
        content.characters.find((c) => c.id === expected)!.spawn,
      );
      const feet = { x: spot.x + TILE / 2, y: spot.y + TILE };
      expect(Math.hypot(landed.x - feet.x, landed.y - feet.y)).toBeLessThan(INTERACT_RADIUS);
      // The camera came with her.
      const scrollAfter = await scene(page, (s) => s.cameras.main.scrollX);
      expect(scrollAfter).not.toBe(scrollBefore);
      // And the meeting was stamped no sooner than the flight allows: the server refuses one inside it.
      const log = await page.evaluate(() => window.__otp!.store.getState().log);
      const took = log.find((e) => e.e === 'verdict')!;
      const met = log.filter((e) => e.e === 'met').at(-1)!;
      expect(met.at - took.at).toBeGreaterThanOrEqual(ride.flightMs);
    });

    test(`the Slow Post makes Purple walk faster (${variant})`, async ({ page }) => {
      await intoTheForest(page);
      await deal(page, seedFor('walk-faster', variant));
      const factor = (skillOf('walk-faster').effect as { factor: number }).factor;
      /** How far one 100ms step of the real walk carries her east from the spawn. */
      const stride = () =>
        scene(page, (s) => {
          const from = { x: s.position.x, y: s.position.y };
          s.move(1, 0, 100, null);
          const dx = s.position.x - from.x;
          s.position = from;
          s.placePurple();
          return dx;
        });
      const before = await stride();
      expect(before).toBeGreaterThan(0);
      await take(page, 'walk-faster');
      await expect(toast(page)).toHaveText(say('perkWalkFaster'));
      const after = await stride();
      expect(after / before).toBeCloseTo(factor, 5);
    });

    test(`the Night Light lights a warm circle round Purple (${variant})`, async ({ page }) => {
      await intoTheForest(page);
      await deal(page, seedFor('lantern', variant));
      expect(await scene(page, (s) => s.glow?.visible)).toBe(false);
      await take(page, 'lantern');
      await expect(toast(page)).toHaveText(say('perkLantern'));
      await expect.poll(() => scene(page, (s) => s.glow?.visible)).toBe(true);
      const lit = await scene(page, (s) => ({
        alpha: s.glow!.alpha,
        blend: s.glow!.blendMode,
        dx: Math.abs(s.glow!.x - s.position.x),
      }));
      expect(lit.dx).toBeLessThanOrEqual(1);
      expect(lit.blend, 'the glow is drawn additively').not.toBe(0);
      // It fills in as the dusk comes on.
      await page.evaluate(
        (ms) => window.__otp!.testClock.advance(ms),
        v2.TIME_LIMIT_MS - content.world.dusk.fromLeftMs / 2,
      );
      await expect.poll(() => scene(page, (s) => s.glow!.alpha)).toBeGreaterThan(lit.alpha);
    });

    test(`the Long Evening winds the clock back, and the time counts less (${variant})`, async ({
      page,
    }) => {
      await intoTheForest(page);
      await deal(page, seedFor('rewind', variant));
      const { ms } = skillOf('rewind').effect as { ms: number };
      await page.evaluate(() => window.__otp!.testClock.advance(60_000));
      const face = page.locator('.otp-hud2__clock');
      const seconds = async () => {
        const [m, s] = (await face.textContent())!.split(':').map(Number);
        return m! * 60 + s!;
      };
      // The HUD redraws four times a second: read the face only once it shows the minute gone.
      await expect.poll(seconds).toBeLessThanOrEqual(v2.TIME_LIMIT_MS / 1000 - 60);
      const before = await seconds();
      await take(page, 'rewind');
      await expect(toast(page)).toHaveText(
        say('perkRewind').replace('{seconds}', String(Math.round(ms / 1000))),
      );
      // A calm moment on the clock while it winds, then the face reads the time given back.
      await expect(page.locator('.otp-hud2__timer')).toHaveAttribute('data-winding', 'true');
      await expect(page.locator('.otp-hud2__timer')).toHaveAttribute('data-winding', 'false');
      expect((await seconds()) - before).toBeGreaterThanOrEqual(ms / 1000 - 2);

      // Past the bare three minutes the run is alive, with the time given back still on the clock.
      await page.evaluate(() => window.__otp!.testClock.advance(120_000 + 1_000));
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('forest');
      expect(await seconds()).toBeGreaterThan(0);

      // In through the door: the score counts the rewound time, faster than the real one.
      await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
      const state = (await page.evaluate(() =>
        window.__otp!.store.getState(),
      )) as unknown as v2.State;
      const run = v2.result(state, content);
      const arrived = state.log.find((e) => e.e === 'arrived')!.at;
      expect(run.rewoundMs).toBe(ms);
      expect(run.timeMs).toBe(arrived - ms);
      const without = v2.result({ ...state, perks: [] }, content);
      expect(run.timeMs!).toBeLessThan(without.timeMs!);
      expect(run.speed).toBeGreaterThanOrEqual(without.speed);
      // A clean run (the good copy) earns more for the same real arrival; a wolf run scores 0 either way.
      if (variant === 'good') expect(run.speed).toBeGreaterThan(without.speed);
    });
  });
}

/* ------------------------------------------------------------------------ the dusk and the knock */

test('dusk comes on from 2:00 left for everyone, gently, and never past the cap', async ({
  page,
}) => {
  await intoTheForest(page);
  const { fromLeftMs, darkest } = content.world.dusk;
  expect(await scene(page, (s) => s.duskShown)).toBe(0);
  await page.evaluate(
    (ms) => window.__otp!.testClock.advance(ms),
    v2.TIME_LIMIT_MS - fromLeftMs - 2000,
  );
  await page.waitForTimeout(300);
  expect(await scene(page, (s) => s.duskShown), 'dusk before 2:00 left').toBe(0);
  await page.evaluate(() => window.__otp!.testClock.advance(30_000));
  await expect.poll(() => scene(page, (s) => s.duskShown)).toBeGreaterThan(0);
  await page.evaluate((ms) => window.__otp!.testClock.advance(ms), fromLeftMs - 32_000 - 500);
  await expect.poll(() => scene(page, (s) => s.duskShown)).toBeGreaterThan(darkest * 0.9);
  expect(await scene(page, (s) => s.duskShown)).toBeLessThanOrEqual(darkest);
  // The world layer only: the HUD over it is not dimmed.
  const hud = await page.locator('.otp-hud2__timer').evaluate((el) => getComputedStyle(el).opacity);
  expect(hud).toBe('1');
});

/** Walks Purple up onto the doorstep and answers how long the door took to open, in run ms. */
async function knockAtTheDoor(page: Page): Promise<number> {
  const d = await page.evaluate(() =>
    window.__otp!.mapObjects!.find((m) => m.name === 'trigger-cottage')!,
  );
  await page.evaluate(
    ([x, y]) => {
      const otp = window.__otp!;
      otp.scene!.position = { x: x!, y: y! };
      otp.scene!.placePurple();
    },
    [d.x + d.width / 2, d.y + d.height + TILE * 0.75] as const,
  );
  await page.waitForTimeout(100);
  const t0 = await page.evaluate(() => window.__otp!.store.elapsed());
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('[data-arrive]')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.up('ArrowUp');
  const log = await page.evaluate(() => window.__otp!.store.getState().log);
  return log.find((e) => e.e === 'arrived')!.at - t0;
}

test('without word sent ahead, Purple knocks and waits the whole knock', async ({ page }) => {
  await intoTheForest(page);
  await meetAllBut(page, []);
  const waited = await knockAtTheDoor(page);
  expect(waited).toBeGreaterThanOrEqual(content.world.knockMs);
  // No welcome on an arrival that did not earn one.
  await expect(page.locator('[data-arrive] .otp-arrive__line').first()).not.toHaveText(
    say('doorWelcome'),
  );
});

test('a Wing Ride with nobody left to meet does nothing, and says so', async ({ page }) => {
  await intoTheForest(page);
  await meetAllBut(page, [giverOf('wing-ride').id]);
  const before = await scene(page, (s) => s.purplePosition);
  await take(page, 'wing-ride');
  await expect(toast(page)).toHaveText(say('perkWingRideNobody'));
  expect(await scene(page, (s) => s.flying)).toBe(false);
  expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('forest');
  expect(await scene(page, (s) => s.purplePosition)).toEqual(before);
});

test('under reduced motion the Wing Ride is a quick fade, and lands at the same friend', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await intoTheForest(page);
  const giver = giverOf('wing-ride');
  const expected = v2.wingRideTarget(content, [giver.id], giver.id)!;
  await take(page, 'wing-ride');
  expect(await scene(page, (s) => s.flight?.fade)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__otp!.store.getState().active), { timeout: 8000 })
    .toBe(expected);
});

/* -------------------------------------------------------------------------- the cast comes alive */

test('the cast breathe on their own idle strips, and hop once when Purple comes to talk', async ({
  page,
}) => {
  await intoTheForest(page);
  await expect
    .poll(() => scene(page, (s) => s.npcs.every((n) => n.sprite.texture.key.endsWith('-idle'))))
    .toBe(true);
  const who = content.characters[1]!;
  // Watch the sprite's sheet on every frame from the meeting on.
  const sheets = page.evaluate((id) => {
    const s = window.__otp!.scene as unknown as Scene;
    const npc = s.npcs.find((n) => n.id === id)!;
    const seen = new Set<string>();
    return new Promise<string[]>((resolve) => {
      const t0 = performance.now();
      const tick = (): void => {
        seen.add(npc.sprite.texture.key);
        if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
        else resolve([...seen]);
      };
      tick();
    });
  }, who.id);
  await page.evaluate((id) => window.__otp!.store.dispatch({ type: 'MEET', c: id }), who.id);
  const seen = await sheets;
  expect(
    seen.some((k) => k.endsWith('-hop')),
    `${who.id} never hopped: ${seen.join(', ')}`,
  ).toBe(true);
  // And back to breathing after the one hop.
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const s = window.__otp!.scene as unknown as Scene;
        return s.npcs.find((n) => n.id === id)!.sprite.texture.key;
      }, who.id),
    )
    .toMatch(/-idle$/);
});

test('a figure turns to face Purple when she comes near', async ({ page }) => {
  await intoTheForest(page);
  const id = content.characters[0]!.id;
  const flipAt = (dx: number) =>
    page.evaluate(
      ({ id, dx }) =>
        new Promise<boolean>((resolve) => {
          const s = window.__otp!.scene as unknown as Scene;
          const npc = s.npcs.find((n) => n.id === id)!;
          s.position = { x: npc.x + dx, y: npc.y + 24 };
          s.placePurple();
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(npc.sprite.flipX)));
        }),
      { id, dx },
    );
  const left = await flipAt(-TILE * 1.5);
  const right = await flipAt(TILE * 1.5);
  expect(left, 'the same way whichever side she stands').not.toBe(right);
});

test('under reduced motion nobody breathes and nobody hops', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await intoTheForest(page);
  const who = content.characters[1]!;
  await page.evaluate((id) => window.__otp!.store.dispatch({ type: 'MEET', c: id }), who.id);
  await page.waitForTimeout(800);
  const keys = await scene(page, (s) => s.npcs.map((n) => n.sprite.texture.key));
  for (const k of keys) expect(k, 'a sheet moved under reduced motion').not.toMatch(/-(idle|hop)$/);
});

/* ----------------------------------------------------------------------------------- the reveal */

test('a safe tile says what to watch for, and an unsafe one what happens in the real world', async ({
  page,
}) => {
  await intoTheForest(page);
  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  const tiles = await page.locator('[data-reveal]').evaluateAll((all) =>
    all.map((t) => ({
      kind: t.getAttribute('data-kind'),
      label: t.querySelector('.otp-reveal__term')?.textContent ?? '',
      line: t.querySelector('[data-reveal-line]')?.textContent ?? '',
    })),
  );
  expect(tiles.length).toBe(content.skills.length);
  for (const t of tiles) {
    expect(
      t.label.startsWith(t.kind === 'good' ? say('revealWatchFor') : content.ui.reveal.realWorld),
    ).toBe(true);
    // The line under "What it would have done" is the variant's own reveal, which names its perk.
    expect(t.line.length).toBeGreaterThan(0);
  }
  expect(tiles.some((t) => t.kind === 'good')).toBe(true);
  expect(tiles.some((t) => t.kind === 'bad')).toBe(true);
});
