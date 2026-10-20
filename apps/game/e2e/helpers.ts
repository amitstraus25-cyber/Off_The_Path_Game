import type { Page } from '@playwright/test';
// The real constants, not copies: `logic.ts` is pure TypeScript with no Phaser and no DOM, so the
// walking helpers below pace themselves off the same numbers the game walks at. They used to carry
// a hardcoded 60 px/s and a 20px tolerance, which were right for 16px tiles and silently wrong the
// moment the art moved to 32px -- every walk overshot by exactly its own length and oscillated.
import { TILE, WALK_SPEED } from '../src/world/logic';

export interface Probe {
  phase: string;
  position: { x: number; y: number };
  verdicts: Record<string, string>;
  flags: string[];
  basket: string[];
  activeCharacter: string | null;
  log: { t: string }[];
}

declare global {
  interface Window {
    __otp?: {
      bus: { emit(event: string, payload: Record<string, unknown>): void };
      store: {
        getState(): {
          phase: string;
          verdicts: Record<string, string>;
          asked: Record<string, string[]>;
          basket: string[];
          flags: string[];
          /** Notice ids Red has actually read, which is what the errand goals score off. */
          read: string[];
          /** Skill ids whose card was opened. Empty for an offer taken on the offerer's word. */
          inspected: string[];
          activeCharacter: string | null;
          runId: string | null;
          log: { t: string }[];
        };
        dispatch(action: Record<string, unknown>): string | null;
      };
      scene?: { redPosition: { x: number; y: number } };
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

/** Clicks past the title screen into the forest. */
export async function startGame(page: Page): Promise<void> {
  await ready(page);
  await page.getByRole('button', { name: /Begin the walk/ }).click();
  await page.waitForFunction(() => window.__otp?.store.getState().phase === 'explore');
}

export async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const otp = window.__otp!;
    const s = otp.store.getState();
    return {
      phase: s.phase,
      position: otp.scene?.redPosition ?? { x: 0, y: 0 },
      verdicts: s.verdicts,
      flags: s.flags,
      basket: s.basket,
      activeCharacter: s.activeCharacter,
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
 * `npc-rabbit` is a tile at (416, 608); the person standing on it answers at (432, 648), because
 * the spawn is centred in its tile and the sprite's origin is its feet. The difference is 56px and
 * INTERACT_RADIUS is 48, so walking to the object's own corner parks Red one tile short of being
 * able to say anything -- which is exactly how e2e/world-reach.spec.ts was wrong first time round.
 *
 * Both offsets are derived from TILE rather than typed: half a tile across to the centre of the
 * spawn tile, and a tile plus eight pixels down to where her feet stand. They used to be bare
 * `+16, +40` literals repeated across five spec files, which were right at TILE = 32 and silently
 * wrong at any other size -- the same drift that made the walking helpers above overshoot when the
 * art moved from 16px tiles to 32px.
 */
export async function talkingDistance(page: Page, name: string): Promise<{ x: number; y: number }> {
  const spot = await mapObject(page, name);
  return { x: spot.x + TILE / 2, y: spot.y + TILE + 8 };
}

/** Closes a notice post if Red has walked up to one, so a walk across the map is not blocked. */
export async function dismissNotice(page: Page): Promise<void> {
  const walkOn = page.getByRole('button', { name: /Walk on/ });
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
    // Long enough to cover the gap at the speed Red actually walks, so she lands on the target
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
      `walkTo gave up after ${budgetMs}ms: Red stopped at ` +
        `(${Math.round(last.position.x)}, ${Math.round(last.position.y)}), ` +
        `${Math.round(gap)}px from (${Math.round(target.x)}, ${Math.round(target.y)}), ` +
        `needing ${Math.round(within)}px. Something is in the corridor.`,
    );
  return last;
}
