/* POST /api/score. See ./top.ts for why the routes live in the game service. */
import { deps } from '../src/deps.ts';
import { handleScore } from '../src/handlers.ts';

/* `export default { fetch }` for the reason set out in ./top.ts -- the bare default function is not
 * a shape Vercel documents, and `fetch` keeps this handler's own 405-with-Allow in our hands, which
 * is the one signal that tells a mounted function from an absent one. */
export default {
  fetch: (request: Request): Promise<Response> => handleScore(request, deps),
};
