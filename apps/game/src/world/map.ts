import type { CollisionMap, Rect } from './logic';
import { TILE } from './logic';

interface TiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    properties?: { name: string; value: unknown }[];
  }[];
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
  /**
   * A drawn face inside the object, in art pixels from its top-left: the blank board the DOM lays
   * the Cyera logo over (`sign-logo`; tools/graybox writes it from the painter's `LOGO_FACE`).
   * Absent on every object that does not carry all four of `faceX`, `faceY`, `faceW`, `faceH`.
   */
  face?: Rect;
}

/** The four face properties as a rectangle, or undefined unless every one is a whole number. */
function faceOf(properties: { name: string; value: unknown }[] | undefined): Rect | undefined {
  const get = (name: string): number | undefined => {
    const value = properties?.find((p) => p.name === name)?.value;
    return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
  };
  const [x, y, width, height] = ['faceX', 'faceY', 'faceW', 'faceH'].map(get);
  if (x === undefined || y === undefined || width === undefined || height === undefined)
    return undefined;
  return { x, y, width, height };
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
    objects: objectLayer.objects.map((o) => {
      const face = faceOf(o.properties);
      return {
        name: o.name,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        ...(face ? { face } : {}),
      };
    }),
  };
}

export const findObject = (map: ForestMap, name: string): MapObject | undefined =>
  map.objects.find((o) => o.name === name);

/** Objects named `bystander-<id>`: people who talk but offer nothing. */
export function bystanderSpawns(
  map: ForestMap,
): { id: string; spawnName: string; x: number; y: number }[] {
  return map.objects
    .filter((o) => o.name.startsWith('bystander-'))
    .map((o) => ({
      id: o.name.slice('bystander-'.length),
      spawnName: o.name,
      x: o.x + o.width / 2,
      y: o.y + o.height / 2,
    }));
}

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
