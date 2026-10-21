import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import { createRunTokens, signingKey } from '../src/token.ts';
import { runTokenSchema } from '../src/schema.ts';

/*
 * The token, as a unit: what it seals, and every way of handing back something it did not seal.
 * What the routes do with a ticket is in start.test.ts and score.test.ts.
 */

const KEY = signingKey('not-a-real-service-role-key');
const tokens = createRunTokens(KEY);
const NOW = 1_761_100_000_000;

/** Base64url of a string, for building tokens by hand. */
const b64 = (text: string): string => Buffer.from(text).toString('base64url');

describe('a run token', () => {
  it('opens to the seed it was issued with and the moment it was issued', () => {
    const { seed, token } = tokens.issue(NOW);
    const ticket = tokens.open(token);
    expect(ticket).toEqual({ id: expect.stringMatching(/^[\w-]{22}$/), seed, issuedAt: NOW });
    expect(v2.isSeed(seed)).toBe(true);
    // And it is a token the submit schema accepts, so an honest browser can always hand it back.
    expect(runTokenSchema.safeParse(token).success).toBe(true);
  });

  it('draws a fresh id and seed every time, from the CSPRNG', () => {
    const issued = Array.from({ length: 50 }, () => tokens.open(tokens.issue(NOW).token)!);
    expect(new Set(issued.map((t) => t.id)).size).toBe(50);
    expect(new Set(issued.map((t) => t.seed)).size).toBeGreaterThan(45);
  });

  it('carries the whole 32-bit seed range, top and bottom', () => {
    const pinned = (byte: number) =>
      createRunTokens(KEY, (n) => Buffer.alloc(n, byte)).issue(NOW).seed;
    expect(pinned(0x00)).toBe(0);
    expect(pinned(0xff)).toBe(2 ** 32 - 1);
  });

  it('holds nothing about the visitor and nothing of the key', () => {
    const { token } = tokens.issue(NOW);
    const payload = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString()) as object;
    expect(Object.keys(payload).sort()).toEqual(['id', 'issuedAt', 'seed']);
    expect(token).not.toContain('not-a-real-service-role-key');
    expect(token).not.toContain(KEY.toString('base64url'));
  });

  it('is derived from the service key, not equal to it, and changes with it', () => {
    expect(KEY).toHaveLength(32);
    expect(KEY.equals(signingKey('another-key'))).toBe(false);
    expect(KEY.equals(signingKey('not-a-real-service-role-key'))).toBe(true);
  });
});

describe('what a token will not open to', () => {
  const { token } = tokens.issue(NOW);
  const [payload, mac] = token.split('.') as [string, string];

  it.each([
    ['a token signed with another key', createRunTokens(signingKey('guessed')).issue(NOW).token],
    [
      'a payload edited under the same signature',
      `${b64('{"id":"x","seed":7,"issuedAt":0}')}.${mac}`,
    ],
    ['a signature cut short', `${payload}.${mac.slice(0, 20)}`],
    ['no signature at all', payload],
    ['an empty signature', `${payload}.`],
    ['a third segment', `${token}.${mac}`],
    ['nothing', ''],
  ])('%s', (_name, forged) => {
    expect(tokens.open(forged)).toBeNull();
  });
});
