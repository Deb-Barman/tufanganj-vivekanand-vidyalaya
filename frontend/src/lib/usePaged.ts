import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { Paginated } from "../types/api";

/** Loads a public paginated list; `more()` fetches the next page. `data === null` means "still loading" (show a skeleton). */
export function usePaged<T>(path: string, pageSize = 12) {
  const [data, setData] = useState<T[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const sep = path.includes("?") ? "&" : "?";
    api
      .get<Paginated<T> | T[]>(`${path}${sep}page_size=${pageSize}`, { auth: false })
      .then((res) => {
        if (!alive.current) return;
        if (Array.isArray(res)) setData(res);
        else {
          setData(res.results);
          setNext(res.next ? res.next.slice(res.next.indexOf("/api/") + 4) : null);
        }
      })
      .catch((e) => alive.current && (setError(e instanceof ApiError ? e.message : "Could not load this right now."), setData([])));
    return () => {
      alive.current = false;
    };
  }, [path, pageSize]);

  const more = useCallback(async () => {
    if (!next || busy) return;
    setBusy(true);
    try {
      const res = await api.get<Paginated<T>>(next, { auth: false });
      setData((d) => [...(d ?? []), ...res.results]);
      setNext(res.next ? res.next.slice(res.next.indexOf("/api/") + 4) : null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load more.");
    } finally {
      setBusy(false);
    }
  }, [next, busy]);

  return { data, error, more, hasMore: next !== null, busy };
}

export const fmtLong = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
export const fmtDay = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return { day: d.getDate(), mon: d.toLocaleDateString("en-IN", { month: "short" }), year: d.getFullYear() };
};
