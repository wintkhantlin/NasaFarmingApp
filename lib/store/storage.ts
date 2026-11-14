import { createStore, del, get, keys, set, type UseStore } from "idb-keyval";

/**
 * Storage the repositories talk to. IndexedDB in the browser; tests pass an
 * in-memory one. Values are plain JSON.
 */
export interface KeyValueStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

export function memoryStorage(): KeyValueStorage {
  const map = new Map<string, unknown>();
  return {
    async get(key) {
      const v = map.get(key);
      return v === undefined ? undefined : structuredClone(v);
    },
    async set(key, value) {
      map.set(key, structuredClone(value));
    },
    async del(key) {
      map.delete(key);
    },
    async keys(prefix = "") {
      return [...map.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
  };
}

let idbStore: UseStore | undefined;

/** Browser storage. Call only on the client. */
export function indexedDbStorage(): KeyValueStorage {
  idbStore ??= createStore("nasa-farming-app", "keyval");
  const store = idbStore;
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    async keys(prefix = "") {
      return (await keys(store)).map(String).filter((k) => k.startsWith(prefix)).sort();
    },
  };
}
