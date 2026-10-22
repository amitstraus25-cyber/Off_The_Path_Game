import { TERRAIN } from './minimap';
import type { MapSketch } from './minimap';
import { TILE } from './logic';
import type { Rect } from './logic';

/*
 * THE FORK SIGNS (the Toadstool's Way Teller, the client 2026-10-22): "at each fork, a small sign
 * shows who lives that way ... pointing to the nearest unmet character down that branch, never to
 * the cottage".
 *
 * WHAT "DOWN THAT BRANCH" MEANS, measured on the map rather than written down. The forest is mostly
 * open lawn, so a flood over every walkable tile reaches everyone from every direction and "a
 * branch" stops meaning anything. A branch is a way along the PATH: the flood here walks only the
 * sketch's path and bridge cells (eight-connected, because the sand meanders diagonally), starting
 * at the fork. Each character is reached at the path cell nearest their spawn; the shortest route's
 * first few steps say which way out of the fork they lie, and that heading is the arrow.
 *
 * Per heading, the sign names the NEAREST UNMET character by path distance, so it updates as the
 * player meets people and goes blank on a heading where everyone has been met. The cottage is not a
 * character and is never a target: nothing here can point at the door (the client's rule for every
 * perk).
 *
 * Pure and Phaser-free, so test/forks.test.ts walks it on the shipped map.
 */

export type Heading = 'up' | 'down' | 'left' | 'right';

/** One character down one way out of a fork, with how far along the path they are. */
export interface ForkRoute {
  readonly id: string;
  readonly heading: Heading;
  /** Path steps from the fork to the cell nearest the character. */
  readonly steps: number;
}

export interface Fork {
  /** The map object's name (`fork-1`). */
  readonly name: string;
  /** The fork's own tile. */
  readonly col: number;
  readonly row: number;
  /** Where the sign stands: a crook beside the fork that is not path, water or another prop. */
  readonly sign: { readonly col: number; readonly row: number };
  /** Everyone the path reaches from here, nearest first. */
  readonly routes: readonly ForkRoute[];
}

/** How far into the route the heading is read: far enough that a meander does not decide it. */
const HEADING_STEPS = 3;

/** How far from a character's spawn the nearest path cell may be, in tiles (Chebyshev). */
const REACH = 3;

/** The eight neighbours, orthogonals first so a tie prefers the straight step. */
const AROUND: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** The crooks a sign may stand in, diagonals first: they are off the sand on a straight road. */
const CROOKS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];

const headingOf = (dx: number, dy: number): Heading =>
  Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';

/**
 * Every fork on the map, with who lies down each way out of it.
 *
 * `forks` are the map's `fork-N` objects, `props` every rectangle a sign must not stand on (the
 * map's `prop-*` objects), both in world pixels.
 */
export function readForks(
  sketch: Pick<MapSketch, 'cols' | 'rows' | 'cells' | 'cast'>,
  forks: readonly (Rect & { name: string })[],
  props: readonly Rect[] = [],
): Fork[] {
  const { cols, rows, cells } = sketch;
  const at = (c: number, r: number): number =>
    c < 0 || r < 0 || c >= cols || r >= rows ? TERRAIN.blocked : cells[r * cols + c]!;
  const isPath = (c: number, r: number): boolean => at(c, r) === TERRAIN.path;
  const underProp = (c: number, r: number): boolean =>
    props.some(
      (p) =>
        c * TILE < p.x + p.width &&
        (c + 1) * TILE > p.x &&
        r * TILE < p.y + p.height &&
        (r + 1) * TILE > p.y,
    );

  return forks.map((f) => {
    const col = Math.floor((f.x + f.width / 2) / TILE);
    const row = Math.floor((f.y + f.height / 2) / TILE);

    // Breadth-first along the sand from the fork, remembering the way each cell was reached.
    const from = new Int32Array(cols * rows).fill(-1);
    const steps = new Int32Array(cols * rows).fill(-1);
    const start = row * cols + col;
    steps[start] = 0;
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]!;
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dx, dy] of AROUND) {
        const nc = c + dx;
        const nr = r + dy;
        if (!isPath(nc, nr)) continue;
        const n = nr * cols + nc;
        if (steps[n] !== -1) continue;
        steps[n] = steps[i]! + 1;
        from[n] = i;
        queue.push(n);
      }
    }

    const routes: ForkRoute[] = [];
    for (const who of sketch.cast) {
      const home = { c: Math.floor(who.col), r: Math.floor(who.row) };
      // The nearest reached path cell to their spawn, ring by ring, never the fork itself.
      let best = -1;
      for (let ring = 1; ring <= REACH && best === -1; ring++)
        for (let dr = -ring; dr <= ring; dr++)
          for (let dc = -ring; dc <= ring; dc++) {
            const c = home.c + dc;
            const r = home.r + dr;
            if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
            const i = r * cols + c;
            if (i === start || steps[i]! <= 0) continue;
            if (best === -1 || steps[i]! < steps[best]!) best = i;
          }
      if (best === -1) continue;
      // Walk the route back to the fork and read the heading a few steps out.
      const route: number[] = [];
      for (let i = best; i !== start && i !== -1; i = from[i]!) route.push(i);
      route.reverse();
      const probe = route[Math.min(HEADING_STEPS, route.length) - 1]!;
      const pc = probe % cols;
      const pr = (probe - pc) / cols;
      routes.push({ id: who.id, heading: headingOf(pc - col, pr - row), steps: steps[best]! });
    }
    routes.sort((a, b) => a.steps - b.steps || (a.id < b.id ? -1 : 1));

    // A crook for the sign: beside the fork on open lawn, off the sand, clear of every prop.
    const crook = CROOKS.map(([dx, dy]) => ({ col: col + dx, row: row + dy })).find(
      (s) => at(s.col, s.row) === TERRAIN.open && !underProp(s.col, s.row),
    ) ?? { col, row: row - 1 };

    return { name: f.name, col, row, sign: crook, routes };
  });
}

/** What one sign says right now: per heading, the nearest character not yet met. */
export interface SignEntry {
  readonly heading: Heading;
  readonly id: string;
}

/** The fixed order a sign lists its headings in, so it does not reshuffle as people are met. */
const HEADINGS: readonly Heading[] = ['left', 'up', 'down', 'right'];

export function signFor(fork: Fork, met: readonly string[]): SignEntry[] {
  return HEADINGS.flatMap((heading) => {
    const next = fork.routes.find((r) => r.heading === heading && !met.includes(r.id));
    return next ? [{ heading, id: next.id }] : [];
  });
}
