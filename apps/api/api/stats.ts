/* GET /api/stats, the dashboard's private read. See ./top.ts for the export shape and the `.ts` specifiers. */
import { statsDeps } from '../src/deps.ts';
import { handleStats } from '../src/stats.ts';

export default {
  fetch: (request: Request): Promise<Response> => handleStats(request, statsDeps),
};
