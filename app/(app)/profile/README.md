# app/(app)/profile

Profile page — implemented in Phase 1 (T15).

## Route

`/profile` — authenticated, inside the app shell.

## Layout

```
┌────────────────────────────────────────────────┐
│ Profile                                        │
├────────────────────────────────────────────────┤
│ Account                                        │
│   you@example.com                              │
│   Signed in                                    │
│                                                │
│ Settings                                       │
│   Weight unit                                  │
│     [ lbs | kg ]   ← Tabs segmented control    │
│                                                │
│   Default rest timer                           │
│     [   90   ] seconds                         │
│     Used when starting a new rest timer.       │
│                                                │
│ ─────────────────────────────────────────────  │
│ [   Sign Out   ]   ← destructive               │
└────────────────────────────────────────────────┘
```

## Files

| File | Role |
|------|------|
| `page.tsx` | Server component — fetches user + settings, renders `ProfileView` inside `PageContainer` |
| `sign-out-button.tsx` | Client component — full cleanup before sign-out (see below) |
| `actions.ts` | Server action — Supabase sign-out + redirect to `/auth` |

## Settings mutations

Settings changes go through `useUpdateSettingsMutation` (TanStack Query) which:
- Optimistically applies the patch to the active-workout store.
- PATCHes `/api/settings`.
- On success, re-applies the canonical server row.
- On error, rolls back to the pre-mutation snapshot and shows a toast.

## Sign-out cleanup contract

`SignOutButton` performs a full client wipe before the server action:

1. `useActiveWorkoutStore.getState().resetStore()` — resets all workout + settings state to initial defaults (`hydrated: true`).
2. `useActiveWorkoutStore.persist.clearStorage()` — removes the persisted localStorage key (`limenfit:active-workout:v1`).
3. `queryClient.clear()` — evicts all TanStack Query caches (exercises library, workout-detail, plans, etc.).
4. `clearPendingDuplicate()` — removes the plan-duplicate `sessionStorage` entry.
5. `toast.dismiss('persistence-degraded')` — dismisses any sticky storage-warning toast.
6. `signOut()` server action — Supabase sign-out + `redirect('/auth')`.

## Out of scope (Phase 2/3)

Theme toggle, units beyond lbs/kg, AI preferences.
