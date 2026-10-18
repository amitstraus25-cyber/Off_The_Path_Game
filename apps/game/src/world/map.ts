import type { CollisionMap, Rect } from './logic';
import { TILE } from './logic';

interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: { name: string; x: number; y: number; width: number; height: number }[];
}
interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
}

export interface MapObject extends Rect {
  name: string;
}

export interface ForestMap {
  widthInPixels: number;
  heightInPixels: number;
  collision: CollisionMap;
  objects: MapObject[];
}

/** Reads the Tiled JSON Phaser already parsed, and keeps only what the game needs. */
export function readForestMap(raw: unknown): ForestMap {
  const map = raw as TiledMap;
  if (map.tilewidth !== TILE || map.tileheight !== TILE)
    throw new Error(`Map tile size must be ${TILE}px, got ${map.tilewidth}x${map.tileheight}`);
  const collisionLayer = map.layers.find((l) => l.name === 'collision');
  if (!collisionLayer?.data) throw new Error('Map has no "collision" tile layer');
  const objectLayer = map.layers.find((l) => l.type === 'objectgroup');
  if (!objectLayer?.objects) throw new Error('Map has no object layer');
  return {
    widthInPixels: map.width * TILE,
    heightInPixels: map.height * TILE,
    collision: { width: map.width, height: map.height, tiles: collisionLayer.data },
    objects: objectLayer.objects.map((o) => ({
      name: o.name,
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
    })),
  };
}

export const findObject = (map: ForestMap, name: string): MapObject | undefined =>
  map.objects.find((o) => o.name === name);

/** Objects named `npc-<id>`, keyed by the character id the content uses. */
export function npcSpawns(
  map: ForestMap,
): { id: string; spawnName: string; x: number; y: number }[] {
  return map.objects
    .filter((o) => o.name.startsWith('npc-'))
    .map((o) => ({
      id: o.name.slice('npc-'.length),
      spawnName: o.name,
      x: o.x + o.width / 2,
      y: o.y + o.height / 2,
    }));
}
