import { useEffect, useState } from "react";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Runs `fetcher` whenever `key` changes; aborts stale requests so fast slider moves never race. */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, key: string, enabled = true): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: enabled });

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher(ctrl.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setState((s) => ({ ...s, error: err.message, loading: false }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return state;
}

/** Delays propagating fast-changing values (e.g. a slider) to avoid a request per pixel. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
