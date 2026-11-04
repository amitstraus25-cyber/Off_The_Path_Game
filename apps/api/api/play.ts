/* POST /api/play, the anonymous play stats. See ./top.ts for the export shape and the `.ts` specifiers. */
import { playDeps } from '../src/deps.ts';
import { handlePlay } from '../src/plays.ts';

/* `fetch`, so a GET reaches our own 405-with-Allow, like the other routes. */
export default {
  fetch: (request: Request): Promise<Response> => handlePlay(request, playDeps),
};
