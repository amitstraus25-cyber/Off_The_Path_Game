import { describe, expect, it } from 'vitest';
import { VERDICTS } from '../src/index';

describe('core smoke', () => {
  it('exposes the three verdicts in order', () => {
    expect(VERDICTS).toEqual(['allow', 'restrict', 'reject']);
  });
});
