import { afterEach, describe, expect, it, vi } from 'vitest';
import { deviceClass, isEmbedded, notePlay } from '../src/net/plays';

/* The play stats' notes: anonymous, fire and forget, and never a thrown error. */

const fakeWindow = (hoverNone: boolean, framed: boolean | 'blocked'): Window => {
  const self = {};
  const win = {
    matchMedia: (q: string) => ({ matches: q === '(hover: none)' && hoverNone }),
    self,
  } as unknown as Window;
  Object.defineProperty(win, 'top', {
    get: () => {
      if (framed === 'blocked') throw new Error('cross-origin');
      return framed ? {} : self;
    },
  });
  return win;
};

describe('the play notes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names the device class and whether the game is framed', () => {
    expect(deviceClass(fakeWindow(true, false))).toBe('phone');
    expect(deviceClass(fakeWindow(false, false))).toBe('desktop');
    expect(isEmbedded(fakeWindow(false, false))).toBe(false);
    expect(isEmbedded(fakeWindow(false, true))).toBe(true);
    expect(isEmbedded(fakeWindow(false, 'blocked'))).toBe(true);
  });

  it('posts the note same-origin, keepalive, with no credentials and nothing about the player', () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 201 })));
    vi.stubGlobal('fetch', fetch);
    notePlay({ stage: 'start', token: 'a.b' }, fakeWindow(true, true));
    const [path, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/play');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      mode: 'same-origin',
      credentials: 'omit',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      stage: 'start',
      token: 'a.b',
      device: 'phone',
      embedded: true,
    });
  });

  it('swallows a failed request and a refused one alike', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    expect(() =>
      notePlay({ stage: 'start', token: 'a.b' }, fakeWindow(false, false)),
    ).not.toThrow();
    vi.stubGlobal('fetch', () => {
      throw new TypeError('keepalive quota');
    });
    expect(() =>
      notePlay({ stage: 'start', token: 'a.b' }, fakeWindow(false, false)),
    ).not.toThrow();
    await Promise.resolve();
  });
});
