import { TILE } from './logic';
import type { Rect } from './logic';

/*
 * THE MINIMAP'S PICTURE OF THE FOREST, read off the map the game loaded (the client, 2026-10-22:
 * "how do i get to this? i cant find the character").
 *
 * Pure, and no Phaser: the scene hands in the Tiled JSON it already parsed and the tileset's own
 * name table, and gets back one small object the DOM minimap (ui/Minimap.tsx) draws. Nothing here
 * is a copy of the map -- not the size, not where anybody stands, not which cells are path -- so a
 * regenerated map moves the minimap with it, which is trap 1 in docs/PAUL_BRIEF.md not happening
 * again.
 *
 * WHAT IT DOES NOT CARRY: anything about a skill. A cast member is an id and a cell, the same for a
 * good deal and a bad one, so the minimap cannot give a verdict away however it is styled.
 */

/** One cell's kind, drawn as one square of the minimap. */
export const TERRAIN = {
  /** Trees, fences, walls: anything Purple cannot walk through. Left unpainted. */
  blocked: 0,
  /** Open ground. */
  open: 1,
  /** The sand paths and the plank bridges, which is what a player steers by. */
  path: 2,
  /** The stream. Blocked too, and drawn apart so the map has its landmarks. */
  water: 3,
} as const;
export type Terrain = (typeof TERRAIN)[keyof typeof TERRAIN];

export interface MapSketch {
  /** The map's size in tiles, which is the minimap's size in its own cells. */
  readonly cols: number;
  readonly rows: number;
  /** `cols * rows` kinds, row by row from the top-left, as `TERRAIN` numbers. */
  readonly cells: readonly Terrain[];
  /** Grandma's cottage, in tiles. */
  readonly cottage: Rect;
  /** Where each member of the cast stands, in tiles (the centre of their spawn cell). */
  readonly cast: readonly { readonly id: string; readonly col: number; readonly row: number }[];
}

interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: { name: string; x: number; y: number; width: number; height: number }[];
}

/** Tiled keeps three flip flags in a gid's top bits; the tile is what is left. */
const GID_MASK = 0x1fffffff;

/** Which kind a ground tile's NAME says it is. Names are graybox's (tileset-forest.gids.json). */
function kindOfName(name: string | undefined): Terrain | null {
  if (name === undefined) return null;
  if (/^(water|shore|waterfall)/.test(name)) return TERRAIN.water;
  if (/^(path|bridge)/.test(name)) return TERRAIN.path;
  return null;
}

/**
 * The sketch, from the Tiled JSON and the tileset's `name -> gid` table.
 *
 * Throws on a map without the layers the scene itself already requires, for the same reason
 * `readForestMap` does: a minimap that silently drew nothing would be the blank the client reported
 * as "i cant find" all over again.
 *
 * @param castAt who stands at which spawn, from content (world/run.ts `castOf`): the spawn object's
 *   name in, the character id out, or null for a spawn nobody in this cast uses.
 */
export function sketchMap(
  raw: unknown,
  gids: Readonly<Record<string, number>>,
  castAt: (spawnName: string) => string | null,
): MapSketch {
  const map = raw as { width: number; height: number; layers: TiledLayer[] };
  const ground = map.layers.find((l) => l.name === 'ground')?.data;
  const collision = map.layers.find((l) => l.name === 'collision')?.data;
  const objects = map.layers.find((l) => l.type === 'objectgroup')?.objects;
  if (!ground || !collision || !objects)
    throw new Error('The minimap needs the ground, collision and object layers');

  const nameOf = new Map<number, string>(Object.entries(gids).map(([name, gid]) => [gid, name]));
  const cells: Terrain[] = [];
  for (let i = 0; i < map.width * map.height; i++) {
    const named = kindOfName(nameOf.get((ground[i] ?? 0) & GID_MASK));
    if (named === TERRAIN.water) cells.push(TERRAIN.water);
    else if ((collision[i] ?? 0) !== 0) cells.push(TERRAIN.blocked);
    else cells.push(named ?? TERRAIN.open);
  }

  const facade = objects.find((o) => o.name === 'prop-cottage');
  if (!facade) throw new Error('The minimap needs "prop-cottage" to mark the cottage');
  const inTiles = (o: Rect): Rect => ({
    x: o.x / TILE,
    y: o.y / TILE,
    width: o.width / TILE,
    height: o.height / TILE,
  });

  const cast = objects.flatMap((o) => {
    const id = castAt(o.name);
    return id === null
      ? []
      : [{ id, col: (o.x + o.width / 2) / TILE, row: (o.y + o.height / 2) / TILE }];
  });

  return { cols: map.width, rows: map.height, cells, cottage: inTiles(facade), cast };
}

/** One rectangle of a run of same-kind cells along a row, in minimap cells. */
export interface Run {
  readonly kind: Terrain;
  readonly x: number;
  readonly y: number;
  readonly length: number;
}

/**
 * The painted cells as runs along each row, so the minimap is a handful of SVG path segments per
 * kind rather than two and a half thousand rectangles. Blocked cells are not painted at all: the
 * minimap's own dark ground shows through them.
 */
export function terrainRuns(sketch: Pick<MapSketch, 'cols' | 'rows' | 'cells'>): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < sketch.rows; y++) {
    let x = 0;
    while (x < sketch.cols) {
      const kind = sketch.cells[y * sketch.cols + x]!;
      let end = x + 1;
      while (end < sketch.cols && sketch.cells[y * sketch.cols + end] === kind) end++;
      if (kind !== TERRAIN.blocked) runs.push({ kind, x, y, length: end - x });
      x = end;
    }
  }
  return runs;
}

/** An SVG path `d` covering every run of one kind, in whole cells. */
export function pathFor(runs: readonly Run[], kind: Terrain): string {
  return runs
    .filter((r) => r.kind === kind)
    .map((r) => `M${r.x} ${r.y}h${r.length}v1h-${r.length}z`)
    .join('');
}
