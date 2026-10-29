import { describe, expect, it } from 'vitest';
import { readVariants, TESTS, variantTag } from '../src/ab';

describe('A/B variants come from the address, checked', () => {
  it('gives every test its first variant with no parameter: what ships', () => {
    expect(readVariants('')).toEqual({
      landing: 'art',
      results: 'below',
      start: 'two',
    });
  });
  it('takes a known variant for a known test', () => {
    const v = readVariants('?landing=forest&results=above&start=one');
    expect(v).toEqual({ landing: 'forest', results: 'above', start: 'one' });
  });
  it('ignores unknown variants, unknown tests and repeated keys', () => {
    const v = readVariants('?landing=wolf&results=above&results=below&colour=red');
    expect(v).toEqual({ landing: 'art', results: 'below', start: 'two' });
  });
  it('tags an event with every test in a fixed order', () => {
    // `post`, the work email's two-step test, went with the work email (2026-10-29): a link that
    // still asks for it is an unknown test, and ignored.
    expect(variantTag(readVariants('?start=one&post=two'))).toBe(
      'landing:art,results:below,start:one',
    );
    expect(Object.keys(TESTS)).toEqual(['landing', 'results', 'start']);
  });
});
