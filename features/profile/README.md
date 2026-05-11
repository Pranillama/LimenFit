# features/profile

Profile feature: account info display, settings form, and sign-out coordination.

## Public API surface

Import from `@/features/profile` (the barrel). Do **not** import from sub-paths.

### Components

```ts
import { ProfileView, AccountInfo, SettingsForm } from '@/features/profile';
```

- **`ProfileView`** — top-level composition of Account section, Settings section, and Sign Out button. Rendered by `app/(app)/profile/page.tsx` inside a `PageContainer`.
- **`AccountInfo`** — displays the signed-in email address. Server-friendly (no client hooks).
- **`SettingsForm`** — weight-unit toggle and rest-timer-default input. Optimistic mutations backed by `useUpdateSettingsMutation`.

### Hooks

```ts
import { useUpdateSettingsMutation } from '@/features/profile';
```

TanStack Query `useMutation` that PATCHes `/api/settings`. Applies optimistic updates to the active-workout store and rolls back on error.

## Settings flow

1. User changes weight unit or rest timer → `mutation.mutate(patch)`.
2. `onMutate` snapshots the store and calls `setUserSettings(patch)` (optimistic).
3. On success, `onSuccess` applies the canonical server row back to the store.
4. On error, `onError` rolls back to the snapshot and shows a toast.

## Sign-out cleanup contract

`SignOutButton` (`app/(app)/profile/sign-out-button.tsx`) performs a full client wipe before handing off to the server action:

1. `useActiveWorkoutStore.getState().resetStore()` — resets all workout + settings state to defaults (keeps `hydrated: true`).
2. `useActiveWorkoutStore.persist.clearStorage()` — removes the persisted localStorage key.
3. `queryClient.clear()` — evicts all TanStack Query caches.
4. `clearPendingDuplicate()` — removes the plan-duplicate session storage entry.
5. `toast.dismiss('persistence-degraded')` — dismisses any sticky storage-warning toast.
6. `signOut()` server action — Supabase sign-out + redirect to `/auth`.
