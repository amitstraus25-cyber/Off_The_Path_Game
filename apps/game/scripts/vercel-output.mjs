/**
 * Writes `.vercel/output` (Vercel's Build Output API, v3) so that Vercel deploys exactly what this
 * project built and compiles none of our TypeScript itself.
 *
 * WHY THIS EXISTS, in the order the leaderboard failed. Two Vercel services produced no functions.
 * Routes inside the game service produced no functions. Routes in the repository-root `api/`
 * produced functions at last -- and every one of them crashed on load with
 * FUNCTION_INVOCATION_FAILED. Vercel's build log said why, in TS5097 thirty-eight times over:
 * Vercel compiles `api/*.ts` with its OWN TypeScript settings, which know nothing of
 * `allowImportingTsExtensions`, an old `lib` (so `Array#at` fails) and no strict narrowing. Worse,
 * it compiles file by file and leaves `import './content.ts'` pointing at a `.ts` file that is not
 * in the lambda, and our workspace packages point `main` at TypeScript source, which a per-file
 * compiler cannot follow at runtime. This codebase writes `.ts` specifiers on purpose, so Node can
 * run its source directly; Vercel's zero-config compiler is the one thing that cannot.
 *
 * So nothing is left for Vercel to compile. Each route is bundled here into ONE self-contained
 * CommonJS file -- packages/core, the handlers and content/game.json inlined, only `node:`
 * builtins external -- and handed over in the documented Build Output layout:
 *
 *   .vercel/output/config.json                  routes: the security headers, then the filesystem
 *   .vercel/output/static/                      apps/game/dist, copied
 *   .vercel/output/functions/api/<name>.func/   index.js + .vc-config.json + package.json
 *
 * THE ROUTES ARE `apps/api/api/*.ts`, the single copy. They export `default { fetch }`; Vercel's
 * Node launcher calls a classic `(req, res)` handler (its own example reads `req.query`), so the
 * small adapter below turns the Node request into a web `Request` and the `Response` back.
 *
 * THE HEADERS COME FROM vercel.json, which stays the one source of truth that test/csp.test.ts
 * and every reviewer already read. Nothing here restates the CSP: it is copied, and the build
 * FAILS if the copy is missing the policy, because a deploy that drops its CSP silently is worse
 * than one that does not deploy.
 *
 * ESBUILD IS NOT A NEW DEPENDENCY. It is resolved through Vite, which already ships it, so this
 * script uses the exact esbuild the game's own build uses and package.json gains nothing.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const at = (path) => `${ROOT}${path}`;
const OUT = at('.vercel/output');
const DIST = at('apps/game/dist');
const ROUTES = ['top', 'score'];

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite'))('esbuild');

const fail = (message) => {
  console.error(`vercel-output: ${message}`);
  process.exit(1);
};

if (!existsSync(`${DIST}/index.html`))
  fail('apps/game/dist has no index.html -- run the game build first.');
if (existsSync(`${DIST}/.e2e-build`))
  fail(
    'apps/game/dist is an e2e build (debug hooks present on purpose). Run `pnpm build` before deploying it.',
  );

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/static`, { recursive: true });
cpSync(DIST, `${OUT}/static`, { recursive: true });

// The headers, copied from vercel.json rather than restated.
const vercel = JSON.parse(readFileSync(at('vercel.json'), 'utf8'));
const headers = Object.fromEntries(
  (vercel.headers ?? []).flatMap((rule) => rule.headers.map((h) => [h.key, h.value])),
);
if (!headers['Content-Security-Policy'])
  fail('vercel.json carries no Content-Security-Policy to ship.');

writeFileSync(
  `${OUT}/config.json`,
  `${JSON.stringify(
    { version: 3, routes: [{ src: '/(.*)', headers, continue: true }, { handle: 'filesystem' }] },
    null,
    2,
  )}\n`,
);

const adapter = (name) => `
const route = require(${JSON.stringify(at(`apps/api/api/${name}.ts`))}).default;
const handle = typeof route === 'function' ? route : route.fetch;

module.exports = async function handler(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const method = req.method || 'GET';
  const request = new Request(proto + '://' + req.headers.host + req.url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' || chunks.length === 0 ? undefined : Buffer.concat(chunks),
  });
  const response = await handle(request);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
};
`;

for (const name of ROUTES) {
  const dir = `${OUT}/functions/api/${name}.func`;
  mkdirSync(dir, { recursive: true });
  await esbuild.build({
    stdin: {
      contents: adapter(name),
      resolveDir: ROOT,
      loader: 'js',
      sourcefile: `${name}-entry.js`,
    },
    outfile: `${dir}/index.js`,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    logLevel: 'warning',
  });
  // The .func directory is a filesystem mount with nothing above it, so this file -- not the
  // repository's "type": "module" -- decides how Node reads index.js.
  writeFileSync(`${dir}/package.json`, '{ "type": "commonjs" }\n');
  writeFileSync(
    `${dir}/.vc-config.json`,
    `${JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: false }, null, 2)}\n`,
  );
}

console.log(
  `vercel-output: wrote static + ${ROUTES.map((r) => `/api/${r}`).join(', ')} to .vercel/output`,
);
