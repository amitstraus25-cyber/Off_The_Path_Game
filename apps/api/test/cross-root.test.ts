import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * The two imports that leave this service root, and the one thing about them no runtime test can
 * see.
 *
 * `src/content.ts` imports `content/game.json` from the repository root and `@otp/core` resolves,
 * through a pnpm symlink, to `packages/core/src/index.ts`. Both live OUTSIDE `apps/api`, which is
 * the `root` vercel.json gives this service. Under plain `node` and under vitest they resolve and
 * every other test in this directory passes; whether Vercel's bundler carries them into the
 * function is a question only a deploy answers, and the failure mode is the quiet one -- the
 * module throws at cold start, both routes answer 500 before a line of ours runs, the game shows
 * "Leaderboard unavailable right now." and play is untouched. A dead board that looks exactly like
 * a board nobody deployed.
 *
 * MEASURED, so the shape of that failure is on the record rather than assumed: copying `api/`,
 * `src/` and `package.json` into an empty directory -- which is what "only the service root" means
 * -- and importing `api/top.ts` gives
 *
 *     ERR_MODULE_NOT_FOUND: Cannot find module '<...>/content/game.json'
 *       imported from <...>/src/content.ts
 *
 * before any handler is reached. From the same checkout, with the repository around it, the same
 * import answers a real 503 with the configuration reason logged by name.
 *
 * So this file does the part that IS checkable from here, and does it on the text of the import
 * rather than on its effect, because the effect is what the bundler alone decides:
 *
 *   1. the relative specifier still points at the file it names, so moving either end breaks the
 *      BUILD instead of the deploy;
 *   2. the JSON import still carries `with { type: 'json' }`. Node 22 refuses a JSON import
 *      without it (ERR_IMPORT_ATTRIBUTE_MISSING) and these routes run on the Node runtime -- but
 *      vitest and vite transform JSON imports either way, so every other test in this directory
 *      passes with the attribute deleted. That is the gap: a one-token edit that nothing executes
 *      differently here and that 500s on the first cold start in production;
 *   3. the bytes the service scores against are the bytes the game ships. Not "a copy that was
 *      correct when it was taken" -- the same file, hashed at both ends.
 *
 * What it deliberately does NOT do is restate the specifier. A test that reads
 * `'../../../content/game.json'` out of the source and then asserts the source contains
 * `'../../../content/game.json'` passes on any string at all; this resolves what it finds against
 * the file's own directory and asks the filesystem.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTENT_TS = resolve(HERE, '../src/content.ts');
const REPO = resolve(HERE, '../../..');

/** The JSON import in src/content.ts: its specifier and whatever attribute clause follows it. */
function jsonImport(): { specifier: string; attributes: string } {
  const source = readFileSync(CONTENT_TS, 'utf8');
  const match = /import\s+\w+\s+from\s+'([^']+\.json)'([^;]*);/.exec(source);
  expect(match, 'src/content.ts no longer has a default JSON import to check').not.toBeNull();
  return { specifier: match![1]!, attributes: match![2]!.trim() };
}

describe('the imports that leave apps/api', () => {
  it('still points the content import at a file that is there', () => {
    const { specifier } = jsonImport();
    const target = resolve(dirname(CONTENT_TS), specifier);
    expect(existsSync(target), `src/content.ts imports ${specifier}, which does not exist`).toBe(
      true,
    );
  });

  it('still reaches OUT of this service root, which is the thing a deploy has to carry', () => {
    const { specifier } = jsonImport();
    const target = resolve(dirname(CONTENT_TS), specifier);
    const serviceRoot = resolve(HERE, '..');
    const fromRoot = relative(serviceRoot, target);
    /*
     * `..` at the front is the whole point: it is what makes this a bundler question. If this ever
     * stops being true -- someone copies the content file into apps/api to make a deploy work --
     * this test fails, and that is the right moment to argue about it, because a copy is a second
     * source of truth for the scoring weights and CLAUDE.md rule 3 says there is one.
     */
    expect(fromRoot.startsWith('..'), 'the content file is inside apps/api now -- see rule 3').toBe(
      true,
    );
    expect(target).toBe(resolve(REPO, 'content/game.json'));
  });

  it('still carries the import attribute plain node requires', () => {
    // Vitest transforms JSON imports with or without it, so nothing else here would notice.
    const { attributes } = jsonImport();
    expect(attributes.replace(/\s+/g, ' ')).toBe("with { type: 'json' }");
  });

  it('scores against the same bytes the game ships, not a copy of them', () => {
    const { specifier } = jsonImport();
    const digest = (path: string): string =>
      createHash('sha256').update(readFileSync(path)).digest('hex');
    expect(digest(resolve(dirname(CONTENT_TS), specifier))).toBe(
      digest(resolve(REPO, 'content/game.json')),
    );
  });

  it('still resolves @otp/core to source outside this root, the second import risk', () => {
    /*
     * packages/core has no build step: its `main` is `src/index.ts`, and pnpm links it as a
     * symlink whose real path is outside apps/api. A bundler that copies the service root plus its
     * own node_modules without following that link has nothing to compile. Same symptom as the
     * content import, same check on a preview.
     */
    const link = resolve(HERE, '../node_modules/@otp/core');
    expect(existsSync(link), 'run pnpm install -- @otp/core is not linked into apps/api').toBe(
      true,
    );
    const real = realpathSync(link);
    expect(relative(resolve(HERE, '..'), real).startsWith('..')).toBe(true);
    expect(real).toBe(realpathSync(resolve(REPO, 'packages/core')));
  });

  it('scans the file it thinks it does', () => {
    // A guard that silently stops matching is worse than no guard: this project has shipped one.
    const source = readFileSync(CONTENT_TS, 'utf8');
    expect(source).toContain('loadContent');
    expect(jsonImport().specifier).toMatch(/\.json$/);
  });
});
