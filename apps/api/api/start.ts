/* POST /api/start. See ./top.ts for the export shape and the `.ts` specifiers. */
import { deps } from '../src/deps.ts';
import { handleStart } from '../src/handlers.ts';

/* `fetch`, so a GET reaches our own 405-with-Allow -- the discriminator for "is it mounted". */
export default {
  fetch: (request: Request): Promise<Response> => Promise.resolve(handleStart(request, deps)),
};
