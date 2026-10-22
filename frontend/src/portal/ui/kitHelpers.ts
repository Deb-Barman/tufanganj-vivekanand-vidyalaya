import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Paginated } from "../../types/api";

/* ───────────── data helpers ───────────── */

/** Fetch every page of a list endpoint (the API caps a page at 200 rows). */
export async function listAll<T>(path: string): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  let url: string | null = `${path}${sep}page_size=200`;
  const out: T[] = [];
  for (let i = 0; i < 25 && url; i++) {
    const page: Paginated<T> = await api.get<Paginated<T>>(url);
    out.push(...page.results);
    // `next` is an absolute URL; keep only the part after /api so api.get can re-prefix it.
    url = page.next ? page.next.slice(page.next.indexOf("/api/") + 4) : null;
  }
  return out;
}

export function errText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
/** "14:05:00" -> "2:05 PM" */
export const fmtTime = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
export const todayISO = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd in local time

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Animates a number from 0 up to `target` once. Respects reduced-motion. */
export function useCountUp(target: number, ms = 900, decimals = 0): number {
  const factor = 10 ** decimals;
  const [val, setVal] = useState(0);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3)) * factor) / factor);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced, factor]);
  return reduced ? target : val;
}


/* ───────────── toast / confirm context ───────────── */

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}
export interface UIContextValue {
  toast: (kind: Toast["kind"], text: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

export const UIContext = createContext<UIContextValue | undefined>(undefined);

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside <UIProvider>");
  return ctx;
}

/** "Class XI Science · 2026" — the session label disambiguates the same class across years. */
export function classLabel(c: { name: string; stream: string; session: string }, sessions: { id: string; label: string }[]): string {
  const sess = sessions.find((s) => s.id === c.session);
  return `${c.name}${c.stream ? " " + c.stream : ""}${sess ? " · " + sess.label : ""}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
export const todayLong = () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const firstName = (n: string) => n.trim().split(/\s+/)[0] || "there";
