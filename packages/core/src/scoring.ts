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
}

/** Pure function of the run log and content. Assumes a legal log (see checkLog). */
export function score(log: readonly RunEvent[], content: Content): ScoreResult {
  const { questionBonus, bonusQuestions } = content.scoring;
  const questioned = new Set<CharacterId>();
  const decided = new Map<SkillId, SkillScore>();

  for (const e of log) {
    if (e.t === 'asked' && (bonusQuestions as string[]).includes(e.q)) questioned.add(e.c);
    if (e.t === 'verdict') {
      const skill = content.skills.find((s) => s.id === e.s)!;
      decided.set(e.s, {
        skillId: e.s,
        verdict: e.v,
        points: skill.outcomes[e.v].points,
        questionedFirst: questioned.has(findCharacterForSkill(content, e.s)!.id),
      });
    }
  }

  const perSkill = content.skills.map(
    (s) => decided.get(s.id) ?? { skillId: s.id, verdict: null, points: 0, questionedFirst: false },
  );
  const earned = perSkill.reduce((sum, s) => sum + s.points, 0);
  const allQuestioned = perSkill.every((s) => s.verdict !== null && s.questionedFirst);
  const bonus = allQuestioned ? questionBonus : 0;

  const { verdicts } = derive(log, content);
  // Capabilities only ever accumulate, so "never all three at once" is decided by the final set.
  const boundaryHeld = !trifectaLive(verdicts, content);
  const boundaryBonus = boundaryHeld ? content.scoring.boundaryBonus : 0;

  // Goals are acts, so they are read off the log's `read` events rather than off the basket.
  const read = log.flatMap((e) => (e.t === 'read' ? [e.n] : []));
  const goals = errandGoals({ verdicts, read }, content);
  const errandBonus = goals.reduce((sum, g) => sum + (g.met ? g.points : 0), 0);
  const errandDone = goals.every((g) => g.met);

  return {
    total: earned + bonus + boundaryBonus + errandBonus,
    perSkill,
    bonus,
    boundaryBonus,
    errandBonus,
    boundaryHeld,
    errandDone,
    goals,
  };
}

export interface RankedRun {
  total: number;
  durationMs: number;
}

/** Sort comparator: higher score first, then the faster run. Negative means `a` ranks better. */
export const compareRuns = (a: RankedRun, b: RankedRun): number =>
  b.total - a.total || a.durationMs - b.durationMs;
