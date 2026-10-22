import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES } from '../src/handlers.ts';
import { nodeHandler } from '../src/node-adapter.ts';
import type { WebHandler } from '../src/node-adapter.ts';

/*
 * The `(req, res)` seam Vercel's Node launcher calls, which bundled functions cannot be tested
 * through any other way. Two kinds of test: small ones over hand-made requests, for every branch,
 * and real ones over a real HTTP server, for the claims that only a socket can prove -- that an
 * oversized body is refused with a 413 the client actually receives, and that the handler behind
 * the adapter never sees it.
 */

interface Seen {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** A web handler that records what it was given and answers 200 `ok`. */
function recorder(): { handle: WebHandler; seen: Seen[] } {
  const seen: Seen[] = [];
  return {
    seen,
    handle: async (request) => {
      seen.push({
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers),
        body: await request.text(),
      });
      return new Response('ok', { status: 201, headers: { 'x-from': 'handler' } });
    },
  };
}

/** A request as Node hands one over: a readable stream with the fields the adapter reads. */
const incoming = (
  parts: Buffer[],
  fields: Partial<Pick<IncomingMessage, 'method' | 'url'>> & {
    headers?: IncomingMessage['headers'];
  } = {},
): IncomingMessage =>
  Object.assign(Readable.from(parts), {
    method: 'POST',
    url: '/api/score?x=1',
    headers: { host: 'off-the-path.test' },
    ...fields,
  }) as unknown as IncomingMessage;

/** The response side: a status, headers, and the bytes `end` was given. */
function outgoing(): {
  res: ServerResponse;
  out: { status: number; headers: Record<string, string>; body: string };
} {
  const out = { status: 0, headers: {} as Record<string, string>, body: '' };
  const res = {
    set statusCode(code: number) {
      out.status = code;
    },
    setHeader(key: string, value: string) {
      out.headers[key] = value;
    },
    end(chunk: Buffer) {
      out.body = chunk.toString('utf8');
    },
  } as unknown as ServerResponse;
  return { res, out };
}

describe('the adapter, over hand-made requests', () => {
  it('turns a Node request into a web Request and the Response back', async () => {
    const { handle, seen } = recorder();
    const { res, out } = outgoing();

    await nodeHandler(handle)(
      incoming([Buffer.from('{"a":'), Buffer.from('1}')], {
        headers: {
          host: 'off-the-path.test',
          'content-type': 'application/json',
          'x-forwarded-proto': 'http',
          'x-many': ['one', 'two'],
          'x-gone': undefined,
        },
      }),
      res,
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('http://off-the-path.test/api/score?x=1');
    expect(seen[0]!.body).toBe('{"a":1}');
    expect(seen[0]!.headers['x-many']).toBe('one, two');
    expect(seen[0]!.headers).not.toHaveProperty('x-gone');
    expect(out.status).toBe(201);
    expect(out.headers['x-from']).toBe('handler');
    expect(out.body).toBe('ok');
  });

  it('assumes https when the proxy says nothing, and GET when the request says nothing', async () => {
    const { handle, seen } = recorder();
    const { res } = outgoing();

    await nodeHandler(handle)(incoming([], { method: undefined }), res);

    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe('https://off-the-path.test/api/score?x=1');
  });

  it('never reads a body for a GET, and sends a bodiless POST as bodiless', async () => {
    const { handle, seen } = recorder();
    await nodeHandler(handle)(
      incoming([Buffer.from('ignored')], { method: 'GET' }),
      outgoing().res,
    );
    await nodeHandler(handle)(incoming([]), outgoing().res);
    expect(seen.map((s) => s.body)).toEqual(['', '']);
  });

  it('takes a body of exactly the cap, and refuses one byte more', async () => {
    const { handle, seen } = recorder();
    const fits = outgoing();
    await nodeHandler(handle, 8)(incoming([Buffer.alloc(4), Buffer.alloc(4)]), fits.res);
    expect(fits.out.status).toBe(201);

    const over = outgoing();
    await nodeHandler(handle, 8)(incoming([Buffer.alloc(4), Buffer.alloc(5)]), over.res);
    expect(over.out.status).toBe(413);
    expect(JSON.parse(over.out.body)).toEqual({ error: 'that submission is too large' });
    expect(seen).toHaveLength(1);
  });

  it('refuses a declared length past the cap without reading the body', async () => {
    const { handle, seen } = recorder();
    const { res, out } = outgoing();
    const req = incoming([Buffer.alloc(4)], {
      headers: { host: 'off-the-path.test', 'content-length': '999999' },
    });

    await nodeHandler(handle, 8)(req, res);

    expect(out.status).toBe(413);
    expect(seen).toHaveLength(0);
    // Nothing was pulled off the stream.
    expect(req.readableFlowing).toBeNull();
  });

  it('lets a request that errors mid-body reject rather than answer', async () => {
    const { handle, seen } = recorder();
    const req = Object.assign(
      new Readable({
        read() {
          this.destroy(new Error('connection reset'));
        },
      }),
      { method: 'POST', url: '/', headers: { host: 'off-the-path.test' } },
    ) as unknown as IncomingMessage;

    await expect(nodeHandler(handle)(req, outgoing().res)).rejects.toThrow('connection reset');
    expect(seen).toHaveLength(0);
  });
});

describe('the adapter, over a real socket', () => {
  let server: Server | undefined;
  afterEach(async () => {
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
    server = undefined;
  });

  async function serve(handle: WebHandler): Promise<string> {
    server = createServer((req, res) => void nodeHandler(handle)(req, res));
    await new Promise<void>((ready) => server!.listen(0, '127.0.0.1', ready));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/score`;
  }

  it('answers a megabyte sent with no content-length with a 413, and the handler never runs', async () => {
    const { handle, seen } = recorder();
    const url = await serve(handle);
    // A stream body is sent chunked: there is no length to check, only the bytes as they arrive.
    const chunk = new Uint8Array(64 * 1024);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 16) return controller.close();
        sent += 1;
        controller.enqueue(chunk);
      },
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'that submission is too large' });
    expect(seen).toHaveLength(0);
  });

  it('answers a declared megabyte with a 413 too', async () => {
    const { handle, seen } = recorder();
    const url = await serve(handle);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(MAX_BODY_BYTES + 1),
    });

    expect(res.status).toBe(413);
    expect(seen).toHaveLength(0);
  });

  it('passes an ordinary body straight through', async () => {
    const { handle, seen } = recorder();
    const url = await serve(handle);

    const res = await fetch(url, { method: 'POST', body: '{"ok":true}' });

    expect(res.status).toBe(201);
    expect(seen[0]!.body).toBe('{"ok":true}');
  });
});
