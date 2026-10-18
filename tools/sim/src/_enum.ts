import { readFileSync } from 'node:fs';
import { VERDICTS, createState, ending, loadContent, reduce, score, trifectaLive } from '@otp/core';
import type { Action, Content, GameState, Verdict } from '@otp/core';

const content: Content = loadContent(JSON.parse(readFileSync(process.argv[2]!, 'utf8')));
const ab = (v: Verdict): string => (v === 'allow' ? 'A' : v === 'restrict' ? 'R' : 'J');

function play(c: Content, vs: Verdict[], post: boolean, door: boolean, postFirst = false): GameState {
  let clock = 0;
  let state = createState(c);
  const send = (a: Action): void => { state = reduce(state, a, c); };
  send({ type: 'START', runId: 'x', at: clock });
  send({ type: 'BEGIN' });
  if (postFirst && post) send({ type: 'READ_NOTICE', n: 'forest-post', at: (clock += 1000) });
  c.characters.forEach((ch, i) => {
    const skill = c.skills.find((s) => s.id === ch.skillId)!;
    send({ type: 'MEET', c: ch.id, at: (clock += 1000) });
    send({ type: 'ASK', c: ch.id, q: 'needs', at: (clock += 1000) });
    send({ type: 'INSPECT', s: skill.id, at: (clock += 1000) });
    send({ type: 'VERDICT', s: skill.id, v: vs[i]!, at: (clock += 1000) });
  });
  if (!postFirst && post) send({ type: 'READ_NOTICE', n: 'forest-post', at: (clock += 1000) });
  if (door) send({ type: 'READ_NOTICE', n: 'cottage-door', at: (clock += 1000) });
  send({ type: 'ENTER_COTTAGE', at: (clock += 1000) });
  send({ type: 'FINISH', at: (clock += 1000) });
  return state;
}

const rows: string[] = [];
for (const a of VERDICTS) for (const b of VERDICTS) for (const c3 of VERDICTS)
  for (const post of [false, true]) for (const door of [false, true]) {
    const st = play(content, [a, b, c3], post, door);
    const r = score(st.log, content);
    rows.push([
      `${ab(a)}${ab(b)}${ab(c3)} post:${post ? 'Y' : 'n'} door:${door ? 'Y' : 'n'}`.padEnd(22),
      String(r.total).padStart(5),
      (trifectaLive(st.verdicts, content) ? 'BROKEN' : 'held').padEnd(7),
      (r.goals.filter((g) => g.met).map((g) => g.id).join('+') || '-').padEnd(17),
      ending(st, content).id.padEnd(10),
      (st.flags.join('+') || '-').padEnd(32),
      st.basket.join('+') || '(empty)',
    ].join(' '));
  }
rows.sort((x, y) => Number(y.slice(22, 27)) - Number(x.slice(22, 27)));
console.log('order:', content.characters.map((c) => c.skillId).join(' / '), ' A=allow R=restrict J=reject');
console.log('line                    total  trifct  goals             ending     flags                            basket');
for (const r of rows) console.log(r);
const bb = play(content, ['restrict', 'restrict', 'allow'], true, true, true);
console.log('\nPOST-READ-FIRST exploit  RRA:', score(bb.log, content).total, ending(bb, content).id, '| flags', bb.flags.join('+') || '-');
