import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { TeacherAttendance, TeacherSheetRow } from "../../types/api";
import { Avatar, DateField, EmptyState, Icon, PageHeader, Segmented, Select, Skeleton, StatusPill, errText, fmtDate, listAll, todayISO, useUI } from "../ui/kitExports";
import { PageLoading } from "../ui/PageLoading";

type Mark = "PRESENT" | "ABSENT";
const SUB = "Take the teachers' attendance the same way as a class: pick a date, tap P or A for each teacher, then save once.";

/** Super Admin → "Teachers" tab of Attendance: mark the staff register, and review / correct saved days. */
export function TeacherAttendanceAdmin() {
  const [view, setView] = useState<"mark" | "records">("mark");
  return (
    <>
      <div className="toolbar" style={{ marginBottom: 6 }}>
        <Segmented value={view} onChange={setView} options={[{ value: "mark", label: "Take attendance" }, { value: "records", label: "Teacher records" }]} />
      </div>
      {view === "mark" ? <MarkTeachers /> : <TeacherRecords />}
    </>
  );
}

/* ───────────── take the register ───────────── */

function MarkTeachers() {
  const { toast } = useUI();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<TeacherSheetRow[] | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [saved, setSaved] = useState<Record<string, Mark>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const res = await api.get<{ date: string; teachers: TeacherSheetRow[] }>(`/academics/teacher-attendance/sheet/?date=${date}`);
      const existing: Record<string, Mark> = {};
      res.teachers.forEach((t) => t.status && (existing[t.teacher] = t.status));
      setRows(res.teachers);
      setMarks(existing);
      setSaved(existing);
    } catch (e) {
      toast("error", errText(e, "Could not load the teachers."));
      setRows([]);
    }
  }, [date, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const tally = useMemo(() => {
    const vals = Object.values(marks);
    const present = vals.filter((v) => v === "PRESENT").length;
    return { present, absent: vals.length - present, marked: vals.length };
  }, [marks]);
  const dirty = useMemo(() => JSON.stringify(marks) !== JSON.stringify(saved), [marks, saved]);
  const total = rows?.length ?? 0;

  async function save() {
    if (tally.marked === 0) return;
    setSaving(true);
    try {
      const records = Object.entries(marks).map(([teacher, status]) => ({ teacher, status }));
      await api.post("/academics/teacher-attendance/bulk/", { date, records });
      setSaved({ ...marks });
      toast("success", `Attendance saved for ${records.length} ${records.length === 1 ? "teacher" : "teachers"}.`);
    } catch (e) {
      toast("error", errText(e, "Could not save attendance."));
    } finally {
      setSaving(false);
    }
  }

  const setAll = (status: Mark) => rows && setMarks(Object.fromEntries(rows.map((t) => [t.teacher, status])));

  if (rows === null && Object.keys(marks).length === 0) return <PageLoading icon="checkCircle" title="Teacher attendance" sub={SUB} rows={4} />;

  return (
    <>
      <PageHeader icon="checkCircle" title="Teacher attendance" sub={SUB} />
      <div className="toolbar">
        <div className="field-inline" style={{ flex: "1 1 200px", maxWidth: 320 }}>
          <label htmlFor="taDate">Date</label>
          <DateField id="taDate" value={date} max={todayISO()} required onChange={(v) => v && setDate(v)} />
        </div>
      </div>

      {rows === null ? (
        <Skeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState icon="users" title="No active teachers yet" text="Create Teacher accounts from the Accounts page, then take their attendance here." />
      ) : (
        <>
          <div className="toolbar">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setAll("PRESENT")}>
              <Icon name="check" size={15} /> Everyone present
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMarks({})}>Clear</button>
          </div>
          <div className="sheet">
            {rows.map((t, i) => {
              const m = marks[t.teacher];
              return (
                <div key={t.teacher} className={`sheet-row ${m === "PRESENT" ? "is-present" : m === "ABSENT" ? "is-absent" : ""}`}>
                  <span className="roll">{i + 1}</span>
                  <span className="name">{t.full_name}{t.department ? <small style={{ display: "block", color: "var(--fg-faint)", fontWeight: 600 }}>{t.department}</small> : null}</span>
                  <div className="pa" role="group" aria-label={`Attendance for ${t.full_name}`}>
                    <button type="button" className={`p ${m === "PRESENT" ? "on" : ""}`} aria-pressed={m === "PRESENT"} onClick={() => setMarks({ ...marks, [t.teacher]: "PRESENT" })}>P</button>
                    <button type="button" className={`a ${m === "ABSENT" ? "on" : ""}`} aria-pressed={m === "ABSENT"} onClick={() => setMarks({ ...marks, [t.teacher]: "ABSENT" })}>A</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sticky-save">
            <div className="tally">
              <span><b>{tally.present}</b> present</span>
              <span><b>{tally.absent}</b> absent</span>
              <span><b>{total - tally.marked}</b> unmarked</span>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || tally.marked === 0 || !dirty}>
              {saving ? "Saving…" : dirty ? "Save attendance" : "Saved ✓"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

/* ───────────── review / correct saved days ───────────── */

function TeacherRecords() {
  const { toast, confirm } = useUI();
  const [teachers, setTeachers] = useState<TeacherSheetRow[]>([]);
  const [teacher, setTeacher] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<TeacherAttendance[] | null>(null);

  useEffect(() => {
    api.get<{ teachers: TeacherSheetRow[] }>("/academics/teacher-attendance/sheet/").then((r) => setTeachers(r.teachers)).catch(() => setTeachers([]));
  }, []);

  const load = useCallback(async () => {
    setItems(null);
    try {
      const p = new URLSearchParams();
      if (teacher) p.set("teacher", teacher);
      if (date) p.set("date", date);
      setItems(await listAll<TeacherAttendance>(`/academics/teacher-attendance/?${p}`));
    } catch (e) {
      toast("error", errText(e, "Could not load the records."));
      setItems([]);
    }
  }, [teacher, date, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  async function flip(r: TeacherAttendance) {
    const status = r.status === "PRESENT" ? "ABSENT" : "PRESENT";
    try {
      await api.patch(`/academics/teacher-attendance/${r.id}/`, { status });
      setItems((prev) => prev?.map((x) => (x.id === r.id ? { ...x, status } : x)) ?? prev);
      toast("success", `Marked ${status === "PRESENT" ? "present" : "absent"}.`);
    } catch (e) {
      toast("error", errText(e, "Could not change it."));
    }
  }

  async function remove(r: TeacherAttendance) {
    if (!(await confirm({ title: "Delete this record?", message: `${r.teacher_name} — ${fmtDate(r.date)} will be removed.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/academics/teacher-attendance/${r.id}/`);
      setItems((prev) => prev?.filter((x) => x.id !== r.id) ?? prev);
      toast("success", "Deleted.");
    } catch (e) {
      toast("error", errText(e, "Could not delete."));
    }
  }

  const present = items?.filter((i) => i.status === "PRESENT").length ?? 0;

  return (
    <>
      <PageHeader icon="clock" title="Teacher records" sub="Find a saved day, correct it or delete it." />
      <div className="toolbar">
        <div className="field-inline" style={{ flex: "1 1 220px" }}>
          <label htmlFor="trTeacher">Teacher</label>
          <Select id="trTeacher" searchable value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            <option value="">All teachers</option>
            {teachers.map((t) => <option key={t.teacher} value={t.teacher}>{t.full_name}</option>)}
          </Select>
        </div>
        <div className="field-inline" style={{ flex: "1 1 180px" }}>
          <label htmlFor="trDate">Date (optional)</label>
          <DateField id="trDate" value={date} max={todayISO()} placeholder="Any date" onChange={setDate} />
        </div>
      </div>

      {items === null ? (
        <Skeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState icon="inbox" title="No records found" text="Teacher attendance you save will be listed here." />
      ) : (
        <>
          <p className="tabs-note" style={{ margin: "0 2px 10px" }}>{items.length} record{items.length === 1 ? "" : "s"} · {present} present · {items.length - present} absent</p>
          <div className="list">
            {items.map((r) => (
              <div key={r.id} className="row-link">
                <Avatar name={r.teacher_name} size={40} />
                <span className="row-main"><strong>{r.teacher_name}</strong><span>{fmtDate(r.date)}</span></span>
                <StatusPill tone={r.status === "PRESENT" ? "good" : "bad"}>{r.status === "PRESENT" ? "Present" : "Absent"}</StatusPill>
                <button type="button" className="icon-btn" onClick={() => flip(r)} aria-label={`Mark ${r.status === "PRESENT" ? "absent" : "present"}`} title={`Change to ${r.status === "PRESENT" ? "absent" : "present"}`}><Icon name="refresh" size={17} /></button>
                <button type="button" className="icon-btn danger" onClick={() => remove(r)} aria-label="Delete record"><Icon name="trash" size={17} /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
