import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import map from '../src/assets/map-forest.json';
import { readForestMap } from '../src/world/map';
import { CAMERA_DEADZONE, cameraFollow, cameraTopLeft, TILE, WALK_SPEED } from '../src/world/logic';
import {
  cameraFor,
  CAMERA_FOCUS_Y,
  RED_FEET_BELOW_SPAWN,
  REFERENCE_VIEWPORTS,
  snapCentreToRow,
} from '@otp/core';
import type { ForestMap } from '../src/world/map';

/*
 * THE DARK BAND ACROSS THE TOP OF THE WORLD.
 *
 * The client's oldest complaint, and the third cause of it. The first two were one-pixel backdrop
 * holes at an odd camera dimension; they were found, fixed, and a magenta-backdrop probe now
 * measures zero holes across 49 configurations. This is not that. The camera's top edge settles
 * PART-WAY INTO a tile row, so the world opens on the bottom sliver of a row of canopy -- crown
 * keylines and nothing else, which reads as a dark rule across the lawn. `topEdgeRows` in
 * packages/core/src/camera.ts has said so since it was written, and until now only the ART read
 * it: the framing passes plant crowns into the rows it names while the GAME pointed its camera
 * wherever the arithmetic landed.
 *
 * Measured on the real map through the real camera, first eight rows of what a visitor sees,
 * percentage of pixels under luma 81 (paint.ts's own "deep shade" threshold), before -> after:
 *
 *     1673x449, the client's own window   27.5% -> 11.4%   (mid-frame 5.6%)
 *     390x844, phone                      54.2% -> 32.4%   (mid-frame 3.7%)
 *     1280x800, the title hero            26.6% -> 13.9%   (mid-frame 3.6%)
 *     375x812, the portrait hero          31.1% ->  4.4%   (mid-frame 3.3%)
 *
 * and the bottom eight rows moved 18.1% -> 9.3%, 11.2% -> 3.7%, 40.8% -> 28.5% and 13.4% -> 5.4%
 * at the same four, so snapping the top did not push the defect onto the other edge.
 *
 * WHAT THIS FILE GUARDS, in three halves, because no one of them alone would be worth anything:
 *
 *   The GEOMETRY, below: compose the two published functions the scene composes -- `cameraTopLeft`
 *   for the clamp and the round, `snapCentreToRow` for the row -- against the real map and the real
 *   viewports, and assert the property a visitor can see. Not the formula: a test that recomputed
 *   `ceil(top / TILE) * TILE` and compared it with the function's own answer would move with the
 *   defect and pass in silence, which is the trap that has cost this repo rounds.
 *
 *   The LIFETIME: the lift is chosen at a placement and dropped on the first frame the camera
 *   moves, and both halves of that are run through the REAL `cameraFollow` here rather than argued
 *   about. A lift left in for the whole run frames Red eleven pixels below her own feet at 375x812
 *   and 768x1024 -- the review that sent the first version of this fix back found exactly that,
 *   and nothing in this file would have.
 *
 *   The CALL, at the end: apps/game's vitest runs on the `node` environment and `forest-scene.ts`
 *   imports Phaser, so there is nothing here to instantiate the scene in. The call sites are
 *   therefore read out of the source, as test/inline-style.test.ts and test/handle-field.test.ts
 *   read theirs. Without it the geometry above would keep passing happily with the snap deleted
 *   from the game, which is precisely the state this file was written to end. Three mutations of
 *   the scene used to pass this file in silence -- deleting the camera move, dropping `reframed`
 *   from the condition, and turning the lift's assignment into `+=` -- and each one now has a test
 *   that was proved by applying that exact mutation and watching it fire.
 */

const forest: ForestMap = readForestMap(map);
const spawn = forest.objects.find((o) => o.name === 'spawn-red');
if (!spawn) throw new Error('map has no "spawn-red"');
const world = { width: forest.widthInPixels, height: forest.heightInPixels };

/**
 * The camera's centre at the opening shot, term for term as `forest-scene.ts` builds it.
 *
 * `create()` puts Red's feet at `spawn.y + RED_FEET_BELOW_SPAWN` and `redFocus()` frames
 * `position.y + CAMERA_FOCUS_Y`. Both terms come from @otp/core rather than being written down
 * again here: a camera this project writes down drifts from the camera it draws, which is the
 * whole argument camera.ts opens with.
 */
const centre = {
  x: spawn.x + TILE / 2,
  y: spawn.y + RED_FEET_BELOW_SPAWN + CAMERA_FOCUS_Y,
};

/** Red herself, which is what the framing is measured against. */
const feet = { x: centre.x, y: spawn.y + RED_FEET_BELOW_SPAWN };

/**
 * Every viewport the opening shot is checked at: the four the project reviews on, the client's own
 * window, the phone they sent the photograph from, and the two short portraits the CSS matrix
 * already visits. A row boundary is a property of the view HEIGHT, so a sweep of heights is what
 * tests it; one viewport would pass on a coincidence.
 */
const VIEWPORTS = [
  { width: 1673, height: 449 },
  { width: 390, height: 844 },
  REFERENCE_VIEWPORTS.desktop,
  REFERENCE_VIEWPORTS.tablet,
  REFERENCE_VIEWPORTS.phone,
  REFERENCE_VIEWPORTS.phoneLandscape,
  { width: 2560, height: 1440 },
  { width: 320, height: 568 },
  { width: 390, height: 600 },
  { width: 768, height: 1024 },
];

/** Where the opening shot's top edge lands, unlifted and lifted, at one viewport. */
function openingEdge(viewport: { width: number; height: number }): {
  raw: number;
  snapped: number;
  lift: number;
  view: { width: number; height: number };
} {
  /*
   * The view is the canvas: `ui/stage.ts` sizes the game to `stageFit`'s view, and `viewFor`
   * returns the whole canvas on every frame where `arrived` is false, which the opening shot is.
   */
  const view = cameraFor(viewport).view;
  const raw = cameraTopLeft(centre, view, world).y;
  const placed = snapCentreToRow(centre.y, 0, raw, world.height - view.height);
  const snapped = cameraTopLeft({ x: centre.x, y: placed.centreY }, view, world).y;
  return { raw, snapped, lift: placed.lift, view };
}

describe('the opening shot does not open on a slice of a canopy row', () => {
  it('lands its top edge on a whole tile row at every viewport', () => {
    for (const vp of VIEWPORTS) {
      const where = `${vp.width}x${vp.height}`;
      const { snapped } = openingEdge(vp);
      expect(snapped % TILE, `the top edge at ${where} is ${snapped}, row ${snapped / TILE}`).toBe(
        0,
      );
    }
  });

  /*
   * CEIL, NOT FLOOR, and this is the consequence of it rather than a restatement of it: the camera
   * only ever moves DOWN, and by less than one row. Down is what pushes the sliver off the top and
   * opens on the first row that is wholly in frame -- which is also the first row the framing
   * passes close, because tools/graybox's audit takes its rows from the same `topEdgeRows`. Up
   * would trade a sliver of crown for a whole row of it: more dark pixels, not fewer.
   */
  it('gets there by moving down, by less than one row', () => {
    for (const vp of VIEWPORTS) {
      const where = `${vp.width}x${vp.height}`;
      const { raw, snapped } = openingEdge(vp);
      expect(
        snapped,
        `the camera at ${where} moved up, from ${raw} to ${snapped}`,
      ).toBeGreaterThanOrEqual(raw);
      expect(snapped - raw, `the camera at ${where} moved ${snapped - raw}px`).toBeLessThan(TILE);
    }
  });

  /*
   * THE BOTTOM EDGE IS THE SAME DEFECT MOVED, so it is checked rather than discovered later by the
   * client. Snapping the top down pushes the bottom down too; past the last row there is no map,
   * and a camera scrolled past it shows the backdrop -- which is the hole this complaint was twice
   * misdiagnosed as. Both bounds, both ends.
   */
  it('keeps the whole camera inside the map, top and bottom', () => {
    for (const vp of VIEWPORTS) {
      const where = `${vp.width}x${vp.height}`;
      const view = cameraFor(vp).view;
      const { snapped } = openingEdge(vp);
      expect(snapped, `the camera at ${where} is above the map`).toBeGreaterThanOrEqual(0);
      expect(
        snapped + view.height,
        `the camera at ${where} runs ${snapped + view.height - world.height}px past the last row`,
      ).toBeLessThanOrEqual(world.height);
    }
  });

  /*
   * The premise, asserted rather than assumed. If the camera were landing on a row boundary by
   * itself at every viewport there would be no band, no fix needed, and the three tests above
   * would be proving nothing at all while passing -- so the one thing that must not be taken on
   * trust is that the defect is there to fix.
   */
  /*
   * THE LIFT IS BIGGER THAN THE DEADZONE, WHICH IS WHY IT CANNOT BE APPLIED AFTER THE FOLLOW.
   *
   * The first version of this fix moved `this.camera.y` and left `redFocus` alone. On the next
   * frame `cameraFollow` measured the camera against its target, found it further away than
   * `CAMERA_DEADZONE.y`, and eased the snap back out -- so the frame a player sees a third of a
   * second after loading is not the frame the fix produced. Run through sixty frames of the real
   * follow with Red standing still:
   *
   *     1673x449   lift 11px   row 15.000 -> 15.000  holds
   *     390x844    lift 10px   row 12.000 -> 12.000  holds
   *     1280x800   lift  7px   row 15.000 -> 15.000  holds
   *     375x812    lift 31px   row 13.000 -> 12.656  DRIFTS
   *     768x1024   lift 31px   row 16.000 -> 15.656  DRIFTS
   *
   * It held at five viewports and came undone at the project's own phone and tablet. This test is
   * the half of that nobody can see by reading: whether any reviewed viewport needs a lift the
   * deadzone will not tolerate. The other half -- that the lift therefore lives in the TARGET --
   * is asserted on the source below, because it is a fact about how the scene is written.
   */
  it('needs a lift bigger than the camera deadzone somewhere, so it cannot be applied after', () => {
    const outside = VIEWPORTS.filter((vp) => openingEdge(vp).lift > CAMERA_DEADZONE.y);
    expect(
      outside.map((vp) => `${vp.width}x${vp.height}`),
      'every lift now fits inside the deadzone, so a post-hoc shift would survive by luck: ' +
        'the requirement below is still right, but this is no longer the reason for it',
    ).not.toHaveLength(0);
  });

  it('is fixing a real misalignment, not an imaginary one', () => {
    const offRow = VIEWPORTS.filter((vp) => openingEdge(vp).raw % TILE !== 0);
    expect(
      offRow.length,
      'no viewport opens part-way into a row any more, so these tests prove nothing: ' +
        'either the spawn or the camera rule has moved and this guard needs rewriting',
    ).toBeGreaterThan(0);
  });
});

/*
 * ------------------------------------------------------------------------------------------
 * The lifetime: what the lift costs while it is held, and what giving it back costs.
 * ------------------------------------------------------------------------------------------
 *
 * THE FIRST VERSION OF THIS FIX WAS SENT BACK HERE, and nothing in this file noticed. The lift
 * went into `redFocus` and stayed there for the whole run; `CAMERA_FOCUS_Y` is -20 and the lift is
 * 31 at 375x812 and 768x1024, so the camera aimed eleven pixels BELOW Red's feet -- out of the
 * method whose docstring says it frames her chest -- from the title card to the cottage door, on
 * the project's own phone and tablet. The geometry above passed every assertion while that was
 * true, because every assertion above is about one frame.
 *
 * So the lift now lives exactly as long as the camera stands still, and these run the REAL
 * `cameraFollow` to say what that is worth both ways.
 */

const FRAME_MS = 1000 / 60;
/** The walk's own travel per frame, which is what the camera's travel is compared against. */
const STRIDE = (WALK_SPEED * FRAME_MS) / 1000;

/** One placement, in the order `syncCamera` does it: unlift, clamp, snap, set. */
function place(
  viewport: { width: number; height: number },
  carried: number,
  cameraY: number,
): { centreY: number; lift: number; top: number; view: { width: number; height: number } } {
  const view = cameraFor(viewport).view;
  const raw = cameraTopLeft({ x: centre.x, y: cameraY - carried }, view, world).y;
  const placed = snapCentreToRow(cameraY, carried, raw, world.height - view.height);
  return {
    ...placed,
    view,
    top: cameraTopLeft({ x: centre.x, y: placed.centreY }, view, world).y,
  };
}

/**
 * The scene's camera loop, run for real from the opening placement: Red walks at `WALK_SPEED` in
 * `dirY`, the camera eases after `redFocus`'s target every frame, and the lift is either released
 * on the first frame the camera's own centre moves or held for ever.
 */
function walk(
  viewport: { width: number; height: number },
  dirY: -1 | 0 | 1,
  frames: number,
  release: boolean,
): {
  dy: number[];
  releasedAt: number;
  cameraY: number;
  top: number;
  feetInFrame: number;
  lift: number;
  view: { width: number; height: number };
} {
  const chosen = openingEdge(viewport);
  let lift = chosen.lift;
  let red = feet.y;
  let cameraY = centre.y + chosen.lift;
  const dy: number[] = [];
  let releasedAt = -1;
  for (let i = 0; i < frames; i++) {
    red += dirY * STRIDE;
    const before = cameraY;
    cameraY = cameraFollow(
      { x: centre.x, y: cameraY },
      { x: centre.x, y: red + CAMERA_FOCUS_Y + lift },
      FRAME_MS,
    ).y;
    if (release && releasedAt < 0 && cameraY !== before) {
      lift = 0;
      releasedAt = i;
    }
    dy.push(cameraY - before);
  }
  const top = cameraTopLeft({ x: centre.x, y: cameraY }, chosen.view, world).y;
  return {
    dy,
    releasedAt,
    cameraY,
    top,
    feetInFrame: red - top,
    lift: chosen.lift,
    view: chosen.view,
  };
}

/** The two viewports whose lift is bigger than the deadzone, which is where all of this bites. */
const BIG_LIFT = [REFERENCE_VIEWPORTS.phone, REFERENCE_VIEWPORTS.tablet];

describe('the lift lives exactly as long as the camera stands still', () => {
  /*
   * Three seconds of the real follow with the camera's own target not moving on this axis, which
   * is the opening shot and is also a walk straight along the X axis: `redFocus`'s Y does not
   * change, so the camera's does not either and the row it was placed on survives. That is why the
   * release reads `this.camera.y` and not `this.walking` -- Red moving is not the question, and
   * inside the deadzone she can move 20px without the camera following at all.
   */
  it('is never given back while the camera has not moved, so the opening frame keeps its row', () => {
    for (const vp of VIEWPORTS) {
      const where = `${vp.width}x${vp.height}`;
      const still = walk(vp, 0, 180, true);
      expect(still.releasedAt, `the camera moved at ${where} with nobody walking`).toBe(-1);
      expect(Math.max(...still.dy.map(Math.abs)), `the camera drifted at ${where}`).toBe(0);
      expect(still.top % TILE, `three seconds in, the edge at ${where} is off its row`).toBe(0);
    }
  });

  /*
   * THE PREMISE OF GIVING IT BACK, measured rather than argued: a lift chosen for one camera
   * position aligns no other. Walk her south through the real follow, let the camera settle, and
   * the top edge is part-way into a row whether the lift was held or dropped -- so holding it buys
   * one aligned frame and then charges a tile of framing for the rest of the run.
   */
  it('aligns nothing once the camera has moved, held or released', () => {
    for (const vp of BIG_LIFT) {
      const where = `${vp.width}x${vp.height}`;
      const held = walk(vp, 1, 90, false);
      const released = walk(vp, 1, 90, true);
      expect(
        held.top % TILE,
        `holding the lift now aligns the edge at ${where} after a walk, which it never did: ` +
          'the follow or the deadzone has changed and the release needs re-arguing',
      ).not.toBe(0);
      expect(released.top % TILE, `released, the edge at ${where} is off its row too`).not.toBe(0);
    }
  });

  /*
   * And what it charges, in the only unit anybody looks at: where Red sits down the frame. Held,
   * the camera is a whole lift lower in the world than `CAMERA_FOCUS_Y` asks, which puts her a
   * whole lift higher up the picture, for ever.
   */
  it('costs a whole lift of framing for every frame it is held after that', () => {
    for (const vp of BIG_LIFT) {
      const where = `${vp.width}x${vp.height}`;
      const held = walk(vp, 1, 90, false);
      const released = walk(vp, 1, 90, true);
      expect(held.lift, `${where} is meant to be one of the big-lift viewports`).toBeGreaterThan(
        CAMERA_DEADZONE.y,
      );
      expect(
        Math.round(released.feetInFrame - held.feetInFrame),
        `holding the lift at ${where} moves Red ${Math.round(released.feetInFrame - held.feetInFrame)}px up the frame instead of ${held.lift}`,
      ).toBe(held.lift);
    }
  });

  /*
   * SOUTHBOUND IT IS FREE, and that is the whole reason the release is keyed on the camera moving
   * rather than on Red moving. She leaves the deadzone after 22px; dropping a 31px lift at that
   * instant puts the target 9px INSIDE the deadzone, so the camera holds a little longer instead
   * of reversing. The world never moves the wrong way and never moves faster than the walk.
   */
  it('costs no camera movement at all when she walks south', () => {
    for (const vp of BIG_LIFT) {
      const where = `${vp.width}x${vp.height}`;
      const held = walk(vp, 1, 90, false);
      const released = walk(vp, 1, 90, true);
      expect(released.releasedAt, `nothing was released at ${where}`).toBeGreaterThan(0);
      expect(
        Math.min(...released.dy),
        `the camera at ${where} reverses after the release, which a player would see as a jolt`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        Math.max(...released.dy),
        `the camera at ${where} travels further in a frame than it does with the lift held`,
      ).toBeLessThanOrEqual(Math.max(...held.dy));
      // And neither of them outruns Red, which is what "the world scrolls with her" means.
      expect(
        Math.max(...released.dy),
        `the camera at ${where} outruns the walk itself`,
      ).toBeLessThanOrEqual(STRIDE);
    }
  });

  /*
   * NORTHBOUND THE CAMERA IS ALREADY GOING THAT WAY and simply goes faster for about a third of a
   * second: measured 4.51px in a frame against the walk's 2.00, then 4.18, 3.90, 3.65, 3.44, all
   * of it given back inside 1.5s. The bound is written against the WALK's own rate -- the thing a
   * player compares it with -- and not against the lift, so it cannot move with the defect.
   */
  it('gives it back northbound inside 1.5s, never faster than two and a half strides', () => {
    for (const vp of BIG_LIFT) {
      const where = `${vp.width}x${vp.height}`;
      const held = walk(vp, -1, 90, false);
      const released = walk(vp, -1, 90, true);
      const peak = Math.max(...released.dy.map(Math.abs));
      expect(
        peak / STRIDE,
        `the camera at ${where} lurched ${peak.toFixed(2)}px in a frame`,
      ).toBeLessThanOrEqual(2.5);
      // Within a hundredth of a pixel: the ease is asymptotic and never exactly arrives.
      expect(
        held.cameraY - released.cameraY,
        `at ${where} the lift is not fully given back after 1.5s`,
      ).toBeCloseTo(released.lift, 2);
    }
  });
});

/*
 * THE RESIZE, which is the half the condition `(cut || reframed)` exists for and which had no test
 * at all. Rotating a phone changes the view height under a camera that has not moved: the lift it
 * is carrying was chosen for the old height and is simply wrong for the new one, so without a
 * fresh placement the band is back and stays back until the player walks -- at the one moment the
 * client is most likely to be looking.
 */
describe('a resize chooses the lift again', () => {
  const ROTATIONS: [{ width: number; height: number }, { width: number; height: number }][] = [
    [REFERENCE_VIEWPORTS.phone, { width: 812, height: 375 }],
    [{ width: 390, height: 844 }, REFERENCE_VIEWPORTS.phoneLandscape],
    [REFERENCE_VIEWPORTS.tablet, { width: 1024, height: 768 }],
  ];

  it('because carrying the old one leaves the edge part-way into a row', () => {
    const stranded: string[] = [];
    for (const [portrait, landscape] of ROTATIONS) {
      const placed = place(portrait, 0, centre.y);
      const carried = cameraTopLeft(
        { x: centre.x, y: placed.centreY },
        cameraFor(landscape).view,
        world,
      ).y;
      if (carried % TILE !== 0)
        stranded.push(
          `${portrait.width}x${portrait.height}->${landscape.width}x${landscape.height} ` +
            `(${carried % TILE}px into row ${Math.floor(carried / TILE)})`,
        );
    }
    expect(
      stranded,
      'no reviewed rotation strands the edge any more, so the `reframed` half of the condition ' +
        'can no longer be justified from this map: re-measure before trusting it',
    ).not.toHaveLength(0);
  });

  it('and a fresh placement puts it back on one', () => {
    for (const [portrait, landscape] of ROTATIONS) {
      const placed = place(portrait, 0, centre.y);
      const after = place(landscape, placed.lift, placed.centreY);
      expect(
        after.top % TILE,
        `rotating to ${landscape.width}x${landscape.height} leaves the edge at ${after.top}`,
      ).toBe(0);
    }
  });

  /*
   * AND IT REPLACES THE LIFT RATHER THAN ADDING TO IT. Six rotations of the same phone, each one
   * re-placing: the correct version is periodic, because the lift is a property of the viewport
   * and of nothing else. `this.snapLift += lift` is not -- it reaches 109px, 3.41 tiles, and takes
   * the camera 217px up the map with it (the arithmetic is in `snapCentreToRow`).
   */
  it('six times over without the camera walking off anywhere', () => {
    const seq = [
      REFERENCE_VIEWPORTS.phone,
      { width: 812, height: 375 },
      REFERENCE_VIEWPORTS.phone,
      { width: 812, height: 375 },
      REFERENCE_VIEWPORTS.phone,
      { width: 812, height: 375 },
    ];
    let lift = 0;
    let cameraY = centre.y;
    const aims: number[] = [];
    for (const vp of seq) {
      const placed = place(vp, lift, cameraY);
      lift = placed.lift;
      cameraY = placed.centreY;
      expect(Math.abs(lift), `a lift of ${lift} is more than a tile`).toBeLessThan(TILE);
      expect(placed.top % TILE, `${vp.width}x${vp.height} is off its row`).toBe(0);
      aims.push(cameraY);
    }
    expect(
      new Set(aims).size,
      `six rotations between two viewports put the camera at ${[...new Set(aims)].join(', ')}: ` +
        'the lift is accumulating rather than being replaced',
    ).toBe(2);
  });
});

/*
 * ------------------------------------------------------------------------------------------
 * The call: that the game actually does this, and only where it may.
 * ------------------------------------------------------------------------------------------
 */

const SOURCE = readFileSync(
  fileURLToPath(new URL('../src/world/forest-scene.ts', import.meta.url)),
  'utf8',
);

/**
 * The same source with every comment taken out.
 *
 * THIS IS NOT TIDINESS, IT IS THE DIFFERENCE BETWEEN A GUARD AND A DECORATION. The first version
 * of the arrival check below asked whether `syncCamera`'s body contained `!this.arrived`, and it
 * passed with the exclusion deleted from the code -- because the docstring three lines above the
 * condition explains what `!this.arrived` is for, in those words. A guard that reads the prose
 * describing the fix instead of the fix is the shape this repo has been bitten by twice, and it
 * was caught here only because the fix was deliberately broken to watch the right message fire.
 * Every assertion over the source now reads code.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** The body of a named method, by matching braces from its signature. */
function bodyOf(source: string, signature: string): string {
  const at = source.indexOf(signature);
  if (at < 0) throw new Error(`forest-scene.ts has no "${signature}"`);
  const open = source.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(open, i + 1);
  }
  throw new Error(`"${signature}" is never closed`);
}

/**
 * The innermost `{ ... }` block containing `needle`, with the offsets it spans.
 *
 * `bodyOf` above finds a METHOD, which is too coarse for everything below: all three mutations
 * this file was sent back for -- deleting the camera move, dropping `reframed` from the condition,
 * and turning the lift's assignment into `+=` -- live inside one branch of one method, and a
 * method-wide `toContain` cannot tell the branch from the rest of the body. So this walks out from
 * the needle to the braces that actually enclose it.
 */
function blockAround(source: string, needle: string): { text: string; from: number; to: number } {
  const at = source.indexOf(needle);
  if (at < 0) throw new Error(`forest-scene.ts has no "${needle}"`);
  let depth = 0;
  let open = -1;
  for (let i = at; i >= 0; i--) {
    if (source[i] === '}') depth++;
    else if (source[i] === '{') {
      if (depth === 0) {
        open = i;
        break;
      }
      depth--;
    }
  }
  if (open < 0) throw new Error(`"${needle}" is not inside a block`);
  depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0)
      return { text: source.slice(open, i + 1), from: open, to: i + 1 };
  }
  throw new Error(`the block around "${needle}" is never closed`);
}

/** The `if (...)` that guards the block containing `needle`, condition only. */
function conditionAround(source: string, needle: string): string {
  const { from } = blockAround(source, needle);
  const head = source.slice(0, from);
  const at = head.lastIndexOf('if (');
  if (at < 0) throw new Error(`the block around "${needle}" is not guarded by an if`);
  return head.slice(at);
}

/** The scene's CODE, with every docstring removed -- see `withoutComments`. */
const SCENE = withoutComments(SOURCE);

const occurrences = (needle: string): number => SCENE.split(needle).length - 1;

/** The placement branch itself: the block that chooses the lift. */
const placement = (): { text: string; from: number; to: number } =>
  blockAround(SCENE, 'snapCentreToRow(');
/** The release: the block that gives it back. */
const release = (): { text: string; from: number; to: number } =>
  blockAround(SCENE, 'this.snapLift = 0');

describe('forest-scene snaps the camera where it may and nowhere else', () => {
  it('snaps inside syncCamera, which is the only place that knows the view', () => {
    expect(SCENE).toContain("from '@otp/core'");
    expect(
      bodyOf(SCENE, 'private syncCamera('),
      'syncCamera no longer snaps the top edge: the band is back at every viewport',
    ).toContain('snapCentreToRow(');
    // And nowhere else, so there is one place to read and one place to change.
    expect(occurrences('snapCentreToRow('), 'the scene calls snapCentreToRow exactly once').toBe(1);
  });

  /*
   * THAT THE CAMERA ACTUALLY MOVES, which this file did not check and which is the whole fix.
   *
   * Every geometric assertion above composes `cameraTopLeft` and `snapCentreToRow` itself, so all
   * of them pass with the scene computing the placement and throwing it away. Deleting the one
   * line that writes the result back to `this.camera` -- the entire visible effect of this round
   * -- left nine tests green. So: the placement block must assign the camera FROM the placement,
   * and the camera must be what the scroll is finally set from. Both halves, because either one
   * alone can be satisfied by a line that does nothing.
   */
  it('moves the camera with the placement it just computed', () => {
    expect(
      placement().text,
      'the placement is computed and thrown away: `snapCentreToRow` is called and nothing is ' +
        'assigned from its centre, so the band is back at every viewport while this file is green',
    ).toMatch(/this\.camera\s*=[^;]*\.centreY/);
    expect(
      bodyOf(SCENE, 'private syncCamera('),
      'the camera field no longer reaches the real camera: setScroll is fed from something else',
    ).toMatch(/cameraTopLeft\(this\.camera,[\s\S]*main\.setScroll\(/);
  });

  /*
   * THE RESIZE HALF OF THE CONDITION. `(cut || reframed)` was reduced to `cut` in review and every
   * test in this file stayed green, because rotating a phone is not something any of them did.
   * The numeric half is the `a resize chooses the lift again` block above -- a lift chosen in
   * portrait leaves the edge 25px into row 16 after the rotation -- and this is the half that says
   * the game asks for a new one.
   */
  it('places again on a resize and not only at a cut', () => {
    const condition = conditionAround(SCENE, 'snapCentreToRow(');
    expect(
      condition,
      'the snap no longer fires on a resize, so rotating a phone on the title screen brings the ' +
        'band back and leaves it there until the player walks',
    ).toContain('reframed');
    expect(condition, 'the snap no longer fires at a cut: the opening shot is unsnapped').toContain(
      'cut',
    );
  });

  /*
   * SET, NOT ACCUMULATED. `this.snapLift = placed.lift` turned into `+=` is green in every test
   * this file had, and it reintroduces exactly the drift the placement exists to avoid: six
   * rotations and the stored lift is 109px, 3.41 tiles, with the camera 217px up the map (the
   * arithmetic is asserted on `snapCentreToRow` in packages/core/test/camera.test.ts, and the
   * six-rotation walk-off is asserted above). Two assertions: the lift comes from the placement's
   * own `.lift`, and nothing anywhere in the scene adds to it.
   */
  it('sets the lift from the placement and never accumulates it', () => {
    expect(
      SCENE,
      'the lift is accumulated rather than replaced: it leaves the tile it is meant to stay ' +
        'inside and walks the camera off up the map, a third of a tile per resize',
    ).not.toMatch(/this\.snapLift\s*[+-]=/);
    expect(
      placement().text,
      'the lift is no longer taken from the placement, so the stored lift and the camera it was ' +
        'computed for can disagree',
    ).toMatch(/this\.snapLift\s*=\s*[A-Za-z_$][\w$]*\.lift\b/);
    expect(
      placement().text,
      'the raw top edge is no longer measured from an UNLIFTED camera, so each placement snaps a ' +
        'camera that is already lifted and the lift accumulates by another route',
    ).toContain('- this.snapLift');
  });

  /*
   * AND IT IS GIVEN BACK ON THE FIRST FRAME THE CAMERA MOVES. The lift is worth a tile of framing
   * for the one frame it aligns and nothing at all afterwards (measured above, both ways, through
   * the real follow). Three things have to hold and each one is a way of getting it wrong:
   *
   *   it is released when the CAMERA has moved, not when RED has -- she moves inside the deadzone
   *   without moving it, and the row survives that;
   *   the comparison is made BEFORE the follow runs, or there is nothing to compare against;
   *   and the release is the ELSE of the placement. As a separate `if` before it, the placement
   *   would measure an already-lifted camera as if it were unlifted and double the lift; after it,
   *   a resize would choose a lift and drop it in the same frame.
   */
  it('gives the lift back on the first frame the camera moves, and not before', () => {
    const body = bodyOf(SCENE, 'private syncCamera(');
    expect(
      body,
      'nothing releases the lift any more, so it is added to `redFocus` for the whole run: at ' +
        '375x812 and 768x1024 the lift is 31 and CAMERA_FOCUS_Y is -20, so the camera aims ' +
        "eleven pixels BELOW Red's feet from the title card to the cottage door",
    ).toContain('this.snapLift = 0');
    expect(
      body,
      'nothing records where the camera was before the follow, so nothing can tell whether it moved',
    ).toMatch(/const\s+([A-Za-z_$][\w$]*)\s*=\s*this\.camera\.y;[\s\S]*cameraFollow\(/);
    expect(
      body,
      'the release is no longer keyed on the camera having moved: a lift chosen at the opening ' +
        'shot now frames Red eleven pixels below her own feet for the rest of the run at 375x812 ' +
        'and 768x1024',
    ).toMatch(/const\s+moved\s*=\s*this\.camera\.y\s*!==\s*[A-Za-z_$][\w$]*;/);
    expect(conditionAround(SCENE, 'this.snapLift = 0'), 'the release is unconditional').toContain(
      'moved',
    );
    expect(
      SCENE.slice(placement().to, release().from),
      'the release is no longer the `else` of the placement, so a frame can place and release at ' +
        'once -- or release first and leave the next placement to snap an already-lifted camera',
    ).toMatch(/^\s*else\s+if\s*\(\s*moved\s*\)\s*$/);
  });

  /*
   * A CENSUS, NOT A SPOT CHECK. Every call to `syncCamera` is accounted for here, so a fifth one
   * added later cannot quietly inherit either answer: whoever writes it has to come to this file
   * and say whether their camera is being PLACED or MOVED. That is the only question the snap
   * turns on, and it is the question the first three rounds of this defect never asked.
   *
   *   `(0, true)`    twice: `create` and `resetToSpawn`, the two shots a player sees at rest.
   *   `(deltaMs)`    once:  `update`, the eased follow. Snapping here quantises the scroll and
   *                         walking north or south judders a whole tile at a time.
   *   `()`           once:  `stageArrival`, the payoff frame, which is composed on the BUILDING.
   *                         e2e/scene-second-pass.spec.ts holds the facade's centre within one
   *                         game pixel of the canvas's, and snapping moves the camera up to 31px.
   */
  it('passes the cut flag at the two placements and at neither of the others', () => {
    expect(
      occurrences('this.syncCamera('),
      'a syncCamera call this census has not classified',
    ).toBe(4);
    expect(occurrences('this.syncCamera(0, true)'), 'the two placements').toBe(2);
    expect(occurrences('this.syncCamera(deltaMs)'), 'the eased follow out of update').toBe(1);
    expect(occurrences('this.syncCamera()'), 'the arrival, which is not snapped').toBe(1);
    expect(bodyOf(SCENE, '\n  create(): void'), 'create places the opening shot').toContain(
      'this.syncCamera(0, true)',
    );
    expect(
      bodyOf(SCENE, 'private resetToSpawn('),
      'a replay places the same opening shot',
    ).toContain('this.syncCamera(0, true)');
    expect(
      bodyOf(SCENE, 'private stageArrival('),
      'the payoff frame is placed unsnapped',
    ).toContain('this.syncCamera()');
  });

  /*
   * The other half of the drift finding above. A lift applied to the camera after `cameraFollow`
   * has run is a lift `cameraFollow` will take back out on the next frame, at any viewport whose
   * lift exceeds the deadzone -- which is two of the four the project reviews on. So it has to be
   * in what the camera is AIMING at, and `redFocus` is the only thing that says that.
   */
  it('carries the lift in the follow target, where the deadzone cannot undo it', () => {
    expect(
      bodyOf(SCENE, 'private redFocus('),
      'redFocus no longer carries snapLift, so the camera eases the snap back out within about ' +
        'a third of a second at 375x812 and 768x1024 and the band returns',
    ).toContain('this.snapLift');
    expect(
      bodyOf(SCENE, 'private doorFocus('),
      'the payoff frame must not be lifted: it is composed on the building',
    ).not.toContain('snapLift');
  });

  it('refuses to snap at the door, by the state and not by the call site', () => {
    expect(
      bodyOf(SCENE, 'private syncCamera('),
      'the arrival is excluded by where it is called from rather than by `arrived`, so the next ' +
        'cut at the door will opt into the snap by accident',
    ).toContain('!this.arrived');
  });
});
