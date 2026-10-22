/*
 * How much of each pixel of a small grid an SVG's filled paths cover -- the instrument the Cyera mark
 * on Purple's cape is held to (`test/art-guards.test.ts`, and the thirteenth pass in
 * `sprites/char-purple.ts`).
 *
 * Deliberately tiny and deliberately strict. It reads the `d` of every `<path>` in the file, accepts
 * only the absolute `M L H V C Z` commands the official logo files are written in, flattens each cubic
 * into 24 segments, and samples a 16 x 16 lattice per pixel with the non-zero winding rule. Any
 * other command throws rather than being guessed at: an instrument that silently half-reads its
 * input is how a bound comes to be written against the wrong drawing. No dependency, no rasteriser
 * library, nothing on the shipped path -- the game never loads this file.
 */

type Pt = readonly [number, number];

function flatten(d: string): Pt[][] {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const polys: Pt[][] = [];
  let cur: Pt[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const num = (): number => {
    const v = Number(toks[i++]);
    if (!Number.isFinite(v))
      throw new Error(`svg-coverage: expected a number in "${d.slice(0, 40)}..."`);
    return v;
  };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i]!)) cmd = toks[i++]!;
    if (cmd === 'M') {
      if (cur.length) polys.push(cur);
      x = sx = num();
      y = sy = num();
      cur = [[x, y]];
      cmd = 'L';
    } else if (cmd === 'L') {
      x = num();
      y = num();
      cur.push([x, y]);
    } else if (cmd === 'H') {
      x = num();
      cur.push([x, y]);
    } else if (cmd === 'V') {
      y = num();
      cur.push([x, y]);
    } else if (cmd === 'C') {
      const [x1, y1, x2, y2, x3, y3] = [num(), num(), num(), num(), num(), num()];
      for (let k = 1; k <= 24; k++) {
        const t = k / 24;
        const u = 1 - t;
        cur.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      x = x3;
      y = y3;
    } else if (cmd === 'Z') {
      x = sx;
      y = sy;
      if (cur.length) polys.push(cur);
      cur = [];
      cmd = '';
    } else {
      throw new Error(`svg-coverage: path command "${cmd}" is not one this instrument reads`);
    }
  }
  if (cur.length) polys.push(cur);
  return polys;
}

/**
 * Coverage, 0..1, of an `n` x `n` grid laid over the SVG's `viewBox`, the box centred in the grid
 * so a non-square artwork keeps its proportions. Row-major: `[row][column]`.
 */
export function svgCoverage(svg: string, n: number): number[][] {
  const box = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1]?.trim().split(/\s+/).map(Number);
  if (!box || box.length !== 4) throw new Error('svg-coverage: the SVG has no viewBox');
  const [bx, by, w, h] = box as [number, number, number, number];
  const polys = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].flatMap((m) => flatten(m[1]!));
  if (!polys.length) throw new Error('svg-coverage: the SVG has no paths');

  const inside = (px: number, py: number): boolean => {
    let wind = 0;
    for (const p of polys)
      for (let k = 0; k < p.length; k++) {
        const [ax, ay] = p[k]!;
        const [cx, cy] = p[(k + 1) % p.length]!;
        const side = (cx - ax) * (py - ay) - (px - ax) * (cy - ay);
        if (ay <= py) {
          if (cy > py && side > 0) wind++;
        } else if (cy <= py && side < 0) wind--;
      }
    return wind !== 0;
  };

  const SS = 16;
  const s = Math.max(w, h) / n;
  const ox = bx - (n * s - w) / 2;
  const oy = by - (n * s - h) / 2;
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) {
      let hit = 0;
      for (let a = 0; a < SS; a++)
        for (let b = 0; b < SS; b++)
          if (inside(ox + (c + (b + 0.5) / SS) * s, oy + (r + (a + 0.5) / SS) * s)) hit++;
      row.push(hit / (SS * SS));
    }
    out.push(row);
  }
  return out;
}
