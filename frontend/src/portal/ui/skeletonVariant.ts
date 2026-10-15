import type { SkeletonVariant } from "./Skeletons";

/**
 * Shape of each dashboard page while it loads: toolbar or not, and which body skeleton.
 * Only used as a fallback when a page's code is still downloading (pages are normally preloaded, see
 * lib/routePreload.ts); keep in sync with what each module renders. `toolbar: "staff"` = shown to Teachers and
 * Super Admin but not to Students.
 */
interface Spec { variant: SkeletonVariant; rows: number; toolbar: boolean | "staff" }
const SPEC: Record<string, Spec> = {
  gallery: { variant: "grid", rows: 3, toolbar: true },
  notices: { variant: "cards", rows: 4, toolbar: true },
  messages: { variant: "cards", rows: 3, toolbar: true },
  accounts: { variant: "cards", rows: 4, toolbar: true },
  admissions: { variant: "cards", rows: 3, toolbar: true },
  students: { variant: "cards", rows: 4, toolbar: true },
  academics: { variant: "cards", rows: 4, toolbar: true },
  achievements: { variant: "cards", rows: 3, toolbar: false },
  teachers: { variant: "cards", rows: 3, toolbar: false },
  marksheets: { variant: "cards", rows: 3, toolbar: false },
  events: { variant: "list", rows: 4, toolbar: true },
  downloads: { variant: "list", rows: 3, toolbar: true },
  exams: { variant: "list", rows: 4, toolbar: true },
  timetable: { variant: "list", rows: 4, toolbar: true },
  homework: { variant: "list", rows: 4, toolbar: "staff" },
  attendance: { variant: "list", rows: 4, toolbar: "staff" },
  results: { variant: "list", rows: 4, toolbar: "staff" },
};

export function skeletonSpecFor(pathname: string, role?: string): { variant: SkeletonVariant; rows: number; toolbar: boolean } {
  const slug = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  const s = SPEC[slug] ?? { variant: "list" as const, rows: 4, toolbar: true };
  return { variant: s.variant, rows: s.rows, toolbar: s.toolbar === "staff" ? role !== "STUDENT" : s.toolbar };
}
