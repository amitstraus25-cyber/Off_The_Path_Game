import { blocked, moveWithCollision, TILE } from './logic';
import type { CollisionMap, Rect, Vec } from './logic';

/*
 * THE GATE ON THE BRIDGE AND THE WING RIDE'S LANDING (docs/GATEKEEPER.md).
 *
 * The river is crossed two ways. The Gatekeeper's Bridge Key opens the gate at the bridge's west
 * end; the Magpie's Wing Ride flies Purple to the far bank. This file is the pure half of both:
 * which cells the gate covers, the collision map that keeps it shut, whether a step was a bump
 * against it, which tile layer carries its picture, and where the flight lands.
 *
 * Phaser-free and DOM-free, so test/gate.test.ts walks it on fixtures and on the shipped map. The
 * map LEAVES THE GATE'S CELLS WALKABLE in its `collision` layer; the game shuts them (`shutGate`)
 * while the run does not have the `bridge-gate` perk, so the open bridge is the map's own and a
 * shut one is only ever an overlay on it.
 */

/** The map rectangle covering the gate's cells at the bridge's west end. */
export const GATE_OBJECT = 'gate-bridge';
/** The map point on the east bank where a Wing Ride sets Purple down. */
export const LANDING_OBJECT = 'wing-landing';
/**
 * THE DRAWBRIDGE'S PICTURES (2026-10-25, the client's late change: the gate became a drawbridge).
 * Tiles of the shipped tileset, looked up by name in the gids file, one PAIR per kind of deck
 * column: `bridge-gate-shut-<n>` (raised) and `bridge-gate-open-<n>` (lowered), n = 0 the west end
 * with the leaf standing up, 1 the open river, 2 the east end. The map lays the raised ones over
 * the whole span and the game swaps each cell's shut-<n> for its own open-<n>.
 */
export const GATE_SHUT_PREFIX = 'bridge-gate-shut-';
export const GATE_OPEN_PREFIX = 'bridge-gate-open-';

/** One kind of deck column: its raised and its lowered tile, by gid. */
export interface GatePair {
  readonly shut: number;
  readonly open: number;
}

/**
 * Every raised/lowered pair the tileset has, from -0 upward, stopping at the first n that lacks
 * either half. A tileset from before the drawbridge has none, and the gate is then only the block.
 */
export function gatePairs(table: Readonly<Record<string, number>>): GatePair[] {
  const pairs: GatePair[] = [];
  for (let n = 0; ; n++) {
    const shut = table[`${GATE_SHUT_PREFIX}${n}`];
    const open = table[`${GATE_OPEN_PREFIX}${n}`];
    if (shut === undefined || open === undefined) return pairs;
    pairs.push({ shut, open });
  }
}

/**
 * HOW LONG THE DRAWBRIDGE TAKES TO COME DOWN, in ms. Brief on purpose: long enough to be seen
 * falling, short enough that nobody waits on it. Instant under prefers-reduced-motion.
 */
export const LOWER_MS = 640;

/**
 * How much of the lowered deck shows, in whole pixels from the hinge (the span's west edge), after
 * `elapsedMs` of the fall. The leaf is hinged at the west end on a north-south axis, and this camera
 * looks straight down on it, so a leaf at angle a from upright covers `width * sin(a)` of the river.
 * It falls like a weight let go, slow off the top and fastest as it lands: a = (pi / 2) * t^2.
 * Whole pixels, because the world is pixel art (a crop, never a stretch).
 */
export function loweredWidth(elapsedMs: number, width: number, ms: number = LOWER_MS): number {
  const t = ms > 0 ? Math.min(1, Math.max(0, elapsedMs / ms)) : 1;
  return Math.round(width * Math.sin((Math.PI / 2) * t * t));
}

/**
 * The lines the gate says, as content's `ui.chrome` has them, and the words used until it does
 * (the contract's own wording): a missing key never leaves the player at a silent wall.
 */
export const GATE_LOCKED_FALLBACK = 'The gate is locked. The Gatekeeper has the key.';

/** How long after a notice the gate stays quiet, in ms: sliding along it is not a new bump. */
export const GATE_NOTICE_COOLDOWN_MS = 2500;

/** One tile of the map, by column and row. */
export interface Cell {
  readonly col: number;
  readonly row: number;
}

/**
 * Every tile the rectangle covers, row by row. A rectangle's right and bottom edges belong to the
 * tile before them, so one that is exactly two tiles wide covers two columns and not three.
 */
export function gateCells(rect: Rect): Cell[] {
  const cols = [Math.floor(rect.x / TILE), Math.ceil((rect.x + rect.width) / TILE) - 1] as const;
  const rows = [Math.floor(rect.y / TILE), Math.ceil((rect.y + rect.height) / TILE) - 1] as const;
  const cells: Cell[] = [];
  for (let row = rows[0]; row <= rows[1]; row++)
    for (let col = cols[0]; col <= cols[1]; col++) cells.push({ col, row });
  return cells;
}

/**
 * The map with the gate's cells solid. A copy: the map the game read stays the open bridge, so the
 * gate opening is a swap back to it and nothing has to remember what was under the gate.
 */
export function shutGate(open: CollisionMap, rect: Rect): CollisionMap {
  const tiles = [...open.tiles];
  for (const { col, row } of gateCells(rect))
    if (col >= 0 && row >= 0 && col < open.width && row < open.height)
      tiles[row * open.width + col] = 1;
  return { width: open.width, height: open.height, tiles };
}

/**
 * Whether this step ran into the SHUT GATE and nothing else: it goes somewhere on the open bridge
 * that it cannot go on the shut one. A step into a tree, or along the railing, is not a bump.
 */
export function gateBump(
  open: CollisionMap,
  shut: CollisionMap,
  from: Vec,
  dx: number,
  dy: number,
): boolean {
  const a = moveWithCollision(open, from, dx, dy);
  const b = moveWithCollision(shut, from, dx, dy);
  return a.x !== b.x || a.y !== b.y;
}

/** The names of the layers that can hold the gate's picture: every tile layer but `collision`. */
interface TiledTileLayer {
  name: string;
  type: string;
  width?: number;
  data?: number[];
}

/**
 * The tile layer the map drew the SHUT gate on: the first layer, `collision` aside, that has one of
 * the raised tiles (`shutGids`) at any of the gate's cells, since the art may cover only part of
 * the rectangle. Null when no layer has it, which is a map from before the gate (or a tileset
 * without its tiles): the scene then has nothing to swap and the gate is only the block.
 *
 * Found by looking, not by a layer name the contract does not give: the picture is wherever the
 * map's painter put it.
 */
export function gateLayerName(
  tiled: { width: number; layers: readonly TiledTileLayer[] },
  cells: readonly Cell[],
  shutGids: readonly number[],
): string | null {
  for (const layer of tiled.layers) {
    if (layer.type !== 'tilelayer' || layer.name === 'collision' || !layer.data) continue;
    const width = layer.width ?? tiled.width;
    if (cells.some((c) => shutGids.includes(layer.data![c.row * width + c.col]!)))
      return layer.name;
  }
  return null;
}

/**
 * Where a Wing Ride sets Purple down: the landing point, or the nearest walkable place to it. The
 * point is a place on a path, so it almost always IS the answer; the search is for a point the
 * painter left a pixel into a tree. Order: the point, below it, to either side, above, then two
 * tiles out the same way. When none is free the point itself, because a landing is not refused.
 */
export function landingSpot(collision: CollisionMap, point: Vec): Vec {
  const steps = [0, TILE * 0.5, TILE, TILE * 2];
  for (const k of steps)
    for (const [dx, dy] of [
      [0, k],
      [-k, 0],
      [k, 0],
      [0, -k],
    ] as const) {
      const spot = { x: point.x + dx, y: point.y + dy };
      if (!blocked(collision, spot.x, spot.y)) return spot;
    }
  return point;
}

/** The centre of a map object, which for a point is the point and for a rectangle its middle. */
export const centreOf = (o: Rect): Vec => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });
