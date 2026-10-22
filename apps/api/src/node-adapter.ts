import type { IncomingMessage, ServerResponse } from 'node:http';
import { MAX_BODY_BYTES } from './handlers.ts';
import { fail } from './http.ts';

/*
 * Vercel's Node launcher calls a classic `(req, res)` handler, and our routes are web handlers
 * (`Request` in, `Response` out). This is the seam, and apps/game/scripts/vercel-output.mjs bundles
 * it into every function. It lives here rather than in a template string in that script so that it
 * is typed, linted and held to the same coverage gate as everything else a request passes through.
 *
 * THE BODY IS CAPPED HERE TOO. The handler's own 32 KB limit binds the read of a web `Request`, but
 * this adapter used to buffer the whole Node request into memory first to build that `Request`, so
 * the cap arrived after the damage: a caller could make an instance hold whatever it could send
 * before the function timed out. Now the read stops at `MAX_BODY_BYTES` and the answer is a 413,
 * the same one the handler gives, and the handler is never called.
 *
 * Every route shares the cap. `start` reads no body and `top` is a GET, so none of them has an
 * honest use for more than a handler's worth of bytes.
 */

export type WebHandler = (request: Request) => Response | Promise<Response>;

const TOO_LARGE = 'that submission is too large';

/**
 * Reads the request body, or null once it has gone past `max` bytes. On overflow nothing is held:
 * the bytes already buffered are dropped and every later chunk is discarded as it arrives, which
 * also drains the socket so the 413 can be delivered on it.
 */
function readBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    let chunks: Buffer[] = [];
    let bytes = 0;
    let over = false;
    req.on('data', (chunk: Buffer) => {
      if (over) return;
      bytes += chunk.length;
      if (bytes > max) {
        over = true;
        chunks = [];
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    // After an overflow this resolves nothing: the promise has already settled with null.
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const send = async (res: ServerResponse, response: Response): Promise<void> => {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
};

/** `(req, res)` for Vercel, over a web handler. `max` is a parameter only so a test can shrink it. */
export function nodeHandler(
  handle: WebHandler,
  max: number = MAX_BODY_BYTES,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const method = req.method ?? 'GET';
    const bodiless = method === 'GET' || method === 'HEAD';

    // A declared length past the cap is refused without reading a byte of the body.
    const declared = Number(req.headers['content-length']);
    if (!bodiless && Number.isFinite(declared) && declared > max) {
      await send(res, fail(413, TOO_LARGE));
      return;
    }

    const body = bodiless ? Buffer.alloc(0) : await readBody(req, max);
    if (body === null) {
      await send(res, fail(413, TOO_LARGE));
      return;
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const proto = String(req.headers['x-forwarded-proto'] || 'https');
    const request = new Request(`${proto}://${req.headers.host}${req.url}`, {
      method,
      headers,
      ...(body.length === 0 ? {} : { body: new Uint8Array(body) }),
    });
    await send(res, await handle(request));
  };
}
