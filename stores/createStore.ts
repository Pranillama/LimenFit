/**
 * Factory for creating app-wide Zustand stores.
 * Middleware order: devtools(persist(initializer))
 * - devtools: applied in non-production only
 * - persist: opt-in via the `persistConfig` parameter; omitted for non-persistent stores
 */

import { create, type Mutate, type StateCreator, type StoreApi } from 'zustand';
import type { UseBoundStore } from 'zustand';
import { devtools, persist, type PersistOptions } from 'zustand/middleware';

export type { StateCreator, PersistOptions };

// Transparent alias — exposes the full PersistOptions surface (partialize, version,
// migrate, merge, skipHydration, …) while keeping the PersistConfig name for consumers.
export type PersistConfig<S, PersistedS = S> = PersistOptions<S, PersistedS>;

// Persisted store retains the .persist API augmentation Zustand adds at runtime.
type PersistedStore<S> = UseBoundStore<Mutate<StoreApi<S>, [['zustand/persist', unknown]]>>;

// Overload: no persist config — returns a plain bound store.
export function createAppStore<S>(
  initializer: StateCreator<S, [], []>,
): UseBoundStore<StoreApi<S>>;

// Overload: with persist config — returns a store augmented with .persist API.
export function createAppStore<S, PersistedS = S>(
  initializer: StateCreator<S, [], []>,
  persistConfig: PersistOptions<S, PersistedS>,
): PersistedStore<S>;

export function createAppStore<S>(
  initializer: StateCreator<S, [], []>,
  persistConfig?: PersistOptions<S>,
): UseBoundStore<StoreApi<S>> | PersistedStore<S> {
  if (persistConfig) {
    const persisted = persist(
      initializer as StateCreator<S, [], [['zustand/persist', unknown]]>,
      persistConfig,
    );
    if (process.env.NODE_ENV !== 'production') {
      return create<S>()(
        devtools(persisted, { name: persistConfig.name }),
      ) as unknown as PersistedStore<S>;
    }
    return create<S>()(persisted) as unknown as PersistedStore<S>;
  }

  if (process.env.NODE_ENV !== 'production') {
    return create<S>()(
      devtools(initializer as StateCreator<S, [], [['zustand/devtools', never]]>),
    ) as unknown as UseBoundStore<StoreApi<S>>;
  }

  return create<S>()(initializer);
}
