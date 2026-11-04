import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export interface ClassYear { id: string; label: string; session: string; current: boolean; outcome: string }

/** A student's class years (current + earlier), newest first. `null` while loading, `[]` for staff or on error. */
export function useClassYears(enabled: boolean): ClassYear[] | null {
  const [years, setYears] = useState<ClassYear[] | null>(enabled ? null : []);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api.get<ClassYear[]>("/academics/my-classes/").then((r) => alive && setYears(r), () => alive && setYears([]));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return years;
}

/** `?school_class=…` for an EARLIER year; empty for the current class (the server's default). */
export const yearQuery = (years: ClassYear[] | null, pick: string) => {
  const y = years?.find((x) => x.id === pick);
  return y && !y.current ? `school_class=${y.id}` : "";
};
