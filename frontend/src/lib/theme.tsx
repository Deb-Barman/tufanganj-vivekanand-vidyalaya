import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "tvv-theme";
const META_COLOR: Record<ResolvedTheme, string> = { dark: "#181b27", light: "#e4e7f0" };

interface ThemeContextValue {
  /** What the user picked: dark, light, or follow the device. */
  preference: ThemePreference;
  /** What is actually showing right now (system is resolved to dark/light). */
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  /** Cycles dark -> light -> system. Used by the header button. */
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* storage can be blocked (private mode) — fall through to default */
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyToDocument(pref: ThemePreference, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-pref", pref);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META_COLOR[resolved]);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  // Whether the *device* currently prefers dark. Only consulted while preference === "system".
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Derived during render — no effect/setState round trip needed.
  const resolved: ResolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* non-fatal: theme still applies for this session */
    }
    setPreferenceState(next);
  }, []);

  // Track the device setting live (e.g. phone flips to dark at sunset).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Sync the DOM (an external system) whenever the outcome changes.
  useEffect(() => {
    applyToDocument(preference, resolved);
  }, [preference, resolved]);

  const cycle = useCallback(() => {
    setPreference(preference === "dark" ? "light" : preference === "light" ? "system" : "dark");
  }, [preference, setPreference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, setPreference, cycle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
