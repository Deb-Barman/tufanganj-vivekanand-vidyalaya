import { useCallback, useEffect, useState } from "react";

export interface Load<T> {
  /** `null` until the first successful load. */
  data: T | null;
  /** "loading" → show a skeleton; "error" → show a Try-again state (never a fake empty list). */
  status: "loading" | "ok" | "error";
  reload: () => void;
}

/**
 * Loads data for one dashboard panel. Unlike `.catch(() => setX([]))`, a failed request is
 * reported as an error (so the panel can offer "Try again") instead of pretending there is nothing to show.
 * `loader` must be stable per mount (it runs once, then again on `reload()`).
 */
export function useLoad<T>(loader: () => Promise<T>): Load<T> {
  const [state, setState] = useState<{ data: T | null; status: Load<T>["status"] }>({ data: null, status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    loader().then(
      (data) => alive && setState({ data, status: "ok" }),
      () => alive && setState((s) => ({ data: s.data, status: "error" })),
    );
    return () => {
      alive = false;
    };
    // `loader` is an inline arrow that never changes meaning; only `tick` (reload) should re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const reload = useCallback(() => {
    setState((s) => ({ data: s.data, status: "loading" }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, reload };
}
