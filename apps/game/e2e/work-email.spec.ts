import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { answerAllAndArrive, startGame, toTheReveal } from './helpers';

/*
 * THE WORK EMAIL ON RESULTS (the client, 2026-10-22), in a real browser.
 *
 * The server decides whether a post needs a work email and the consent (OTP_WORK_EMAIL) and says
 * so on `POST /api/start`. This spec answers that route both ways and holds the screen to:
 *
 *   - flag off: nothing new on screen, and the privacy line that says "no email";
 *   - flag on: a labelled `type=email` field with its hint, a consent box named by its sentence,
 *     Post aria-disabled until both are good, friendly sentences from the content file, a keyboard
 *     path through all of it, and the privacy line that is true while an address is asked for;
 *   - the address in the post body only, normalised, and nowhere in the browser's storage after;
 *   - the layout at the three widths the definition of done names.
 */

interface Words {
  ui: {
    chrome: Record<string, string>;
    contact: {
      consentVersion: string;
      emailLabel: string;
      emailHint: string;
      consent: string;
      emailMissing: string;
      emailInvalid: string;
      emailPersonal: string;
      consentMissing: string;
      privacy: string;
    };
  };
}
const content = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../content/game.v2.json', import.meta.url)), 'utf8'),
) as Words;
const words = content.ui.contact;
const say = (key: string): string => content.ui.chrome[key]!;

const TOKEN = 'dGVzdA.c2lnbmF0dXJl';

interface Posted {
  handle?: string;
  email?: string;
  consent?: unknown;
  [key: string]: unknown;
}

/** Results, with the start answering `emailRequired` as given; the posts are recorded. */
async function reachResults(page: Page, emailRequired: boolean | undefined): Promise<Posted[]> {
  const posts: Posted[] = [];
  await page.route('**/api/start', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        emailRequired === undefined
          ? { seed: 0, token: TOKEN }
          : { seed: 0, token: TOKEN, emailRequired },
      ),
    }),
  );
  await page.route('**/api/top**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"entries":[]}' }),
  );
  await page.route('**/api/score', async (route: Route) => {
    const body = route.request().postDataJSON() as Posted;
    posts.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ handle: body.handle, score: 10, rank: 1 }),
    });
  });
  await page.goto('/');
  await startGame(page);
  await answerAllAndArrive(page, 'leave');
  await toTheReveal(page);
  await expect(page.locator('.otp-hero__score')).toBeVisible();
  return posts;
}

const emailField = (page: Page) => page.getByRole('textbox', { name: words.emailLabel });
const consentBox = (page: Page) => page.getByRole('checkbox', { name: words.consent });
const postButton = (page: Page) => page.getByRole('button', { name: 'Post', exact: true });

/** Presses Tab until `target` has focus, failing rather than looping forever. */
async function tabTo(page: Page, target: ReturnType<Page['locator']>): Promise<void> {
  for (let n = 0; n < 40; n++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

test.describe('with the flag off', () => {
  for (const [why, flag] of [
    ['a start from before the flag', undefined],
    ['a start that says false', false],
  ] as const) {
    test(`${why}: no email field, no consent, and the plain privacy line`, async ({ page }) => {
      const posts = await reachResults(page, flag);
      await expect(page.locator('[data-contact]')).toHaveCount(0);
      await expect(page.locator('input[type="email"]')).toHaveCount(0);
      await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
      await expect(page.locator('[data-privacy]')).toHaveAttribute('data-privacy', 'plain');
      await expect(page.locator('[data-privacy]')).toContainText(say('privacyLine'));
      await expect(postButton(page)).not.toHaveAttribute('aria-disabled', 'true');

      await postButton(page).click();
      await expect(page.locator('[data-announce="post"]')).toHaveAttribute(
        'data-notice',
        'handleAssigned',
      );
      expect(Object.keys(posts[0]!).sort()).toEqual(['handle', 'log', 'token']);
    });
  }
});

test.describe('with the flag on', () => {
  test('asks for a work email and the consent, in the content words, and says what it keeps', async ({
    page,
  }) => {
    await reachResults(page, true);
    const field = emailField(page);
    await expect(field).toBeVisible();
    await expect(field).toHaveAttribute('type', 'email');
    await expect(field).toHaveAttribute('autocomplete', 'email');
    await expect(field).toHaveAccessibleDescription(words.emailHint);
    await expect(page.locator('.otp-email__hint')).toHaveText(words.emailHint);
    await expect(consentBox(page)).not.toBeChecked();
    await expect(page.locator('[data-consent-version]')).toHaveAttribute(
      'data-consent-version',
      words.consentVersion,
    );
    // The line that says "no email" would be false now; the one that replaces it is shown.
    await expect(page.locator('[data-privacy]')).toHaveAttribute('data-privacy', 'contact');
    await expect(page.locator('[data-privacy]')).toContainText(words.privacy);
    await expect(page.locator('[data-privacy]')).not.toContainText(say('privacyLine'));
    // Post is disabled by ARIA, not by `disabled`, so it stays reachable and can say why.
    await expect(postButton(page)).toHaveAttribute('aria-disabled', 'true');
    // Playwright reads aria-disabled as "not enabled"; the DOM property is what keeps it pressable.
    expect(await postButton(page).evaluate((b) => (b as HTMLButtonElement).disabled)).toBe(false);
  });

  test('a press of the disabled Post marks every problem, focuses the first, and posts nothing', async ({
    page,
  }) => {
    const posts = await reachResults(page, true);
    // Reached and pressed from the keyboard: aria-disabled keeps it focusable, so this is the
    // path by which a keyboard or screen-reader user learns why it is not ready.
    await postButton(page).focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-problem="email-missing"]')).toHaveText(words.emailMissing);
    await expect(page.locator('[data-problem="consent-missing"]')).toHaveText(words.consentMissing);
    await expect(emailField(page)).toBeFocused();
    await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(emailField(page)).toHaveAccessibleDescription(
      new RegExp(words.emailMissing.slice(0, 20)),
    );
    await expect(consentBox(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(consentBox(page)).toHaveAccessibleDescription(words.consentMissing);
    await expect(page.locator('[data-announce="post"]')).toHaveText('');
    expect(posts).toHaveLength(0);
  });

  test('keyboard only: type, hear the problem on the way out, fix it, tick, post', async ({
    page,
  }) => {
    const posts = await reachResults(page, true);
    const field = emailField(page);

    await tabTo(page, field);
    await page.keyboard.type('Jane.Doe@gmail.com');
    // Nothing is said while typing...
    await expect(page.locator('[data-problem]')).toHaveCount(0);
    await page.keyboard.press('Tab');
    // ...and on the way out, the friendly sentence, tied to the field.
    await expect(page.locator('[data-problem="email-personal"]')).toHaveText(words.emailPersonal);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(consentBox(page)).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(field).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('  Jane.Doe@Acme-Research.com ');
    await expect(page.locator('[data-problem]')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-problem]')).toHaveCount(0);
    await expect(consentBox(page)).toBeFocused();
    await expect(postButton(page)).toHaveAttribute('aria-disabled', 'true');

    await page.keyboard.press('Space');
    await expect(consentBox(page)).toBeChecked();
    await expect(postButton(page)).not.toHaveAttribute('aria-disabled', 'true');

    await page.keyboard.press('Tab');
    await expect(postButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-announce="post"]')).toHaveAttribute(
      'data-notice',
      'handleAssigned',
    );

    expect(posts).toHaveLength(1);
    expect(Object.keys(posts[0]!).sort()).toEqual(['consent', 'email', 'handle', 'log', 'token']);
    expect(posts[0]!.email).toBe('jane.doe@acme-research.com');
    expect(posts[0]!.consent).toBe(true);
    // The address is not on the screen anywhere but the field the player typed it into.
    const shown = await page.locator('.otp-result').evaluate((el) => {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input').forEach((i) => i.remove());
      return clone.textContent ?? '';
    });
    expect(shown.toLowerCase()).not.toContain('jane.doe');
  });

  test('a refusal from the server marks the field it names', async ({ page }) => {
    await reachResults(page, true);
    await page.unroute('**/api/score');
    await page.route('**/api/score', (route: Route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'x', reason: 'email-personal' }),
      }),
    );
    // An address core passes and the server refuses (its list is the authority).
    await emailField(page).fill('ops@acme.com');
    await consentBox(page).check();
    await postButton(page).click();
    await expect(page.getByRole('status')).toHaveText(words.emailPersonal);
    await expect(
      page.locator('.otp-contact__problem[data-problem="email-personal"]'),
    ).toBeVisible();
    await expect(emailField(page)).toBeFocused();
    await expect(page.locator('.otp-board__row--you')).toHaveCount(0);
  });

  test('keeps the address in no browser storage after a post', async ({ page, context }) => {
    await reachResults(page, true);
    await emailField(page).fill('ops@acme.com');
    await consentBox(page).check();
    await postButton(page).click();
    await expect(page.locator('[data-announce="post"]')).toHaveAttribute(
      'data-notice',
      'handleAssigned',
    );
    const stored = await page.evaluate(async () => ({
      local: JSON.stringify({ ...localStorage }),
      session: JSON.stringify({ ...sessionStorage }),
      cookie: document.cookie,
      idb: (await indexedDB.databases()).map((d) => d.name),
    }));
    expect(stored).toEqual({ local: '{}', session: '{}', cookie: '', idb: [] });
    expect(await context.cookies()).toEqual([]);
  });
});

test.describe('the layout, at the three widths', () => {
  for (const width of [375, 768, 1280]) {
    test(`${width}px: every control whole, in reading order, no sideways scroll`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await reachResults(page, true);
      const field = emailField(page);
      await field.scrollIntoViewIfNeeded();

      const box = async (selector: string) => {
        const b = await page.locator(selector).boundingBox();
        if (!b) throw new Error(`${selector} has no box`);
        return b;
      };
      const form = await box('.otp-post');
      const input = await box('#otp-email-input');
      const consent = await box('.otp-consent');
      const post = await box('.otp-post > button[type="submit"]');
      const name = await box('#otp-handle-input');

      // Inside the form, never past its edge.
      for (const [what, b] of [
        ['the email field', input],
        ['the consent', consent],
      ] as const) {
        expect(b.x, what).toBeGreaterThanOrEqual(form.x - 0.5);
        expect(b.x + b.width, what).toBeLessThanOrEqual(form.x + form.width + 0.5);
      }
      // Reading order is the visual order: name, then the address, then the consent, then Post.
      expect(input.y).toBeGreaterThan(name.y);
      expect(consent.y).toBeGreaterThan(input.y);
      expect(post.y).toBeGreaterThanOrEqual(consent.y + consent.height - 1);
      // Touch targets: the field and the consent row at least the 44px minimum.
      expect(input.height).toBeGreaterThanOrEqual(44);
      expect(consent.height).toBeGreaterThanOrEqual(44);
      // No sideways scroll on the page.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
