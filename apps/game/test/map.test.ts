import { describe, expect, it } from 'vitest';
import content from '../../../content/game.v2.json';
import map from '../src/assets/map-forest.json';
import gids from '../src/assets/tileset-forest.gids.json';
import manifest from '../src/assets/manifest.json';
import { readForestMap } from '../src/world/map';
import { blocked, FOOT_BOX, INTERACT_RADIUS, overlaps, TILE } from '../src/world/logic';
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
  const spawn = tiles(object('spawn-purple'));
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

/*
 * ===========================================================================
 * AND A SECOND FLOOD, OVER POSITIONS, BECAUSE THE ONE ABOVE ANSWERS A DIFFERENT QUESTION.
 * ===========================================================================
 *
 * `reachable()` walks TILES, which is the right model for "can Purple get to this object". It is the
 * wrong model for every claim about a rect FIRING, and those are the claims the level's lesson
 * rests on. A notice opens through `overlaps()`, a point test on Purple's position -- and her
 * position is the BOTTOM EDGE of her foot box, not the middle of her tile. The two models
 * disagree at a row boundary: standing in the lowest row of a rect she presents a y equal to the
 * rect's own bottom edge, the half-open test reads it as the row below, and nothing fires. Both
 * the forest post and the door note were open that way, both at y values on the 2px-per-frame
 * grid she walks from the spawn, and the tile flood called both of them sealed.
 *
 * So this floods over integer FEET POSITIONS and asks `blocked()` -- the game's own wall test,
 * imported rather than reimplemented -- where she may stand. One pixel per step is exact and not
 * an approximation: the foot box is 20 x 12 against a 32px grid, so every edge of the unblocked
 * region lands on an integer and there is no sub-pixel corridor to miss. Steps are axis-separated
 * because `moveWithCollision` moves one axis at a time.
 */
function standingFlood(refuse?: MapObject): Uint8Array {
  const pw = forest.collision.width * TILE;
  const ph = forest.collision.height * TILE;
  const spawn = object('spawn-purple');
  const seen = new Uint8Array(pw * ph);
  const start = (spawn.y + TILE) * pw + (spawn.x + TILE / 2);
  seen[start] = 1;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const key = queue[head]!;
    const x = key % pw;
    const y = (key - x) / pw;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= pw || ny >= ph) continue;
      const next = ny * pw + nx;
      if (seen[next] === 1 || blocked(forest.collision, nx, ny)) continue;
      if (refuse && overlaps({ x: nx, y: ny }, refuse)) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return seen;
}

/** The tiles of `o` Purple can still be standing in, given a position flood. */
const canStandIn = (seen: Uint8Array, o: MapObject): string[] => {
  const pw = forest.collision.width * TILE;
  const hit = new Set<string>();
  for (let y = o.y; y < o.y + o.height; y++)
    for (let x = o.x; x < o.x + o.width; x++)
      if (seen[y * pw + x] === 1) hit.add(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`);
  return [...hit];
};

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
  const cast = content.characters.map((c) => [c.name, c.id, c.spawn] as const);

  /*
   * Driven from content, like the bystander block below, and for the same reason: typing the three
   * spawn names out here is the one thing standing between CLAUDE.md rule 3 and a fourth character
   * added as data. Such a character would be undrawn, the cottage would never open and the run
   * would never end, and every test in the repo would stay green while it happened.
   */
  it('names at least one character, or these tests are vacuous', () => {
    expect(cast.length).toBeGreaterThan(0);
  });

  it.each(cast)('%s has a spawn object on the map', (_name, _id, spawn) => {
    expect(forest.objects.map((o) => o.name)).toContain(spawn);
  });

  /*
   * world/map.ts's npcSpawns and bystanderSpawns recover the character id by stripping `npc-` or
   * `bystander-` off the object name,
   * and forest-scene.ts then uses the whole object name as the texture key. So the content id and
   * the spawn name are one contract written in two files, and this is the only thing asserting it.
   */
  it.each(cast)('%s spawns under the name the scene reads its id back out of', (_n, id, spawn) => {
    expect(spawn).toMatch(new RegExp(`^(npc|bystander)-${id}$`));
  });

  it.each(cast)('Purple can walk to %s', (_name, _id, spawn) => {
    expect(touches(open, object(spawn))).toBe(true);
  });

  it('Purple can reach the cottage door', () => {
    expect(touches(open, object('trigger-cottage'))).toBe(true);
  });

  it('Purple starts somewhere she can stand', () => {
    const spawn = tiles(object('spawn-purple'));
    expect(solid(spawn.x0, spawn.y0)).toBe(false);
  });
});

describe('the notice post cannot be walked around', () => {
  /*
   * The zero-click beat is the lesson of the level, so it must not be optional. The garden fence
   * encloses the cottage on three sides and the map border closes the fourth, which leaves the
   * gate approach, and the notice spans it. Without this the player can take a one-tile detour
   * and never learn what the notice does.
   *
   * IT FLOODS POSITIONS NOW, AND THAT IS NOT A TIDY-UP. The tile version of this assertion was
   * green on a map where the gate could be walked through with the notice silent: standing in the
   * lowest row of the approach Purple presents a y of exactly 704, the rect ended at 704, `overlaps`
   * is half-open, and 704 is on the 2px grid she walks from the spawn. Hold Down, hold Right, and
   * the lesson of the level never happens. See the note on `standingFlood`.
   */
  it('the gate cannot be entered if the notice is refused', () => {
    expect(
      canStandIn(standingFlood(object('notice-forest-post')), object('gate-fence-gap')),
    ).toEqual([]);
  });

  it('but the gate is reachable normally', () => {
    expect(canStandIn(standingFlood(), object('gate-fence-gap')).length).toBeGreaterThan(0);
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

describe('no tile on the map asks Phaser to rotate it', () => {
  /*
   * THE CLIENT'S "LAGGINESS IN THE TOP RIGHT", and the guard that keeps it dead.
   *
   * It was never lag. It was a one-pixel dashed line of the camera backdrop showing THROUGH the
   * world near the top of the frame, on the launch screen and in play. Seven rounds looked for it in
   * the canvas offset, in frame pacing and in a tear in the top rows, and ruled all three out with
   * measurements, because the hole is not in the renderer's timing -- it is in the gids.
   *
   * Tiled keeps a tile's mirror state in the top three bits of its gid, and Phaser's
   * `tilemapTiledJSON` loader decodes six of the eight combinations as a ROTATION rather than a
   * flip. Phaser's tilemap renderer rotates the quad about the tile centre, a rotated quad lands a
   * hair short of its cell, and the tile drops a pixel row. Whether it drops one depends on where
   * the tile and the camera land against the device pixel grid, so only three or four dashes show at
   * a time -- which is exactly why this survived so long and why it reads as a flicker.
   *
   * Measured with the camera backdrop painted magenta, so a hole could not be mistaken for art:
   * across 6 viewports x 2 DPR x launch/play x 7 camera positions, 74 of 168 configurations leaked,
   * worst 2976 pixels, including the client's own 1673x449. With the generator emitting the
   * horizontal bit only: 0 of 168.
   *
   * So the map may carry the horizontal mirror and nothing else. `tools/graybox/src/forest-map.ts`
   * is where that is enforced; this is where it is CHECKED, because the map is committed and a
   * regenerated map is what ships.
   *
   * THE BITS ARE WRITTEN OUT HERE AND NOT IMPORTED, deliberately. Importing `FLIP_V` from the
   * generator would make this test agree with the generator about the wire format instead of
   * checking it: redefine the constant and both move together while the shipped map rotates. These
   * three numbers are the Tiled file format, not this repo's opinion of it.
   */
  const FLIPPED_HORIZONTALLY = 0x80000000;
  const FLIPPED_VERTICALLY = 0x40000000;
  const FLIPPED_DIAGONALLY = 0x20000000;

  const layers = (map as unknown as { layers: { name: string; data?: number[] }[] }).layers;
  const width = forest.collision.width;

  /** Every tile whose gid carries a bit Phaser turns into a rotation, with where to find it. */
  const rotating = layers.flatMap((layer) =>
    (layer.data ?? []).flatMap((raw, i) => {
      const gid = raw >>> 0;
      if ((gid & FLIPPED_VERTICALLY) === 0 && (gid & FLIPPED_DIAGONALLY) === 0) return [];
      const bits = [
        (gid & FLIPPED_HORIZONTALLY) !== 0 ? 'H' : '-',
        (gid & FLIPPED_VERTICALLY) !== 0 ? 'V' : '-',
        (gid & FLIPPED_DIAGONALLY) !== 0 ? 'D' : '-',
      ].join('');
      return [`${layer.name} (${i % width},${Math.floor(i / width)}) ${bits}`];
    }),
  );

  it('no layer carries a vertical mirror or a transpose', () => {
    expect(
      rotating.slice(0, 10),
      `${rotating.length} tile(s) carry a gid bit Phaser decodes as a rotation; a rotated tile ` +
        `drops a pixel row and the camera backdrop shows through it`,
    ).toEqual([]);
  });

  /*
   * ...AND THE SCAN IS ACTUALLY LOOKING AT FLIP BITS. Without this, a generator that stopped
   * mirroring altogether -- or a scan reading the wrong field -- would satisfy the assertion above
   * while saying nothing. The horizontal mirror is the one Phaser renders square, so it is both
   * allowed and expected: it is what carries the texture variety the vertical axis used to.
   */
  it('but the horizontal mirror is still used, or the check above is vacuous', () => {
    const mirrored = layers.flatMap((layer) =>
      (layer.data ?? []).filter((raw) => ((raw >>> 0) & FLIPPED_HORIZONTALLY) !== 0),
    );
    expect(mirrored.length).toBeGreaterThan(0);
  });
});

describe('bystanders stand where they can be met', () => {
  const open = reachable();
  /** The cast who stand about the forest and are not drawn as travellers: spawn `bystander-<id>`. */
  const bystanders = content.characters.filter((c) => c.spawn.startsWith('bystander-'));
  const names = bystanders.map((b) => b.name);

  it('names at least one bystander, or these tests are vacuous', () => {
    expect(names.length).toBeGreaterThan(0);
  });

  it.each(bystanders.map((b) => [b.name, b.spawn] as const))(
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
  it.each(bystanders.map((b) => [b.name, b.spawn] as const))(
    'Purple can walk to %s',
    (_name, spawn) => {
      expect(touches(open, object(spawn))).toBe(true);
    },
  );

  it.each(bystanders.map((b) => [b.name, b.spawn] as const))(
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
  it.each(bystanders.map((b) => [b.name, b.spawn] as const))(
    "%s's sprite sheet is in the manifest",
    (_name, sprite) => {
      expect(manifest.spritesheets.map((s) => s.key)).toContain(sprite);
    },
  );
});

/*
 * ===========================================================================
 * THE CAST IS MADE OF PEOPLE, NOT DECALS.
 * ===========================================================================
 *
 * Measured in the running game before this: Purple walks straight through all seven of them -- three
 * travellers and four bystanders -- and is drawn inside them at equal depth on the way past. Both
 * seating helpers in the generator call `clearArea`, which clears collision, so every one of them
 * stood on an open tile. The old spec could not see it: it asked whether each spawn was WALKABLE,
 * which is the opposite of what a person standing there means, and passed.
 */
describe('the cast is made of people, not decals', () => {
  const cast = [...content.characters.map((c) => [c.name, c.spawn] as const)];

  const STEPS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  /*
   * The closest Purple's FEET can get to a cell, standing in the neighbour `[dx, dy]` of it.
   *
   * Derived from `FOOT_BOX`, which is what `blocked()` actually tests, rather than assumed to be
   * the neighbour's centre: she presses against a wall, she does not stand politely in the middle
   * of the next tile, and the difference is 16px against 32 -- the whole margin this check has.
   * Her position IS the bottom edge of her foot box, so the four directions are not symmetrical
   * and the one that matters is from the south, where the box hangs above her feet.
   */
  const closestStand = (tx: number, ty: number, dx: number, dy: number) => ({
    x:
      dx === 0
        ? tx * TILE + TILE / 2
        : tx * TILE + (dx > 0 ? TILE + FOOT_BOX.width / 2 : -FOOT_BOX.width / 2),
    y:
      dy === 0
        ? ty * TILE + TILE / 2
        : dy > 0
          ? (ty + 1) * TILE - FOOT_BOX.offsetY + FOOT_BOX.height / 2
          : ty * TILE,
  });

  it('names somebody, or every test below is vacuous', () => {
    expect(cast.length).toBeGreaterThan(0);
  });

  it.each(cast)('Purple cannot walk through %s', (_name, spawn) => {
    const t = tiles(object(spawn));
    for (let y = t.y0; y <= t.y1; y++)
      for (let x = t.x0; x <= t.x1; x++)
        expect(solid(x, y), `${spawn} at (${x},${y}) is a tile Purple walks straight through`).toBe(
          true,
        );
  });

  /*
   * ...AND GIVING HIM COLLISION MUST NOT PUT HIM OUT OF REACH, which is the other half and the
   * half that could have gone wrong. `nearest()` measures centre to centre against
   * `INTERACT_RADIUS`, and the bound is the game's own constant rather than the 48 it happens to
   * be today: a smaller radius some later round chooses would fail here, loudly, instead of
   * quietly making a traveller unspeakable-to.
   */
  it.each(cast)('%s can still be spoken to from a cell Purple can stand in', (_name, spawn) => {
    const o = object(spawn);
    const t = tiles(o);
    const centre = { x: o.x + o.width / 2, y: o.y + o.height / 2 };
    const reaches = STEPS.filter(([dx, dy]) => !solid(t.x0 + dx, t.y0 + dy)).map(([dx, dy]) => {
      const p = closestStand(t.x0, t.y0, dx, dy);
      return Math.hypot(centre.x - p.x, centre.y - p.y);
    });
    expect(reaches.length, `${spawn} has no walkable cell beside him at all`).toBeGreaterThan(0);
    expect(
      Math.min(...reaches),
      `${spawn} is out of reach from every cell beside him`,
    ).toBeLessThan(INTERACT_RADIUS);
  });

  /*
   * NOBODY STANDS IN THE ROAD. The track-edge pass bites tiles out of the sand, and a bitten cell
   * is drawn as grass while the carriageway still runs through it -- path to its east and path to
   * its west. The snail was seated on one of those at (41,20) by a helper that reads "the row
   * below the last path row", which is a verge everywhere the track is a solid band and is the
   * middle of the road here. Harmless while he was a decal; a wall across the gate approach the
   * moment he became a person.
   */
  it.each(cast)('%s is not standing in the middle of the carriageway', (_name, spawn) => {
    const t = tiles(object(spawn));
    const ground = (map as unknown as { layers: { name: string; data?: number[] }[] }).layers.find(
      (l) => l.name === 'ground',
    )?.data;
    const isPath = (x: number, y: number): boolean => {
      const raw = ground?.[y * forest.collision.width + x] ?? 0;
      const name = nameOfGid.get((raw >>> 0) & 0x1fffffff);
      return name !== undefined && (name.startsWith('path') || name.startsWith('bridge'));
    };
    expect(isPath(t.x0 - 1, t.y0) && isPath(t.x0 + 1, t.y0)).toBe(false);
  });
});

/*
 * A PLAYER WHO ONLY EVER HOLDS RIGHT STILL GETS THERE.
 *
 * `overlaps` is a point test on Purple's feet, so the two rows she spawns on are the whole of that
 * player's journey and one solid tile anywhere along them costs her both notices and the ending.
 * A flood fill cannot see it: the map stays perfectly connected around any obstacle. The
 * generator asserts the same thing where the obstacle gets planted; this is the shipped artefact.
 */
describe('the due-east walk is clear from the spawn to the door lane', () => {
  const spawn = tiles(object('spawn-purple'));
  const end = tiles(object('trigger-cottage'));

  it.each([spawn.y0, spawn.y0 + 1])('row %i carries no obstacle', (row) => {
    const barred: string[] = [];
    for (let x = spawn.x0; x <= end.x1; x++) if (solid(x, row)) barred.push(`(${x},${row})`);
    expect(barred, `solid tile(s) on the line a due-east walker walks`).toEqual([]);
  });
});

/*
 * ===========================================================================
 * THE NOTE ON THE DOOR IS ON THE WAY TO THE DOOR.
 * ===========================================================================
 *
 * `trigger-cottage` ends the run and `notice-cottage-door` pays the hundred points for the `sign`
 * errand -- half of one of the two lines that reach the thousand-point ceiling. The generator's
 * comment claimed the note and the trigger matched row for row so every approach crossed the note
 * first. They did match, and it was still false: the lane is walkable a row BELOW both rects, so
 * five of the trigger's eight entry tiles were outside the note and the natural walk round the
 * south of the lane and up the far side of the door scored 900 on verdicts worth 1,000.
 *
 * Asserted as reachability rather than as geometry, which is the point. Two rectangles that line
 * up prove nothing on their own; what matters is whether the world lets her round them.
 */
describe('nothing that ends the run sits in front of what scores it', () => {
  it('the cottage trigger cannot be entered without standing on the door note', () => {
    expect(
      canStandIn(standingFlood(object('notice-cottage-door')), object('trigger-cottage')),
    ).toEqual([]);
  });

  /*
   * ...and the run can still be finished, or the assertion above is satisfied by a trigger walled
   * off from the world, which is a worse bug wearing this one's clothes.
   */
  it('but the trigger can be entered normally', () => {
    expect(canStandIn(standingFlood(), object('trigger-cottage')).length).toBeGreaterThan(0);
  });

  /*
   * ...and the note is still READABLE from the lane, not merely unavoidable: a rect she can reach
   * only by leaving the walk would be a seal that costs the hundred points it exists to pay.
   */
  it('and the note can be stood on while the run is still going', () => {
    expect(
      canStandIn(standingFlood(object('trigger-cottage')), object('notice-cottage-door')).length,
    ).toBeGreaterThan(0);
  });
});

/*
 * ===========================================================================
 * THE ENCLOSURE IS A BARRIER, NOT A PICTURE OF ONE.
 * ===========================================================================
 */
describe('the garden cannot be entered round the end of the fence', () => {
  const layers = (map as unknown as { layers: { name: string; data?: number[] }[] }).layers;
  const belowLayer = layers.find((l) => l.name === 'decor-below')?.data ?? [];
  const width = forest.collision.width;
  const height = forest.collision.height;
  const drawn = (x: number, y: number): string =>
    nameOfGid.get(((belowLayer[y * width + x] ?? 0) >>> 0) & 0x1fffffff) ?? '';

  /** The rows the enclosure's horizontal runs are drawn on, read off the fence itself. */
  const rails = (() => {
    const rows = new Map<number, number[]>();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (drawn(x, y) === 'fence-h') rows.set(y, [...(rows.get(y) ?? []), x]);
    return [...rows.entries()].map(([y, xs]) => ({ y, x0: Math.min(...xs) }));
  })();

  it('there are two rails, or the two tests below are vacuous', () => {
    expect(rails.length).toBe(2);
  });

  /*
   * THE RAIL REACHES THE EDGE OF THE WORLD. On the shipped map the north one did not: the
   * connectivity sweep had cut (58,11) to open two tiles sealed in behind it, taking the scrub
   * the fence pass had planted there with it, and a player who refused the notice could walk
   * through the gap and stand inside the line the fence draws. It went nowhere only because a
   * trunk at (58,14) happened to stop her -- and that trunk is `fellable`, so the barrier was
   * being held by a tree any later planting pass is free to take out.
   */
  it.each(rails.map((r) => [r.y, r.x0] as const))(
    'the rail on row %i is unbroken from the fence to the edge of the world',
    (y, x0) => {
      const gaps: string[] = [];
      for (let x = x0; x < width; x++) if (!solid(x, y)) gaps.push(`(${x},${y})`);
      expect(gaps).toEqual([]);
    },
  );

  /*
   * ...AND THE CHECK THAT DOES NOT CARE HOW SHE GOT IN. The older assertion floods with the
   * forest notice refused and looks at the GATE, which is one column of two tiles and says
   * nothing at all about a way in that does not come through the gate. This looks at the whole
   * enclosure: east of the gate column, between the two rails.
   */
  it('nothing inside the enclosure is reachable with the forest notice refused', () => {
    const seen = standingFlood(object('notice-forest-post'));
    const gateX = tiles(object('gate-fence-gap')).x0;
    const north = Math.min(...rails.map((r) => r.y));
    const south = Math.max(...rails.map((r) => r.y));
    const trespass = canStandIn(seen, {
      name: 'the enclosure',
      x: (gateX + 1) * TILE,
      y: (north + 1) * TILE,
      width: (width - gateX - 1) * TILE,
      height: (south - north - 1) * TILE,
    });
    expect(trespass).toEqual([]);
  });
});

/*
 * ===========================================================================
 * SHE CANNOT STAND ON GRANDMA'S ROOF.
 * ===========================================================================
 *
 * The facade was solid over its roof and wall courses and open on the row above them, where only
 * the gable and the chimney stand -- which left the two columns beside and between them walkable:
 * one-tile alcoves wedged into the building's own silhouette, reachable from the garden strip
 * behind the house and from the alley between the house and the west fence. Driven to them in the
 * running game, Purple is drawn standing on the ridge with the gable at her elbow and the chimney
 * smoking beside her head, in the frame every player ends the game on.
 *
 * The row above the building is part of the building, and that is the invariant rather than the
 * two coordinates it happens to catch today: the shape of the roofline is the cottage owner's to
 * change, and whatever shape it takes she may not be inside it.
 */
describe('the cottage is a building, not a climbing frame', () => {
  it('no tile of the building, gable row included, is walkable', () => {
    const house = tiles(object('prop-cottage'));
    const open: string[] = [];
    for (let y = house.y0 - 1; y <= house.y1; y++)
      for (let x = house.x0; x <= house.x1; x++) if (!solid(x, y)) open.push(`(${x},${y})`);
    expect(open, 'tile(s) of the cottage Purple can stand on').toEqual([]);
  });

  /*
   * ...and the row above it is a row, not the top of the map: a cottage anchored at y 0 would
   * satisfy the assertion above by having nothing above it to check.
   */
  it('and that row is inside the map', () => {
    expect(tiles(object('prop-cottage')).y0).toBeGreaterThan(0);
  });
});
