import { QueryClient } from "@tanstack/react-query";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

const CACHE_KEY = "hmd-query-cache-v1";

/**
 * Cache lives in IndexedDB, not localStorage: it survives a reload, is read
 * off the main thread, and has room for the whole rundown plus guest list.
 * On a slow connection the guest sees the last known data instantly while the
 * refetch happens behind it.
 */
export const persister: Persister = {
  persistClient: (client: PersistedClient) => set(CACHE_KEY, client),
  restoreClient: () => get<PersistedClient>(CACHE_KEY),
  removeClient: () => del(CACHE_KEY),
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * "offlineFirst": serve the cached value, try the network once, and keep
       * the cached value if it fails. This is what keeps the app usable on the
       * venue wifi instead of showing a spinner forever.
       */
      networkMode: "offlineFirst",
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 20_000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      /** Paused while offline, then replayed in order once the network is back. */
      networkMode: "offlineFirst",
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 20_000),
    },
  },
});
