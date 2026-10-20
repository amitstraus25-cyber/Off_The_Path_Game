import { deps } from '../src/deps.ts';
import { handleTop } from '../src/handlers.ts';

/** GET /api/top -- rank, handle and score, cached at the edge. See src/handlers.ts. */
export default function handler(request: Request): Promise<Response> {
  return handleTop(request, deps);
}
