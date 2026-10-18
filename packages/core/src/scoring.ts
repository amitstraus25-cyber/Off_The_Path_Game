import { findCharacterForSkill } from './content.ts';
import type { CharacterId, Content, SkillId, Verdict } from './content.ts';
import { derive, errandGoals, trifectaLive } from './outcomes.ts';
import type { GoalResult } from './outcomes.ts';
import type { RunEvent } from './state.ts';

export interface SkillScore {
  skillId: SkillId;
  verdict: Verdict | null;
  points: number;
  /** True when a bonus-eligible question was asked of this skill's character before the verdict. */
  questionedFirst: boolean;
  /** The verdict was given without the card ever being opened. */
  onTrust: boolean;
}

export interface ScoreResult {
  total: number;
  perSkill: SkillScore[];
  /** Asked a real question of every skill before deciding. */
  bonus: number;
  /** Never let all three capabilities run at once. The biggest single prize. */
  boundaryBonus: number;
  /** Points from the errand goals that were actually carried out. */
  errandBonus: number;
  boundaryHeld: boolean;
  /** Every goal Grandma asked for was done. */
  errandDone: boolean;
  /** One row per goal, so the recap can say which were missed and why. */
  goals: GoalResult[];
  /** At least one offer was accepted without its card being opened. */
  tookOnTrust: boolean;
  /** The whole of what an unopened offer is worth. A single flag takes it away. */
  trustBonus: number;
}

/** Pure function of the run log and content. Assumes a legal log (see checkLog). */
export function score(log: readonly RunEvent[], content: Content): ScoreResult {
  const { questionBonus, bonusQuestions } = content.scoring;
  const questioned = new Set<CharacterId>();
  const decided = new Map<SkillId, SkillScore>();

  const opened = new Set<SkillId>();
  for (const e of log) {
    if (e.t === 'asked' && (bonusQuestions as string[]).includes(e.q)) questioned.add(e.c);
    if (e.t === 'inspected') opened.add(e.s);
    if (e.t === 'verdict') {
      const skill = content.skills.find((s) => s.id === e.s)!;
      const onTrust = !opened.has(e.s);
      decided.set(e.s, {
        skillId: e.s,
        verdict: e.v,
        /*
         * An offer taken on the offerer's word scores nothing of its own. Everything it is worth
         * sits in `trustBonus`, which pays only on a clean arrival -- so a gamble that comes off
         * is worth exactly what reading the card was worth, and a gamble that does not is worth
         * nothing at all.
         */
        points: onTrust ? 0 : skill.outcomes[e.v].points,
        questionedFirst: questioned.has(findCharacterForSkill(content, e.s)!.id),
        onTrust,
      });
    }
  }

  const perSkill = content.skills.map(
    (s) =>
      decided.get(s.id) ?? {
        skillId: s.id,
        verdict: null,
        points: 0,
        questionedFirst: false,
        onTrust: false,
      },
  );
  const earned = perSkill.reduce((sum, s) => sum + s.points, 0);
  const allQuestioned = perSkill.every((s) => s.verdict !== null && s.questionedFirst);
  const bonus = allQuestioned ? questionBonus : 0;

  const { verdicts, flags } = derive(log, content);
  // Capabilities only ever accumulate, so "never all three at once" is decided by the final set.
  const boundaryHeld = !trifectaLive(verdicts, content);
  const boundaryBonus = boundaryHeld ? content.scoring.boundaryBonus : 0;

  // Goals are acts, so they are read off the log's `read` events rather than off the basket.
  const read = log.flatMap((e) => (e.t === 'read' ? [e.n] : []));
  const goals = errandGoals({ verdicts, read }, content);
  const errandBonus = goals.reduce((sum, g) => sum + (g.met ? g.points : 0), 0);
  const errandDone = goals.every((g) => g.met);

  /*
   * The gamble pays only if nothing was taken from Red. One flag is enough to lose it, which is
   * what keeps "say yes to everything" from being the fast route to a good score: it is the fast
   * route to the worst one.
   */
  const tookOnTrust = perSkill.some((s) => s.onTrust);
  const trustBonus = tookOnTrust && flags.length === 0 ? content.scoring.trustBonus : 0;

  return {
    total: earned + bonus + boundaryBonus + errandBonus + trustBonus,
    perSkill,
    bonus,
    boundaryBonus,
    errandBonus,
    boundaryHeld,
    errandDone,
    goals,
    tookOnTrust,
    trustBonus,
  };
}

export interface RankedRun {
  total: number;
  durationMs: number;
}

/** Sort comparator: higher score first, then the faster run. Negative means `a` ranks better. */
export const compareRuns = (a: RankedRun, b: RankedRun): number =>
  b.total - a.total || a.durationMs - b.durationMs;
