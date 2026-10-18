// Plays a strategy through the real reducer and prints score + ending.
//   pnpm sim                          table of every strategy, with and without questions
//   pnpm sim --strategy perfect       one run in detail
//   pnpm sim --strategy random --seed 7 --questions
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERDICTS,
  createState,
  ending,
  liveCapabilities,
  loadContent,
  recap,
  reduce,
  score,
  trifectaLive,
} from '@otp/core';
import type { Action, Content, GameState, Skill, Verdict } from '@otp/core';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const content = loadContent(JSON.parse(readFileSync(join(root, 'content/game.json'), 'utf8')));

type Strategy = (skill: Skill, rnd: () => number) => Verdict;
const STRATEGIES: Record<string, Strategy> = {
  perfect: (s) => s.bestVerdict,
  'reject-all': () => 'reject',
  'allow-all': () => 'allow',
  'restrict-all': () => 'restrict',
  random: (_s, rnd) => VERDICTS[Math.floor(rnd() * VERDICTS.length)]!,
};

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `readFirst` reads the notice before any verdict, which is the cautious-sequencing play. */
function play(
  c: Content,
  strategy: Strategy,
  questions: boolean,
  seed: number,
  readFirst = false,
): GameState {
  const rnd = mulberry32(seed);
  let clock = 0;
  let state = createState(c);
  const send = (a: Action): void => {
    state = reduce(state, a, c);
  };
  send({ type: 'START', runId: `sim-${seed}`, at: clock });
  send({ type: 'BEGIN' });
  const notice = c.notices[0];
  if (readFirst && notice) send({ type: 'READ_NOTICE', n: notice.id, at: (clock += 2000) });
  for (const ch of c.characters) {
    const skill = c.skills.find((s) => s.id === ch.skillId)!;
    send({ type: 'MEET', c: ch.id, at: (clock += 5000) });
    if (questions) send({ type: 'ASK', c: ch.id, q: 'needs', at: (clock += 3000) });
    send({ type: 'INSPECT', s: skill.id, at: (clock += 4000) });
    send({ type: 'VERDICT', s: skill.id, v: strategy(skill, rnd), at: (clock += 6000) });
  }
  // Red passes the post on the way to the cottage.
  if (!readFirst && notice) send({ type: 'READ_NOTICE', n: notice.id, at: (clock += 4000) });
  send({ type: 'ENTER_COTTAGE', at: (clock += 8000) });
  send({ type: 'FINISH', at: clock + 1000 });
  return state;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const seed = Number(arg('seed') ?? 1);
const withQuestions = process.argv.includes('--questions');
const chosen = arg('strategy');

if (chosen) {
  const strategy = STRATEGIES[chosen];
  if (!strategy) {
    console.error(
      `Unknown strategy "${chosen}". Choose one of: ${Object.keys(STRATEGIES).join(', ')}`,
    );
    process.exit(1);
  }
  const state = play(content, strategy, withQuestions, seed);
  const result = score(state.log, content);
  console.log(`strategy: ${chosen}${withQuestions ? ' (asks a question first)' : ''}`);
  for (const row of recap(state.log, content))
    console.log(
      `  ${row.skillName.padEnd(16)} ${row.verdict.padEnd(9)} ${String(row.points).padStart(3)}  ${row.success ? 'full marks' : 'missed'}`,
    );
  console.log(
    `  questions ${result.bonus}, boundary ${result.boundaryBonus}, errand ${result.errandBonus}, total ${result.total}`,
  );
  console.log(
    `  live capabilities: ${liveCapabilities(state.verdicts, content).join(', ') || '(none)'}`,
  );
  console.log(`  trifecta: ${trifectaLive(state.verdicts, content) ? 'ALL THREE LIVE' : 'held'}`);
  for (const g of result.goals)
    console.log(`  errand ${g.met ? '[x]' : '[ ]'} ${g.label} (needs ${g.needs})`);
  console.log(`  ending: ${ending(state, content).title}`);
  console.log(`  basket: ${state.basket.join(', ') || '(empty)'}`);
  console.log(`  flags: ${state.flags.join(', ') || '(none)'}`);
} else {
  console.log('strategy      questions  total  trifecta  goals  ending');
  for (const [name, strategy] of Object.entries(STRATEGIES))
    for (const q of [false, true]) {
      const state = play(content, strategy, q, seed);
      const result = score(state.log, content);
      const tri = trifectaLive(state.verdicts, content) ? 'BROKEN' : 'held';
      const goals = `${result.goals.filter((g) => g.met).length}/${result.goals.length}`;
      console.log(
        `${name.padEnd(13)} ${(q ? 'yes' : 'no').padEnd(10)} ${String(result.total).padStart(5)}  ${tri.padEnd(8)}  ${goals.padEnd(6)} ${ending(state, content).id}`,
      );
    }
}
