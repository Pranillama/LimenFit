# features/plan

Training plan feature components and logic. Implemented in T11, T12, T13.

## Delivery scope

**T11** ships only the server-side surface:
- `POST /api/plans`, `PATCH /api/plans/[id]`, `DELETE /api/plans/[id]` route handlers
- `lib/plans/importFromHistory.ts` — pure client/server function that converts a completed workout into a `planWorkoutDraftSchema`-compatible object the plan creation form (T12) can use directly
- `lib/plans/duplicate.ts` — server-only DB helper that reads a source plan via the `plans` + nested `plan_workouts`/`plan_exercises` select, then calls the `create_plan_with_children` RPC to produce a fresh copy owned by the target user

**T12** adds the actual plan creation/edit screens that consume the helpers above.

**T13** adds the `/plan/[slug]` public viewer and the `POST /api/plans/duplicate` route, which calls `duplicatePlanForUser` from `lib/plans/duplicate.ts`.

## lib/plans/ helpers

```
lib/plans/
  index.ts                  barrel re-export
  importFromHistory.ts      buildPlanWorkoutFromHistory(workout, position) → ImportedPlanWorkoutDraft
  duplicate.ts              duplicatePlanForUser(supabase, { sourcePlanId, targetUserId }) → { planId, shareSlug }
  __tests__/
    importFromHistory.test.ts
    duplicate.test.ts
```

`importFromHistory.ts` is a pure function — no DB access, safe to call from client or server. Its output satisfies `planWorkoutDraftSchema` from `lib/schemas/plan.ts`.

`duplicate.ts` calls `assertServerOnly()` at import time; it must not appear in browser bundles. The route handler (`POST /api/plans/duplicate`, T13) is responsible for authentication and passing `targetUserId = user.id`.

## UI conventions

Use `DiscardConfirmationDialog` from `@/components/discard-confirmation-dialog` for any cancel-with-unsaved-work flow (default focus on Keep Editing, two-button modal, controlled `open` state).

## T12: My Plans list + read-only detail

Adds the browsable plan surfaces. No editor yet (that's T13+).

### New files

```
features/plan/
  components/
    PlanList.tsx              Server/client-agnostic list of PlanRowDTO cards → /train/plans/[id]
    StartPlanWorkoutButton.tsx  'use client' — calls useStartWorkoutAction({ source: 'plan', … })
    DeletePlanButton.tsx       'use client' — DiscardConfirmationDialog → useDeletePlanMutation
  hooks/
    useDeletePlanMutation.ts   TanStack mutation: DELETE /api/plans/[id], invalidates ['plans']

app/(app)/train/plans/
  page.tsx                    Server Component — plans list with Create Plan link
  loading.tsx                 PageSkeleton wrapper
  [id]/
    page.tsx                  Server Component — plan detail (workouts + exercises + Start/Delete)
    loading.tsx               PageSkeleton wrapper
    edit/page.tsx             Placeholder — "Plan editor coming soon"
  new/page.tsx                Placeholder — "Plan editor coming soon"
```

### Key design decisions

- Exercise names are resolved server-side via `exercises(name)` join on `plan_exercises`, so the detail page is a pure Server Component with no client-only lookups.
- Active-draft conflicts are handled automatically via the shell-mounted `ResumeOrDiscardDialog`; `StartPlanWorkoutButton` calls `useStartWorkoutAction` and does not need its own conflict UI.
- `DeletePlanButton` closes the confirmation dialog immediately on confirm, runs the mutation in the background, and navigates on success — toast on error is handled by the mutation hook.

## T12: Plan editor

Adds the plan creation and editing surfaces.

### New files

```
features/plan/
  components/
    PlanEditor.tsx            'use client' — full editor shell (sticky header, name input,
                              workout list, Add Workout, dirty tracking, DiscardConfirmationDialog)
    PlanWorkoutEditor.tsx     'use client' — single workout block with drag handle, name input,
                              exercise list, + Add Exercises (ExercisePicker), Import from History stub
    PlanExerciseEditor.tsx    'use client' — drag handle, exercise name (via useExerciseLookup),
                              targetSets × targetReps inputs, remove button
  hooks/
    useCreatePlanMutation.ts  POST /api/plans; on success invalidates ['plans']
    useUpdatePlanMutation.ts  PATCH /api/plans/[id]; on success invalidates ['plans']
  lib/
    planEditorState.ts        Pure state helpers: addWorkout, removeWorkout, reorderWorkouts,
                              updateWorkoutName, addExercisesToWorkout, removeExercise,
                              reorderExercises, updateExerciseTargets, appendImportedWorkout,
                              toApiWorkouts (maps EditorWorkoutItem[] → PlanWorkoutDraft[])

app/(app)/train/plans/
  new/page.tsx                Server Component — renders <PlanEditor mode="create" />
  [id]/edit/page.tsx          Server Component — fetches plan, maps to InitialPlanState,
                              renders <PlanEditor mode="edit" initialPlan={…} />;
                              notFound() if plan not owned by current user
```

### State model

`EditorWorkoutItem` and `EditorExerciseItem` carry a `localId` (a `crypto.randomUUID()` string) used as React key and as the value for framer-motion `Reorder.Item`. When editing an existing plan the server row `id` is reused as the `localId` so drag handles are stable. The API payload is assembled by `toApiWorkouts()`, which sets `position` from the current array index; server IDs are not required in the request body since `update_plan_with_children` fully replaces child rows.

### Drag-to-reorder

Mirrors the `useDragControls` / `Reorder.Group` + `Reorder.Item` pattern from `features/workout/components/ExerciseCardList.tsx`. Workouts and exercises each maintain a local `localIds` state array that drives framer-motion ordering; on reorder the parent `workouts` state is updated via `reorderWorkouts` / `reorderExercises` helpers.

### Save validation

The **Save Plan** button is disabled until: plan name is non-empty, ≥ 1 workout exists, and every workout has a non-empty name with ≥ 1 exercise. This mirrors the `planCreateBodySchema` / `planWorkoutDraftSchema` `.min(1)` guards.

### Dirty tracking

`isDirty` is computed by comparing the current `name` + JSON-serialised `workouts` against a snapshot taken at mount. On Cancel: no-op exit if not dirty; `DiscardConfirmationDialog` (title "Discard plan?") otherwise.
