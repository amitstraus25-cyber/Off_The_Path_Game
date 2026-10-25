import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { v2 } from '@otp/core';
import { TILE } from '../src/world/logic';
import {
  answerAllAndArrive,
  crossTheRiver,
  mapObject,
  ready,
  talkingDistance,
  toTheReveal,
} from './helpers';

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

/**
 * Pinned seeds and what each deals good. Checked against the real deal in `deal()`. Rules 3 deals
 * 8 ways: the Wood Map always good, one of Bridge Key and Wing Ride, one of the other four.
 */
const DEALS: Readonly<Record<number, readonly string[]>> = {
  0: ['cottage-finder', 'bridge-key', 'word-weaver'],
  3: ['cottage-finder', 'bridge-key', 'latch-lifter'],
  5: ['cottage-finder', 'short-cut', 'slow-post'],
  6: ['cottage-finder', 'short-cut', 'night-light'],
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

/** Puts Purple's feet at a point, as the scene's own placement does. */
async function standAt(page: Page, at: { x: number; y: number }): Promise<void> {
  await page.evaluate(
    ([x, y]) => {
      const otp = window.__otp!;
      otp.scene!.position = { x: x!, y: y! };
      otp.scene!.placePurple();
    },
    [at.x, at.y] as const,
  );
  await page.waitForTimeout(100);
}

/** Whether the collision Purple walks on is solid at a world point. */
const isSolid = (page: Page, x: number, y: number): Promise<boolean> =>
  page.evaluate(([px, py]) => window.__otp!.isSolidAt!(px!, py!), [x, y] as const);

interface Scene {
  npcs: {
    id: string;
    x: number;
    y: number;
    sprite: { texture: { key: string }; flipX: boolean };
  }[];
  gateStandsOpen: boolean;
  gateFalling: number | null;
  gateLeaf: { x: number; lowered: number; deckWidth: number } | null;
  gate: {
    art: { layer: { getTileAt(c: number, r: number): { index: number } | null } } | null;
  } | null;
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

/*
 * THE WOOD MAP IS ALWAYS DEALT GOOD (rules 3, `deal.always`): the first card teaches what a good card
 * looks like, so there is no bad copy to play and it is taken once.
 */
test('the Wood Map is always good, and draws the minimap, which nobody has without it', async ({
  page,
}) => {
  expect(content.deal.always).toContain(skillOf('minimap').id);
  await intoTheForest(page);
  await deal(page, 0);
  await expect(page.locator('[data-minimap]')).toHaveCount(0);
  await take(page, 'minimap');
  await expect(page.locator('[data-minimap]')).toBeVisible();
  await expect(toast(page)).toHaveText(say('perkMinimap'));
});

for (const variant of ['good', 'bad'] as const) {
  test.describe(`taken ${variant}`, () => {
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
      await crossTheRiver(page);
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

    test(`the Magpie's Wing Ride flies Purple over the river to the far bank (${variant})`, async ({
      page,
    }) => {
      await intoTheForest(page);
      await deal(page, seedFor('wing-ride', variant));
      const ride = skillOf('wing-ride').effect as { flightMs: number; lands: string };
      const landing = await mapObject(page, ride.lands);
      const gate = await mapObject(page, 'gate-bridge');
      await standAt(page, await talkingDistance(page, giverOf('wing-ride').spawn));
      const scrollBefore = await scene(page, (s) => s.cameras.main.scrollX);
      await take(page, 'wing-ride');
      await expect(toast(page)).toHaveText(say('perkWingRide'));
      expect(await scene(page, (s) => s.flying), 'no flight took off').toBe(true);
      // In the air, and still in the forest: there is nobody at the landing to meet.
      expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('forest');
      await expect
        .poll(() => scene(page, (s) => s.flying), { timeout: ride.flightMs + 5000 })
        .toBe(false);

      // Set down at the far bank's landing (or a step from it, if it is a pixel into a tree), and
      // across the river: east of the whole drawbridge span, which is still raised.
      const landed = await scene(page, (s) => s.purplePosition);
      expect(Math.hypot(landed.x - landing.x, landed.y - landing.y)).toBeLessThanOrEqual(TILE * 2);
      expect(landed.x).toBeGreaterThan(gate.x + gate.width);
      expect(await scene(page, (s) => s.gateStandsOpen), 'the flight lowered the bridge').toBe(
        false,
      );
      expect(await page.evaluate(() => window.__otp!.store.getState().active)).toBeNull();
      expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('forest');
      // The camera came with her.
      expect(await scene(page, (s) => s.cameras.main.scrollX)).not.toBe(scrollBefore);
      // And she can walk on from there: a step east moves her.
      const before = await scene(page, (s) => s.purplePosition);
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(300);
      await page.keyboard.up('ArrowRight');
      expect((await scene(page, (s) => s.purplePosition)).x).toBeGreaterThan(before.x);
    });

    test(`the Bridge Key lowers the drawbridge, and only then is it walkable (${variant})`, async ({
      page,
    }) => {
      await intoTheForest(page);
      await deal(page, seedFor('bridge-gate', variant));
      const gate = await mapObject(page, 'gate-bridge');
      await take(page, 'bridge-gate');
      await expect(toast(page)).toHaveText(say('perkBridgeGate'));
      await expect.poll(() => scene(page, (s) => s.gateStandsOpen)).toBe(true);
      expect(await isSolid(page, gate.x + TILE / 2, gate.y + TILE / 2)).toBe(false);
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

      // In through the door, over the river first (rules 3): the score counts the rewound time,
      // faster than the real one.
      await crossTheRiver(page);
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
  await crossTheRiver(page);
  await meetAllBut(page, []);
  const waited = await knockAtTheDoor(page);
  expect(waited).toBeGreaterThanOrEqual(content.world.knockMs);
  // No welcome on an arrival that did not earn one.
  await expect(page.locator('[data-arrive] .otp-arrive__line').first()).not.toHaveText(
    say('doorWelcome'),
  );
});

test('under reduced motion the Wing Ride is a quick fade, and lands on the far bank all the same', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await intoTheForest(page);
  const ride = skillOf('wing-ride').effect as { flightMs: number; lands: string };
  const landing = await mapObject(page, ride.lands);
  await take(page, 'wing-ride');
  expect(await scene(page, (s) => s.flight?.fade)).toBe(true);
  await expect
    .poll(() => scene(page, (s) => s.flying), { timeout: ride.flightMs + 5000 })
    .toBe(false);
  const landed = await scene(page, (s) => s.purplePosition);
  expect(Math.hypot(landed.x - landing.x, landed.y - landing.y)).toBeLessThanOrEqual(TILE * 2);
});

/* ---------------------------------------------------------------------- the river and the bridge */

/**
 * THE DRAWBRIDGE (docs/GATEKEEPER.md, and the client's late change of 2026-10-25: the gate is a
 * drawbridge, raised over the whole span until the key is taken, and seen coming down).
 */
test.describe('the drawbridge', () => {
  /** Purple a tile west of the span, on the deck's row, facing it. */
  const westOfTheSpan = async (page: Page) => {
    const gate = await mapObject(page, 'gate-bridge');
    const at = { x: gate.x - TILE, y: gate.y + gate.height / 2 + TILE / 4 };
    await standAt(page, at);
    expect(await isSolid(page, at.x, at.y), 'the west bank end of the bridge is walkable').toBe(
      false,
    );
    return { gate, at };
  };
  /** The tile the drawbridge's layer shows at a cell. */
  const tileAt = (page: Page, col: number, row: number) =>
    page.evaluate(
      ([c, r]) => {
        const s = window.__otp!.scene as unknown as Scene;
        return s.gate?.art?.layer.getTileAt(c!, r!)?.index ?? null;
      },
      [col, row] as const,
    );
  const gids = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../src/assets/tileset-forest.gids.json', import.meta.url)),
      'utf8',
    ),
  ) as Record<string, number>;

  test('is raised from the start: Purple cannot walk onto it, and bumping it says why', async ({
    page,
  }) => {
    await intoTheForest(page);
    const { gate, at } = await westOfTheSpan(page);
    // Raised over every cell of the span: the river shows where the deck will be.
    const row = Math.floor(gate.y / TILE);
    const col0 = Math.floor(gate.x / TILE);
    const cols = Math.round(gate.width / TILE);
    expect(await tileAt(page, col0, row)).toBe(gids['bridge-gate-shut-0']);
    for (let i = 1; i < cols - 1; i++)
      expect(await tileAt(page, col0 + i, row)).toBe(gids['bridge-gate-shut-1']);
    expect(await tileAt(page, col0 + cols - 1, row)).toBe(gids['bridge-gate-shut-2']);

    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(900);
    await page.keyboard.up('ArrowRight');
    const stopped = await scene(page, (s) => s.purplePosition);
    expect(stopped.x, 'she walked onto the raised drawbridge').toBeLessThan(gate.x);
    expect(stopped.x, 'she never reached it').toBeGreaterThan(at.x);
    await expect(toast(page)).toHaveText(say('gateLocked'));
    expect(await scene(page, (s) => s.gateStandsOpen)).toBe(false);
  });

  test('comes down when the Bridge Key is taken -- falling, then down -- and is walkable once it is', async ({
    page,
  }) => {
    await intoTheForest(page);
    const { gate } = await westOfTheSpan(page);
    const mid = { x: gate.x + gate.width / 2, y: gate.y + gate.height / 2 };
    // Watch every frame from the take: how far it has fallen, and whether the deck is solid.
    const watched = page.evaluate(
      ([x, y]) =>
        new Promise<{
          fall: (number | null)[];
          solidWhileFalling: boolean[];
          leaf: ({ x: number; lowered: number; deckWidth: number } | null)[];
          open: boolean;
        }>((resolve) => {
          const otp = window.__otp!;
          const s = otp.scene as unknown as Scene;
          const fall: (number | null)[] = [];
          const solidWhileFalling: boolean[] = [];
          const leaf: ({ x: number; lowered: number; deckWidth: number } | null)[] = [];
          const t0 = performance.now();
          const tick = (): void => {
            const f = s.gateFalling;
            fall.push(f);
            if (f !== null) {
              solidWhileFalling.push(otp.isSolidAt!(x!, y!));
              leaf.push(s.gateLeaf);
            }
            if (performance.now() - t0 < 2500 && !s.gateStandsOpen) requestAnimationFrame(tick);
            else resolve({ fall, solidWhileFalling, leaf, open: s.gateStandsOpen });
          };
          tick();
        }),
      [mid.x, mid.y] as const,
    );
    await take(page, 'bridge-gate');
    const { fall, solidWhileFalling, leaf, open } = await watched;
    expect(open, 'the drawbridge never came down').toBe(true);
    const falling = fall.filter((f): f is number => f !== null);
    expect(falling.length, 'it was down at once: nothing was seen falling').toBeGreaterThan(2);
    expect(
      falling.some((f) => f > 0 && f < 1),
      'never part-way down',
    ).toBe(true);
    for (let i = 1; i < falling.length; i++)
      expect(falling[i]!, 'it went back up').toBeGreaterThanOrEqual(falling[i - 1]!);
    // Not walkable in the air: the deck is solid for every frame it is falling.
    expect(solidWhileFalling.every(Boolean), 'walkable before it was down').toBe(true);
    // Not a wipe: the raised leaf is drawn at the deck's leading edge on every falling frame
    // (world/gate.ts leafOffset), and is seen part-way across the river.
    expect(
      leaf.every((l) => l !== null),
      'a falling frame without the leaf',
    ).toBe(true);
    for (const l of leaf) expect(l!.x).toBe(Math.max(0, l!.lowered - TILE));
    expect(
      leaf.some((l) => l!.x > 0 && l!.x < l!.deckWidth - TILE),
      'the leaf was never seen mid-river',
    ).toBe(true);

    // Down: the lowered tiles on every cell, the collision lifted, and Purple walks across.
    const row = Math.floor(gate.y / TILE);
    const col0 = Math.floor(gate.x / TILE);
    expect(await tileAt(page, col0, row)).toBe(gids['bridge-gate-open-0']);
    expect(await tileAt(page, col0 + 1, row)).toBe(gids['bridge-gate-open-1']);
    expect(await tileAt(page, col0 + Math.round(gate.width / TILE) - 1, row)).toBe(
      gids['bridge-gate-open-2'],
    );
    expect(await isSolid(page, mid.x, mid.y)).toBe(false);
    await page.keyboard.down('ArrowRight');
    await expect
      .poll(async () => (await scene(page, (s) => s.purplePosition)).x, { timeout: 6000 })
      .toBeGreaterThan(gate.x + gate.width);
    await page.keyboard.up('ArrowRight');
  });

  test('under reduced motion it is simply down, with nothing seen falling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await intoTheForest(page);
    const { gate } = await westOfTheSpan(page);
    const watched = page.evaluate(
      () =>
        new Promise<(number | null)[]>((resolve) => {
          const s = window.__otp!.scene as unknown as Scene;
          const seen: (number | null)[] = [];
          const t0 = performance.now();
          const tick = (): void => {
            seen.push(s.gateFalling);
            if (performance.now() - t0 < 600) requestAnimationFrame(tick);
            else resolve(seen);
          };
          tick();
        }),
    );
    await take(page, 'bridge-gate');
    expect((await watched).every((f) => f === null)).toBe(true);
    await expect.poll(() => scene(page, (s) => s.gateStandsOpen)).toBe(true);
    expect(await isSolid(page, gate.x + gate.width / 2, gate.y + gate.height / 2)).toBe(false);
  });

  test('a replay raises it again', async ({ page }) => {
    await intoTheForest(page);
    const gate = await mapObject(page, 'gate-bridge');
    await take(page, 'bridge-gate');
    await expect.poll(() => scene(page, (s) => s.gateStandsOpen)).toBe(true);
    await deal(page, 0);
    await expect.poll(() => scene(page, (s) => s.gateStandsOpen)).toBe(false);
    expect(await isSolid(page, gate.x + gate.width / 2, gate.y + gate.height / 2)).toBe(true);
    expect(await tileAt(page, Math.floor(gate.x / TILE), Math.floor(gate.y / TILE))).toBe(
      gids['bridge-gate-shut-0'],
    );
  });
});

test('the door refuses a run that never crossed the river', async ({ page }) => {
  await intoTheForest(page);
  await meetAllBut(page, []);
  const refused = await page.evaluate(() =>
    window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }),
  );
  expect(refused).toBe('not-across');
  expect(await page.evaluate(() => window.__otp!.store.getState().phase)).toBe('forest');
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
