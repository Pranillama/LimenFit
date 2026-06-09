export const AVATAR_BUCKET = 'avatars';

/** Square display size we downscale/crop avatars to before upload. */
export const AVATAR_SIZE_PX = 512;

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Storage object path for a user's avatar. Fixed name → replacing overwrites. */
export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar.webp`;
}

export type AvatarValidation = { ok: true } | { ok: false; error: string };

/** Validates an upload candidate by MIME type and byte size. */
export function validateAvatarFile(file: Pick<File, 'type' | 'size'>): AvatarValidation {
  if (!ACCEPTED_AVATAR_TYPES.includes(file.type as (typeof ACCEPTED_AVATAR_TYPES)[number])) {
    return { ok: false, error: 'Use a PNG, JPEG, or WebP image.' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: 'Image must be under 5 MB.' };
  }
  return { ok: true };
}
