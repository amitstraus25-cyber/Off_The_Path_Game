import { deps } from '../src/deps.ts';
import { handleScore } from '../src/handlers.ts';

/** POST /api/score -- recomputes the score from the run log and stores that. See src/handlers.ts. */
export default function handler(request: Request): Promise<Response> {
  return handleScore(request, deps);
}
