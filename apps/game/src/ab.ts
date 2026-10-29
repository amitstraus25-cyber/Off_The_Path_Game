/*
 * A/B VARIANTS (the client, 2026-10-25: "A/B test everything").
 *
 * THE HOST PAGE ASSIGNS, THE GAME REPORTS. The agency's page puts each visitor in a group and says
 * which in the iframe's own address -- `?landing=forest&results=above` -- and the game draws that
 * variant and names it on every event it posts (embed/postMessage.ts), so the page's analytics can
 * split by it. Nothing comes IN by message: the embed contract stays outbound only (ARCHITECTURE
 * section 9), and a query string is read once, at boot, like any other page.
 *
 * Each test has a fixed list of variants; the FIRST is the default a visitor gets with no
 * parameter, which is what ships. Anything else in the query string is ignored: an unknown test,
 * an unknown variant, a repeated key. Pure, so test/ab.test.ts holds it without a browser.
 */
export const TESTS = {
  /** The landing: the client's illustration (2026-10-25), or the live forest as it was before. */
  landing: ['art', 'forest'],
  /** Results (P19): "Read the research" where it is, or directly under the score. */
  results: ['below', 'above'],
  /** The start (P20): landing then how-to, or one screen with the rules and par on it. */
  start: ['two', 'one'],
  // The post form's test (P21, `post`: the email at once or as a second step) went with the work
  // email (the client, 2026-10-29): there is one field to post with, so nothing to split.
} as const;

export type TestName = keyof typeof TESTS;
export type Variants = { readonly [K in TestName]: (typeof TESTS)[K][number] };

export function readVariants(search: string): Variants {
  const query = new URLSearchParams(search);
  const out = {} as Record<TestName, string>;
  for (const name of Object.keys(TESTS) as TestName[]) {
    const allowed: readonly string[] = TESTS[name];
    const asked = query.getAll(name);
    out[name] = asked.length === 1 && allowed.includes(asked[0]!) ? asked[0]! : allowed[0]!;
  }
  return out as Variants;
}

/** The variants as one short tag for an event, e.g. "landing:art,results:below,start:two". */
export const variantTag = (v: Variants): string =>
  (Object.keys(TESTS) as TestName[]).map((name) => `${name}:${v[name]}`).join(',');

/** This visit's variants, read once. */
export const variants: Variants = readVariants(
  typeof location === 'undefined' ? '' : location.search,
);
