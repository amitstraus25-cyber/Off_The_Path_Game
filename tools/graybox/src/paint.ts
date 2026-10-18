// Tiny zero-dependency raster + PNG encoder, plus the palette the tile and sprite painters share.
import { deflateSync } from 'node:zlib';

export type RGBA = [number, number, number, number];

export const rgb = (hex: string, a = 255): RGBA => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  a,
];

/**
 * Each entry is a shade ramp: dark, base, light, highlight.
 *
 * Retuned 2026-10-17 to the concept board's own colours. The previous ramps were a flat olive
 * world: measured against the board, the live render sat at a median luminance of 108 with an
 * interquartile range of 108..117 -- nine levels of brightness across half the screen -- while the
 * board's median is 154 with an IQR of 87..190. The board is bright daylight with deep local
 * shade, not an overcast field, so the fix is a wider, warmer range rather than an overall tint.
 *
 * `shadow` is the one dusk-shadow ramp docs/ASSETS.md allows. It extends `grass` downward rather
 * than introducing a hue: the board's shadows are grass in shade, never black and never purple.
 */
export const PALETTE = {
  grass: ['#2f7a3e', '#3f9a46', '#50ba51', '#9ed858'],
  shadow: ['#16281a', '#1f3a22', '#2c4f2b', '#3a6332'],
  path: ['#c89a62', '#e2bc86', '#f2cf99', '#fae3bd'],
  water: ['#1a74c8', '#2f9ff0', '#5fcbfc', '#e2f9fc'],
  trunk: ['#4e3520', '#6b4a2b', '#8a6440', '#a37d55'],
  // The darkest step stays in the leaf hue. Sampled straight off the board it came back teal
  // (#1d6b52), which at 16px reads as a hard ink outline round every tree rather than shade.
  canopy: ['#21713c', '#2f9a4a', '#51bb4b', '#86d65c'],
  stone: ['#5f5f66', '#8f8f93', '#b4b4b8', '#d2d2d6'],
  /*
   * The wolf, and only the wolf. He was drawn in `stone` -- the ramp the rocks use -- which is why
   * he read as a grey teddy rather than a predator. Warm dark grey-brown, so that when he is
   * wearing Grandma's cool grey shawl the fur above it reads as the wrong animal.
   */
  wolf: ['#2a2521', '#403931', '#5a5048', '#786c60'],
  roof: ['#a8322c', '#e04a42', '#fc695b', '#ff9a86'],
  wall: ['#c4ab8c', '#f3d9c1', '#faeada', '#fffaf0'],
  wood: ['#6b4522', '#9a6a36', '#c08f55', '#dcb882'],
  cloak: ['#8c2420', '#c0392b', '#d9584a', '#ef8a7c'],
  skin: ['#c98f63', '#f0c9a0', '#ffe0c0', '#fff0e0'],
  fur: ['#c9c2b4', '#ece6da', '#f8f4ec', '#ffffff'],
  night: ['#1a1026', '#2d1b3d', '#441363', '#6d2d93'],
  gold: ['#9c7420', '#d4a72c', '#f0c84a', '#ffe88a'],
  ink: ['#160923', '#2a1a38', '#3d2a4d', '#543d66'],
} as const satisfies Record<string, readonly [string, string, string, string]>;

export type Ramp = keyof typeof PALETTE;
/** 0 = darkest, 3 = lightest. */
export const shade = (ramp: Ramp, level: 0 | 1 | 2 | 3, alpha = 255): RGBA =>
  rgb(PALETTE[ramp][level], alpha);

/**
 * Smooth value noise over a 2D grid, for variation that spans many tiles.
 *
 * Picking a grass variant per tile with plain random gives white noise: every tile differs from
 * its neighbour and the field averages out to one flat tone at any distance. The board's ground
 * varies in broad patches of sun and shade, which needs a field that is correlated across tiles --
 * so the map samples this at a low frequency and the patches come out several tiles wide.
 */
export function valueNoise2D(seed: number): (x: number, y: number) => number {
  const hash = (x: number, y: number): number => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const ease = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = ease(x - x0);
    const fy = ease(y - y0);
    const top = hash(x0, y0) * (1 - fx) + hash(x0 + 1, y0) * fx;
    const bottom = hash(x0, y0 + 1) * (1 - fx) + hash(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/** Deterministic noise so regenerating the art never churns the diff. */
export function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Img {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  px(x: number, y: number, c: RGBA): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (c[3] === 255) {
      this.data.set(c, i);
      return;
    }
    // Source-over so soft shadows and water highlights blend instead of punching holes.
    const a = c[3] / 255;
    const inv = 1 - a;
    this.data[i] = Math.round(c[0] * a + this.data[i]! * inv);
    this.data[i + 1] = Math.round(c[1] * a + this.data[i + 1]! * inv);
    this.data[i + 2] = Math.round(c[2] * a + this.data[i + 2]! * inv);
    this.data[i + 3] = Math.max(this.data[i + 3]!, c[3]);
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!, this.data[i + 3]!];
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  frame(x: number, y: number, w: number, h: number, c: RGBA): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  /** Filled ellipse; the workhorse for canopies, heads and rocks. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++)
      this.px(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, c);
  }

  /** Copies another image, skipping fully transparent pixels. */
  blit(src: Img, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c[3] !== 0) this.px(dx + x, dy + y, c);
      }
  }

  /** Dark outline around every opaque edge; what makes sprites read at 16px. */
  outline(c: RGBA): void {
    const copy = new Uint8Array(this.data);
    const opaque = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && copy[(y * this.w + x) * 4 + 3]! > 0;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (opaque(x, y)) continue;
        if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1))
          this.px(x, y, c);
      }
  }

  png(): Buffer {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      Buffer.from(this.data.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1);
    }
    const chunk = (type: string, body: Buffer): Buffer => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length);
      const td = Buffer.concat([Buffer.from(type), body]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(td));
      return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
