'use client';

import { Loader2, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

import {
  ACCEPTED_AVATAR_TYPES,
  AVATAR_BUCKET,
  AVATAR_SIZE_PX,
  avatarObjectPath,
  validateAvatarFile,
} from '../lib/avatar';
import { Avatar } from './Avatar';

/** Persist (or clear) the avatar URL on the profile. */
async function patchAvatarUrl(avatarUrl: string | null): Promise<void> {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarUrl }),
  });
  if (!res.ok) throw new Error(`Profile update failed (HTTP ${res.status})`);
}

/** Center-crop to a square and downscale to AVATAR_SIZE_PX, encoded as webp. */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))),
      'image/webp',
      0.9,
    );
  });
}

export interface AvatarUploaderProps {
  userId: string;
  avatarUrl: string | null;
  initials: string;
}

export function AvatarUploader({ userId, avatarUrl, initials }: AvatarUploaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;

    const check = validateAvatarFile(file);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }

    setBusy(true);
    try {
      const blob = await toSquareWebp(file);
      const supabase = createSupabaseBrowserClient();
      const path = avatarObjectPath(userId);

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;

      await patchAvatarUrl(url);
      router.refresh();
      toast.success('Photo updated');
    } catch {
      toast.error('Could not upload photo. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setMenuOpen(false);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.storage.from(AVATAR_BUCKET).remove([avatarObjectPath(userId)]);
      await patchAvatarUrl(null);
      router.refresh();
      toast.success('Photo removed');
    } catch {
      toast.error('Could not remove photo. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Avatar avatarUrl={avatarUrl} initials={initials} size={56} />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AVATAR_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={busy}
        aria-label="Change profile photo"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn(
          'absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-secondary text-muted-foreground transition-colors',
          'hover:text-brand-foreground hover:bg-brand disabled:cursor-not-allowed',
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
      </button>

      {menuOpen && !busy ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              fileInputRef.current?.click();
            }}
            className="flex w-full items-center rounded-[0.3rem] px-3 py-2 text-left text-sm hover:bg-accent"
          >
            {avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {avatarUrl ? (
            <button
              type="button"
              role="menuitem"
              onClick={handleRemove}
              className="flex w-full items-center rounded-[0.3rem] px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
