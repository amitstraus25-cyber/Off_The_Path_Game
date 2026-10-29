import { describe, expect, it } from 'vitest';
import { v2 } from '@otp/core';
import { handleScore, handleStart } from '../src/handlers.ts';
import { createWriteBudget } from '../src/limit.ts';
import { CONFIG, T0, TOKENS, harness, noStore, postScore } from './fake.ts';
import { claimedMs, runOf } from './helpers.ts';

/*
 * POST /api/start: a seed the server drew, sealed with the moment it drew it. Nothing is stored.
 */

const start = (headers: Record<string, string> = { 'content-type': 'application/json' }): Request =>
  new Request('https://off-the-path.test/api/start', { method: 'POST', headers, body: '{}' });

describe('POST /api/start', () => {
  it('issues a seed and a token that seals that seed and this moment', async () => {
    const h = harness();
    const res = handleStart(start(), h.deps);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { seed: number; token: string };
    // A seed and a token, and nothing else: no `emailRequired` since the work email came out
    // (the client, 2026-10-29), so the game is never asked for an address.
    expect(Object.keys(body).sort()).toEqual(['seed', 'token']);
    expect(v2.isSeed(body.seed)).toBe(true);
    expect(TOKENS.open(body.token)).toMatchObject({ seed: body.seed, issuedAt: T0 });
    // Never cached: two visitors behind one cache must not share a run.
    expect(res.headers.get('cache-control')).toBe('no-store');
    // And nothing written, no cookie set, the key nowhere in the reply.
    expect(h.calls).toHaveLength(0);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(JSON.stringify(body)).not.toContain(CONFIG.serviceRoleKey);
  });

  it('starts a run the score route then takes, end to end', async () => {
    const h = harness();
    const { seed, token } = (await handleStart(start(), h.deps).json()) as {
      seed: number;
      token: string;
    };
    const log = v2.toRunLog(runOf('careful', seed));
    h.clock.now += claimedMs(log) + 20_000;

    const res = await handleScore(postScore({ handle: 'brave-lantern-42', log, token }), h.deps);

    expect(res.status).toBe(200);
    expect(h.written()).toEqual({ handle: 'brave-lantern-42', score: 100 });
  });

  it('refuses every method but POST, and says which one it wanted', () => {
    // The discriminator: a GET here answering 405 proves the function is mounted.
    for (const method of ['GET', 'PUT', 'OPTIONS']) {
      const res = handleStart(
        new Request('https://off-the-path.test/api/start', { method }),
        noStore,
      );
      expect(res.status, method).toBe(405);
      expect(res.headers.get('allow'), method).toBe('POST');
    }
  });

  it('is same-origin only, and JSON only', () => {
    const h = harness();
    expect(
      handleStart(
        start({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }),
        h.deps,
      ).status,
    ).toBe(403);
    // A plain cross-origin form post or a bare fetch is not a run start.
    expect(handleStart(start({ 'content-type': 'text/plain' }), h.deps).status).toBe(415);
    // The media type is matched exactly: a JSON-looking parameter or suffix is not JSON.
    for (const type of ['text/plain;x=application/json', 'application/jsonx', 'x-application/json'])
      expect(handleStart(start({ 'content-type': type }), h.deps).status, type).toBe(415);
    // Parameters and case on the real type are fine.
    expect(
      handleStart(start({ 'content-type': 'Application/JSON; charset=utf-8' }), h.deps).status,
    ).toBe(200);
    expect(
      handleStart(
        start({ 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }),
        h.deps,
      ).status,
    ).toBe(200);
  });

  it('answers 503 when the service is not configured, so the game deals its own seed', () => {
    const res = handleStart(start(), noStore);
    expect(res.status).toBe(503);
  });

  it('sheds starts past its own budget, without touching the write budget', () => {
    const h = harness(undefined, { starts: createWriteBudget(1, 60_000, () => 0) });
    expect(handleStart(start(), h.deps).status).toBe(200);
    const shed = handleStart(start(), h.deps);
    expect(shed.status).toBe(429);
    expect(shed.headers.get('retry-after')).toBe('60');
    expect(h.deps.budget.take()).toBe(true);
  });
});
