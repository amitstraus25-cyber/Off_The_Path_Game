// Tile painters. Every tile is 16x16 and drawn from the shared palette ramps, so the forest reads
// as layered pixel art rather than flat colour. Names here are the contract the map generator uses.
import { Img, noise, shade } from './paint.ts';
import type { RGBA } from './paint.ts';

export const TILE = 16;

type Painter = (img: Img, seed: number) => void;

/**
 * Grass. The four variants are four brightness steps, not four random speckle patterns: the map
 * picks between them with low-frequency noise, so the field reads as broad patches of sun and
 * shade the way the board's does. Within a tile the contrast stays deliberately low -- a previous
 * pass used three opaque tones at full contrast and that made the 16px grid MORE obvious at 3x,
 * not less. The variation has to come from many tiles, not from inside one.
 */
function grass(variant: number): Painter {
  // 0 is the shaded patch, 3 the sunlit one. The wash is alpha so the step between neighbouring
  // patches stays small even where two variants meet.
  // Deliberately shallow. At 64/26/42/96 the four steps were far enough apart that a patch edge
  // read as a hard-edged rectangle of lighter grass -- the tile grid showing through the thing
  // meant to hide it.
  const wash: readonly [0 | 1 | 2 | 3, number][] = [
    [0, 44],
    [0, 15],
    [2, 22],
    [2, 52],
  ];
  return (img, seed) => {
    const rnd = noise(seed + variant * 977);
    img.rect(0, 0, TILE, TILE, shade('grass', 1));
    const [level, alpha] = wash[variant] ?? [1, 0];
    if (alpha > 0) img.rect(0, 0, TILE, TILE, shade('grass', level, alpha));
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(rnd() * TILE);
      const y = Math.floor(rnd() * TILE);
      img.px(x, y, shade('grass', rnd() > 0.5 ? 0 : 2, 120));
    }
    // A few upright blades catch the light; the sunlit patches get more of them.
    for (let i = 0; i < 2 + variant; i++) {
      const x = Math.floor(rnd() * TILE);
      const y = 2 + Math.floor(rnd() * (TILE - 4));
      img.px(x, y, shade('grass', 3, 190));
      img.px(x, y + 1, shade('grass', 2, 150));
    }
  };
}

function pathFill(img: Img, seed: number): void {
  const rnd = noise(seed);
  img.rect(0, 0, TILE, TILE, shade('path', 1));
  for (let i = 0; i < 20; i++)
    img.px(Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), shade('path', rnd() > 0.5 ? 0 : 2));
  // Pebbles.
  for (let i = 0; i < 2; i++) {
    const x = 1 + Math.floor(rnd() * (TILE - 2));
    const y = 1 + Math.floor(rnd() * (TILE - 2));
    img.px(x, y, shade('stone', 1));
    img.px(x + 1, y, shade('stone', 2));
  }
}

/**
 * Path edge: grass on the named sides, soil in the middle, with a ragged border so the
 * track looks worn rather than stamped.
 */
function pathEdge(sides: ('n' | 's' | 'e' | 'w')[]): Painter {
  return (img, seed) => {
    pathFill(img, seed);
    const rnd = noise(seed + 311);
    const depth = (): number => 3 + Math.floor(rnd() * 3);
    for (const side of sides)
      for (let i = 0; i < TILE; i++) {
        const d = depth();
        for (let j = 0; j < d; j++) {
          const [x, y] =
            side === 'n'
              ? [i, j]
              : side === 's'
                ? [i, TILE - 1 - j]
                : side === 'w'
                  ? [j, i]
                  : [TILE - 1 - j, i];
          img.px(x, y, shade('grass', j === d - 1 ? 0 : 1));
        }
      }
  };
}

function waterFill(img: Img, seed: number, frame: number): void {
  const rnd = noise(seed);
  img.rect(0, 0, TILE, TILE, shade('water', 1));
  // Depth, at low contrast: three ruled lines across a flat blue read as a painted road, so the
  // surface gets a soft field first and the crests sit on top of it.
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const r = rnd();
      if (r > 0.88) img.px(x, y, shade('water', 0, 130));
      else if (r > 0.82) img.px(x, y, shade('water', 2, 80));
    }
  // Sparkle dashes rather than full-width crests, phase-shifted per frame so two tiles side by
  // side never pulse together.
  for (const row of [3, 11]) {
    const y = (row + frame * 4) % TILE;
    const start = Math.floor(rnd() * 10);
    const len = 2 + Math.floor(rnd() * 2);
    img.line(start, y, start + len, y, shade('water', 3, 200));
    img.px(start + 1, y + 1, shade('water', 2, 140));
  }
}

/** Shore: water with a sand-and-stone bank on the named sides. */
function shore(sides: ('n' | 's' | 'e' | 'w')[]): Painter {
  return (img, seed) => {
    waterFill(img, seed, 0);
    const rnd = noise(seed + 733);
    for (const side of sides)
      for (let i = 0; i < TILE; i++) {
        const d = 4 + Math.floor(rnd() * 3);
        for (let j = 0; j < d; j++) {
          const [x, y] =
            side === 'n'
              ? [i, j]
              : side === 's'
                ? [i, TILE - 1 - j]
                : side === 'w'
                  ? [j, i]
                  : [TILE - 1 - j, i];
          // Grass above, a thin wet-sand lip, then a bright foam line against the water.
          img.px(
            x,
            y,
            j === d - 1
              ? shade('water', 3, 230)
              : j === d - 2
                ? shade('path', 0)
                : j === d - 3
                  ? shade('path', 1)
                  : shade('grass', 1),
          );
        }
      }
    // Foam along the waterline.
    for (let i = 0; i < 6; i++)
      img.px(Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), shade('water', 3, 150));
  };
}

const flower = (petal: RGBA): Painter =>
  function paintFlower(img, seed) {
    grass(0)(img, seed);
    const rnd = noise(seed + 55);
    for (let i = 0; i < 3; i++) {
      const x = 2 + Math.floor(rnd() * (TILE - 5));
      const y = 3 + Math.floor(rnd() * (TILE - 6));
      img.px(x, y + 1, shade('grass', 0));
      img.px(x, y, petal);
      img.px(x - 1, y, petal);
      img.px(x + 1, y, petal);
      img.px(x, y - 1, petal);
      img.px(x, y, shade('gold', 2));
    }
  };

const bush: Painter = (img, seed) => {
  grass(1)(img, seed);
  const rnd = noise(seed + 91);
  // Sits in the grass rather than on it. Dark green, not black: grass in shade.
  img.ellipse(9.5, 12.5, 6.5, 2.6, shade('shadow', 1, 110));
  img.ellipse(8, 9, 6.5, 5, shade('canopy', 1));
  img.ellipse(6, 7, 4, 3, shade('canopy', 2));
  for (let i = 0; i < 10; i++)
    img.px(2 + Math.floor(rnd() * 12), 5 + Math.floor(rnd() * 8), shade('canopy', 0));
  img.px(5, 6, shade('canopy', 3));
  img.px(9, 5, shade('canopy', 3));
};

const rock: Painter = (img, seed) => {
  grass(2)(img, seed);
  img.ellipse(9.5, 13, 6, 2.4, shade('shadow', 1, 110));
  img.ellipse(8, 11, 6, 4, shade('stone', 0));
  img.ellipse(8, 10, 5.5, 3.5, shade('stone', 1));
  img.ellipse(6.5, 8.5, 3, 2, shade('stone', 2));
  img.px(5, 8, shade('stone', 3));
  img.line(9, 9, 11, 12, shade('stone', 0));
};

/**
 * Tree trunk, drawn across two tiles so it stands centred under the 2x2 canopy. `half` says which
 * side of the seam this tile holds.
 */
function trunk(half: 'left' | 'right'): Painter {
  return (img, seed) => {
    grass(0)(img, seed);
    const left = half === 'left';
    // Shadow pooling at the base and spilling down-right, away from the light. This used to be a
    // 9x3 ellipse of canopy green at alpha 70 -- the only cast shadow in the entire tileset.
    img.ellipse(left ? 15 : 3, 14.5, 11, 4, shade('shadow', 0, 70));
    img.ellipse(left ? 15 : 3, 14, 9, 3.2, shade('shadow', 1, 120));
    // 5 pixels of trunk each side of the shared edge.
    const x0 = left ? 11 : 0;
    img.rect(x0, 0, 5, 15, shade('trunk', 1));
    if (left) img.rect(x0, 0, 2, 15, shade('trunk', 2));
    else img.rect(x0 + 3, 0, 2, 15, shade('trunk', 0));
    for (const y of [3, 7, 11]) img.line(x0 + 1, y, x0 + 3, y + 1, shade('trunk', 0));
    // Roots flaring onto the grass.
    img.px(left ? x0 - 1 : x0 + 5, 14, shade('trunk', 1));
    img.px(left ? x0 - 1 : x0 + 5, 13, shade('trunk', 0));
    img.rect(x0, 14, 5, 1, shade('trunk', 0));
  };
}

/**
 * One quadrant of a 2x2 canopy. One big ellipse split across four tiles is what gives the round,
 * overlapping crowns the concept board has; the dark rim is what makes them read at 16px.
 */
/** Where the sun is. Everything in the forest is lit from the upper left and shades down-right. */
const LIGHT = { x: -1, y: -1 } as const;

function canopy(qx: 0 | 1, qy: 0 | 1): Painter {
  // One fixed seed, read identically by all four quadrants, so the lobes line up across the seams.
  const lobes = (() => {
    const rnd = noise(4242);
    return Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      const r = 9.6 + rnd() * 1.8;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.94, rad: 4.1 + rnd() * 1.1 };
    });
  })();

  return (img, seed) => {
    const rnd = noise(seed + 17);
    // Centred on the seam the four tiles share, which is also where the trunk stands.
    const cx = 16 - qx * 16;
    const cy = 16 - qy * 16;

    // The crown is a ball of clumped leaves, not a disc with a ring drawn round it. Each pass is
    // the same silhouette shifted along the light axis, so the dark step survives only on the
    // shaded lower-right edge. The previous version redrew a hard rim all the way round, which is
    // what made every tree read as a sticker laid on the grass.
    const pass = (dx: number, dy: number, level: 0 | 1 | 2 | 3, scale = 1, only?: 'lit'): void => {
      // Big enough that the crown's lower edge meets the trunk tile below it: at 12.4 it stopped
      // about four pixels short and every tree looked like a lollipop floating over a stump.
      img.ellipse(cx + dx, cy + dy, 14.8 * scale, 14.2 * scale, shade('canopy', level));
      for (const l of lobes) {
        if (only === 'lit' && l.x * LIGHT.x + l.y * LIGHT.y < 2) continue;
        img.ellipse(
          cx + l.x * scale + dx,
          cy + l.y * scale + dy,
          l.rad * scale,
          l.rad * 0.94 * scale,
          shade('canopy', level),
        );
      }
    };
    // Shaded side first, pushed away from the light so it only shows where the sun does not reach.
    pass(-LIGHT.x * 1.4, -LIGHT.y * 1.4, 0);
    pass(0, 0, 1);
    pass(LIGHT.x * 2.2, LIGHT.y * 2.2, 2, 0.84, 'lit');
    // A small highlight where the light actually lands.
    img.ellipse(cx + LIGHT.x * 5.2, cy + LIGHT.y * 5.2, 3.8, 3.4, shade('canopy', 3));

    // Leaf speckle, only inside the crown, at low contrast so it does not fight the lobes.
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(rnd() * TILE);
      const y = Math.floor(rnd() * TILE);
      if (img.get(x, y)[3] === 0) continue;
      const r = rnd();
      img.px(x, y, shade('canopy', r > 0.62 ? 0 : r > 0.3 ? 2 : 1, 110));
    }
  };
}

const fenceRail: Painter = (img, seed) => {
  grass(1)(img, seed);
  img.rect(0, 6, TILE, 2, shade('wood', 1));
  img.rect(0, 6, TILE, 1, shade('wood', 2));
  img.rect(0, 10, TILE, 2, shade('wood', 1));
  img.rect(0, 10, TILE, 1, shade('wood', 2));
};

const fencePost: Painter = (img, seed) => {
  fenceRail(img, seed);
  img.rect(6, 3, 4, 12, shade('wood', 0));
  img.rect(6, 3, 2, 12, shade('wood', 1));
  img.rect(6, 3, 4, 1, shade('wood', 2));
};

function bridgePlank(kind: 'left' | 'middle' | 'right'): Painter {
  return (img, seed) => {
    const rnd = noise(seed + 404);
    img.rect(0, 0, TILE, TILE, shade('wood', 1));
    for (let y = 0; y < TILE; y += 3) img.line(0, y, TILE - 1, y, shade('wood', 0));
    for (let i = 0; i < 14; i++)
      img.px(Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), shade('wood', 2));
    // Rails along the top and bottom edge of the crossing.
    img.rect(0, 0, TILE, 2, shade('wood', 0));
    img.rect(0, TILE - 2, TILE, 2, shade('wood', 0));
    if (kind !== 'right') {
      img.rect(TILE - 2, 0, 2, 3, shade('wood', 2));
      img.rect(TILE - 2, TILE - 3, 2, 3, shade('wood', 2));
    }
    if (kind !== 'left') {
      img.rect(0, 0, 2, 3, shade('wood', 2));
      img.rect(0, TILE - 3, 2, 3, shade('wood', 2));
    }
  };
}

const cottageWall: Painter = (img, seed) => {
  const rnd = noise(seed + 606);
  img.rect(0, 0, TILE, TILE, shade('wall', 1));
  // Stone courses.
  for (let y = 0; y < TILE; y += 4) {
    img.line(0, y, TILE - 1, y, shade('wall', 0));
    const offset = (y / 4) % 2 === 0 ? 4 : 10;
    img.line(offset, y, offset, Math.min(y + 3, TILE - 1), shade('wall', 0));
  }
  for (let i = 0; i < 10; i++)
    img.px(Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), shade('wall', 2));
};

const cottageWindow: Painter = (img, seed) => {
  cottageWall(img, seed);
  img.rect(3, 4, 10, 9, shade('wood', 0));
  // Lit from inside: warm amber, brightest at the top where the lamp hangs. Cold blue glass read
  // as an empty house, which is the wrong note for the one door Red is walking towards.
  img.rect(4, 5, 8, 7, shade('gold', 1));
  img.rect(4, 5, 8, 3, shade('gold', 2));
  img.rect(5, 5, 5, 2, shade('gold', 3));
  img.rect(7, 5, 2, 7, shade('wood', 0));
  img.rect(4, 8, 8, 1, shade('wood', 0));
  // The light falling onto the wall under the sill.
  img.rect(3, 13, 10, 1, shade('gold', 2, 70));
  // Window box with flowers.
  img.rect(2, 12, 12, 3, shade('wood', 1));
  img.px(4, 12, shade('cloak', 2));
  img.px(7, 12, shade('gold', 2));
  img.px(10, 12, shade('fur', 3));
};

const cottageDoor: Painter = (img, seed) => {
  cottageWall(img, seed);
  img.rect(3, 2, 10, 14, shade('wood', 0));
  img.rect(4, 3, 8, 13, shade('wood', 1));
  img.rect(4, 3, 3, 13, shade('wood', 2));
  for (const x of [7, 9]) img.line(x, 4, x, 15, shade('wood', 0));
  img.px(10, 9, shade('gold', 2));
  img.px(10, 10, shade('gold', 1));
};

function roof(kind: 'left' | 'middle' | 'right' | 'peak'): Painter {
  return (img) => {
    img.rect(0, 0, TILE, TILE, shade('roof', 1));
    // Overlapping scalloped shingles rather than a running-bond grid: the grid read as brickwork
    // laid on a slope, which is why the cottage looked like a box rather than a roof.
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      const offset = row % 2 === 0 ? 0 : 3;
      for (let x = offset - 5; x < TILE + 5; x += 5) {
        img.ellipse(x + 2.5, y + 2.6, 2.2, 2.3, shade('roof', 2));
        img.ellipse(x + 2.5, y + 2.1, 1.8, 1.7, shade('roof', 3));
        // The groove between two shingles, which is what makes them read as separate tiles.
        img.line(x + 5, y + 1, x + 5, y + 3, shade('roof', 0));
      }
      // The line that closes the row is the shadow the course above casts on this one.
      img.line(0, y, TILE - 1, y, shade('roof', 0));
    }
    if (kind === 'peak') {
      img.rect(0, 0, TILE, 3, shade('roof', 2));
      img.rect(0, 0, TILE, 1, shade('roof', 3));
    }
    // The eave: a dark roof line with the wall's own shadow directly under it.
    if (kind !== 'peak') {
      img.rect(0, TILE - 3, TILE, 1, shade('roof', 0));
      img.rect(0, TILE - 2, TILE, 2, shade('wall', 0));
    }
    if (kind === 'left') img.rect(0, 0, 2, TILE - 2, shade('roof', 0));
    if (kind === 'right') img.rect(TILE - 2, 0, 2, TILE - 2, shade('roof', 0));
  };
}

const chimney: Painter = (img, seed) => {
  const rnd = noise(seed + 808);
  img.rect(0, 0, TILE, TILE, [0, 0, 0, 0]);
  img.rect(4, 4, 8, 12, shade('stone', 0));
  img.rect(5, 5, 6, 11, shade('stone', 1));
  img.rect(5, 5, 2, 11, shade('stone', 2));
  img.rect(3, 2, 10, 3, shade('stone', 0));
  for (let i = 0; i < 6; i++)
    img.px(5 + Math.floor(rnd() * 6), 6 + Math.floor(rnd() * 9), shade('stone', 2));
};

const stallAwning = (kind: 'left' | 'middle' | 'right'): Painter =>
  function paintAwning(img) {
    img.rect(0, 0, TILE, TILE, [0, 0, 0, 0]);
    // Striped canvas, the stall's strongest read on the board.
    for (let x = 0; x < TILE; x++) {
      const stripe = Math.floor(x / 4) % 2 === 0;
      img.rect(x, 4, 1, 8, stripe ? shade('wall', 2) : shade('cloak', 2));
    }
    img.rect(0, 3, TILE, 2, shade('wood', 0));
    img.rect(0, 11, TILE, 2, shade('wood', 0));
    // Scalloped hem.
    for (let x = 0; x < TILE; x += 4) img.ellipse(x + 2, 13, 2, 1.5, shade('wall', 1));
    if (kind === 'left') img.rect(0, 3, 2, 12, shade('wood', 0));
    if (kind === 'right') img.rect(TILE - 2, 3, 2, 12, shade('wood', 0));
  };

const stallCounter: Painter = (img, seed) => {
  grass(1)(img, seed);
  img.rect(0, 2, TILE, 7, shade('wood', 1));
  img.rect(0, 2, TILE, 2, shade('wood', 2));
  img.line(0, 9, TILE - 1, 9, shade('wood', 0));
  img.rect(1, 10, 3, 6, shade('wood', 0));
  img.rect(12, 10, 3, 6, shade('wood', 0));
  // Wares on the counter.
  img.ellipse(5, 2, 2, 1.5, shade('gold', 2));
  img.ellipse(11, 2, 2, 1.5, shade('water', 2));
};

const lanternPost: Painter = (img, seed) => {
  grass(0)(img, seed);
  img.rect(7, 5, 2, 11, shade('wood', 0));
  img.rect(7, 5, 1, 11, shade('wood', 1));
  img.rect(5, 1, 6, 2, shade('wood', 0));
  img.rect(5, 3, 6, 5, shade('gold', 0));
  img.rect(6, 4, 4, 3, shade('gold', 3));
  img.px(7, 5, shade('wall', 3));
  // Warm pool of light on the grass.
  img.ellipse(8, 8, 7, 6, shade('gold', 3, 40));
};

/*
 * A well, which took two goes. The first had a flat 14x3 red bar floating at the top with a gap
 * under it, over a near-black mouth with a bright blue slot in it -- which at 16px read as a block
 * of plastic explosive with an LED timer rather than as a well. The roof is now a stepped gable
 * sitting ON its posts, and the water is a dark glint rather than a lit panel.
 */
const well: Painter = (img, seed) => {
  grass(1)(img, seed);
  // Posts first, so the roof and the rim lap over them.
  img.rect(3, 5, 2, 7, shade('wood', 0));
  img.rect(11, 5, 2, 7, shade('wood', 0));
  img.rect(3, 5, 1, 7, shade('wood', 1));
  img.rect(11, 5, 1, 7, shade('wood', 1));
  // Stepped gable.
  img.rect(6, 1, 4, 1, shade('roof', 2));
  img.rect(4, 2, 8, 1, shade('roof', 1));
  img.rect(2, 3, 12, 1, shade('roof', 1));
  img.rect(1, 4, 14, 1, shade('roof', 0));
  // Winch bar and rope.
  img.rect(5, 7, 6, 1, shade('wood', 1));
  img.rect(8, 8, 1, 3, shade('wood', 2));
  // Stone rim, then the dark water well inside it.
  img.ellipse(8, 12, 6, 3.2, shade('stone', 0));
  img.ellipse(8, 12, 5, 2.4, shade('stone', 2));
  img.ellipse(8, 12.5, 3.2, 1.5, shade('night', 0));
  img.px(7, 12, shade('water', 0));
  img.px(9, 13, shade('water', 0));
};

/*
 * A fountain in a glade. Scenery, and nothing more.
 *
 * It briefly lost its stonework to make room for the Cyera mark laid under it, which left a pool
 * with a spike in it. The mark is gone (see docs/GAME_DESIGN.md section 5d) and the fountain is
 * the fountain again.
 */
const fountain: Painter = (img, seed) => {
  grass(2)(img, seed);
  // Lower basin.
  img.ellipse(8, 12, 7, 4, shade('stone', 0));
  img.ellipse(8, 12, 6, 3.2, shade('stone', 2));
  img.ellipse(8, 12.2, 4.6, 2.2, shade('water', 1));
  img.ellipse(6.6, 11.6, 2.2, 1, shade('water', 2));
  // Pedestal and upper bowl.
  img.rect(7, 7, 2, 5, shade('stone', 1));
  img.rect(7, 7, 1, 5, shade('stone', 2));
  img.ellipse(8, 7, 3.6, 1.5, shade('stone', 0));
  img.ellipse(8, 6.8, 2.6, 1, shade('water', 2));
  // The spout, and the fall on either side.
  img.px(8, 2, shade('water', 3));
  img.px(8, 3, shade('water', 3));
  img.px(7, 4, shade('water', 2));
  img.px(9, 4, shade('water', 2));
  img.px(6, 5, shade('water', 2));
  img.px(10, 5, shade('water', 2));
  // Where it catches the light, it catches the sky.
  img.px(6, 6, shade('water', 3));
  img.px(10, 6, shade('water', 3));
  img.px(5, 12, shade('water', 2, 200));
};

/*
 * A small toadstool, scattered about the glade. A few mushrooms under the trees is what this
 * forest would have anyway, and that is the whole of why it is here.
 */
const toadstoolRing: Painter = (img, seed) => {
  grass(1)(img, seed);
  // Alpha, like every other decor shadow in this file. At full opacity a 1px ellipse is a bar.
  img.ellipse(8, 14, 3.2, 0.8, shade('shadow', 1, 110));
  img.rect(7, 10, 2, 4, shade('wall', 2));
  img.rect(7, 10, 1, 4, shade('wall', 3));
  img.ellipse(8, 9, 4, 2.6, shade('roof', 1));
  img.ellipse(8, 8, 3.2, 1.8, shade('roof', 2));
  img.px(6, 8, shade('wall', 3));
  img.px(10, 9, shade('wall', 3));
  img.px(8, 7, shade('wall', 3));
};

const signpost: Painter = (img, seed) => {
  grass(2)(img, seed);
  img.rect(7, 4, 2, 12, shade('wood', 0));
  img.rect(7, 4, 1, 12, shade('wood', 1));
  img.rect(2, 3, 11, 5, shade('wood', 1));
  img.rect(2, 3, 11, 1, shade('wood', 2));
  img.rect(2, 7, 11, 1, shade('wood', 0));
  // Arrow point and two lines of "writing".
  img.line(13, 3, 15, 5, shade('wood', 1));
  img.line(13, 7, 15, 5, shade('wood', 1));
  img.line(4, 5, 10, 5, shade('wood', 0));
};

const waterfall: Painter = (img, seed) => {
  const rnd = noise(seed + 212);
  img.rect(0, 0, TILE, TILE, shade('water', 2));
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const r = rnd();
      if (r > 0.75) img.px(x, y, shade('water', 3));
      else if (r < 0.2) img.px(x, y, shade('water', 1));
    }
  for (const x of [2, 7, 12]) img.line(x, 0, x, TILE - 1, shade('water', 3, 200));
};

/** Index order is the tileset layout; the map generator refers to these names. */
export const TILE_PAINTERS: Record<string, Painter> = {
  'grass-0': grass(0),
  'grass-1': grass(1),
  'grass-2': grass(2),
  'grass-3': grass(3),
  path: pathFill,
  'path-n': pathEdge(['n']),
  'path-s': pathEdge(['s']),
  'path-e': pathEdge(['e']),
  'path-w': pathEdge(['w']),
  'path-ne': pathEdge(['n', 'e']),
  'path-nw': pathEdge(['n', 'w']),
  'path-se': pathEdge(['s', 'e']),
  'path-sw': pathEdge(['s', 'w']),
  water: (img, seed) => waterFill(img, seed, 0),
  'water-2': (img, seed) => waterFill(img, seed, 1),
  'shore-n': shore(['n']),
  'shore-s': shore(['s']),
  'shore-e': shore(['e']),
  'shore-w': shore(['w']),
  waterfall: waterfall,
  'flower-white': flower([250, 250, 245, 255]),
  'flower-pink': flower([240, 150, 190, 255]),
  'flower-red': flower([214, 75, 70, 255]),
  bush: bush,
  rock: rock,
  'trunk-l': trunk('left'),
  'trunk-r': trunk('right'),
  'canopy-tl': canopy(0, 0),
  'canopy-tr': canopy(1, 0),
  'canopy-bl': canopy(0, 1),
  'canopy-br': canopy(1, 1),
  'fence-h': fenceRail,
  'fence-post': fencePost,
  'bridge-l': bridgePlank('left'),
  'bridge-m': bridgePlank('middle'),
  'bridge-r': bridgePlank('right'),
  wall: cottageWall,
  'wall-window': cottageWindow,
  door: cottageDoor,
  'roof-l': roof('left'),
  'roof-m': roof('middle'),
  'roof-r': roof('right'),
  'roof-peak': roof('peak'),
  chimney: chimney,
  'stall-awning-l': stallAwning('left'),
  'stall-awning-m': stallAwning('middle'),
  'stall-awning-r': stallAwning('right'),
  'stall-counter': stallCounter,
  'lantern-post': lanternPost,
  fountain,
  'toadstool-ring': toadstoolRing,
  well: well,
  signpost: signpost,
};

export const TILE_NAMES = Object.keys(TILE_PAINTERS);
/** Tiled gids are 1-based. */
export const gid = (name: string): number => {
  const i = TILE_NAMES.indexOf(name);
  if (i === -1) throw new Error(`Unknown tile "${name}"`);
  return i + 1;
};

export const COLUMNS = 12;

export function paintTileset(): Img {
  const rows = Math.ceil(TILE_NAMES.length / COLUMNS);
  const sheet = new Img(COLUMNS * TILE, rows * TILE);
  TILE_NAMES.forEach((name, i) => {
    const tile = new Img(TILE, TILE);
    TILE_PAINTERS[name]!(tile, 1000 + i * 37);
    sheet.blit(tile, (i % COLUMNS) * TILE, Math.floor(i / COLUMNS) * TILE);
  });
  return sheet;
}
