import { describe, expect, it } from 'vitest';
import content from '../../../content/game.json';
import map from '../src/assets/map-forest.json';
import gids from '../src/assets/tileset-forest.gids.json';
import manifest from '../src/assets/manifest.json';
import { readForestMap } from '../src/world/map';
import { TILE } from '../src/world/logic';
import type { ForestMap, MapObject } from '../src/world/map';

const forest: ForestMap = readForestMap(map);
/** gid -> tile name, so a test can tell sand from grass from bridge deck. */
const nameOfGid = new Map<number, string>(
  Object.entries(gids as Record<string, number>).map(([name, gid]) => [gid, name]),
);
const object = (name: string): MapObject => {
  const found = forest.objects.find((o) => o.name === name);
  if (!found) throw new Error(`map has no "${name}"`);
  return found;
};

const tiles = (o: MapObject) => ({
  x0: Math.floor(o.x / TILE),
  x1: Math.floor((o.x + o.width) / TILE) - 1,
  y0: Math.floor(o.y / TILE),
  y1: Math.floor((o.y + o.height) / TILE) - 1,
});

const solid = (x: number, y: number): boolean =>
  x < 0 ||
  y < 0 ||
  x >= forest.collision.width ||
  y >= forest.collision.height ||
  forest.collision.tiles[y * forest.collision.width + x] !== 0;

/** Every walkable tile reachable from the spawn, optionally refusing to enter a rectangle. */
function reachable(avoid?: MapObject): Set<string> {
  const spawn = tiles(object('spawn-red'));
  const blocked = avoid ? tiles(avoid) : null;
  const start = `${spawn.x0},${spawn.y0}`;
  const seen = new Set([start]);
  const queue = [[spawn.x0, spawn.y0] as const];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || solid(nx, ny)) continue;
      if (blocked && nx >= blocked.x0 && nx <= blocked.x1 && ny >= blocked.y0 && ny <= blocked.y1)
        continue;
      seen.add(key);
      queue.push([nx, ny] as const);
    }
  }
  return seen;
}

const touches = (seen: Set<string>, o: MapObject): boolean => {
  const t = tiles(o);
  for (let y = t.y0; y <= t.y1; y++)
    for (let x = t.x0; x <= t.x1; x++) {
      if (seen.has(`${x},${y}`)) return true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        if (seen.has(`${x + dx},${y + dy}`)) return true;
    }
  return false;
};

describe('the generated forest is playable', () => {
  const open = reachable();

  it.each(['npc-rabbit', 'npc-owl', 'npc-lantern-keeper'])('Red can walk to %s', (name) => {
    expect(touches(open, object(name))).toBe(true);
  });

  it('Red can reach the cottage door', () => {
    expect(touches(open, object('trigger-cottage'))).toBe(true);
  });

  it('Red starts somewhere she can stand', () => {
    const spawn = tiles(object('spawn-red'));
    expect(solid(spawn.x0, spawn.y0)).toBe(false);
  });
});

describe('the notice post cannot be walked around', () => {
  /*
   * The zero-click beat is the lesson of the level, so it must not be optional. The garden fence
   * encloses the cottage on three sides and the map border closes the fourth, which leaves the
   * gate approach, and the notice spans it. Without this the player can take a one-tile detour
   * and never learn what the notice does.
   */
  it('the gate is unreachable if the notice is refused', () => {
    const avoidingNotice = reachable(object('notice-forest-post'));
    expect(touches(avoidingNotice, object('gate-fence-gap'))).toBe(false);
  });

  it('but the gate is reachable normally', () => {
    expect(touches(reachable(), object('gate-fence-gap'))).toBe(true);
  });

  /*
   * This used to be checked against `trigger-cottage`, which worked only while the trigger
   * happened to sit on the gap in the fence. It has since moved to the doorstep, so the gap is
   * named directly and the assertion says what it always meant.
   */
  it('the notice spans the full width of the gate approach', () => {
    const notice = tiles(object('notice-forest-post'));
    const gap = tiles(object('gate-fence-gap'));
    expect(notice.y0).toBeLessThanOrEqual(gap.y0);
    expect(notice.y1).toBeGreaterThanOrEqual(gap.y1);
    expect(notice.x1).toBe(gap.x0 - 1);
  });
});

describe('nothing a goal needs sits behind the end of the walk', () => {
  /*
   * The bug this exists to catch: `trigger-cottage` ends the run, and it used to sit on the
   * garden gate, in front of the note on Grandma's door. A player who met all three travellers
   * and then walked east had the run taken off her at the gate, so the `sign` errand goal was
   * advertised in the HUD on every run and could not be earned in that order.
   *
   * A flood fill over the collision layer cannot see this. The gate tiles are deliberately
   * walkable, so the BFS strolls straight through the one thing that ends the run: the trigger is
   * a terminator, not a wall. The fix is to treat it as a wall HERE, which asks the question that
   * matters -- can Red still be in the explore phase when she gets there? -- rather than "is
   * there a corridor of walkable tiles", which was never in doubt.
   *
   * This fails on the old map and passes on the new one.
   */
  const stillExploring = reachable(object('trigger-cottage'));
  const acts = content.scoring.errandGoals.flatMap((g) => ('act' in g && g.act ? [g.act] : []));

  /*
   * `stands on`, not `touches`. Reading a notice needs Red's feet inside the rect (`overlaps` in
   * world/logic.ts is a point test), so a notice whose own tiles are all unreachable still passes
   * a `touches` check from the tile next door, and the goal stays unearnable.
   */
  const standsOn = (seen: Set<string>, o: MapObject): boolean => {
    const t = tiles(o);
    for (let y = t.y0; y <= t.y1; y++)
      for (let x = t.x0; x <= t.x1; x++) if (seen.has(`${x},${y}`)) return true;
    return false;
  };

  it.each(acts)('the notice "%s" can be stood on before the walk ends', (act) => {
    expect(standsOn(stillExploring, object(`notice-${act}`))).toBe(true);
  });

  /*
   * `overlaps` is a point test on Red's feet, not a tile test, and a player who only ever holds
   * Right walks the whole map with her feet on one exact y. A notice rect that misses that line
   * is unreachable for her however walkable the tiles around it are, which is the same bug one
   * level down.
   */
  it.each(acts)('the notice "%s" lies on the line a due-east walker actually walks', (act) => {
    const spawn = object('spawn-red');
    const feetY = spawn.y + TILE;
    const notice = object(`notice-${act}`);
    expect(feetY).toBeGreaterThanOrEqual(notice.y);
    expect(feetY).toBeLessThan(notice.y + notice.height);
  });
});

describe('the river crossing lines up', () => {
  /*
   * The bridge is two rows tall and so is the track. When the track was mid-meander at the
   * river it met the bridge one row high, leaving a step in the sand and a dead-end row of
   * path running into the water.
   *
   * This has to read the GROUND layer, not collision: grass is walkable too, so a collision
   * test cannot tell a track that stops at the bank from a meadow that was never a track.
   */
  const layers = (map as unknown as { layers: { name: string; data?: number[] }[] }).layers;
  const ground = layers.find((l) => l.name === 'ground')?.data ?? [];
  const width = forest.collision.width;
  const height = forest.collision.height;

  const isPathTile = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const name = nameOfGid.get(ground[y * width + x] ?? 0);
    return name !== undefined && name.startsWith('path');
  };
  const isBridgeTile = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const name = nameOfGid.get(ground[y * width + x] ?? 0);
    return name !== undefined && name.startsWith('bridge');
  };

  /** Every row carrying bridge deck, and the column span it covers. */
  const deck = (() => {
    const rows = new Set<number>();
    let minX = Infinity;
    let maxX = -Infinity;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (isBridgeTile(x, y)) {
          rows.add(y);
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
    return { rows: [...rows].sort((a, b) => a - b), minX, maxX };
  })();

  it('there is a bridge, at least two rows tall and contiguous', () => {
    expect(deck.rows.length).toBeGreaterThanOrEqual(2);
    expect(deck.rows[deck.rows.length - 1]! - deck.rows[0]!).toBe(deck.rows.length - 1);
  });

  it('the sand meets the deck squarely on both banks', () => {
    for (const y of deck.rows) {
      expect(isPathTile(deck.minX - 1, y), `west bank has no track on deck row ${y}`).toBe(true);
      expect(isPathTile(deck.maxX + 1, y), `east bank has no track on deck row ${y}`).toBe(true);
    }
  });

  it('no row of track runs into the water', () => {
    // Any track tile touching the bank must be on a deck row. A track row that approaches the
    // river and is not carried across is the exact bug this guards.
    for (let y = 0; y < height; y++) {
      if (deck.rows.includes(y)) continue;
      expect(
        isPathTile(deck.minX - 1, y),
        `track on row ${y} reaches the west bank but no bridge carries it across`,
      ).toBe(false);
      expect(
        isPathTile(deck.maxX + 1, y),
        `track on row ${y} reaches the east bank but no bridge carries it across`,
      ).toBe(false);
    }
  });
});

describe('errand goals are reachable in the world', () => {
  const acts = content.scoring.errandGoals.flatMap((g) => ('act' in g && g.act ? [g.act] : []));

  it('names at least one act, or this test is vacuous', () => {
    expect(acts.length).toBeGreaterThan(0);
  });

  it.each(acts)('the notice "%s" is placed on the map', (act) => {
    expect(forest.objects.map((o) => o.name)).toContain(`notice-${act}`);
  });

  it.each(acts)('the notice "%s" can be walked to from the spawn', (act) => {
    const spawn = object('spawn-red');
    const start = { x: Math.floor(spawn.x / TILE), y: Math.floor(spawn.y / TILE) };
    const seen = new Set([`${start.x},${start.y}`]);
    const queue = [start];
    while (queue.length > 0) {
      const at = queue.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const next = { x: at.x + dx, y: at.y + dy };
        const key = `${next.x},${next.y}`;
        if (seen.has(key)) continue;
        const { collision } = forest;
        const outside =
          next.x < 0 || next.y < 0 || next.x >= collision.width || next.y >= collision.height;
        if (outside || collision.tiles[next.y * collision.width + next.x] !== 0) continue;
        seen.add(key);
        queue.push(next);
      }
    }

    const notice = object(`notice-${act}`);
    const box = tiles(notice);
    let reachable = false;
    for (let tx = box.x0; tx <= box.x1; tx++)
      for (let ty = box.y0; ty <= box.y1; ty++) if (seen.has(`${tx},${ty}`)) reachable = true;
    expect(reachable).toBe(true);
  });
});

describe('bystanders stand where they can be met', () => {
  const open = reachable();
  const names = content.bystanders.map((b) => b.name);

  it('names at least one bystander, or these tests are vacuous', () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(content.bystanders.map((b) => [b.name, b.spawn] as const))(
    '%s has a spawn object on the map',
    (_name, spawn) => {
      expect(forest.objects.map((o) => o.name)).toContain(spawn);
    },
  );

  /*
   * A bystander carved out of the middle of a tree cluster is unreachable, so the player simply
   * never meets them and nothing says so. The generator asserts this too; this catches a map
   * committed from an older generator.
   */
  it.each(content.bystanders.map((b) => [b.name, b.spawn] as const))(
    'Red can walk to %s',
    (_name, spawn) => {
      expect(touches(open, object(spawn))).toBe(true);
    },
  );

  it.each(content.bystanders.map((b) => [b.name, b.spawn] as const))(
    '%s does not block the gate approach',
    (_name, spawn) => {
      const at = tiles(object(spawn));
      const notice = tiles(object('notice-forest-post'));
      const clash =
        at.x0 <= notice.x1 && at.x1 >= notice.x0 && at.y0 <= notice.y1 && at.y1 >= notice.y0;
      expect(clash).toBe(false);
    },
  );

  /*
   * The scene throws on a missing texture, which turns a forgotten sprite into a black screen
   * rather than a missing bystander. The manifest is what the loader reads.
   */
  it.each(content.bystanders.map((b) => [b.name, b.sprite] as const))(
    "%s's sprite sheet is in the manifest",
    (_name, sprite) => {
      expect(manifest.spritesheets.map((s) => s.key)).toContain(sprite);
    },
  );

  it('every bystander spawn is named after its content id', () => {
    for (const b of content.bystanders) expect(b.spawn).toBe(`bystander-${b.id}`);
  });
});
