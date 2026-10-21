/*
 * The screen-reader fixes from PLAN.md "Readiness findings" that survive into v2, because they
 * live in the components v2 keeps: the post's announcement, the heading outline, the question
 * list's semantics, where focus goes when a panel closes, and a label with nothing to label.
 *
 * Every one of these is invisible in a screenshot and was found by reading the running page's
 * structure, so every assertion here reads the running page's structure. Each was REPRODUCED
 * against the unfixed build before it was fixed (the messages below are what fired), and each
 * guard was proved by putting the defect back and watching the right message fire.
 *
 * Live regions use the node-identity trick a11y.spec.ts documents: a region inserted already
 * holding its text is announced by no screen reader, and a test that only checks "the text is
 * there" passes on both the broken and the fixed page.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';
import { ready, startGame, tag, tagOf } from './helpers';

const CONTENT = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.json', import.meta.url)), 'utf8'),
) as { strings: Record<string, string> };

const SKILL_OF: Record<string, string> = {
  rabbit: 'cottage-finder',
  owl: 'word-weaver',
  'lantern-keeper': 'night-light',
};

/** What the page's heading outline is, in the order a screen reader walks it. */
interface Heading {
  level: number;
  text: string;
  /** How many Season Mix words it carries, and whether any of them is slanted. */
  serif: number;
  slanted: boolean;
}

const headings = (page: Page): Promise<Heading[]> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[role="heading"]'))
      // What AT cannot reach is not in its outline: hidden, inert or display:none subtrees.
      .filter((el) => !el.closest('[aria-hidden="true"], [inert], [hidden]'))
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => ({
        level: el.matches('h1,h2,h3,h4,h5,h6')
          ? Number(el.tagName.slice(1))
          : Number(el.getAttribute('aria-level') ?? 2),
        text: (el.textContent ?? '').trim(),
        serif: el.querySelectorAll('.otp-serif').length,
        slanted: Array.from(el.querySelectorAll('.otp-serif')).some(
          (s) => getComputedStyle(s).fontStyle !== 'normal',
        ),
      })),
  );

/**
 * One h1, first, and no level skipped on the way down.
 *
 * "No level skipped" is the half that is easy to forget: an h2 under no h1 is the Inspect card's
 * defect, and an h3 under no h2 is the same defect one level down. Season Mix still binds: at
 * most one highlighted word in a heading, and never slanted (CLAUDE.md brand rules).
 */
async function expectCoherentOutline(page: Page, where: string): Promise<void> {
  const outline = await headings(page);
  const levels = outline.map((h) => h.level);
  expect
    .soft(
      levels.filter((l) => l === 1),
      `${where}: exactly one h1 -- the outline was ${JSON.stringify(outline.map((h) => `h${h.level} ${h.text}`))}`,
    )
    .toHaveLength(1);
  expect.soft(levels[0], `${where}: the h1 comes before every other heading`).toBe(1);
  levels.forEach((level, i) => {
    if (i === 0) return;
    expect
      .soft(level, `${where}: h${level} "${outline[i]!.text}" skips a level`)
      .toBeLessThanOrEqual(Math.max(...levels.slice(0, i)) + 1);
  });
  /*
   * A modal panel is the whole screen to the person inside it, because everything behind it is
   * unreachable while it is `aria-modal`. Its heading has to be IN it: an outline that is coherent
   * only because the frame behind the card has an h1 would leave the dialog itself with nothing
   * to land on when a reader asks for the headings.
   */
  const inDialog = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="dialog"]')).map(
      (d) => d.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
    ),
  );
  inDialog.forEach((count) =>
    expect.soft(count, `${where}: a modal dialog has no heading inside it`).toBeGreaterThan(0),
  );
  for (const h of outline) {
    expect
      .soft(h.serif, `${where}: "${h.text}" has more than one Season Mix word`)
      .toBeLessThanOrEqual(1);
    expect.soft(h.slanted, `${where}: "${h.text}" sets Season Mix in italic`).toBe(false);
  }
}

/** Plays the three encounters through the store and walks the arrival, ending on Results. */
async function reachResults(page: Page): Promise<void> {
  await page.evaluate((skillOf) => {
    const { store } = window.__otp!;
    for (const [character, verdict] of Object.entries({
      rabbit: 'restrict',
      owl: 'reject',
      'lantern-keeper': 'allow',
    })) {
      store.dispatch({ type: 'MEET', c: character });
      store.dispatch({ type: 'INSPECT', s: skillOf[character] });
      store.dispatch({ type: 'VERDICT', s: skillOf[character], v: verdict });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, SKILL_OF);
  await expect(page.locator('.otp-arrive')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();
}

/**
 * Opens the Rabbit's conversation and waits until it has focus, which is when it is really open:
 * the panel records what to give focus back to, and takes focus, in an effect after the next paint.
 * A key sent before that arrives at a panel that is not yet listening.
 */
const meetRabbit = async (page: Page): Promise<void> => {
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  await expect(page.locator('.otp-dialogue')).toBeVisible();
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
};

/** Where focus is, in words a failure message can use. */
const focusedNow = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'BODY';
    return `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
});

/* ------------------------------------------------------------------ 1: pressing Post is announced */

test('pressing Post lands in a status region that was already there', async ({ page }) => {
  await page.route('**/api/score', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: 'x', score: 900 }),
    }),
  );
  await startGame(page);
  await reachResults(page);

  /*
   * The region has to exist, EMPTY, before the press. It was `{notice && <p role="status">}`, so
   * the node was inserted holding its sentence -- the one shape a screen reader never announces.
   * `data-announce="post"` is how every other region in the game names itself; the role is what
   * the existing specs find it by, so both are asserted.
   */
  const region = page.getByRole('status');
  await expect(
    region,
    'the post outcome is conditionally rendered: its status region is inserted already holding its text, which no screen reader announces',
  ).toHaveCount(1);
  await expect(region).toHaveAttribute('data-announce', 'post');
  expect(await region.textContent(), 'born empty, or it announces nothing').toBe('');
  await tag(page, '[data-announce="post"]', 'before-post');

  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(region).not.toHaveText('');
  expect(
    await tagOf(page, '[data-announce="post"]'),
    'the same node, mutated -- not a new one',
  ).toBe('before-post');

  // And it stays that node through the next press and through "Try another name".
  await page.getByRole('button', { name: CONTENT.strings['handleReroll']! }).click();
  await expect(region).toHaveText('');
  expect(await tagOf(page, '[data-announce="post"]')).toBe('before-post');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(region).not.toHaveText('');
  expect(await tagOf(page, '[data-announce="post"]')).toBe('before-post');
});

test('the empty post region takes no room on the screen', async ({ page }) => {
  await startGame(page);
  await reachResults(page);
  // A live region has to stay rendered, so it must not stay visible: an empty paragraph with the
  // sentence's top margin would open a gap between the fine print and the board before anything
  // has been posted.
  const box = await page.locator('[data-announce="post"]').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { h: r.height, mt: parseFloat(cs.marginTop), mb: parseFloat(cs.marginBottom) };
  });
  expect(box, 'the empty status region occupies space').toEqual({ h: 0, mt: 0, mb: 0 });
});

test.describe('pressing Post by keyboard keeps focus on the button, for every outcome', () => {
  /*
   * The Post button was `disabled` while the post was out, and a disabled button cannot hold focus:
   * the browser blurs it the moment the attribute lands, so a keyboard or screen-reader player who
   * pressed it was dropped on <body> -- the top of the document -- before the reply came back and was
   * spoken. It happened for every outcome, because it happened at the PRESS, which is why this holds
   * focus in flight and again after each of the four ways a post can end.
   *
   * Each outcome is its own run (a fresh Results screen), and the reply is held at a gate so the
   * in-flight state is observable rather than assumed: without it a fast mock answers before the
   * assertion looks, and the guard measures the state AFTER the button was re-enabled, which is the
   * one state the defect never affected.
   */
  const OUTCOMES: readonly (readonly [string, (route: Route) => Promise<void>])[] = [
    [
      'accepted (200)',
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ handle: 'x', score: 900 }),
        }),
    ],
    [
      'refused (400)',
      (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'bad run' }),
        }),
    ],
    [
      'server error (500)',
      (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'boom' }),
        }),
    ],
    ['connection lost', (route) => route.abort('connectionreset')],
  ];

  for (const [outcome, respond] of OUTCOMES) {
    test(outcome, async ({ page }) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let requests = 0;
      await page.route('**/api/score', async (route: Route) => {
        requests += 1;
        await gate;
        await respond(route);
      });

      await startGame(page);
      await reachResults(page);

      const post = page.getByRole('button', { name: 'Post', exact: true });
      // Results takes focus in an effect after the next paint. A Tab sent before that lands on the
      // button and is then overtaken by the screen's own focus -- a test race, not a player's, and
      // the first cut of this lost one outcome in four to it.
      await expect(page.locator('.otp-screen__body')).toBeFocused();
      await tabTo(page, post, 'Post');
      await page.keyboard.press('Enter');
      await expect.poll(() => requests, { message: 'the press never sent a post' }).toBe(1);

      /*
       * Wait for the render that makes the button unavailable -- by EITHER mechanism, so a regression
       * to `disabled` is still waited for and then fails on focus -- and then for the frames the
       * browser needs to act on it. Chromium does not blur a focused button the instant it becomes
       * disabled: `document.activeElement` is still that button for the rest of the task and moves
       * to <body> at the next rendering update. Measured: a read taken straight after the attribute
       * lands says BUTTON, a read one frame later says BODY, and the first cut of this guard read
       * too early and PASSED on the broken page.
       */
      await page.waitForFunction(() => {
        const b = Array.from(document.querySelectorAll('button')).find(
          (x) => x.textContent?.trim() === 'Post',
        );
        return !!b && (b.hasAttribute('disabled') || b.getAttribute('aria-disabled') === 'true');
      });
      await page.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );
      // In flight: still where the player is, and unavailable to a screen reader. Focus is asserted
      // FIRST so that a regression to `disabled` reports the defect it is, not its symptom.
      expect(
        await focusedNow(page),
        'pressing Post dropped focus to the body: a disabled button cannot keep it',
      ).toMatch(/^BUTTON "Post"/);
      await expect(post).toHaveAttribute('aria-disabled', 'true');

      // A second press while the first is out does nothing: aria-disabled does not stop a press.
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      expect(requests, 'a press on a post already in flight sent a second one').toBe(1);

      release();
      await expect(page.getByRole('status')).not.toHaveText('');
      await expect(post, 'the button stayed unavailable after the reply').not.toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(await focusedNow(page), `after the post was ${outcome}`).toMatch(/^BUTTON "Post"/);
    });
  }
});

/* ------------------------------------------------------------------ 2: heading structure */

test('every screen has one h1 and an outline that never skips a level', async ({ page }) => {
  // 00 Title
  await expectCoherentOutline(page, 'title');

  // 01 Explore
  await startGame(page);
  await expectCoherentOutline(page, 'explore');
  // The h1 says "Explore", so the frame's own "01 Explore" is for the eye alone: read as well, a
  // screen reader hears the word twice and a bare numeral with nothing to number.
  await expect(
    page.locator('.otp-world-frame .otp-panel__title'),
    'the frame title is announced as well as the h1: "Explore" is read twice',
  ).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.otp-world-frame .otp-panel__number')).toHaveAttribute(
    'aria-hidden',
    'true',
  );

  // 02 Question
  await meetRabbit(page);
  await expectCoherentOutline(page, 'dialogue');

  // 03 Inspect -- the card that had an h2 and nothing above it.
  await page.locator('.otp-dialogue__show').click();
  await expect(page.locator('.otp-card')).toBeVisible();
  await expectCoherentOutline(page, 'inspect');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-dialogue')).toBeHidden();

  // The post by the path
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await expect(page.locator('.otp-notice')).toBeVisible();
  await expectCoherentOutline(page, 'notice, unread');
  await page.getByRole('button', { name: /Read the notice/ }).click();
  await expectCoherentOutline(page, 'notice, read');
  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-notice')).toHaveCount(0);

  // 04 Arrive, before and after the beats finish (the ending title is an h2 that mounts late).
  await page.evaluate((skillOf) => {
    const { store } = window.__otp!;
    for (const [c, s] of Object.entries(skillOf)) {
      store.dispatch({ type: 'MEET', c });
      store.dispatch({ type: 'INSPECT', s });
      store.dispatch({ type: 'VERDICT', s, v: 'restrict' });
    }
    store.dispatch({ type: 'ENTER_COTTAGE' });
  }, SKILL_OF);
  await expect(page.locator('.otp-arrive')).toBeVisible();
  await expectCoherentOutline(page, 'arrive, first line');
  for (let i = 0; i < 8; i++) {
    const go = page.getByRole('button', { name: 'Go on' });
    if ((await go.count()) === 0) break;
    await go.click();
  }
  await expect(page.locator('.otp-ending__title')).toBeVisible();
  await expectCoherentOutline(page, 'arrive, ending shown');

  // 05 Results
  await page.getByRole('button', { name: /Step inside/ }).click();
  await expect(page.locator('.otp-hero__score')).toBeVisible();
  await expectCoherentOutline(page, 'results');
});

/* ------------------------------------------------------------------ 3: the question list */

test('the question list does not claim a question is selected before one is chosen', async ({
  page,
}) => {
  await startGame(page);
  await meetRabbit(page);

  const group = page.getByRole('group', { name: 'Ask Rabbit' });
  await expect(group, 'the questions are a named group of buttons').toHaveCount(1);
  await expect(group.getByRole('button')).toHaveCount(2);

  const claims = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-selected]')).map(
      (el) =>
        `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}"=${el.getAttribute('aria-selected')}`,
    ),
  );
  expect(
    claims,
    'a screen reader is told an option is selected that nobody picked: these are actions, not a selection',
  ).toEqual([]);
  expect(
    await page.locator('[role="listbox"], [role="option"]').count(),
    'the questions are not a listbox: nothing here is selected, each button asks',
  ).toBe(0);

  // The visual cursor is a separate fact and keeps working: the first row wears it before any
  // focus (as the board draws it), and it follows the arrow keys.
  const cursor = (): Promise<string[]> =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.otp-option[data-cursor]')).map((el) =>
        (el.textContent ?? '').trim(),
      ),
    );
  expect(await cursor(), 'the cursor row is not drawn before any focus').toHaveLength(1);
  expect((await cursor())[0]).toMatch(/What does it need/);
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(group.getByRole('button', { name: /Who made it/ })).toBeFocused();
  expect(await cursor(), 'the cursor row does not follow focus').toHaveLength(1);
  expect((await cursor())[0]).toMatch(/Who made it/);

  // An asked question still says so to AT, by the state a button already has.
  await group.getByRole('button', { name: /Who made it/ }).click();
  await expect(group.getByRole('button', { name: /Who made it/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

/* ------------------------------------------------------------------ 4: focus on close */

test('closing a panel hands focus back, never to the body', async ({ page }) => {
  await startGame(page);

  /*
   * The world's own heading is where focus goes when there was nothing to give it back to: the
   * panels are opened by a key on the canvas or a tap on the pad, neither of which is a focusable
   * thing in the page, so `useFocusTrap` restored focus to the body and a screen reader's reading
   * position went back to the top of the document.
   */
  const homeIsFocused = async (where: string): Promise<void> => {
    expect(await focusedNow(page), `${where}: focus dropped to the document body`).not.toBe('BODY');
    expect(await focusedNow(page), where).toMatch(/^H1 "Explore"/);
  };

  // 02 Question, closed with Esc.
  await meetRabbit(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-dialogue')).toBeHidden();
  await homeIsFocused('Esc on the conversation');

  // 03 Inspect, closed with "Go back": back to the button that opened it.
  await meetRabbit(page);
  await page.locator('.otp-dialogue__show').click();
  await expect(page.locator('.otp-card')).toBeFocused();
  await page.getByRole('button', { name: CONTENT.strings['cardBack']! }).click();
  await expect(page.locator('.otp-dialogue')).toBeVisible();
  await expect(
    page.locator('.otp-dialogue__show'),
    '"Go back" returned focus somewhere other than the control that opened the card',
  ).toBeFocused();

  // ...and closed by a verdict, which ends the conversation: back to the world.
  await page.locator('.otp-dialogue__show').click();
  await expect(page.locator('.otp-card')).toBeFocused();
  await page.getByRole('button', { name: /^Restrict/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-card')).toHaveCount(0);
  await homeIsFocused('a verdict on the card');

  // Taking an offer as it was made ends the conversation from the dialogue itself.
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'owl' }));
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
  await page.getByRole('button', { name: CONTENT.strings['takeAsOffered']! }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-dialogue')).toHaveCount(0);
  await homeIsFocused('Take it as offered');

  // The post, closed both ways it can be.
  for (const [how, close] of [
    ['Esc on the post', () => page.keyboard.press('Escape')],
    [
      'Walk on',
      () => page.getByRole('button', { name: CONTENT.strings['noticeWalkOn']! }).press('Enter'),
    ],
  ] as const) {
    await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
    await expect(page.locator('.otp-notice')).toBeVisible();
    await expect(page.locator('.otp-notice [data-autofocus]')).toBeFocused();
    await close();
    await expect(page.locator('.otp-notice')).toHaveCount(0);
    await homeIsFocused(how);
  }
});

test('beginning the walk and walking it again both land on the world, not the body', async ({
  page,
}) => {
  await startGame(page);
  // The store flips the phase before Preact has rendered it, so wait for the frame, not the phase.
  await expect(page.locator('.otp-world-frame')).toBeVisible();
  expect(await focusedNow(page), 'Begin the walk left focus on the body').toMatch(/^H1 "Explore"/);

  await reachResults(page);
  await page.getByRole('button', { name: CONTENT.strings['replay']! }).click();
  await expect(page.locator('.otp-hero__score')).toHaveCount(0);
  expect(await focusedNow(page), 'Walk it again left focus on the body').toMatch(/^H1 "Explore"/);
});

test('focus is never taken from a control the player is actually on', async ({ page }) => {
  await startGame(page);
  // The music switch is the one control on Explore. A panel that closes while the player is on it
  // must give it back rather than yank focus to the heading.
  const toggle = page.getByRole('switch', { name: 'Music' });
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'rabbit' }));
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-dialogue')).toBeHidden();
  await expect(
    toggle,
    'a panel that closed took focus from the control the player was on',
  ).toBeFocused();
});

test('the focused world heading draws no ring around a label nobody can act on', async ({
  page,
}) => {
  await startGame(page);
  await meetRabbit(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-dialogue')).toBeHidden();
  expect(await focusedNow(page)).toMatch(/^H1 "Explore"/);
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement!);
    return { outline: cs.outlineStyle, shadow: cs.boxShadow };
  });
  // Same call `.otp-ui [tabindex='-1'][data-autofocus]:focus-visible` makes for the panels' bodies.
  expect(
    ring,
    'a container focused by script is not a control and has nothing to indicate',
  ).toEqual({ outline: 'none', shadow: 'none' });
});

/* ------------------------------------------------------------------ 5: a label with nothing to label */

test('no aria-label sits on an element whose role cannot take one', async ({ page }) => {
  /*
   * `#game` carried `aria-label="Game world"` on a div with no role. A generic element is not
   * exposed as anything, so the label reached nobody. This is the general form of that: every
   * element carrying a name must be something that has one -- a control, a landmark, an image, a
   * group -- and the check walks every phase's markup rather than the one element reported.
   */
  const unnameable = (): Promise<string[]> =>
    page.evaluate(() => {
      // Tags that take a name from their own markup with no role attribute at all.
      const NAMEABLE = new Set([
        'BUTTON',
        'A',
        'INPUT',
        'SELECT',
        'TEXTAREA',
        'IMG',
        'SVG',
        'SECTION',
        'NAV',
        'FORM',
        'ASIDE',
        'MAIN',
        'UL',
        'OL',
        'TABLE',
        'DIALOG',
        'FIELDSET',
        'DETAILS',
        'CANVAS',
      ]);
      return Array.from(document.querySelectorAll<HTMLElement>('[aria-label], [aria-labelledby]'))
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .filter((el) => !el.hasAttribute('role') && !NAMEABLE.has(el.tagName.toUpperCase()))
        .map(
          (el) =>
            `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ''} class="${el.className}">`,
        );
    });

  expect(await unnameable(), 'title').toEqual([]);
  await startGame(page);
  expect(await unnameable(), 'explore').toEqual([]);
  await meetRabbit(page);
  expect(await unnameable(), 'dialogue').toEqual([]);
  await page.locator('.otp-dialogue__show').click();
  await expect(page.locator('.otp-card')).toBeVisible();
  expect(await unnameable(), 'inspect').toEqual([]);
});

test('the world canvas is exposed as what it is: a picture, with its words elsewhere', async ({
  page,
}) => {
  const game = page.locator('#game');
  await expect(game).toHaveAttribute('role', 'img');
  await expect(game).toHaveAccessibleName('Game world');
  // The picture is not the game's text: the forest in words is a real region the summary names.
  await startGame(page);
  await expect(page.getByRole('region', { name: /forest, in words/i })).toHaveCount(1);
});

/* ------------------------------------------------------------------ the whole run, by keyboard */

/** Presses Tab until `target` has focus, or fails saying where focus ended up. */
async function tabTo(page: Page, target: Locator, what: string, max = 40): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(
    `Tab never reached "${what}" in ${max} presses; focus is on ${await focusedNow(page)}`,
  );
}

test('a run can be played from the keyboard alone, panel by panel, to the post', async ({
  page,
}) => {
  /*
   * The fixes above move focus, change roles and reorder headings, so the thing most worth
   * checking after them is the thing they could break: that every control a player has to press
   * is still reachable, in an order that makes sense, with no mouse. Walking to a traveller is
   * covered by ui.spec.ts ("Explore can be walked without a pointer") and world-reach.spec.ts, so
   * the walk is the one step taken through the store; everything inside a panel is a real key.
   */
  await page.route('**/api/score', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: 'x', score: 900 }),
    }),
  );

  // Title: the way in is the one Lime button.
  await tabTo(page, page.getByRole('button', { name: /Begin the walk/ }), 'Begin the walk');
  await page.keyboard.press('Enter');
  /*
   * Something that exists ONLY once play has begun. This used to be `.otp-world-frame` toBeVisible,
   * which the title screen already renders -- so it passed the instant the test started, before
   * Begin had been pressed at all, and the focus read on the next line was the first thing that
   * actually waited. The visually-hidden h1 is mounted by `App` only while the world is on screen
   * (`inWorld`), and it is where focus goes when play starts, so "Explore's h1 has focus" cannot be
   * true on the title and cannot be true a moment before Begin is processed. The store's phase is
   * the other half: the walk has begun in the rules as well as on the screen.
   */
  await expect(
    page.getByRole('heading', { level: 1, name: 'Explore' }),
    'Begin was pressed and the forest never took focus',
  ).toBeFocused();
  expect(
    await page.evaluate(() => window.__otp!.store.getState().phase),
    'the title is still the phase',
  ).toBe('explore');

  // The first Tab from the world's home reaches the one control Explore has: the heading is
  // BEFORE the switch in the reading order, which is the other reason it is the home.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('switch', { name: 'Music' })).toBeFocused();

  // 02 Question: ask one, then go and look at the card.
  await meetRabbit(page);
  await expect(page.locator('.otp-dialogue__line')).toContainText('find Grandma.');
  const group = page.getByRole('group', { name: 'Ask Rabbit' });
  await page.keyboard.press('ArrowDown');
  await expect(group.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(group.getByRole('button').first()).toHaveAttribute('aria-disabled', 'true');
  await tabTo(page, page.locator('.otp-dialogue__show'), 'Show me the skill');
  await page.keyboard.press('Enter');

  /*
   * Every key below is sent only once the panel it is meant for HAS focus, which is the point at
   * which it is actually open: a panel takes focus in an effect that runs after the next paint,
   * and a Tab sent into the gap moves focus from whatever the PREVIOUS panel handed back, so the
   * panel then records the wrong control as the one to give focus back to. The first cut of this
   * test lost a verdict's focus to exactly that, nondeterministically, and it is a test race and
   * not a player's -- nobody Tabs inside sixteen milliseconds.
   */
  await expect(page.locator('.otp-card')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.otp-dialogue__show')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-card')).toBeFocused();
  await tabTo(page, page.getByRole('button', { name: /^Restrict/ }), 'Restrict');
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-card')).toHaveCount(0);
  // The player tabbed onto the music switch before the conversation, so that is what they had
  // when the panel opened and what they are given back -- not yanked to the heading.
  await expect(page.getByRole('switch', { name: 'Music' }), 'a verdict').toBeFocused();

  // The post: read it, then walk on, both with keys.
  await page.evaluate(() => window.__otp!.bus.emit('reachedNotice', { noticeId: 'forest-post' }));
  await expect(page.locator('.otp-notice [data-autofocus]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-announce="notice"]')).not.toHaveText('');
  await expect(page.getByRole('button', { name: CONTENT.strings['noticeWalkOn']! })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-notice')).toHaveCount(0);
  await expect(
    page.getByRole('switch', { name: 'Music' }),
    'walking on from the post',
  ).toBeFocused();

  // The other two travellers: one taken as offered, one inspected.
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'owl' }));
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
  await tabTo(
    page,
    page.getByRole('button', { name: CONTENT.strings['takeAsOffered']! }),
    'Take it as offered',
  );
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-dialogue')).toHaveCount(0);

  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'MEET', c: 'lantern-keeper' }));
  await expect(page.locator('.otp-dialogue__text')).toBeFocused();
  await tabTo(page, page.locator('.otp-dialogue__show'), 'Show me the skill');
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-card')).toBeFocused();
  await tabTo(page, page.getByRole('button', { name: /^Reject/ }), 'Reject');
  await page.keyboard.press('Enter');
  await expect(page.locator('.otp-card')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => Object.keys(window.__otp!.store.getState().verdicts).length))
    .toBe(3);

  // 04 Arrive: the walk to the door is the store's, the beats are keys.
  await page.evaluate(() => window.__otp!.store.dispatch({ type: 'ENTER_COTTAGE' }));
  await expect(page.locator('.otp-arrive [data-autofocus]')).toBeFocused();
  for (let i = 0; i < 8; i++) {
    if ((await page.getByRole('button', { name: /Step inside/ }).count()) > 0) break;
    await tabTo(page, page.getByRole('button', { name: 'Go on' }), 'Go on');
    await page.keyboard.press('Enter');
  }
  await tabTo(page, page.getByRole('button', { name: /Step inside/ }), 'Step inside');
  await page.keyboard.press('Enter');

  // 05 Results: reach Post with Tab, press it, and the outcome is spoken into the same region.
  await expect(page.locator('.otp-hero__score')).toBeVisible();
  await expect(page.locator('.otp-screen__body')).toBeFocused();
  const status = page.getByRole('status');
  await tag(page, '[data-announce="post"]', 'kbd-run');
  await tabTo(page, page.getByRole('button', { name: 'Post', exact: true }), 'Post');
  await page.keyboard.press('Enter');
  await expect(status).not.toHaveText('');
  expect(await tagOf(page, '[data-announce="post"]')).toBe('kbd-run');
});
