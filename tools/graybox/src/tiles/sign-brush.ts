/*
 * THE BRUSH HAND -- the lettering on the forest notice and the Dead End sign (the Cyera Speed! sign
 * until it was repainted, both 2026-10-25).
 *
 * The client picked "B1" from four previews that day (B0, the 3 x 5 type as shipped; B1 brush; B2
 * signwriter; B3 playful). This is B1 and only B1: the other three were a scratch round and are not
 * in the game. What it is, in the client's own preview caption: heavy downstrokes, dry-brush ends, a
 * bouncing baseline, and a drawn heart with an outline and a highlight.
 *
 * A line is laid out as a list of pixels, each with a ROLE, and the sign that carries it decides
 * the colour of each role -- dark ink on the paper notice, cream paint on the timber board:
 *
 *   ink    the letter's body
 *   dry    a dry-brush pixel: the end of a stroke where the brush ran out of paint
 *   hline  the heart's outline     hfill  its body     hhi  its highlight
 *
 * Glyph cells: '#' ink, '+' dry, 'o' heart outline, 'h' heart fill, '*' heart highlight, '.' empty.
 *
 * Capitals only, five rows, for the reason the old 3 x 5 font gave and which still holds: a
 * lower-case "y" or "e" needs a descender and a bowl that five rows cannot hold. The downstrokes are
 * two pixels and the cross-strokes one, which is what makes it read as a brush rather than a stamp,
 * and it costs width: RESEARCH is 36 pixels here against 31 in the old font, which is why the
 * notice's paper is 42 wide now and not 38 (`NOTICE_PAGE` in `s-props.ts`). Only the letters the two
 * signs spell are drawn; a sign that asks for another one throws.
 *
 * The guard on what this lays is in `s-props.ts`, at the foot, measured on the finished sheet: the
 * letters and the heart's body stand at least 100 luma off their ground, and the dry-brush pixels and
 * the heart's highlight are the two NAMED exceptions to that floor, each with its own rule.
 */

export type Role = 'ink' | 'dry' | 'hline' | 'hfill' | 'hhi';
export type Px = readonly [number, number, Role];
/** One laid line, its top-left at (0, 0): its box and its pixels. */
export type Laid = { w: number; h: number; px: Px[] };

const BRUSH: Record<string, readonly string[]> = {
  I: ['+##', '.#.', '.#.', '.#.', '##+'],
  C: ['.##+', '##..', '##..', '##..', '.###'],
  Y: ['#.#', '##+', '.#.', '.#.', '.#.'],
  E: ['##+', '#..', '##.', '#..', '###'],
  R: ['###.', '##.#', '###.', '##+.', '##.#'],
  A: ['.##.', '##.#', '####', '##.#', '##.+'],
  S: ['+##', '#..', '.#.', '..#', '##+'],
  H: ['##.#', '##.#', '####', '##.#', '##.#'],
  P: ['###.', '##.#', '###.', '##..', '##..'],
  D: ['###.', '##.#', '##.#', '##.#', '###.'],
  // For DEAD END (2026-10-25): H's heavy left downstroke and thin right one, the diagonal between.
  N: ['##..#', '###.#', '##.##', '##..#', '##..+'],
  '!': ['##', '##', '#+', '..', '#.'],
  ' ': ['.', '.', '.', '.', '.'],
  // Painted, not stamped: lobes of unequal size, the tip pulled a pixel left, one highlight stroke.
  '♥': ['.oo.oo.', 'o*hohho', 'o*hhhho', 'ohhhho.', '.ohho..', '..oo...'],
};

/**
 * One brush hand: which glyphs sit a pixel low, by the glyph's place in its line (spaces are not
 * counted; the heart is counted but never drops, so its tip stays on the line). Fixed, so the sign
 * is the same every build -- the generator is deterministic and that property is the proof standard
 * for every art change.
 */
const BOUNCE = [0, 1, 0, 0, 1, 0, 1, 0, 0, 1];

/** The blank column between two glyphs. */
const GAP = 1;

const roleOf = (c: string): Role | undefined =>
  c === '#'
    ? 'ink'
    : c === '+'
      ? 'dry'
      : c === 'o'
        ? 'hline'
        : c === 'h'
          ? 'hfill'
          : c === '*'
            ? 'hhi'
            : undefined;

/** Lays one line of `text` in the brush hand, with its top-left at (0, 0). */
export function layLine(text: string): Laid {
  const px: Px[] = [];
  let at = 0;
  let k = 0;
  for (const ch of text) {
    const g = BRUSH[ch];
    if (!g) throw new Error(`the brush hand has no "${ch}" -- draw it in BRUSH before using it`);
    const dy = ch === '♥' || ch === ' ' ? 0 : BOUNCE[k % BOUNCE.length]!;
    g.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        const r = roleOf(row[gx]!);
        if (r) px.push([at + gx, gy + dy, r]);
      }
    });
    at += Math.max(...g.map((r) => r.length)) + GAP;
    if (ch !== ' ') k++;
  }
  const xs = px.map((p) => p[0]);
  const ys = px.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(0, ...ys);
  return {
    w: Math.max(...xs) - x0 + 1,
    h: Math.max(...ys) - y0 + 1,
    px: px.map(([x, y, r]) => [x - x0, y - y0, r] as Px),
  };
}

/** A laid line placed on a sheet: its top-left, and the text it spells. */
export type LaidAt = { x: number; y: number; laid: Laid; text: string };

/** The rows between two stacked lines. */
const LEADING = 1;

/**
 * Lays `texts` as a stack of lines, each centred across `board` and the stack centred down it.
 */
export function layOn(
  board: { x: number; y: number; w: number; h: number },
  texts: readonly string[],
): LaidAt[] {
  const laid = texts.map((t) => layLine(t));
  const h = laid.reduce((a, l) => a + l.h, 0) + LEADING * (laid.length - 1);
  let y = board.y + Math.floor((board.h - h) / 2);
  return laid.map((l, i) => {
    const at = { x: board.x + Math.floor((board.w - l.w) / 2), y, laid: l, text: texts[i]! };
    y += l.h + LEADING;
    return at;
  });
}
