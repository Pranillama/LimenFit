# Stores registry

All Zustand stores are created via `createAppStore` from `./createStore`. This factory enforces a consistent middleware order across all stores: `devtools(persist(initializer))`. Devtools are automatically disabled in production (statically inlined by Next.js). Persistence is opt-in — pass a `persistConfig` object with at minimum a `name` string; stores that omit it never touch localStorage. Immer is not installed in this phase; mutate state via object spread or the Zustand setter pattern.

## Owned stores

| Store                   | Ticket                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `useActiveWorkoutStore` | T6 — ticket:75146556-4dd0-418c-9f5e-1d0fc95d0981/6a59f852-8841-4a91-9307-c4869acbbb00  |
| Settings client wiring  | T15 — ticket:75146556-4dd0-418c-9f5e-1d0fc95d0981/7141e09e-62ad-4c3c-96df-1fe6fd9df4b2 |
