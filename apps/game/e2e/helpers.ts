import type { Page } from '@playwright/test';

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

/** Closes a notice post if Red has walked up to one, so a walk across the map is not blocked. */
export async function dismissNotice(page: Page): Promise<void> {
  const walkOn = page.getByRole('button', { name: /Walk on/ });
  if ((await walkOn.count()) > 0) await walkOn.first().click();
}

/** Walks towards a point, one axis at a time, until close enough or the budget runs out. */
export async function walkTo(
  page: Page,
  target: { x: number; y: number },
  within = 20,
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
    const ms = Math.min(900, Math.max(120, (distance / 60) * 1000));
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
  return last;
}
