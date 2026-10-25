/*
 * THE GATEKEEPER, drawn at 32 x 48: the Toadstool, turned into the one who holds the bridge key.
 *
 * The client's design of 2026-10-25 (docs/GATEKEEPER.md). The river is the walk's one real decision
 * and the bridge has a gate on it now; he stands at its west end and his skill, Bridge Key, opens
 * it for you. He is the same mushroom he was as a bystander -- the russet dome, the cream stem, the
 * brow over two dots, the twig of an arm -- in a keeper's cap, holding a big brass key upright at
 * his side like a staff. The cap says "official"; the key says what he is official about.
 *
 * WHY THE KEY STANDS ON THE LEFT, and it is the seat's reason, not taste. `assertSeats()` in
 * `cast.ts` wants the right edge of a figure two pixels of line on far more of its rows than the
 * left. A key is a two-pixel shaft and a five-pixel bow: thin features `seat.ts` will not thicken.
 * On his right it would be the rightmost thing on fifteen rows, those rows would read as one-pixel
 * line, and the seat check would fail on exactly the figure it was written for. On his left it is
 * on the lit side, which is meant to stay a single pixel, and the body keeps its band down the
 * right. It is also his right hand, which is the hand a keeper holds a key in.
 *
 * WHY HE IS STILL SMALL, measured against the band rule rather than chosen. `assertBodyPlans()`
 * refuses two silhouettes inside both a width band (+-4) and a height band (+-6). With the owl at
 * 22 x 26 and the snail at 27 x 15 the only box left for a figure about this wide is at most 22
 * across and at most 19 tall: any taller and he is the owl's twin, any wider and the snail's. So the
 * keeper's cap and the key's bow are paid for inside the toadstool's own 22 x 18, plus the one row
 * the band allows: the dome comes down from 7 rows to 6.4 and in from 9.6 to 8.6, the cap sits in
 * the row that freed, and the key's bow stands beside the dome where its flank falls away.
 *
 * Everything that was true of the toadstool's drawing and is still drawn here is kept with its
 * reasons, below, from `bystanders.ts` where he used to live.
 */
import { Img, keyline, pull, rust as rustTone, shade } from '../paint.ts';
import type { RGBA } from '../paint.ts';
import { base, BLINK, REST, taper } from './bystanders.ts';
import type { Pose, PosedPainter } from './bystanders.ts';
import { seat } from './seat.ts';

/**
 * The upper half of an ellipse, flat along `baseY`. A mushroom cap is a dome with a brim, and a
 * whole ellipse with its bottom hidden behind the stem is not the same shape -- the brim is where
 * the gills hang, so the flat edge has to be real.
 */
function dome(img: Img, cx: number, baseY: number, rx: number, ry: number, c: RGBA): void {
  for (let y = Math.floor(baseY - ry); y <= Math.floor(baseY); y++) {
    const dy = (y + 0.5 - baseY) / ry;
    if (dy < -1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++)
      if (x + 0.5 >= cx - half && x + 0.5 <= cx + half) img.px(x, y, c);
  }
}

/*
 * The cap's russet. `paint.ts`'s `rust(t)` at the four stops, which are the live toadstool TILE's
 * own (`tiles/w-undergrowth.ts`), so the mushroom on the map and the mushroom by the bridge read as
 * one species. The note that used to stand over this in `bystanders.ts` records why it is not
 * Cyera purple: PIXEL_STANDARD section 2 moved the toadstools off brand colour.
 */
const rust = (level: 0 | 1 | 2 | 3): RGBA => rustTone(level / 3);
const CAP_LINE = pull(keyline('wood'), 0.62, 0.52);

/**
 * His grounding shadow (`seat`, sprites/seat.ts): the cap's own russet line taken from `wood`'s
 * keyline at luma 50 rather than 35, pulled the same way, so it reads as shade beside it.
 */
const CAP_SHADOW: RGBA = pull(keyline('wood', 25), 0.62, 0.52);

/*
 * THE KEEPER'S CAP: a cool slate crown, a darker band with a brass badge, a peak. `stone` because it
 * is the one ramp on the palette that is nobody's fur, leaf, wood or brand -- a uniform colour -- and
 * because grey against the russet is the strongest hue step the dome can be given that is not purple.
 * Its band and peak take `stone`'s own keyline, so the cap has its own dark and does not borrow the
 * mushroom's.
 */
const CAP_DARK: RGBA = keyline('stone', 30);

/*
 * THE KEY, in brass: `gold`. The same ramp the item icon `item-key` is painted from in `faces.ts`,
 * so the key he holds and the key the card shows are one object. The hole in the bow and the shade
 * under the collar take `gold`'s keyline, which is a dark bronze rather than black.
 */
const BRASS_DARK: RGBA = keyline('gold', 70);

/** Where the stem stands: its centre column. Everything is laid off it or off the cap's centre. */
const SX = 15;
/** The key's shaft, left column. The bow is centred over it and the bit hangs off its left. */
const KX = 6;

/**
 * He is rooted and never bobs. The blink moves the twig arm a pixel instead, which is the only tell
 * that the thing addressing you is the mushroom and not something behind it.
 *
 * HIS BEAT IS THE CAP, which wobbles a whole pixel sideways on the stem (`pose.beat`, signed). The
 * stem, the ring, the face and the key stay planted, so it reads as a hat settling and not as the
 * mushroom sliding; the gills, the spots and the keeper's cap travel with the dome because they are
 * on it.
 */
function paintGatekeeper(img: Img, pose: Pose): void {
  const blink = pose.blink;
  const t = pose.dip;
  const w = pose.beat;
  const cx = SX + w;

  /*
   * --- stem: a short tapered column with a swollen base, lit down the left ---
   *
   * Eight columns wide. The face has to fit inside it with a clear column of stem down each side --
   * at six the two eyes took four of them and the pair sat against the silhouette edge, where
   * `outline` crowds them and they read as two notches rather than as a face.
   */
  for (let y = 38; y <= 46; y++) {
    const hw = 3.6 + (y > 43 ? (y - 43) * 0.45 : 0);
    const left = Math.round(SX - hw);
    const right = Math.round(SX + hw);
    img.rect(left, y, right - left, 1, shade('wall', 1));
    img.rect(left, y, 2, 1, shade('wall', 2));
    img.rect(right - 1, y, 1, 1, shade('wall', 0));
  }

  // --- the ring: the torn veil, flared wider than the stem and catching light on its top face ---
  for (let y = 39; y <= 40; y++) {
    const hw = 5.0 - (y - 39) * 1.2;
    const left = Math.round(SX - hw);
    const right = Math.round(SX + hw);
    img.rect(left, y, right - left, 1, y === 39 ? shade('wall', 3) : shade('wall', 1));
    img.rect(right - 1, y, 1, 1, shade('wall', 0));
  }

  /*
   * --- the mushroom's cap: full mass in shade, body inset up-left, lit quarter to the top-left ---
   *
   * The levels are the toadstool's, which were MEASURED against the live tile: the cap proper at
   * `rust` 2 inside the tile's own band, the lit quarter at `rust` 3, the shaded flank on `rust` 1
   * and `rust` 0 as the pixel proud of everything. Only the size moved, for the band rule above.
   */
  dome(img, cx, 38, 8.6, 6.4, rust(0));
  dome(img, cx - 0.6, 37.4, 8.0, 5.8, rust(2)); // the cap proper
  dome(img, cx - 2.4, 35.6, 5.0, 3.4, rust(3)); // the lit quarter only
  // The shaded flank: a crescent down the low right, where the dome turns away from the light.
  for (let y = 34; y <= 37; y++) {
    const dy = (y + 0.5 - 37.4) / 5.8;
    const half = 8.0 * Math.sqrt(Math.max(0, 1 - dy * dy));
    const edge = Math.round(cx - 0.6 + half);
    img.rect(edge - 2, y, 2, 1, rust(1));
  }

  /*
   * Gills: the SHADOW under the brim, and a band in it. Not a comb -- a row of alternating dark and
   * cream across a brim this size renders as a mouth full of teeth over the eyes.
   */
  img.line(7 + w, 38, 22 + w, 38, CAP_LINE);
  img.rect(9 + w, 39, 12, 1, CAP_LINE);

  // Spots: a dark seat, a cream face inset up-left, so each sits on the curve. `wall`, the cottage
  // cream, which is what the live tile spots its caps with. Two now, where the cap was three: the
  // keeper's cap stands where the middle one was.
  for (const [sx, sy, r] of [
    [9.6, 35.6, 1.9],
    [20.4, 35.2, 1.8],
  ] as const) {
    img.ellipse(sx + w, sy, r, r * 0.9, rust(0));
    img.ellipse(sx + w - 0.3, sy - 0.4, r - 0.5, (r - 0.5) * 0.9, shade('wall', 1));
    img.ellipse(sx + w - 0.7, sy - 0.8, r - 1.1, (r - 1.1) * 0.9, shade('wall', 2));
  }

  /*
   * --- the keeper's cap, on the crown of the dome ---
   *
   * Three parts and one row each is all the budget there is: a crown two rows tall, lit down its
   * left; a band in the cap's own dark with a two-pixel brass badge dead centre, which is the one
   * mark that makes it a uniform rather than a beret; and a peak a pixel wider than the crown either
   * side, dark, with one lit pixel where the light catches its top-left edge. It sits square: a
   * keeper does not wear his cap at an angle.
   */
  const hx0 = Math.round(cx) - 4;
  img.rect(hx0, 30, 8, 2, shade('stone', 1));
  img.rect(hx0, 30, 2, 2, shade('stone', 2));
  img.px(hx0, 30, shade('stone', 3));
  img.rect(hx0 + 6, 30, 2, 2, shade('stone', 0));
  img.rect(hx0, 32, 8, 1, CAP_DARK);
  img.rect(hx0 + 3, 32, 2, 1, shade('gold', 3));
  img.rect(hx0 - 1, 33, 10, 1, CAP_DARK);
  img.px(hx0 - 1, 33, shade('stone', 1));

  /*
   * --- the key, upright at his side, its bit on the ground ---
   *
   * Seventeen rows of it against an eighteen-row figure: a big key, the size a key is in a story.
   * The bow stands beside the dome where its flank has fallen away, so it reads against the sky
   * rather than against the cap; the shaft runs down in front of the brim and into clear air; the
   * bit's two teeth point outboard, away from the stem, so they break the silhouette on the lit side.
   */
  // The bow: a ring five wide and five tall with a hole down its middle, lit top-left.
  for (const [x, y, c] of [
    [KX - 1, 30, shade('gold', 3)],
    [KX, 30, shade('gold', 3)],
    [KX + 1, 30, shade('gold', 2)],
    [KX - 2, 31, shade('gold', 3)],
    [KX - 1, 31, shade('gold', 2)],
    [KX, 31, BRASS_DARK],
    [KX + 1, 31, shade('gold', 2)],
    [KX + 2, 31, shade('gold', 1)],
    [KX - 2, 32, shade('gold', 2)],
    [KX - 1, 32, shade('gold', 2)],
    [KX, 32, BRASS_DARK],
    [KX + 1, 32, shade('gold', 1)],
    [KX + 2, 32, shade('gold', 1)],
    [KX - 2, 33, shade('gold', 2)],
    [KX - 1, 33, shade('gold', 1)],
    [KX, 33, BRASS_DARK],
    [KX + 1, 33, shade('gold', 1)],
    [KX + 2, 33, shade('gold', 0)],
    [KX - 1, 34, shade('gold', 1)],
    [KX, 34, shade('gold', 1)],
    [KX + 1, 34, shade('gold', 0)],
  ] as const)
    img.px(x, y, c);
  // The collar under the bow, a pixel proud of the shaft on each side.
  img.rect(KX - 1, 35, 3, 1, shade('gold', 2));
  img.px(KX + 1, 35, shade('gold', 0));
  // The shaft, two wide: lit on the left, shaded on the right.
  for (let y = 36; y <= 46; y++) {
    img.px(KX, y, shade('gold', 2));
    img.px(KX + 1, y, shade('gold', 0));
  }
  // The bit: two teeth off the shaft's foot, with the notch between them.
  img.rect(KX - 2, 42, 2, 2, shade('gold', 1));
  img.px(KX - 2, 42, shade('gold', 2));
  img.rect(KX - 2, 45, 2, 2, shade('gold', 1));
  img.px(KX - 2, 45, shade('gold', 2));

  /*
   * The twig arm, reaching across to the key and holding it. In clear air under the brim, from the
   * stem's left edge to the shaft, and it takes the pixel of dip the toadstool's pointing twig did:
   * on the breath his grip slides a row up the shaft.
   */
  taper(img, SX - 3.6, 42.2 - t, KX + 2.4, 41.4 - t, 1.8, 1.4, shade('wood', 0));
  taper(img, SX - 3.6, 41.8 - t, KX + 2.6, 41.0 - t, 1.0, 0.9, shade('wood', 2));
  // The hand: a knot of twig closed round the shaft.
  img.rect(KX, 40 - t, 2, 2, shade('wood', 1));
  img.px(KX, 40 - t, shade('wood', 2));

  /*
   * Face, well inside the stem so the outline never eats an eye. Brow in CAP_LINE, a clear row of lit
   * stem, then the eye: brow, stem, eye, then the cheek and chin below, which are where the whole
   * expression lives.
   */
  for (const ex of [SX - 3, SX + 1]) {
    img.rect(ex, 41, 2, 1, CAP_LINE);
    if (!blink) {
      img.rect(ex, 43, 2, 2, CAP_LINE);
      img.px(ex, 43, shade('wall', 3));
    } else {
      img.rect(ex, 44, 2, 1, CAP_LINE);
    }
  }

  base(img, KX - 2, SX + 5, 47, CAP_LINE);
  img.outline(CAP_LINE);
  seat(img, CAP_LINE, CAP_SHADOW);
}

/**
 * His box, in `cast.ts`'s terms (the OUTLINED bbox; `assertBodyPlans()` holds the idle frame to it
 * within a pixel and against every other figure's bands). See the header for why it is this box.
 */
export const GATEKEEPER_PLAN = {
  'npc-gatekeeper': {
    w: 22,
    h: 19,
    widest: 'the cap and the key',
    breaks: 'the key, standing at his side',
  },
} as const satisfies Record<string, { w: number; h: number; widest: string; breaks: string }>;

/** Keyed by the texture name the scene looks up, `npc-gatekeeper`: `-0` open-eyed, `-1` the blink. */
export const GATEKEEPER_FRAMES: Record<string, (img: Img) => void> = {
  'npc-gatekeeper-0': (img) => paintGatekeeper(img, REST),
  'npc-gatekeeper-1': (img) => paintGatekeeper(img, BLINK),
};

/** Posable, for the idle and hop strips. */
export const GATEKEEPER_POSED: Record<string, PosedPainter> = {
  'npc-gatekeeper': paintGatekeeper,
};

/** The line and the grounding shadow he is seated with, for `assertSeats()` in `cast.ts`. */
export const GATEKEEPER_SEATS: Record<string, { readonly line: RGBA; readonly shadow: RGBA }> = {
  'npc-gatekeeper': { line: CAP_LINE, shadow: CAP_SHADOW },
};
