/*
 * THE LINT RULES, ASKED RATHER THAN READ.
 *
 * eslint.config.js enforces two of CLAUDE.md's rules: "no eval, no innerHTML with data" over
 * everything that ships, and packages/core's purity over core. Both are expressed as lists inside
 * a config whose semantics are not obvious by eye -- flat config does not merge two entries that
 * configure the same rule, the last match wins outright, and the two blocks overlap on
 * packages/core. Get that wrong and core's purity rules switch OFF while the config reads as
 * though it gained protection. That is not a thing a reader can check; it is a thing you ask.
 *
 * So this file asks. It lints a short probe of each forbidden construct, at a path in each
 * directory the config claims to cover, through the real config, and fails if the real ESLint
 * stops reporting it. Nothing is written to disk: `lintText` takes the path to pretend the text
 * came from.
 *
 * The negative control at the end is half the value. Without it, a config that reported
 * everything everywhere -- or a probe that is a syntax error, which reports too -- would pass
 * every assertion above.
 */
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** One ESLint, reused: constructing it reads and resolves the whole config. */
const eslint = new ESLint({ cwd: ROOT });

/** The rule ids ESLint reports for `text`, pretending it lives at `filePath`. */
async function rulesFiredIn(filePath: string, text: string): Promise<string[]> {
  const [result] = await eslint.lintText(text, { filePath: ROOT + filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse-error');
}

/** Everything the eval-and-HTML-sink block exists to stop, one construct per line. */
const SINKS = `
export function sink(el: Element, data: string): void {
  el.innerHTML = data;
  el.outerHTML = data;
  el.insertAdjacentHTML('beforeend', data);
  eval(data);
  // A string literal, not \`data\`: without type information the base rule only sees the obvious
  // shape, so a probe built from a variable would assert a reach this config does not have.
  setTimeout('danger()', 0);
}
`;

/** Everything core's purity block exists to stop. */
const IMPURITIES = `
export function impure(): number {
  const a = Date.now();
  const b = Math.random();
  const c = new Date();
  const d = window.innerWidth;
  const e = performance.now();
  return a + b + Number(c) + d + e;
}
`;

/** Directories eslint.config.js claims to cover. Their own name is the assertion. */
const SHIPPED = [
  'apps/game/src/probe.ts',
  'apps/api/src/probe.ts',
  'apps/api/api/probe.ts',
  'packages/core/src/probe.ts',
];

describe('the sinks every shipped directory is held to', () => {
  for (const path of SHIPPED) {
    // 20s, not the default 5: the first of these pays eslint's cold start on the typed config,
    // which ran 5.6s on a busy machine and failed a green suite.
    it(`${path}: eval and the HTML sinks are reported`, async () => {
      const fired = await rulesFiredIn(path, SINKS);
      expect(fired, `${path} parsed as anything but TypeScript`).not.toContain('parse-error');
      expect(fired.filter((r) => r === 'no-restricted-properties')).toHaveLength(3);
      expect(fired).toContain('no-eval');
      expect(fired).toContain('no-implied-eval');
    }, 20_000);
  }

  it('apps/game: dangerouslySetInnerHTML is reported in TSX', async () => {
    const fired = await rulesFiredIn(
      'apps/game/src/probe.tsx',
      'export const P = () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;\n',
    );
    expect(fired).toContain('no-restricted-syntax');
  });
});

describe("packages/core keeps its own rules while gaining the others'", () => {
  /*
   * The regression this file was written for. Both config blocks match this path and both want
   * `no-restricted-properties` and `no-restricted-syntax`; if the later one replaces rather than
   * restates the earlier one, core silently stops being checked for purity.
   */
  it('still reports the clock, the dice and a bare new Date()', async () => {
    const fired = await rulesFiredIn('packages/core/src/probe.ts', IMPURITIES);
    expect(fired, 'Date.now and Math.random').toContain('no-restricted-properties');
    expect(fired, 'new Date() with no argument').toContain('no-restricted-syntax');
    expect(fired, 'window and performance').toContain('no-restricted-globals');
    expect(fired.filter((r) => r === 'no-restricted-properties').length).toBeGreaterThanOrEqual(2);
  });

  it('reports a sink in the same file as an impurity', async () => {
    const fired = await rulesFiredIn('packages/core/src/probe.ts', SINKS + IMPURITIES);
    expect(fired).toContain('no-eval');
    expect(fired).toContain('no-restricted-globals');
    // Three sinks plus the clock and the dice: proof the two lists are concatenated, not replaced.
    expect(fired.filter((r) => r === 'no-restricted-properties')).toHaveLength(5);
  });
});

describe('the control', () => {
  /*
   * tools/ is deliberately outside the list: the graybox generator runs at build time, writes PNGs
   * and never reaches a browser. If this assertion ever fails it means the blocks have stopped
   * being scoped at all -- and every assertion above would then be passing for the wrong reason.
   */
  it('does not reach a directory the config does not name', async () => {
    const fired = await rulesFiredIn('tools/graybox/src/probe.ts', SINKS);
    expect(fired).not.toContain('no-restricted-properties');
    expect(fired).not.toContain('no-eval');
  });
});
