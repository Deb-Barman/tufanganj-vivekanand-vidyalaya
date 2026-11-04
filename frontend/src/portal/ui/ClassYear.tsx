import { Select } from "./Select";
import type { ClassYear } from "./classYears";

/**
 * "Class year" drop-down for students who have been in more than one class. Old years stay readable: timetable, homework,
 * exams — everything the student had then. Hidden when there is only one year.
 */
export function ClassYearPicker({ years, value, onChange }: { years: ClassYear[] | null; value: string; onChange: (id: string) => void }) {
  if (!years || years.length < 2) return null;
  const current = years.find((y) => y.current) ?? years[0];
  return (
    <label className="field-inline" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-soft)" }}>Class year</span>
      <Select aria-label="Class year" value={value || current.id} onChange={(e) => onChange(e.target.value)} style={{ minWidth: 220 }}>
        {years.map((y) => <option key={y.id} value={y.id}>{y.label} · {y.session}{y.current ? " (now)" : ""}</option>)}
      </Select>
    </label>
  );
}
