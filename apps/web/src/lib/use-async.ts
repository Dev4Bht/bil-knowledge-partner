"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

type Result<T> = { key: string; data?: T; error?: ApiError };

/**
 * Loads data whenever `key` changes (or `reload` is called). Keeps the previous data while reloading so
 * lists do not flash empty. `loading` is true until a result for the current key has arrived.
 */
export function useAsync<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const fullKey = key === null ? null : `${key}#${nonce}`;

  useEffect(() => {
    if (fullKey === null) return;
    const controller = new AbortController();
    loadRef
      .current(controller.signal)
      .then((data) => setResult({ key: fullKey, data }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setResult({
          key: fullKey,
          error: error instanceof ApiError ? error : new ApiError(0, "unknown", "Something went wrong. Please try again."),
        });
      });
    return () => controller.abort();
  }, [fullKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const settled = result !== null && result.key === fullKey;
  return {
    data: result?.data,
    error: settled ? result.error : undefined,
    loading: fullKey !== null && !settled,
    reload,
  };
}
