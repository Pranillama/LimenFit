import { describe, it, expect } from 'vitest';
import { UUID_RE } from '../index';

describe('UUID_RE', () => {
  it('accepts a valid v4 UUID', () => {
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts uppercase v4 UUID', () => {
    expect(UUID_RE.test('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(UUID_RE.test('')).toBe(false);
  });

  it('rejects a plain string', () => {
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
  });

  it('rejects a v3 UUID (version digit 3)', () => {
    expect(UUID_RE.test('550e8400-e29b-31d4-a716-446655440000')).toBe(false);
  });

  it('rejects a UUID with wrong variant bits', () => {
    expect(UUID_RE.test('550e8400-e29b-41d4-0716-446655440000')).toBe(false);
  });

  it('rejects a UUID missing hyphens', () => {
    expect(UUID_RE.test('550e8400e29b41d4a716446655440000')).toBe(false);
  });
});
