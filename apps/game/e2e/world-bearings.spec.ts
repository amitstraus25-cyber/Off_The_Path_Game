/*
 * Does the forest ever tell the player WHO is missing and WHICH WAY to walk? (docs/UX_REVIEW.md 16,
 * the half `e2e/world-reach.spec.ts` left open.)
 *
 * Two findings, measured on the build before the fix, both at 1280x800 with one verdict given:
 *
 *  - HELD AT THE DOOR AND NOT TOLD WHO. Everything a sighted player could read on the explore
 *    screen was dumped leaf by leaf. The locked door said "I should hear all three travellers
 *    first." and the chip beside it said "1 of 3 skills seen". The only nodes on the page carrying
 *    the words "Owl" or "Lantern Keeper" were three `<li>` inside `.otp-visually-hidden`, boxed at
 *    0x25 and 1x25 CSS px -- a screen reader got the roster and nobody else did.
 *
 *  - NO BEARINGS AT ALL. `worldBearings` and `worldDistances` shipped in the content file and a
 *    repo-wide grep found one hit each: their own declarations. Nothing in the build could reach
 *    either, so every traveller's line ended at their state and a player who could not see the
 *    canvas had to sweep 1,495 walkable tiles to find three people.
 *
 * The producer landed on 2026-10-25 (P5): `world/forest-scene.ts` dispatches the event on the edge.
 * The first two tests still DISPATCH IT THEMSELVES, to pin the consumer end of the contract -- the
 * words it picks, and the words it refuses -- and the last asserts the scene's own payload.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startGame } from './helpers';

/**
 * The consumer's event name. Spelled here and in `ui/App.tsx`, and -- once the producer lands --
 * in `world/forest-scene.ts`; this file is what keeps the spellings honest, exactly as
 * world-reach.spec.ts does for `otp:within-reach`.
 */
const BEARINGS = 'otp:bearings';

/** The hidden roster, one line per traveller. */
const roster = (page: Page): Promise<string[]> =>
  page.$$eval('.otp-visually-hidden li', (nodes) => nodes.map((n) => n.textContent ?? ''));

test.describe('the forest summary carries bearings', () => {
  test("each named traveller's line ends in a direction and a distance", async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    // What the scene will dispatch once it does: ids and indices, no words. Sector 2 is east,
    // counting 45-degree sectors clockwise from north; band 1 is the middle distance.
    await page.evaluate((name) => {
      window.dispatchEvent(
        new CustomEvent(name, {
          detail: {
            bearings: [
              { id: 'owl', sector: 2, band: 1 },
              { id: 'lantern-keeper', sector: 4, band: 2 },
            ],
          },
        }),
      );
    }, BEARINGS);

    await expect.poll(async () => (await roster(page)).join(' | ')).toContain('east of you');

    const lines = await roster(page);
    const owl = lines.find((l) => l.startsWith('Owl')) ?? '';
    const keeper = lines.find((l) => l.startsWith('Lantern Keeper')) ?? '';
    const rabbit = lines.find((l) => l.startsWith('Rabbit')) ?? '';

    // The words come out of content/game.v2.json's own pipe-separated lists, at the index the payload
    // named. Written out rather than re-split from the content file here: re-deriving them the way
    // the component does would pass for a component that split the wrong string.
    expect(owl).toBe('Owl, not met yet, east of you, a short walk away');
    expect(keeper).toBe('Lantern Keeper, not met yet, south of you, a long way off');

    // Nobody the payload did not name picks up a bearing of someone else's.
    expect(rabbit).toBe('Rabbit, not met yet');
  });

  test('a payload with words in it cannot put words on the page', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    /*
     * The reason the payload is indices: `window` is public, so anything on the page can dispatch
     * this event. Every sentence the summary says is looked up in `content` at render, so a forged
     * payload has nothing to inject WITH -- and the entries below are each malformed in one of the
     * ways a real bug would be, so a validator that waved any of them through would show here.
     */
    await page.evaluate((name) => {
      window.dispatchEvent(
        new CustomEvent(name, {
          detail: {
            bearings: [
              { id: 'owl', sector: 'straight to the wolf', band: 0 },
              { id: 'lantern-keeper', sector: 1.5, band: 0 },
              { id: 'rabbit', sector: -1, band: 0 },
              { id: 'rabbit', sector: 99, band: 99 },
              'not an object',
              null,
            ],
          },
        }),
      );
    }, BEARINGS);

    await page.waitForTimeout(200);
    const lines = await roster(page);
    expect(lines.join(' | ')).not.toContain('wolf');
    // An in-range id with an out-of-range index loses the bearing, not the line.
    expect(lines.find((l) => l.startsWith('Rabbit'))).toBe('Rabbit, not met yet');
    expect(lines.find((l) => l.startsWith('Owl'))).toBe('Owl, not met yet');
    expect(lines.find((l) => l.startsWith('Lantern Keeper'))).toBe('Lantern Keeper, not met yet');
  });

  test('the scene says every bearing itself now', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    // The producer landed (the review of 2026-10-25, P5): with no faked payload at all, every
    // traveller's line ends in a direction and a distance, in content's own words.
    const ends =
      /, (north|north-east|east|south-east|south|south-west|west|north-west) of you, (a few steps away|a short walk away|a long way off)$/;
    await expect.poll(async () => (await roster(page)).every((l) => ends.test(l))).toBe(true);
    expect((await roster(page)).map((l) => l.split(',')[0])).toEqual([
      'Rabbit',
      'Toadstool',
      'Owl',
      'Magpie',
      'Snail',
      'Lantern Keeper',
      'Cat',
    ]);
  });
});
