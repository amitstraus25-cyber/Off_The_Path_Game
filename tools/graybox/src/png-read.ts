/*
 * A minimal PNG decoder, so tools can read an image back in.
 *
 * paint.ts encodes; nothing could read. Scoring our own output against the concept board needs to
 * open both, so this handles exactly what we meet in practice: 8-bit, non-interlaced, colour type
 * 2 (RGB), 6 (RGBA) or 0 (greyscale). Anything else throws rather than guessing, because a silently
 * misread image would produce confident wrong numbers.
 */
import { inflateSync } from 'node:zlib';

export interface Raster {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8Array;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function readPng(buf: Buffer): Raster {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (buf[i] !== SIGNATURE[i]) throw new Error('not a PNG');
  }

  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  const idat: Buffer[] = [];

  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8]!;
      colour = body[9]!;
      if (body[12] !== 0) throw new Error('interlaced PNG is not supported');
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    p += 12 + len; // length + type + body + crc
  }

  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : colour === 0 ? 1 : 0;
  if (!channels) throw new Error(`unsupported colour type ${colour}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);

  let at = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[at++]!;
    for (let i = 0; i < stride; i++) {
      const x = raw[at + i]!;
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let v: number;
      switch (filter) {
        case 0:
          v = x;
          break;
        case 1:
          v = x + a;
          break;
        case 2:
          v = x + b;
          break;
        case 3:
          v = x + ((a + b) >> 1);
          break;
        case 4: {
          // Paeth
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`unknown PNG filter ${filter}`);
      }
      line[i] = v & 0xff;
    }
    at += stride;

    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      if (channels === 1) {
        out[d] = out[d + 1] = out[d + 2] = line[s]!;
        out[d + 3] = 255;
      } else {
        out[d] = line[s]!;
        out[d + 1] = line[s + 1]!;
        out[d + 2] = line[s + 2]!;
        out[d + 3] = channels === 4 ? line[s + 3]! : 255;
      }
    }
    prev.set(line);
  }

  return { width, height, data: out };
}
