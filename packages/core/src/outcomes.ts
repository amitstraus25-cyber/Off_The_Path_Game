import { CAPABILITIES, findSkill } from './content.ts';
import type {
  Capability,
  Content,
  Ending,
  Flag,
  Notice,
  Outcome,
  Skill,
  SkillId,
  Verdict,
} from './content.ts';
import type { GameState, RunEvent } from './state.ts';

/** Pure basket/flag update for one verdict. Order is stable and items never repeat. */
export function applyOutcome(
  basket: readonly string[],
  flags: readonly Flag[],
  outcome: Outcome,
): { basket: string[]; flags: Flag[] } {
  const kept = basket.filter((i) => !outcome.basketRemoves.includes(i));
  const added = outcome.basketAdds.filter((i) => !kept.includes(i));
  const newFlags = outcome.flagsSet.filter((f) => !flags.includes(f));
  return { basket: [...kept, ...added], flags: [...flags, ...newFlags] };
}

/** Capabilities left live by the verdicts given so far. Verdicts are final, so this only grows. */
export function liveCapabilities(
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): Capability[] {
  const live = new Set<Capability>();
  for (const skill of content.skills) {
    const v = verdicts[skill.id];
    if (v) for (const g of skill.outcomes[v].grants) live.add(g);
  }
  return CAPABILITIES.filter((c) => live.has(c));
}

/**
 * True when all three legs are live at once. This, not any single skill, is what lets an injected
 * instruction reach private data and send it out.
 */
export const trifectaLive = (
  verdicts: Readonly<Record<SkillId, Verdict>>,
  content: Content,
): boolean => liveCapabilities(verdicts, content).length === CAPABILITIES.length;

export const findNotice = (content: Content, id: string): Notice | undefined =>
  content.notices.find((n) => n.id === id);

export function canEnterCottage(state: Pick<GameState, 'verdicts'>, content: Content): boolean {
  return content.skills.every((s) => state.verdicts[s.id] !== undefined);
}

export interface GoalResult {
  id: string;
  label: string;
  points: number;
  /** The capability without which this was never possible. */
  needs: Capability;
  met: boolean;
}

/**
 * What Grandma asked for, and how much of it got done.
 *
 * A goal needs its capability live and, where the goal names an `act`, that thing actually done on
 * the walk -- so holding a capability is not the same as using it, and a player who clamps every
 * skill and walks straight to the cottage collects less than one who went to the post. This is the
 * only thing in the ruleset that pays for a grant; without it every capability is pure downside.
 */
export function errandGoals(
  state: Pick<GameState, 'verdicts' | 'read'>,
  content: Content,
): GoalResult[] {
  /*
   * Only a capability obtained cleanly counts towards the errand. A skill you allowed in full does
   * the job it promised and the one it hid, so the word it sent for you went to the wolf as well --
   * that is not Grandma's errand carried out, it is the wolf's. Without this, leaking the key and
   * every message still scored the same as refusing everything.
   */
  const earned = new Set<Capability>();
  for (const skill of content.skills) {
    const v = state.verdicts[skill.id];
    if (v === undefined) continue;
    const outcome = skill.outcomes[v];
    if (outcome.flagsSet.length === 0) for (const g of outcome.grants) earned.add(g);
  }
  return content.scoring.errandGoals.map((g) => ({
    id: g.id,
    label: g.label,
    points: g.points,
    needs: g.needs,
    met: earned.has(g.needs) && (g.act === undefined || state.read.includes(g.act)),
  }));
}

/**
 * Selects the ending by what actually happened: how much was taken, and how much of the errand was
 * carried out. Content lint guarantees exactly one match for every combination.
 *
 * It used to key on the flag count alone. Refusing every skill sets no flags, so "I declined all
 * three and arrived with nothing done" and "I read every card and got all three right" produced
 * the identical card -- and the ending is the part a player repeats to someone else.
 */
export function ending(
  state: Pick<GameState, 'flags' | 'verdicts' | 'read'>,
  content: Content,
): Ending {
  const n = state.flags.length;
  const met = errandGoals(state, content).filter((g) => g.met).length;
  return content.endings.find(
    (e) =>
      n >= e.when.minFlags &&
      n <= (e.when.maxFlags ?? Infinity) &&
      met >= (e.when.minGoals ?? 0) &&
      met <= (e.when.maxGoals ?? Infinity),
  )!;
}

export interface Derived {
  basket: string[];
  flags: Flag[];
  verdicts: Record<SkillId, Verdict>;
}

/**
 * Whether a notice still has something left to do: it carries a hidden instruction, and at least
 * one of the flags that instruction sets is not set yet.
 *
 * This is what keeps the forest post re-readable. The post is the only mechanical demonstration of
 * the whole lesson, and the only clear lane out of the spawn runs straight past it, so a player who
 * walks east first used to spend it before a single verdict existed -- `already-read` latched, and
 * every later reading refused. The fiction is unchanged: the injection still needs all three legs
 * live at the moment of reading, because it is the lantern that reads the hidden line out, the
 * basket that exposes the letter and the weaver that sends it on. Reading it early still does
 * nothing. It simply no longer uses the post up.
 *
 * A notice with no `whenExposed` -- the note on Grandma's door -- is never pending, so it keeps the
 * plain read-once rule. So does one whose flags are all already set, which is what stops the beat
 * being replayed once it has actually fired.
 */
export const noticePending = (notice: Notice, flags: readonly Flag[]): boolean =>
  notice.whenExposed !== undefined &&
  // `flagsSet` is required by the schema, so there is no empty-array fallback to write here: a
  // `whenExposed` that set nothing would be a content error, and content.ts would reject it.
  notice.whenExposed.flagsSet.some((f) => !flags.includes(f));

/** Rebuilds basket, flags and verdicts from a log alone (used by the server and tests). */
export function derive(log: readonly RunEvent[], content: Content): Derived {
  let basket = [...content.startBasket];
  let flags: Flag[] = [];
  const verdicts: Record<SkillId, Verdict> = {};
  for (const e of log) {
    if (e.t === 'verdict') {
      verdicts[e.s] = e.v;
      ({ basket, flags } = applyOutcome(basket, flags, findSkill(content, e.s)!.outcomes[e.v]));
    }
    // A notice only bites if all three legs were live at the moment it was read, and only if it
    // carries a hidden instruction at all -- the sign on Grandma's door is just a sign.
    if (e.t === 'read' && trifectaLive(verdicts, content)) {
      const exposed = findNotice(content, e.n)?.whenExposed;
      if (exposed)
        ({ basket, flags } = applyOutcome(basket, flags, {
          ...exposed,
          points: 0,
          grants: [],
          basketAdds: [],
        }));
    }
  }
  return { basket, flags, verdicts };
}

/**
 * Notices that actually fired, for the recap.
 *
 * Deduplicated, because a notice is now re-readable until its hidden instruction has taken effect,
 * so a log can legitimately hold several `read` events for the same post. It still bites once.
 */
export function exposedNotices(log: readonly RunEvent[], content: Content): Notice[] {
  const verdicts: Record<SkillId, Verdict> = {};
  const fired: Notice[] = [];
  for (const e of log) {
    if (e.t === 'verdict') verdicts[e.s] = e.v;
    if (e.t === 'read' && trifectaLive(verdicts, content)) {
      const notice = findNotice(content, e.n);
      if (notice?.whenExposed && !fired.some((n) => n.id === notice.id)) fired.push(notice);
    }
  }
  return fired;
}

export interface RecapRow {
  skillId: SkillId;
  skillName: string;
  verdict: Verdict;
  bestVerdict: Verdict;
  points: number;
  /** True when the player earned the full per-skill score. Drives success vs missed row styling. */
  success: boolean;
  /** True when a hidden action took effect. */
  compromised: boolean;
  /** The verdict was given without the card ever being opened. */
  onTrust: boolean;
  hiddenAction: { title: string; detail: string } | null;
  recap: string;
}

/** One row per decided skill, in content order. */
export function recap(log: readonly RunEvent[], content: Content): RecapRow[] {
  const { verdicts } = derive(log, content);
  const opened = new Set(log.flatMap((e) => (e.t === 'inspected' ? [e.s] : [])));
  return content.skills.flatMap((s: Skill) => {
    const v = verdicts[s.id];
    if (v === undefined) return [];
    const o = s.outcomes[v];
    return [
      {
        skillId: s.id,
        skillName: s.name,
        verdict: v,
        bestVerdict: s.bestVerdict,
        points: o.points,
        success: o.points === content.scoring.maxPerSkill,
        compromised: o.flagsSet.length > 0,
        hiddenAction: s.finePrint ? { title: s.finePrint.title, detail: s.finePrint.detail } : null,
        recap: o.recap,
        onTrust: !opened.has(s.id),
      },
    ];
  });
}
