# features/workout

Active-workout feature: store, sync engine, hydration, and shell integration.

## Public API surface

Import from `@/features/workout` (the barrel). Do **not** import from sub-paths.

### Store hook

```ts
import { useActiveWorkoutStore } from '@/features/workout';
```

Zustand bound store with `.persist` API (see `stores/createStore.ts`). Carries the full
`ActiveWorkoutStoreState` — draft metadata, exercises, queued mutations, sync state.

### Starting a workout (T10 / T12 / T14 entry points)

```ts
import { useStartWorkoutAction } from '@/features/workout';

const startWorkout = useStartWorkoutAction();

// Simple start (home / freestyle / plan)
await startWorkout({ source: 'home' });
await startWorkout({ source: 'plan', payload: { planWorkoutId: 'uuid' } });

// Restore an expired draft from history — blocked if an active draft exists
const result = await startWorkout({ source: 'history-restore' });
if (result?.blocked) {
  // result.reason === 'active-draft-exists' — show the prescribed message (Flow 6 step 5)
}
```

`useStartWorkoutAction` drives the resume-or-discard dialog automatically when a draft
is already in progress, then navigates to `/train` on success.

### Selectors

```ts
import { selectHasActiveDraft, selectActiveDraftMeta, selectSyncBadge } from '@/features/workout';
```

Pass to `useActiveWorkoutStore(selector)` for fine-grained subscriptions.

### Server hydration

`ActiveWorkoutRuntime` (mounted once inside `AppShell`) calls `hydrateActiveWorkout`
on mount. It queries Supabase for an `in_progress` workout when no local draft is found,
maps the row into store shape with all `serverId` fields populated, and calls
`store.hydrateFromServer(snapshot)`. Local draft always wins (prefer-local-draft rule,
Flow 3 step 1).

For the matching server-side idempotency contract see **T7** (`lib/idempotency`).

### Resume-or-discard dialog

`ResumeOrDiscardDialog` is a controlled dialog mounted once in `AppShell` (via
`ActiveWorkoutRuntime`). It is driven by the `resumeCoordinator` event bus — consumers
never render it directly. Three actions: **Resume current workout** /
**Discard current workout and start a new one** (label varies by intent source) /
**Cancel**. Wording follows spec:Core Flows — LimenFit Phase 1, Flow 3 step 1.

### Discard confirmation for cancel-with-unsaved-work flows

Use `DiscardConfirmationDialog` from `@/components/discard-confirmation-dialog` for any
other cancel-with-unsaved-work flow (two-button modal, controlled `open` state).

## Active Workout Session UI

### TrainPageShell state machine

`TrainPageShell` is the top-level router for `/train`. It reads `hydrated` and `meta` from
the store and renders one of four branches:

| Condition | Rendered |
|-----------|----------|
| `!hydrated` | `<PageSkeleton />` |
| `meta === null` | `<StartWorkoutEmptyState />` |
| `meta.status === 'in_progress'` | `<ActiveWorkoutSession />` |
| `meta.status === 'completed_local' \| 'completed_synced'` | `<EndWorkoutSummary onResume={() => {}} />` |

No `router.push` is needed — the user is already on `/train`, and the store drives the view.

### In-progress session view transitions

`ActiveWorkoutSession` owns a local `view` state (`'session' | 'summary'`). Pressing
**End Workout** in the header transitions to `'summary'`, rendering `<EndWorkoutSummary
onResume={() => setView('session')} />`. Pressing **Resume Workout** in the summary flips
back to `'session'`.

Once the user confirms **Save**, `endWorkout({ name })` sets `meta.status` to
`'completed_local'` and enqueues a `workout.patch`. `ActiveWorkoutSession` unmounts
immediately (the shell's `in_progress` branch no longer matches) and `TrainPageShell`
takes over, rendering `EndWorkoutSummary` directly from the `completed_local` branch.

### Post-save auto-clear behaviour

After `endWorkout()` the session goes through two states:

1. **`completed_local`** — saved to localStorage, `workout.patch` is in the queue. The
   summary shows "Saved locally — finishing sync…". No action buttons are shown.
2. **`completed_synced`** — `recordSyncResult` transitions status once the queue drains
   with no error, and `selectShouldAutoClear` becomes true. The `useCompletionCleanup`
   hook (mounted in `ActiveWorkoutRuntime`) calls `clearCompletedSession()` which resets
   `meta` to `null`. `TrainPageShell` then renders `<StartWorkoutEmptyState />`.

The user can also press **Done** (visible only in `completed_synced`) to call
`clearCompletedSession()` immediately, bypassing the auto-clear timer.

If the page is refreshed while status is `completed_local` or `completed_synced`, the
`TrainPageShell` `completed_local | completed_synced` branch lands the user directly on
the summary without needing to replay the in-progress session. `useCompletionCleanup`
re-subscribes on mount and fires `clearCompletedSession()` as soon as the queue drains.

See also: spec:Core Flows — LimenFit Phase 1, Flow 3 (prefer-local-draft) and Flow 4b
(end-of-session summary and save).
