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
 *  - NO BEARINGS AT ALL. `worldBearings` and `worldDistances` shipped in content/game.json and a
 *    repo-wide grep found one hit each: their own declarations. Nothing in the build could reach
 *    either, so every traveller's line ended at their state and a player who could not see the
 *    canvas had to sweep 1,495 walkable tiles to find three people.
 *
 * The bearing half is a channel with a producer that has not landed yet: `world/forest-scene.ts`
 * is the only thing that knows where Red is standing. So this file DISPATCHES THE EVENT ITSELF and
 * asserts the consumer end of the contract -- the words it picks, and the words it refuses. When
 * the scene starts dispatching for real these assertions do not change; they stop needing the
 * `page.evaluate` that fakes it.
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

const TOAST = '.otp-toast';
const WORLD = '[data-announce="world"]';

/** The hidden roster, one line per traveller. */
const roster = (page: Page): Promise<string[]> =>
  page.$$eval('.otp-visually-hidden li', (nodes) => nodes.map((n) => n.textContent ?? ''));

/**
 * Red, one verdict in: Rabbit answered, Owl and the Lantern Keeper outstanding. Driven through the
 * store rather than walked, because what is under test is what the screen SAYS in that state and a
 * twenty-second walk to get there would only make the test slower and flakier.
 */
async function oneVerdictIn(page: Page): Promise<void> {
  await startGame(page);
  await page.evaluate(() => {
    const s = window.__otp!.store;
    s.dispatch({ type: 'MEET', c: 'rabbit' });
    s.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
    s.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'restrict' });
  });
  await page.waitForFunction(() => window.__otp!.store.getState().phase === 'explore');
}

/**
 * Walks Red into the cottage trigger and waits for the door's own line.
 *
 * The wait for an EMPTY toast first is not politeness: `main.ts` refuses to show the locked-door
 * hint while another hint is still up (`if (!hint) showHint(...)`), so firing this straight after
 * a verdict gets the verdict's toast back and the test would assert against the wrong sentence.
 */
async function heldAtTheDoor(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (document.querySelector('.otp-toast')?.textContent ?? '') === '',
  );
  // `enteredCottage` carries no payload; `{}` is what the helper's `emit` signature accepts and
  // what `main.ts` ignores. The handler is the real one, so the hint is the real hint.
  await page.evaluate(() => window.__otp!.bus.emit('enteredCottage', {}));
  await expect(page.locator(TOAST)).toContainText('travellers', { timeout: 5000 });
}

/* ------------------------------------------- half one: who is still missing? */

test.describe('held at the locked door', () => {
  test('the visible line names the travellers who still owe an answer', async ({ page }) => {
    await page.goto('/');
    await oneVerdictIn(page);
    await heldAtTheDoor(page);

    const toast = (await page.locator(TOAST).textContent()) ?? '';

    // The names, on the line a sighted player can actually read. These are literals on purpose:
    // asserting against the same `content.characters` the component maps over would pass even if
    // the component printed the wrong three, which is the whole failure being guarded.
    expect(toast, 'the outstanding travellers are named').toContain('Owl');
    expect(toast, 'the outstanding travellers are named').toContain('Lantern Keeper');

    // And only those. Rabbit has answered; re-walking to Rabbit is the backtrack this fixes.
    expect(toast, 'a traveller who has already answered is not sent for again').not.toContain(
      'Rabbit',
    );

    // The shipped sentence is still the sentence. The names are an addition to content's copy,
    // never a replacement for it.
    expect(toast).toContain('I should hear all three travellers first.');
  });

  test('the live region says the same words as the pill, not fewer', async ({ page }) => {
    await page.goto('/');
    await oneVerdictIn(page);
    await heldAtTheDoor(page);

    /*
     * `.otp-toast` is `aria-hidden="true"` and this region is what speaks. App.tsx's own note says
     * the visible line "is a duplicate of these words, not a second message" -- so the two drifting
     * apart is a defect even when both are individually fine, and it is the shape a fix applied to
     * one of them and not the other takes.
     */
    const toast = (await page.locator(TOAST).textContent()) ?? '';
    const spoken = (await page.locator(WORLD).textContent()) ?? '';
    expect(spoken).toBe(toast);
    expect(spoken).toContain('Lantern Keeper');
  });

  test('a verdict confirmation collects no roster', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    // The other thing `hint` carries. It must stay the bare confirmation.
    await page.evaluate(() => {
      const s = window.__otp!.store;
      s.dispatch({ type: 'MEET', c: 'rabbit' });
      s.dispatch({ type: 'INSPECT', s: 'cottage-finder' });
      s.dispatch({ type: 'VERDICT', s: 'cottage-finder', v: 'restrict' });
    });
    await expect(page.locator(TOAST)).toContainText('Cottage Finder');

    const toast = (await page.locator(TOAST).textContent()) ?? '';
    expect(toast.trim()).toBe('Restricted: Cottage Finder');
  });

  test('the pill still empties, so it still fades out', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    /*
     * `.otp-toast:empty { opacity: 0 }` is the whole of how the pill disappears -- it has no hidden
     * state and no unmount, by design, because a node that unmounts cannot be measured for layout
     * shift. An extra child node rendered unconditionally would stop `:empty` matching and leave a
     * dark pill sitting on the forest forever, which is the obvious way to get this fix wrong.
     */
    await page.waitForFunction(
      () => (document.querySelector('.otp-toast')?.textContent ?? '') === '',
    );
    const shown = await page.locator(TOAST).evaluate((el) => ({
      children: el.childElementCount,
      opacity: getComputedStyle(el).opacity,
    }));
    expect(shown.children, 'no element children, or :empty stops matching').toBe(0);
    expect(shown.opacity).toBe('0');
  });
});

/* ------------------------------------------- half two: which way do I walk? */

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

    // The words come out of content/game.json's own pipe-separated lists, at the index the payload
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

  test('no payload leaves every line exactly as it was', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    // The state the game ships in today, and will keep shipping in until the producer lands.
    expect(await roster(page)).toEqual([
      'Rabbit, not met yet',
      'Owl, not met yet',
      'Lantern Keeper, not met yet',
    ]);
  });
});
