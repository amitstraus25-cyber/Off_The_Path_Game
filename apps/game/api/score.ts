/* POST /api/score. See ./top.ts for why the routes live in the game service. */
import { deps } from '@otp/api/src/deps.ts';
import { handleScore } from '@otp/api/src/handlers.ts';

export default function handler(request: Request): Promise<Response> {
  return handleScore(request, deps);
}
