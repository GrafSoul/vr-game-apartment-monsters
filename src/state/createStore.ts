import { useSyncExternalStore } from 'react';

/** A tiny external store: read in useFrame with `get`, subscribe React components with `use`. */
export interface Store<T> {
  get: () => T;
  set: (patch: Partial<T> | ((state: T) => Partial<T>)) => void;
  /** The selector must return a primitive or an existing reference, never a new object. */
  use: <U>(selector: (state: T) => U) => U;
}

/** Creates a store with shallow-merge updates. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      listeners.forEach((listener) => listener());
    },
    use: (selector) => useSyncExternalStore(subscribe, () => selector(state)),
  };
}
