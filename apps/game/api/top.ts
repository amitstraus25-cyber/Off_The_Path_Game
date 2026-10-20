/*
 * GET /api/top, served as an ordinary Vercel Function of the GAME service.
 *
 * The implementation lives in @otp/api and is unchanged; this file exists only to put a route
 * where Vercel will certainly find one. The second-service route did not work: `services.api`
 * with a null framework failed schema validation outright (which failed every deployment for six
 * hours), and with the key removed the deployment succeeds but the service still produces no
 * functions and /api/top returns Vercel's own 404 rather than anything of ours.
 *
 * A `<root>/api/*` directory beside a static build is the oldest and most widely supported
 * convention Vercel has, and it needs no multi-service support on any plan. Vite ignores this
 * directory because it sits outside `src`.
 */
import { deps } from '@otp/api/src/deps.ts';
import { handleTop } from '@otp/api/src/handlers.ts';

export default function handler(request: Request): Promise<Response> {
  return handleTop(request, deps);
}
