// Plays a strategy through the real v2 reducer and prints the score and the ending.
//   pnpm sim                              every strategy over every deal, and the trap checks
//   pnpm sim --strategy careful           one deal in detail (seed 0)
//   pnpm sim --strategy greedy --seed 7   one chosen deal
// Nothing here re-derives a rule: the strategies, the deal and the score are packages/core's.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 } from '@otp/core';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const content = v2.loadContent(
  JSON.parse(readFileSync(join(root, 'content/game.v2.json'), 'utf8')),
);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const chosen = arg('strategy');
const seed = Number(arg('seed') ?? 0);

if (chosen) {
  if (!(chosen in v2.STRATEGIES)) {
    console.error(
      `Unknown strategy "${chosen}". Choose one of: ${Object.keys(v2.STRATEGIES).join(', ')}`,
    );
    process.exit(1);
  }
  const played = v2.play(content, chosen, { seed });
  console.log(`strategy: ${chosen}, deal ${seed}`);
  for (const ch of content.characters) {
    const skill = content.skills.find((s) => s.id === ch.skillId)!;
    const kind = played.state.good.includes(skill.id) ? 'good' : 'bad ';
    const verdict = played.state.verdicts[skill.id] ?? 'walked past';
    console.log(`  ${ch.name.padEnd(16)} ${skill.name.padEnd(16)} ${kind}  ${verdict}`);
  }
  console.log(`  ending: ${played.ending ?? '(run still open)'}, score ${played.total}`);
} else {
  const rows = v2.table(content);
  console.log(
    `strategy      deals  mean score  grandma  wolf  late  (out of ${content.scoring.outOf})`,
  );
  for (const name of Object.keys(v2.STRATEGIES)) {
    const mine = rows.filter((r) => r.strategy === name);
    const mean = mine.reduce((sum, r) => sum + r.total, 0) / mine.length;
    const count = (ending: string): number => mine.filter((r) => r.ending === ending).length;
    console.log(
      `${name.padEnd(13)} ${String(mine.length).padStart(5)}  ${mean.toFixed(1).padStart(10)}  ` +
        `${String(count('grandma')).padStart(7)}  ${String(count('wolf')).padStart(4)}  ${String(count('late')).padStart(4)}`,
    );
  }
  console.log('');
  for (const check of v2.trapChecks(content).checks)
    console.log(`${check.ok ? '[x]' : '[ ]'} ${check.name}: ${check.detail}`);
}
