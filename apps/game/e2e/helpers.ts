import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// The real constants, not copies: `logic.ts` is pure TypeScript with no Phaser and no DOM, so the
// walking helpers below pace themselves off the same numbers the game walks at. They used to carry
// a hardcoded 60 px/s and a 20px tolerance, which were right for 16px tiles and silently wrong the
// moment the art moved to 32px -- every walk overshot by exactly its own length and oscillated.
import { TILE, WALK_SPEED } from '../src/world/logic';

export interface Probe {
  phase: string;
  position: { x: number; y: number };
  verdicts: Record<string, string>;
  /** Skill ids in the basket, in the order taken. */
  basket: string[];
  activeCharacter: string | null;
  log: { e: string }[];
}

/** The v2 run state, as much of it as a spec reads. */
export interface RunState {
  phase: string;
  seed: number;
  /** The skills dealt good this run. */
  good: string[];
  runId: string | null;
  active: string | null;
  met: string[];
  inspected: string[];
  verdicts: Record<string, string>;
  basket: { s: string; v: string }[];
  log: { e: string; at: number }[];
}

declare global {
  interface Window {
    __otp?: {
      bus: { emit(event: string, payload: Record<string, unknown>): void };
      store: {
        getState(): RunState;
        dispatch(action: Record<string, unknown>): string | null;
        elapsed(): number;
      };
      content: {
        characters: { id: string; name: string; spawn: string; skillId: string }[];
        world: { crossing?: string[] };
        skills: {
          id: string;
          name: string;
          effect: { kind: string };
          good: { card: { take: string[]; leave: string }; reveal: string };
          bad: { card: { take: string[]; leave: string }; reveal: string };
          realWorld: { term: string; note: string };
        }[];
      };
      /** The run clock's e2e override: a skew added to the clock, never the limit. */
      testClock: { advance(ms: number): void };
      scene?: {
        purplePosition: { x: number; y: number };
        position: { x: number; y: number };
        placePurple(): void;
      };
      isSolidAt?: (x: number, y: number) => boolean;
      mapObjects?: { name: string; x: number; y: number; width: number; height: number }[];
    };
  }
}

export const ready = (page: Page) => page.waitForSelector('#game[data-ready="true"]');

/**
 * Tags a DOM node so a later render can be asked whether it is still the same object.
 *
 * This is the live-region trick the a11y specs are built on: a region inserted into the DOM
 * already containing its text is announced by no screen reader -- they announce MUTATIONS to a
 * region that was already there -- so a test that only checks "the text is present" passes on the
 * broken case too. A remount loses the tag; a mutation keeps it.
 */
export const tag = (page: Page, selector: string, mark: string): Promise<void> =>
  page
    .locator(selector)
    .evaluate((el, m) => void ((el as unknown as Record<string, string>)['__otpTag'] = m), mark);

export const tagOf = (page: Page, selector: string): Promise<string | null> =>
  page
    .locator(selector)
    .evaluate((el) => (el as unknown as Record<string, string>)['__otpTag'] ?? null);

/** Clicks past the title screen and the how-to into the forest. */
export async function startGame(page: Page): Promise<void> {
  await ready(page);
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.getByRole('button', { name: /Start walking/ }).click();
  await page.waitForFunction(() => window.__otp?.store.getState().phase === 'forest');
}

/**
 * Types a name into the empty name field, as a player now must: the field starts empty and nothing
 * suggests one (the client, 2026-10-25). A field already holding a name is left as it is.
 */
export async function typeAName(page: Page, name = 'Little Purple'): Promise<void> {
  const field = page.locator('#otp-handle-input');
  if ((await field.inputValue()) === '') await field.fill(name);
}

/**
 * From the cottage door (or the late ending) to the reveal: every line of the arrival, then the
 * way in. The v2 rules have no FINISH: the run ended at the door, and this is the view walking on.
 */
export async function toTheReveal(page: Page): Promise<void> {
  const finish = page.locator('[data-arrive] [data-action="finish"]');
  await page.locator('[data-arrive]').waitFor();
  while (!(await finish.isVisible())) await page.getByRole('button', { name: 'Go on' }).click();
  await finish.click();
  await page.locator('.otp-reveal').waitFor();
  /*
   * And the screen has taken focus. Results focuses its own body in an after-paint effect, which
   * Preact runs up to a frame (or its 100ms fallback) after the screen is in the DOM; a spec that
   * starts tabbing before then has focus pulled back out from under it, mid-test -- seen as a card
   * that opened on Enter and then ignored Space, because Space went to the body.
   */
  await expect(page.locator('.otp-screen__body')).toBeFocused();
  /*
   * A name in the field, as the player who posts will have typed. The field starts empty since the
   * client's call of 2026-10-25, and the specs that reach this point are about what happens next.
   * Set through an input event rather than `fill`, so focus stays where the screen put it.
   */
  const field = page.locator('#otp-handle-input');
  if (await field.count())
    await field.evaluate((el: HTMLInputElement) => {
      if (el.value !== '') return;
      el.value = 'Little Purple';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

/**
 * THROUGH THE CONVERSATION TO THE CARD (the client, 2026-10-26): "What have you got?", then "Show
 * me". Meeting someone opens the conversation, not the card. Waits out the double-click guard first
 * (components.tsx `activationIsDeliberate`), because a spec is faster than any player.
 */
export async function askToSee(page: Page, who?: string): Promise<void> {
  const offer = who ? `[data-offer="${who}"]` : '[data-offer]';
  const talk = page.locator(`${offer}[data-talk]`);
  await expect(talk).toBeVisible();
  await page.waitForTimeout(320);
  await talk.locator('[data-action="ask"]').click();
  await talk.locator('[data-action="show-me"]').click();
  await expect(page.locator(`${offer}[data-card]`)).toBeVisible();
}

/**
 * Answers every offer through the store and walks in: a whole run with no walking, for the specs
 * that need the end of a run and not the path to it. `take` takes everything.
 *
 * `leave` leaves everything BUT THE HONEST WAY OVER THE RIVER. Since rules 3 (docs/GATEKEEPER.md)
 * the cottage is across the river and the door refuses a run that took no crossing skill
 * ('not-across'), so "leave all seven" never reaches the door at all -- it is the late ending. The
 * nearest run that does is the careful player's answer at the river and a leave everywhere else:
 * take whichever of the two crossings (`world.crossing`) this deal dealt good, which keeps the run
 * clean and on Grandma's ending, as "leave everything" was before the river.
 */
export async function answerAllAndArrive(page: Page, verdict: 'take' | 'leave'): Promise<void> {
  await page.evaluate((v) => {
    const { store, content } = window.__otp!;
    const good = store.getState().good;
    const crossing = content.world.crossing ?? [];
    const honestCrossing = content.skills.find(
      (s) => crossing.includes(s.effect.kind) && good.includes(s.id),
    )?.id;
    for (const c of content.characters) {
      store.dispatch({ type: 'MEET', c: c.id });
      store.dispatch({ type: 'INSPECT', s: c.skillId });
      const take = v === 'take' || c.skillId === honestCrossing;
      store.dispatch({ type: 'VERDICT', s: c.skillId, v: take ? 'take' : 'leave' });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, verdict);
}

/**
 * TAKES THE HONEST WAY OVER THE RIVER, through the store: the one of the two crossings
 * (`world.crossing`, docs/GATEKEEPER.md) this deal dealt good, from its giver -- and waits out the
 * Wing Ride's flight if that is the one, so whatever the spec does next starts with Purple on her
 * feet. Since rules 3 the door refuses a run that crossed by neither ('not-across'), so a spec that
 * places Purple at the cottage without walking there takes this first. Answers the skill taken.
 */
export async function crossTheRiver(page: Page): Promise<string> {
  const taken = await page.evaluate(() => {
    const { store, content } = window.__otp!;
    const { good } = store.getState();
    const crossing = content.world.crossing ?? [];
    const skill = content.skills.find(
      (s) => crossing.includes(s.effect.kind) && good.includes(s.id),
    )!;
    const giver = content.characters.find((c) => c.skillId === skill.id)!;
    store.dispatch({ type: 'MEET', c: giver.id });
    store.dispatch({ type: 'VERDICT', s: skill.id, v: 'take' });
    return skill.id;
  });
  await expect
    .poll(() => page.evaluate((s) => window.__otp!.store.getState().verdicts[s], taken))
    .toBe('take');
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window.__otp!.scene as { flying?: boolean } | undefined)?.flying ?? false,
        ),
      {
        timeout: 10_000,
      },
    )
    .toBe(false);
  return taken;
}

/** Whether this run has taken either way over the river yet (`world.crossing`). */
export const hasCrossed = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const { store, content } = window.__otp!;
    const crossing = content.world.crossing ?? [];
    return store
      .getState()
      .basket.some((b) =>
        crossing.includes(content.skills.find((s) => s.id === b.s)?.effect.kind ?? ''),
      );
  });

/**
 * Puts Purple on the road midway between the first two characters in walking order (the Rabbit and
 * the Gatekeeper), so a wide window frames three figures. Since rules 3 the opening shot frames
 * Purple and the Rabbit only -- the Toadstool who stood near the spawn is now the Gatekeeper, at
 * the bridge's west end -- and the specs that measure figures "in shot" need more than two.
 *
 * ON A PATH TILE, the nearest one to the midpoint, read from the shipped map: her contact shadow is
 * tinted from the ground it sits on, and on the dark lawn it reads at a tenth of what it does on the
 * path (measured 3 pixels against 68), which is a fact about the lawn and not the shadow. The
 * opening shot she replaces stood her on the path. Returns once the camera is still on her.
 */
export async function standBetweenTheFirstTwo(page: Page): Promise<{ x: number; y: number }> {
  const objects = await page.evaluate(() => {
    const otp = window.__otp!;
    return otp.content.characters
      .slice(0, 2)
      .map((c) => otp.mapObjects!.find((o) => o.name === c.spawn)!);
  });
  const mid = {
    x: (objects[0]!.x + objects[1]!.x) / 2 + TILE / 2,
    y: (objects[0]!.y + objects[1]!.y) / 2 + TILE,
  };
  const asset = (name: string): unknown =>
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../src/assets/${name}`, import.meta.url)), 'utf8'),
    );
  const map = asset('map-forest.json') as {
    width: number;
    height: number;
    layers: { name: string; data?: number[] }[];
  };
  const names = new Map(
    Object.entries(asset('tileset-forest.gids.json') as Record<string, number>).map(([k, v]) => [
      v,
      k,
    ]),
  );
  const layer = (n: string) => map.layers.find((l) => l.name === n)!.data!;
  const ground = layer('ground');
  const collision = layer('collision');
  let best: { x: number; y: number; d: number } | null = null;
  for (let row = 0; row < map.height; row++)
    for (let col = 0; col < map.width; col++) {
      const i = row * map.width + col;
      // The top three bits of a Tiled gid are flips, not the tile.
      const name = names.get(ground[i]! & 0x1fffffff) ?? '';
      if (collision[i] !== 0 || !name.startsWith('path')) continue;
      const at = { x: (col + 0.5) * TILE, y: (row + 0.75) * TILE };
      const d = Math.hypot(at.x - mid.x, at.y - mid.y);
      if (!best || d < best.d) best = { ...at, d };
    }
  const at = { x: best!.x, y: best!.y };
  await page.evaluate(
    ([x, y]) => {
      const otp = window.__otp!;
      otp.scene!.position = { x: x!, y: y! };
      otp.scene!.placePurple();
    },
    [at.x, at.y] as const,
  );
  expect(
    await page.evaluate(([x, y]) => window.__otp!.isSolidAt!(x!, y!), [at.x, at.y] as const),
    `(${at.x}, ${at.y}) between the first two is not on the road`,
  ).toBe(false);
  // And the camera has come to rest on her: a shot measured mid-pan is two different pictures.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const main = (
          window.__otp!.scene as unknown as {
            cameras: { main: { scrollX: number; scrollY: number } };
          }
        ).cameras.main;
        let last = '';
        let still = 0;
        const tick = (): void => {
          const now = `${main.scrollX},${main.scrollY}`;
          still = now === last ? still + 1 : 0;
          last = now;
          if (still >= 20) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  return at;
}

export async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const otp = window.__otp!;
    const s = otp.store.getState();
    return {
      phase: s.phase,
      position: otp.scene?.purplePosition ?? { x: 0, y: 0 },
      verdicts: s.verdicts,
      basket: s.basket.map((b) => b.s),
      activeCharacter: s.active,
      log: s.log,
    };
  });
}

/** Holds a key for a number of milliseconds of real time. */
export async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(60);
}

/** Walks until the predicate is true or the budget runs out; returns whether it got there. */
export async function walkUntil(
  page: Page,
  key: string,
  done: (p: Probe) => boolean,
  budgetMs = 12_000,
): Promise<Probe> {
  let last = await probe(page);
  let spent = 0;
  while (!done(last) && spent < budgetMs) {
    await hold(page, key, 400);
    spent += 400;
    last = await probe(page);
  }
  return last;
}

export interface MapObject {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Landmark positions come from the generated map, so the tests survive a map regeneration. */
export async function mapObject(page: Page, name: string): Promise<MapObject> {
  const found = await page.evaluate(
    (n) => window.__otp?.mapObjects?.find((o) => o.name === n) ?? null,
    name,
  );
  if (!found) throw new Error(`Map has no object "${name}"`);
  return found;
}

/**
 * Where an NPC can actually be TALKED to, which is not where the map object is.
 *
 * `npc-rabbit` is a tile at (416, 608); the person standing on it answers at (432, 640), because
 * the spawn is centred in its tile and the sprite's origin is its feet. Walking to the object's own
 * corner parks Purple short of being able to say anything -- which is exactly how
 * e2e/world-reach.spec.ts was wrong first time round.
 *
 * Both offsets are derived from TILE rather than typed: half a tile across to the centre of the
 * spawn tile, and a tile down to where her feet stand. They used to be bare `+16, +40` literals
 * repeated across five spec files, which were right at TILE = 32 and silently wrong at any other
 * size -- the same drift that made the walking helpers above overshoot when the art moved from
 * 16px tiles to 32px.
 *
 * THE `+ 8` IS GONE, AND IT COST A ROUND. This read `spot.y + TILE + 8` from 37a94b9, where it was
 * CORRECT: `createCharacter` then placed the sprite at `spawn.y + NPC_SPRITE.height / 2` and the
 * NPC sheets are 48px tall, so the anchor was tile-centre + 24 = o.y + 40, and `TILE + 8` is
 * literally 16 + 24 restated. The very next commit, 6452ece, changed that line to
 * `spawn.y + TILE / 2` -- its own docstring says why: "every one of the eight stood 8px into the
 * tile below their own" -- which moved the whole cast 8px north to o.y + 32. This file was not
 * touched and kept encoding the old anchor.
 *
 * Eight pixels, and it read as a hole in the map. `walkTo`'s tolerance is `TILE * 1.25` = 40 and
 * the north approach to a cast member is EXACTLY 40.00px, margin zero, so Purple landing 3px off
 * centre at (333,704) measured 40.11 to the stale target and threw "Something is in the corridor."
 * Against the real anchor it is 32.14, inside tolerance with 8px to spare, and `INTERACT_RADIUS` is
 * 48 -- she could always talk. The game was never broken; the test measured to a point that had
 * moved. A whole round was spent hunting a collision tile at (10,22) that is the toadstool's own
 * spawn cell, deliberately solid under the "nobody in the cast is a ghost" invariant.
 *
 * THERE ARE THREE ANCHORS FOR THIS ONE POINT and nothing asserts they agree: here (o.y + 32, now
 * correct), `createCharacter` in src/world/forest-scene.ts (o.y + 32, the truth that `nearest()`
 * measures against), and `map.test.ts`'s `centre` (o.y + 16, a different thing for a different
 * purpose). That is why an 8px move landed silently in e2e instead of in `pnpm test`. The real fix
 * is one exported `castAnchor()` both callers read; until then, `test/cast-anchor.test.ts` fails if
 * these two drift again.
 */
export async function talkingDistance(page: Page, name: string): Promise<{ x: number; y: number }> {
  const spot = await mapObject(page, name);
  return { x: spot.x + TILE / 2, y: spot.y + TILE };
}

/** Walks away from an offer if Purple has stumbled into one, so a walk across the map is not blocked. */
export async function dismissNotice(page: Page): Promise<void> {
  const walkOn = page.locator('[data-action="walk-on"]');
  if ((await walkOn.count()) > 0) await walkOn.first().click();
}

/**
 * Walks towards a point, one axis at a time, and THROWS if the budget runs out short of it.
 *
 * It used to return the last probe either way. Ten call sites await it and not one of them looks
 * at what comes back, so a map regeneration that drops a bush into the corridor did not fail here:
 * it failed several seconds later, in five different spec files, as a locator timing out on a
 * dialogue that never opened. The arrival is the precondition every one of those tests is built
 * on, so it is asserted where it happens, with the gap in the message.
 */
export async function walkTo(
  page: Page,
  target: { x: number; y: number },
  // A tile and a quarter: comfortably inside INTERACT_RADIUS, so arriving means she can talk.
  within = TILE * 1.25,
  budgetMs = 30_000,
): Promise<Probe> {
  let spent = 0;
  let last = await probe(page);
  while (spent < budgetMs) {
    const dx = target.x - last.position.x;
    const dy = target.y - last.position.y;
    if (Math.hypot(dx, dy) <= within) break;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const key = horizontal
      ? dx > 0
        ? 'ArrowRight'
        : 'ArrowLeft'
      : dy > 0
        ? 'ArrowDown'
        : 'ArrowUp';
    const distance = horizontal ? Math.abs(dx) : Math.abs(dy);
    // Long enough to cover the gap at the speed Purple actually walks, so she lands on the target
    // instead of sailing past it and turning round to sail past it again.
    const ms = Math.min(900, Math.max(120, (distance / WALK_SPEED) * 1000));
    await hold(page, key, ms);
    spent += ms;
    await dismissNotice(page);
    const next = await probe(page);
    // Nudge sideways when a tree or rock stops progress.
    if (Math.hypot(next.position.x - last.position.x, next.position.y - last.position.y) < 2) {
      await hold(
        page,
        horizontal ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : dx > 0 ? 'ArrowRight' : 'ArrowLeft',
        500,
      );
      spent += 500;
    }
    last = await probe(page);
  }
  const gap = Math.hypot(target.x - last.position.x, target.y - last.position.y);
  if (gap > within)
    throw new Error(
      `walkTo gave up after ${budgetMs}ms: Purple stopped at ` +
        `(${Math.round(last.position.x)}, ${Math.round(last.position.y)}), ` +
        `${Math.round(gap)}px from (${Math.round(target.x)}, ${Math.round(target.y)}), ` +
        `needing ${Math.round(within)}px. Something is in the corridor.`,
    );
  return last;
}

/**
 * How a player moves a panel that is taller than the screen. These two and nothing else: a mouse
 * wheel over the panel, and a finger dragged along it.
 *
 * `Locator.scrollIntoViewIfNeeded()`, `element.scrollIntoView()`, setting `scrollTop` and
 * `Locator.click()` -- which scrolls its target into view before it clicks -- are all things a
 * PROGRAMME can do and a player cannot. They scroll an `overflow: hidden` box as readily as an
 * `overflow: auto` one, which is exactly the difference between a button a player can reach and
 * one they cannot. `ui.spec.ts` carried a reachability test built on `scrollIntoViewIfNeeded()` for
 * as long as the verdict buttons were unreachable at 200% zoom on a phone, and it passed the whole
 * time: it scrolled the clipped panel on the player's behalf.
 */
export type PlayerGesture = 'wheel' | 'touch';

/**
 * Whether a real pointer put at the middle of the control would land on it.
 *
 * Both halves are needed. Inside the viewport is not enough, because a box clipped by an
 * `overflow: hidden` ancestor still has a bounding rect and still reports it; `elementFromPoint`
 * is what notices that the point belongs to something else.
 */
export const pointerCanLandOn = (locator: Locator): Promise<boolean> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const inside = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return inside && hit !== null && el.contains(hit);
  });

/**
 * THE CONTROL: can this browser turn a synthetic touch gesture into scrolling AT ALL?
 *
 * CI's Linux runner could not, and that cost a red pipeline that looked like a product defect.
 * Measured there with the diagnostics in `reachByGesture`: the modal scroller was `overflow: auto`
 * with 563px to scroll, `touch-action` was `auto` on every element up to the root, the finger was
 * on the panel's own content, and `(pointer: coarse)` matched -- and sixteen touch gestures moved it
 * zero pixels. The same gesture scrolls it on macOS under Chromium 1228 and 1243. So the page was
 * right and the HARNESS could not synthesize touch scrolling on that platform.
 *
 * This injects a plain box that nothing in the game styles -- fixed, `overflow: auto`, ten times
 * taller inside than out, on top of everything -- runs the SAME gesture `reachByGesture` uses over
 * it, and asks whether it moved. If a box with no game CSS at all will not scroll, no failure on the
 * panel can be blamed on the panel; if it does scroll and the panel does not, the panel is broken.
 * That is the line between a skip and a defect, and it is drawn by measurement, not by platform name.
 */
export async function touchScrollSynthesizes(page: Page): Promise<boolean> {
  const cdp = await page.context().newCDPSession(page);
  const at = await page.evaluate(() => {
    const box = document.createElement('div');
    box.id = '__touch-control';
    Object.assign(box.style, {
      position: 'fixed',
      left: '10px',
      top: '10px',
      width: '120px',
      height: '120px',
      overflowY: 'auto',
      zIndex: '2147483647',
      background: '#fff',
    });
    const tall = document.createElement('div');
    tall.style.height = '1200px';
    box.append(tall);
    document.body.append(box);
    return { x: 70, y: 70 };
  });
  await cdp.send('Input.synthesizeScrollGesture', {
    x: at.x,
    y: at.y,
    yDistance: -80,
    gestureSourceType: 'touch',
    speed: 900,
  });
  await page.waitForTimeout(150);
  const moved = await page.evaluate(() => {
    const box = document.getElementById('__touch-control');
    const top = box?.scrollTop ?? 0;
    box?.remove();
    return top;
  });
  await cdp.detach();
  return moved > 0;
}

/**
 * What a finger NEEDS in order to scroll `target` into view, checked from the page's own computed
 * state: a scroll container above it with somewhere to go, and no `touch-action` between the panel
 * content and that container that forbids vertical panning. Used where `touchScrollSynthesizes`
 * says the gesture itself cannot be performed, so the test still proves everything a browser reads
 * before scrolling rather than proving nothing.
 */
export const touchCouldScrollTo = (target: Locator): Promise<string | null> =>
  target.evaluate((el) => {
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller) {
      const oy = getComputedStyle(scroller).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && scroller.scrollHeight > scroller.clientHeight)
        break;
      scroller = scroller.parentElement;
    }
    if (!scroller) return 'no scroll container with room to scroll sits above the control';
    for (let node: Element | null = el; node; node = node.parentElement) {
      const ta = getComputedStyle(node).touchAction;
      if (ta === 'none' || ta === 'pan-x' || ta === 'pinch-zoom')
        return `touch-action "${ta}" on ${node.tagName.toLowerCase()}.${node.getAttribute('class') ?? ''} forbids vertical panning`;
      if (node === scroller) break;
    }
    return null;
  });

/**
 * Scrolls with a wheel or a finger over the panel until a pointer could land on `target`, and
 * THROWS if it cannot -- with where the control is, so the message says which way it is stuck.
 *
 * It only ever gestures over `.otp-panel`, because that is where a player's hand is: dragging
 * the dim above a bottom-docked card is not a thing anyone does to read it. A gesture goes in the
 * direction the control lies in, which is how a player works, and a control that is not moving
 * after a gesture is exactly the failure this exists to name.
 */
export async function reachByGesture(
  page: Page,
  target: Locator,
  gesture: PlayerGesture,
  maxGestures = 16,
): Promise<number> {
  const cdp = gesture === 'touch' ? await page.context().newCDPSession(page) : null;
  const where = (): Promise<{ top: number; bottom: number; viewport: number }> =>
    target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), viewport: innerHeight };
    });

  /*
   * WHAT WAS UNDER THE FINGER, for the failure message only. This helper first failed on CI's Linux
   * runner and on no machine anyone could reproduce it on -- 16 touch gestures, zero pixels moved --
   * with a one-line message and no artefacts. So when it gives up it now says what it hit, what
   * touch-action applied all the way up the tree, and whether the panel's scroller moved at all,
   * which is the difference between "the gesture never arrived" and "it arrived and was refused".
   */
  const scrollerTops: number[] = [];
  const scrollerTop = (): Promise<number | null> =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.otp-layer--modal .otp-panel__body');
      return el ? el.scrollTop : null;
    });
  const diagnose = (x: number, y: number): Promise<string> =>
    page.evaluate(
      ({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        const chain: string[] = [];
        for (let el: Element | null = hit; el && chain.length < 8; el = el.parentElement) {
          const ta = getComputedStyle(el).touchAction;
          const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
          chain.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}[${ta}]`);
        }
        const body = document.querySelector<HTMLElement>('.otp-layer--modal .otp-panel__body');
        const state = body
          ? `scroller top ${body.scrollTop} of ${body.scrollHeight - body.clientHeight} scrollable` +
            ` (${getComputedStyle(body).overflowY})`
          : 'no modal scroller found';
        return (
          `under the finger at (${x},${y}): ${chain.join(' < ') || 'nothing'}; ${state}; ` +
          `pointer:coarse=${matchMedia('(pointer: coarse)').matches}, ` +
          `maxTouchPoints=${navigator.maxTouchPoints}`
        );
      },
      { x, y },
    );

  let made = 0;
  let lastHand = { x: 0, y: 0 };
  for (;;) {
    if (await pointerCanLandOn(target)) return made;
    const at = await where();
    const top = await scrollerTop();
    if (top !== null) scrollerTops.push(top);
    if (made >= maxGestures)
      throw new Error(
        `${String(made)} ${gesture} gestures over the panel and the control is still out of reach: ` +
          `top ${String(at.top)}, bottom ${String(at.bottom)}, viewport ${String(at.viewport)}px tall. ` +
          `Scroller positions across the gestures: [${scrollerTops.join(', ')}]. ` +
          (await diagnose(lastHand.x, lastHand.y)),
      );
    // Over the part of the panel that is actually on screen.
    const hand = await page
      .locator('.otp-panel')
      .last()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = Math.max(r.top, 0);
        const bottom = Math.min(r.bottom, innerHeight);
        return { x: Math.round(r.left + r.width / 2), y: Math.round((top + bottom) / 2) };
      });
    lastHand = hand;
    // Down the page if the control is below the fold, up it if it is above: a third of the screen
    // at a time, so a tiny panel is not flung past its target and a tall one still arrives.
    const step = Math.round(at.viewport / 3) * (at.bottom > at.viewport ? 1 : -1);
    if (cdp) {
      // `yDistance` is positive for a finger travelling DOWN, which scrolls the content UP.
      await cdp.send('Input.synthesizeScrollGesture', {
        x: hand.x,
        y: hand.y,
        yDistance: -step,
        gestureSourceType: 'touch',
        speed: 900,
      });
    } else {
      await page.mouse.move(hand.x, hand.y);
      await page.mouse.wheel(0, step);
    }
    made += 1;
    // A wheel tick is animated; let it land before asking where the control went.
    await page.waitForTimeout(gesture === 'wheel' ? 220 : 60);
  }
}
