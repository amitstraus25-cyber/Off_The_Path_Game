import { contentSchema, lintContent } from './content.ts';
import type { Content, LintOptions } from './content.ts';
import { trapChecks } from './sim.ts';
import { TIME_LIMIT_MS } from './state.ts';

/*
 * Kept apart from content.ts so the import graph has no cycle: the trap is measured by PLAYING the
 * content (sim.ts), the simulator needs the reducer, and the reducer needs content.ts.
 */

/** Every problem found in a content file, listed. Thrown by parseContent and loadContent. */
export class ContentError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid game content:\n- ${issues.join('\n- ')}`);
    this.name = 'ContentError';
    this.issues = issues;
  }
}

/** Schema only. Throws ContentError listing every problem. For tools and tests that lint by hand. */
export function parseContent(raw: unknown): Content {
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success)
    throw new ContentError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  return parsed.data;
}

/**
 * Parse, lint, then play the trap properties. Throws ContentError listing every problem.
 *
 * The trap is not played on content the lint refused: an unknown skill or a broken ceiling makes
 * the simulator's numbers meaningless, and a list of trap failures on top of a structural one
 * sends the reader after the wrong fault.
 */
export function loadContent(raw: unknown, opts: LintOptions = {}): Content {
  const content = parseContent(raw);
  const issues = lintContent(content, opts);
  // Here rather than in the lint: content.ts cannot import the clock (state.ts imports it).
  if (content.scoring.parMs >= TIME_LIMIT_MS)
    issues.push(
      `scoring.parMs ${content.scoring.parMs} is not under the ${TIME_LIMIT_MS}ms limit, so no run earns a speed bonus`,
    );
  if (issues.length > 0) throw new ContentError(issues);
  const trap = trapChecks(content);
  if (!trap.ok)
    throw new ContentError(
      trap.checks.filter((c) => !c.ok).map((c) => `trap: ${c.name} (${c.detail})`),
    );
  return content;
}
