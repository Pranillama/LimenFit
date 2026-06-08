import { describe, it, expect } from 'vitest';

import { inToCm, cmToIn } from '../unitConversions';

describe('inToCm', () => {
  it('converts inches to centimetres, one decimal', () => {
    expect(inToCm(33)).toBe(83.8);
  });
});

describe('cmToIn', () => {
  it('converts centimetres to inches, one decimal', () => {
    expect(cmToIn(83.8)).toBe(33);
  });
});
