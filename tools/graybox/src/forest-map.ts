// Lays out the forest: a winding river with a waterfall, curving paths, tree clusters with 2x2
// canopies, and the landmarks the story needs. Objects keep the names apps/game reads.
import { noise, valueNoise2D } from './paint.ts';
import { COLUMNS, TILE, TILE_NAMES, gid } from './tiles.ts';

export const MAP_W = 60;
export const MAP_H = 42;

type Layer = number[];
const blank = (): Layer => new Array<number>(MAP_W * MAP_H).fill(0);

export interface GeneratedMap {
  json: string;
  /** Where the map generator decided each landmark sits, in pixels. */
  landmarks: Record<string, { x: number; y: number }>;
}

/** Standard 4x4 ordered-dither matrix, used to scatter the grass variant boundaries. */
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

export function generateForestMap(): GeneratedMap {
  const rnd = noise(20261016);
  const ground = blank();
  const below = blank();
  const above = blank();
  const collision = blank();

  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const set = (layer: Layer, x: number, y: number, tile: number): void => {
    if (inside(x, y)) layer[y * MAP_W + x] = tile;
  };
  const at = (layer: Layer, x: number, y: number): number =>
    inside(x, y) ? layer[y * MAP_W + x]! : 0;
  const solid = (x: number, y: number): void => set(collision, x, y, 1);
  const clear = (x: number, y: number): void => set(collision, x, y, 0);

  // --- grass base: broad patches of sun and shade, not per-tile static -------
  // The four variants are four brightness steps, chosen by a field that is correlated across
  // tiles. Picking one at random per tile is white noise: every tile differs from its neighbour,
  // and at any distance the whole field averages to one flat tone, which is what made the ground
  // read as a single green with stickers on it.
  const grassTiles = [gid('grass-0'), gid('grass-1'), gid('grass-2'), gid('grass-3')];
  const sun = valueNoise2D(20261017);
  /** Patch size, in tiles. Large enough to read as meadow, small enough to vary on one screen. */
  const PATCH = 9.5;
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      // A second, finer octave keeps the patch edges from looking like contour lines.
      const v = sun(x / PATCH, y / PATCH) * 0.78 + sun(x / 2.2, y / 2.2) * 0.22;
      /*
       * Ordered dither on the threshold. Each grass tile carries a flat wash across its whole
       * 16x16, so wherever two variants meet the boundary is a straight tile edge and the eye
       * reads the field as rectangles of slightly different green -- the tile grid showing
       * through the very thing meant to hide it. Nudging the threshold by a Bayer matrix only
       * flips tiles already within a hair of a boundary, so the straight edge scatters into a
       * dotted transition and the patches read as light rather than as blocks.
       */
      const dither = (BAYER_4[y % 4]![x % 4]! / 16 - 0.47) * 0.09;
      const v2 = v + dither;
      const step = v2 < 0.36 ? 0 : v2 < 0.52 ? 1 : v2 < 0.7 ? 2 : 3;
      set(ground, x, y, grassTiles[step]!);
    }

  // --- the river: a sine curve so it meanders like the board's ---------------
  const riverCentre = (y: number): number => 26 + Math.sin(y / 7) * 3 + Math.sin(y / 3.1) * 1.2;
  const riverHalf = 1.6;
  const isWater = (x: number, y: number): boolean => Math.abs(x - riverCentre(y)) <= riverHalf;
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (isWater(x, y)) {
        set(ground, x, y, rnd() > 0.5 ? gid('water') : gid('water-2'));
        solid(x, y);
      }
  // Banks.
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (isWater(x, y)) continue;
      const nextToWater = isWater(x - 1, y) || isWater(x + 1, y);
      if (!nextToWater) continue;
      set(ground, x, y, isWater(x + 1, y) ? gid('shore-w') : gid('shore-e'));
    }
  // A waterfall spilling in at the north end.
  for (let y = 0; y < 4; y++)
    for (let x = Math.round(riverCentre(y)) - 1; x <= Math.round(riverCentre(y)) + 1; x++) {
      set(ground, x, y, gid('waterfall'));
      solid(x, y);
    }

  // --- paths -----------------------------------------------------------------
  const pathTiles = new Set<number>();
  const layPath = (points: [number, number][], width = 2): void => {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i]!;
      const [x1, y1] = points[i + 1]!;
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let s = 0; s <= steps; s++) {
        const cx = x0 + ((x1 - x0) * s) / steps;
        const cy = y0 + ((y1 - y0) * s) / steps;
        for (let dy = 0; dy < width; dy++)
          for (let dx = 0; dx < width; dx++) {
            const x = Math.round(cx) + dx;
            const y = Math.round(cy) + dy;
            if (!inside(x, y) || isWater(x, y)) continue;
            pathTiles.add(y * MAP_W + x);
          }
      }
    }
  };

  /*
   * Main east-west track, plus a north fork to the owl and a south fork to the lantern.
   * The track meanders a row for looks, but it must be FLAT where it crosses the river: the
   * bridge is two rows tall, and a track that is mid-meander there meets it one row high and
   * leaves a visible step in the sand. The river sits around x 25 to 29, so the bends live
   * well clear of it.
   */
  layPath([
    [4, 20],
    [12, 19],
    [18, 20],
    [34, 20],
    [42, 19],
    [48, 20],
    [52, 20],
  ]);
  layPath([
    [15, 20],
    [15, 14],
    [17, 9],
  ]);
  layPath([
    [38, 21],
    [39, 28],
    [37, 33],
  ]);

  for (const index of pathTiles) {
    const x = index % MAP_W;
    const y = Math.floor(index / MAP_W);
    set(ground, x, y, gid('path'));
  }
  // Soft edges where the track meets grass.
  const isPath = (x: number, y: number): boolean => pathTiles.has(y * MAP_W + x) && inside(x, y);
  for (const index of pathTiles) {
    const x = index % MAP_W;
    const y = Math.floor(index / MAP_W);
    const n = !isPath(x, y - 1);
    const s = !isPath(x, y + 1);
    const e = !isPath(x + 1, y);
    const w = !isPath(x - 1, y);
    const name =
      n && e
        ? 'path-ne'
        : n && w
          ? 'path-nw'
          : s && e
            ? 'path-se'
            : s && w
              ? 'path-sw'
              : n
                ? 'path-n'
                : s
                  ? 'path-s'
                  : e
                    ? 'path-e'
                    : w
                      ? 'path-w'
                      : 'path';
    set(ground, x, y, gid(name));
  }

  /*
   * The bridge, where the main track meets the river.
   *
   * Its rows are read off the track rather than hard-coded. Hard-coding them is what put the
   * deck a row below the sand: the waypoints moved, the constant did not, and the crossing
   * gained a step that no test could see. Measuring the approach means the two can never
   * disagree, whatever the waypoints do later.
   */
  const bridgeCentre = Math.round(riverCentre(20));
  const approachX = bridgeCentre - 3; // dry land, just west of the water
  const bridgeRows: number[] = [];
  for (let y = 0; y < MAP_H; y++) if (isPath(approachX, y)) bridgeRows.push(y);
  if (bridgeRows.length === 0) throw new Error('the main track does not reach the river crossing');

  for (const y of bridgeRows)
    for (let x = bridgeCentre - 2; x <= bridgeCentre + 2; x++) {
      const kind =
        x === bridgeCentre - 2 ? 'bridge-l' : x === bridgeCentre + 2 ? 'bridge-r' : 'bridge-m';
      set(ground, x, y, gid(kind));
      clear(x, y);
    }

  // --- forest border and tree clusters ---------------------------------------
  const plantTree = (x: number, y: number): boolean => {
    // A tree needs its trunk tile plus a clear 2x2 canopy above, and must not sit on a path.
    for (let dy = -2; dy <= 0; dy++)
      for (let dx = 0; dx <= 1; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (!inside(tx, ty) || isPath(tx, ty) || isWater(tx, ty)) return false;
        if (at(below, tx, ty) !== 0 || at(above, tx, ty) !== 0) return false;
      }
    set(below, x, y, gid('trunk-l'));
    set(below, x + 1, y, gid('trunk-r'));
    solid(x, y);
    solid(x + 1, y);
    set(above, x, y - 2, gid('canopy-tl'));
    set(above, x + 1, y - 2, gid('canopy-tr'));
    set(above, x, y - 1, gid('canopy-bl'));
    set(above, x + 1, y - 1, gid('canopy-br'));
    return true;
  };

  // Dense treeline around the edges keeps the player in the clearing.
  for (let x = 0; x < MAP_W; x += 2) {
    plantTree(x, 2);
    plantTree(x, MAP_H - 2);
  }
  for (let y = 3; y < MAP_H - 2; y += 2) {
    plantTree(0, y);
    plantTree(MAP_W - 2, y);
  }
  // The border must be solid even where a tree could not be planted.
  for (let x = 0; x < MAP_W; x++)
    for (const y of [0, 1, MAP_H - 1]) {
      solid(x, y);
      if (at(below, x, y) === 0 && at(ground, x, y) !== gid('waterfall'))
        set(below, x, y, gid('bush'));
    }
  for (let y = 0; y < MAP_H; y++)
    for (const x of [0, MAP_W - 1]) {
      solid(x, y);
      if (at(below, x, y) === 0) set(below, x, y, gid('bush'));
    }

  // Scattered groves.
  for (let i = 0; i < 90; i++)
    plantTree(2 + Math.floor(rnd() * (MAP_W - 5)), 5 + Math.floor(rnd() * (MAP_H - 8)));

  // --- undergrowth ------------------------------------------------------------
  const scatter = (tile: string, count: number, makeSolid = false): void => {
    for (let i = 0; i < count; i++) {
      const x = 2 + Math.floor(rnd() * (MAP_W - 4));
      const y = 3 + Math.floor(rnd() * (MAP_H - 6));
      if (isPath(x, y) || isWater(x, y) || at(below, x, y) !== 0 || at(above, x, y) !== 0) continue;
      set(below, x, y, gid(tile));
      if (makeSolid) solid(x, y);
    }
  };
  scatter('flower-white', 40);
  scatter('flower-pink', 30);
  scatter('flower-red', 24);
  // Rare on purpose: often enough to be found, seldom enough to be noticed as a choice.
  scatter('flower-lilac', 9);
  scatter('bush', 30, true);
  scatter('rock', 22, true);

  // --- landmarks ---------------------------------------------------------------
  const landmarks: Record<string, { x: number; y: number }> = {};
  const place = (name: string, x: number, y: number, tile: string, makeSolid = true): void => {
    set(below, x, y, gid(tile));
    if (makeSolid) solid(x, y);
    landmarks[name] = { x: x * TILE, y: y * TILE };
  };
  const clearArea = (x: number, y: number, w: number, h: number): void => {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        set(below, x + dx, y + dy, 0);
        set(above, x + dx, y + dy, 0);
        clear(x + dx, y + dy);
      }
  };

  // Rabbit's market stall, just west of the bridge.
  clearArea(11, 15, 4, 5);
  for (const [i, kind] of (
    ['stall-awning-l', 'stall-awning-m', 'stall-awning-m', 'stall-awning-r'] as const
  ).entries())
    set(above, 11 + i, 16, gid(kind));
  for (let i = 0; i < 4; i++) {
    set(below, 11 + i, 17, gid('stall-counter'));
    solid(11 + i, 17);
  }
  landmarks['stall'] = { x: 11 * TILE, y: 17 * TILE };

  place('signpost', 9, 19, 'signpost');
  // The notice post stands on the main track, so every route to the cottage passes it.
  place('notice-post', 43, 19, 'signpost');
  place('well', 23, 24, 'well');
  place('lantern-post', 36, 32, 'lantern-post');

  // Grandma's cottage at the east end, behind a fence with one gate.
  const cx = 50;
  const cy = 14;
  clearArea(cx - 1, cy - 1, 9, 9);
  for (let i = 0; i < 6; i++) {
    const kind = i === 0 ? 'roof-l' : i === 5 ? 'roof-r' : 'roof-m';
    set(below, cx + i, cy, gid('roof-peak'));
    set(below, cx + i, cy + 1, gid(kind));
    solid(cx + i, cy);
    solid(cx + i, cy + 1);
  }
  set(below, cx + 4, cy - 1, gid('chimney'));
  for (let row = 2; row <= 4; row++)
    for (let i = 0; i < 6; i++) {
      set(below, cx + i, cy + row, gid('wall'));
      solid(cx + i, cy + row);
    }
  set(below, cx + 1, cy + 3, gid('wall-window'));
  set(below, cx + 4, cy + 3, gid('wall-window'));
  set(below, cx + 2, cy + 4, gid('door'));
  set(below, cx + 3, cy + 4, gid('door'));
  landmarks['cottage'] = { x: cx * TILE, y: cy * TILE };

  /*
   * Garden fence with a single gate on the main path. The garden has to be ENCLOSED: a fence that
   * only runs north-south can be walked around at either end, which would let the player reach the
   * cottage without passing the notice post. The run north of the gate, the run south of it, and
   * the two returns east to the treeline are all load-bearing.
   */
  const fenceX = 46;
  const gardenTop = cy - 2;
  const gardenBottom = cy + 10;
  const gardenEast = MAP_W - 3;
  for (let y = gardenTop; y <= gardenBottom; y++) {
    if (y === 20 || y === 21) continue; // the gate
    set(below, fenceX, y, gid('fence-post'));
    solid(fenceX, y);
  }
  for (let x = fenceX; x <= gardenEast; x++) {
    for (const y of [gardenTop, gardenBottom]) {
      set(below, x, y, gid('fence-h'));
      solid(x, y);
    }
  }
  // Seal the gap between the fence ends and the map's own treeline.
  for (let x = gardenEast; x < MAP_W; x++) for (const y of [gardenTop, gardenBottom]) solid(x, y);
  landmarks['gate'] = { x: fenceX * TILE, y: 20 * TILE };

  // Make sure the path through the gate and up to the door is walkable.
  for (let x = fenceX; x <= cx + 3; x++)
    for (const y of [20, 21]) {
      set(ground, x, y, gid('path'));
      clear(x, y);
      set(below, x, y, 0);
      set(above, x, y, 0);
    }
  for (let y = cy + 5; y <= 21; y++)
    for (const x of [cx + 2, cx + 3]) {
      set(ground, x, y, gid('path'));
      clear(x, y);
      set(below, x, y, 0);
      set(above, x, y, 0);
    }

  // --- NPC positions, each on walkable ground beside its landmark ---------------
  const npc = (name: string, x: number, y: number) => {
    clearArea(x, y, 1, 1);
    return {
      name,
      x: x * TILE,
      y: y * TILE,
      width: TILE,
      height: TILE,
    };
  };

  /*
   * Bystanders stand one tile off the track rather than on it, so they decorate the walk instead
   * of interrupting it. The assertion is the point: a bystander carved out of the middle of a
   * tree cluster is unreachable and would simply never be met, which is a bug nobody would see.
   */
  const bystander = (name: string, x: number, y: number) => {
    const touchesTrack = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => isPath(x + dx!, y + dy!));
    if (!touchesTrack) throw new Error(`${name} at ${x},${y} does not touch the track`);
    clearArea(x, y, 1, 1);
    return { name, x: x * TILE, y: y * TILE, width: TILE, height: TILE };
  };

  const spawnX = 5;
  const spawnY = 20;
  /*
   * Four tiles square, and the decor-below layer with it. `clearArea` only clears collision and
   * the canopy above, so a trunk drawn below stayed exactly where Red spawns and sat behind her
   * head: she started the game with her face against a tree.
   */
  for (let dy = -2; dy < 3; dy++)
    for (let dx = -2; dx < 3; dx++) {
      set(below, spawnX + dx, spawnY + dy, 0);
      set(above, spawnX + dx, spawnY + dy, 0);
      clear(spawnX + dx, spawnY + dy);
    }
  clearArea(spawnX, spawnY, 2, 2);
  for (const y of [spawnY, spawnY + 1]) {
    set(ground, spawnX, y, gid('path'));
    set(ground, spawnX + 1, y, gid('path'));
  }

  const objects = [
    { name: 'spawn-red', x: spawnX * TILE, y: spawnY * TILE, width: TILE, height: TILE },
    npc('npc-rabbit', 13, 19),
    npc('npc-owl', 17, 11),
    npc('npc-lantern-keeper', 37, 33),
    // One per stretch of the walk: the start, the far side of the bridge, and the gate approach.
    bystander('bystander-toadstool', 10, 21),
    bystander('bystander-magpie', 22, 22),
    bystander('bystander-snail', 41, 21),
    /*
     * Inside the garden, north of the path, between the gate and the door. She is the only
     * bystander past the notice post, so by the time she speaks every decision has been made and
     * the forest notice has already done whatever it was going to do.
     */
    bystander('bystander-cat', 47, 19),
    /*
     * The walk ends on the DOORSTEP, not at the garden gate.
     *
     * It used to end at the gate (x 46), which is the only gap in the fence. That put the end of
     * the run in front of the door note, so a player who did the natural thing -- meet all three
     * travellers, then walk east -- had the run taken off them at the gate and could never reach
     * the note. The `sign` errand goal was advertised in the HUD on every run and, in that order,
     * could not be earned. It was reachable only by slipping through the gate with a verdict still
     * outstanding, reading the note, and walking back, which nobody does.
     *
     * It spans all three rows of the door lane, not just the doorstep. `overlaps` is a point test
     * on Red's feet, and a player who only ever holds Right keeps her feet on row 21 for the whole
     * map. A trigger on row 19 alone is invisible to that player: she walks straight past the door,
     * out across the lawn, and the run never ends. That is worse than the bug this move fixed.
     */
    {
      name: 'trigger-cottage',
      x: (cx + 2) * TILE,
      y: 19 * TILE,
      width: TILE * 2,
      height: TILE * 3,
    },
    /*
     * The gap in the garden fence. Nothing in the game reads it; the map tests do, to assert that
     * the forest notice spans the only way in. That invariant used to be checked against
     * `trigger-cottage`, which happened to sit on the gap until the trigger moved to the door.
     * Naming the gap directly means the test says what it means.
     */
    { name: 'gate-fence-gap', x: fenceX * TILE, y: 20 * TILE, width: TILE, height: TILE * 2 },
    {
      // Spans the whole gate approach (x 42 to 45, both path rows). The gate at x 46 is only
      // reachable along these two rows, so the notice cannot be walked around: the zero-click
      // beat is the point of the level and must not be optional.
      name: 'notice-forest-post',
      x: 42 * TILE,
      y: 20 * TILE,
      width: TILE * 4,
      height: TILE * 2,
    },
    {
      /*
       * The note on Grandma's door, which the `sign` errand goal needs. It sits in the lane
       * immediately WEST of the doorstep and matches the trigger row for row, so every approach
       * from the garden crosses the note first and the trigger second, whichever row Red walks.
       * Putting it east of the gate but west of the door is what makes the ordering hold without
       * the two rects ever sharing a tile, which would race inside one frame.
       *
       * This belongs HERE, in the generator, and not in the generated map-forest.json: a previous
       * pass added it by hand to the JSON and every later `pnpm graybox` silently wiped it, which
       * left the goal advertised in the HUD and impossible to complete.
       */
      name: 'notice-cottage-door',
      x: cx * TILE,
      y: 19 * TILE,
      width: TILE * 2,
      height: TILE * 3,
    },
    { name: 'prop-signpost', ...landmarks['signpost']!, width: TILE, height: TILE },
    { name: 'prop-well', ...landmarks['well']!, width: TILE, height: TILE },
    { name: 'prop-lantern-post', ...landmarks['lantern-post']!, width: TILE, height: TILE },
    { name: 'prop-cottage', ...landmarks['cottage']!, width: TILE * 6, height: TILE * 5 },
    { name: 'prop-stall', ...landmarks['stall']!, width: TILE * 4, height: TILE },
  ].map((o, i) => ({ id: i + 1, rotation: 0, visible: true, ...o }));

  // The gate tiles must stay walkable even after the fence loop.
  for (const y of [20, 21]) clear(fenceX, y);

  const tileLayer = (id: number, name: string, data: Layer) => ({
    id,
    name,
    type: 'tilelayer',
    width: MAP_W,
    height: MAP_H,
    x: 0,
    y: 0,
    opacity: 1,
    visible: name !== 'collision',
    data,
  });

  const rows = Math.ceil(TILE_NAMES.length / COLUMNS);
  const json = JSON.stringify({
    compressionlevel: -1,
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.2',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: MAP_W,
    height: MAP_H,
    tilewidth: TILE,
    tileheight: TILE,
    nextlayerid: 6,
    nextobjectid: objects.length + 1,
    layers: [
      tileLayer(1, 'ground', ground),
      tileLayer(2, 'decor-below', below),
      tileLayer(3, 'decor-above', above),
      tileLayer(4, 'collision', collision),
      {
        id: 5,
        name: 'objects',
        type: 'objectgroup',
        draworder: 'topdown',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects,
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'tileset-forest',
        image: 'tileset-forest.png',
        imagewidth: COLUMNS * TILE,
        imageheight: rows * TILE,
        tilewidth: TILE,
        tileheight: TILE,
        tilecount: TILE_NAMES.length,
        columns: COLUMNS,
        margin: 0,
        spacing: 0,
      },
    ],
  });

  return { json, landmarks };
}
