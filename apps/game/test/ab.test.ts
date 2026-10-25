import { describe, expect, it } from 'vitest';
import { readVariants, TESTS, variantTag } from '../src/ab';

describe('A/B variants come from the address, checked', () => {
  it('gives every test its first variant with no parameter: what ships', () => {
    expect(readVariants('')).toEqual({
      landing: 'art',
      results: 'below',
      start: 'two',
      post: 'one',
    });
  });
  it('takes a known variant for a known test', () => {
    const v = readVariants('?landing=forest&results=above&start=one&post=two');
    expect(v).toEqual({ landing: 'forest', results: 'above', start: 'one', post: 'two' });
  });
  it('ignores unknown variants, unknown tests and repeated keys', () => {
    const v = readVariants('?landing=wolf&results=above&results=below&colour=red');
    expect(v).toEqual({ landing: 'art', results: 'below', start: 'two', post: 'one' });
  });
  it('tags an event with every test in a fixed order', () => {
    expect(variantTag(readVariants('?post=two'))).toBe(
      'landing:art,results:below,start:two,post:two',
    );
    expect(Object.keys(TESTS)).toEqual(['landing', 'results', 'start', 'post']);
  });
});
