import { loadContent } from '@otp/core';
// The import ATTRIBUTE is required, not decorative: Node 22 refuses a JSON import without one
// (ERR_IMPORT_ATTRIBUTE_MISSING), and these two routes run on the Node runtime. Vitest and Vite
// transform JSON imports either way, which is exactly why the tests could not have caught it.
import raw from '../../../content/game.json' with { type: 'json' };

/*
 * The same content file the game loads, through the same schema and the same lint.
 *
 * This is what makes the recompute meaningful: the server scores a run against the very bytes the
 * player played, not a copy. It is read once per cold start, and a content file that does not
 * validate throws here -- which is the right moment for it to fail, before a score can be computed
 * from something the game would have refused to start with.
 */
export const content = loadContent(raw);
