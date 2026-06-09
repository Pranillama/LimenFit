import { describe, it, expect } from 'vitest';

import {
  ACCEPTED_AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  avatarObjectPath,
  validateAvatarFile,
} from '../avatar';

describe('avatarObjectPath', () => {
  it('builds a per-user object path with a fixed webp name', () => {
    expect(avatarObjectPath('user-123')).toBe('user-123/avatar.webp');
  });
});

describe('validateAvatarFile', () => {
  it('accepts an allowed type within the size limit', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1024 })).toEqual({ ok: true });
    for (const type of ACCEPTED_AVATAR_TYPES) {
      expect(validateAvatarFile({ type, size: 1024 }).ok).toBe(true);
    }
  });

  it('rejects a disallowed type', () => {
    const result = validateAvatarFile({ type: 'image/gif', size: 1024 });
    expect(result.ok).toBe(false);
  });

  it('rejects a file over the size limit', () => {
    const result = validateAvatarFile({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 });
    expect(result.ok).toBe(false);
  });
});
