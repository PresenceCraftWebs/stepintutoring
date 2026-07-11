import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tiny async-data hook used across pages: runs `fn` on mount (and when
 * `deps` change), exposes the value plus a `reload()` for pull-style
 * refreshes. Ignores results from stale invocations.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: readonly unknown[] = [],
): {
  value: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
} {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;
    setLoading(true);
    setError(undefined);
    fn().then(
      (v) => {
        if (runId.current === id) {
          setValue(v);
          setLoading(false);
        }
      },
      (e: unknown) => {
        if (runId.current === id) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { value, error, loading, reload };
}
