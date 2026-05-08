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
