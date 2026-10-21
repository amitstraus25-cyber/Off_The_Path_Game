import { v2 } from '@otp/core';
// The import ATTRIBUTE is required, not decorative: Node 22 refuses a JSON import without one
// (ERR_IMPORT_ATTRIBUTE_MISSING), and these routes run on the Node runtime. Vitest and Vite
// transform JSON imports either way, which is exactly why the tests could not have caught it.
import raw from '../../../content/game.v2.json' with { type: 'json' };

/*
 * The same content file the game loads, through the same schema, lint and trap.
 *
 * This is what makes the recompute meaningful: the server scores a run against the very bytes the
 * player played, not a copy. It is read once per cold start, and a content file that does not
 * validate throws here -- which is the right moment for it to fail, before a score can be computed
 * from something the game would have refused to start with. v2 since Phase E: a v1 log does not
 * parse as a v2 one (core runlog.ts), so a v1 game posting here is refused with a 400.
 */
export const content = v2.loadContent(raw);
