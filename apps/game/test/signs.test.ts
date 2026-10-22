import { describe, expect, it } from 'vitest';
import content from '../../../content/game.v2.json';
import map from '../src/assets/map-forest.json';
import gids from '../src/assets/tileset-forest.gids.json';
import { readForestMap } from '../src/world/map';
import type { MapObject } from '../src/world/map';
import { TILE } from '../src/world/logic';
import { faceOnCanvas, isSign, SIGN_NEAR, signKey, signNear } from '../src/world/signs';
import type { View } from '../src/world/signs';

/*
 * THE THREE CYERA SIGNS (the client, 2026-10-23), on the shipped map: the forest notice lettered
 * "I ♥ Cyera Research", the "Cyera Speed!" board by the waterfall, and the blank board the logo is
 * laid over. What is asserted here is the contract between three files -- the map that places them,
 * the content that says what they say, and the scene's pure helpers in world/signs.ts -- and that
 * every sign is a solid thing off the path that a player can walk up to. The picture itself, the
 * logo's alignment and the captions in the running game are e2e/forest-signs.spec.ts.
 */

const forest = readForestMap(map);
const nameOfGid = new Map<number, string>(
  Object.entries(gids as Record<string, number>).map(([name, gid]) => [gid, name]),
);
const layer = (name: string): number[] =>
  (map as unknown as { layers: { name: string; data?: number[] }[] }).layers.find(
    (l) => l.name === name,
  )?.data ?? [];
const nameAt = (layerName: string, x: number, y: number): string =>
  nameOfGid.get((layer(layerName)[y * forest.collision.width + x]! >>> 0) & 0x1fffffff) ?? '';
const solid = (x: number, y: number): boolean =>
  x < 0 ||
  y < 0 ||
  x >= forest.collision.width ||
  y >= forest.collision.height ||
  forest.collision.tiles[y * forest.collision.width + x] !== 0;
const cells = (o: MapObject): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = Math.floor(o.y / TILE); y < Math.ceil((o.y + o.height) / TILE); y++)
    for (let x = Math.floor(o.x / TILE); x < Math.ceil((o.x + o.width) / TILE); x++)
      out.push([x, y]);
  return out;
};

const signs = forest.objects.filter(isSign);
const words = content.ui.world.signs as Record<string, { caption: string; spoken?: string }>;

/** Every walkable tile reachable from the spawn, four-connected. */
const reachable = (() => {
  const spawn = forest.objects.find((o) => o.name === 'spawn-purple')!;
  const start: [number, number] = [Math.floor(spawn.x / TILE), Math.floor(spawn.y / TILE)];
  const seen = new Set([start.join(',')]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n: [number, number] = [x + dx, y + dy];
      if (solid(n[0], n[1]) || seen.has(n.join(','))) continue;
      seen.add(n.join(','));
      queue.push(n);
    }
  }
  return seen;
})();

describe('the Cyera signs on the map', () => {
  it('are the three the client asked for, or every test below is vacuous', () => {
    expect(signs.map((s) => s.name).sort()).toEqual(['sign-logo', 'sign-research', 'sign-speed']);
  });

  it('each have a caption in content, and content captions no sign the map lacks', () => {
    expect(Object.keys(words).sort()).toEqual(signs.map((s) => signKey(s.name)).sort());
    for (const { caption, spoken } of Object.values(words)) {
      // One line each: the caption is a single line in the toast's slot.
      expect(caption).not.toMatch(/\n/);
      if (spoken !== undefined) expect(spoken).not.toMatch(/[\n♥]/);
    }
  });

  it('say what the client asked them to say', () => {
    expect(words['research']?.caption).toBe('I ♥ Cyera Research');
    expect(words['speed']?.caption).toBe('Cyera Speed!');
    expect(words['logo']?.caption).toBe('Cyera');
  });

  /*
   * The tiles each sign is drawn with, read off the generated gid map rather than written as gids,
   * so this fails on a sign laid without its art -- an invisible wall -- or art without its sign.
   */
  const DRAWN: Record<string, string[]> = {
    'sign-research': ['notice-board', 'notice-board-r'],
    'sign-speed': ['sign-speed'],
    'sign-logo': ['sign-logo-l', 'sign-logo-r'],
  };

  it.each(signs.map((s) => [s.name, s] as const))(
    '%s is drawn, and solid on every tile',
    (_n, s) => {
      const tiles = cells(s);
      expect(tiles.map(([x, y]) => nameAt('decor-below', x, y))).toEqual(DRAWN[s.name]);
      for (const [x, y] of tiles) {
        expect(solid(x, y), `(${x},${y}) is walkable`).toBe(true);
        // Nothing drawn over a sign: no crown, no bush.
        expect(nameAt('decor-above', x, y), `(${x},${y}) has something over it`).toBe('');
      }
    },
  );

  it.each(signs.map((s) => [s.name, s] as const))('%s stands off the path', (_n, s) => {
    for (const [x, y] of cells(s)) {
      const ground = nameAt('ground', x, y);
      expect(
        ground.startsWith('path') || ground.startsWith('bridge'),
        `${ground} at (${x},${y})`,
      ).toBe(false);
    }
  });

  it.each(signs.map((s) => [s.name, s] as const))(
    '%s can be walked up to: a reachable tile raises its caption',
    (_n, s) => {
      const near = [...reachable]
        .map((k) => k.split(',').map(Number) as [number, number])
        .filter(
          ([x, y]) =>
            signNear(signs, { x: (x + 0.5) * TILE, y: (y + 1) * TILE - 1 }) === signKey(s.name),
        );
      expect(near.length, `no reachable tile near ${s.name}`).toBeGreaterThan(0);
    },
  );

  it('the logo board carries a blank face inside its own rectangle, and no other sign does', () => {
    const logo = signs.find((s) => s.name === 'sign-logo')!;
    const face = logo.face!;
    expect(face).toBeDefined();
    expect(face.x).toBeGreaterThanOrEqual(0);
    expect(face.y).toBeGreaterThanOrEqual(0);
    expect(face.x + face.width).toBeLessThanOrEqual(logo.width);
    expect(face.y + face.height).toBeLessThanOrEqual(logo.height);
    // Room for the 734 x 176 mark at a size that reads: wider than four times its height.
    expect(face.width / face.height).toBeGreaterThan(734 / 176 - 1);
    expect(signs.filter((s) => s.face).map((s) => s.name)).toEqual(['sign-logo']);
  });
});

describe('which sign Purple is near (world/signs.ts)', () => {
  const sign = (name: string, x: number, y: number, w = TILE, h = TILE): MapObject => ({
    name,
    x,
    y,
    width: w,
    height: h,
  });
  const a = sign('sign-a', 0, 0);
  const b = sign('sign-b', 4 * TILE, 0);

  it('is none when she is further than SIGN_NEAR on either axis', () => {
    expect(signNear([a], { x: TILE + SIGN_NEAR + 1, y: TILE / 2 })).toBeNull();
    expect(signNear([a], { x: TILE / 2, y: TILE + SIGN_NEAR + 1 })).toBeNull();
  });

  it('is the sign when she is within it, inclusive at the edge', () => {
    expect(signNear([a], { x: TILE + SIGN_NEAR, y: TILE + SIGN_NEAR })).toBe('a');
    expect(signNear([a], { x: TILE / 2, y: TILE / 2 })).toBe('a');
  });

  it('is the nearer of two, when both are near', () => {
    expect(signNear([a, b], { x: 2.8 * TILE, y: TILE })).toBe('b');
    expect(signNear([b, a], { x: 2.2 * TILE, y: TILE })).toBe('a');
  });
});

describe('where the logo goes on the canvas (world/signs.ts)', () => {
  const logo: MapObject = {
    name: 'sign-logo',
    x: 640,
    y: 704,
    width: 64,
    height: 32,
    face: { x: 6, y: 5, width: 52, height: 14 },
  };
  const view = (scrollX: number, scrollY: number): View => ({
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    scrollX,
    scrollY,
  });

  it('is the face, offset by the scroll Phaser draws at: floored, as roundPixels floors it', () => {
    expect(faceOnCanvas(logo, view(500.7, 600.2), null)).toEqual({
      x: 640 + 6 - 500,
      y: 704 + 5 - 600,
      width: 52,
      height: 14,
    });
  });

  it('is nothing for a sign with no face', () => {
    const bare: MapObject = {
      name: logo.name,
      x: logo.x,
      y: logo.y,
      width: logo.width,
      height: logo.height,
    };
    expect(faceOnCanvas(bare, view(500, 600), null)).toBeNull();
  });

  it('is nothing once the face is wholly off the camera, and something while any of it shows', () => {
    expect(faceOnCanvas(logo, view(0, 0), null)).toBeNull();
    // Its left edge one pixel inside the right of the view.
    expect(faceOnCanvas(logo, view(640 + 6 - 399, 600), null)).not.toBeNull();
    expect(faceOnCanvas(logo, view(640 + 6 - 400, 600), null)).toBeNull();
  });

  it('is nothing while Purple stands in front of it, and the face again once she steps clear', () => {
    const over = { x: 650, y: 690, width: 32, height: 48 };
    expect(faceOnCanvas(logo, view(500, 600), over)).toBeNull();
    const clear = { x: 720, y: 690, width: 32, height: 48 };
    expect(faceOnCanvas(logo, view(500, 600), clear)).not.toBeNull();
  });
});
