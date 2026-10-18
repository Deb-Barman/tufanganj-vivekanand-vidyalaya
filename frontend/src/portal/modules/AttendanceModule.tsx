import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { AcademicSession, Attendance, SchoolClass, StudentProfile } from "../../types/api";
import { AttendanceRecords } from "./RecordsManager";
import { TeacherAttendanceAdmin } from "./TeacherAttendanceAdmin";
import { ImportButton } from "../ui/ImportButton";
import { EmptyState, Icon, PageHeader, Ring, Segmented, Skeleton, classLabel, errText, listAll, todayISO, useUI, Select, DateField } from "../ui/kitExports";
import { PageLoading } from "../ui/PageLoading";
import { dashPath } from "../ui/nav";

type Mark = "PRESENT" | "ABSENT";

export function AttendanceModule() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"mark" | "records" | "teachers" | "mine">("mark");
  const [rev, setRev] = useState(0); // bumped after an import so the lists reload
  if (!user) return null;
  if (user.role === "STUDENT") return <OwnAttendance url="/academics/attendance/" sub="Days recorded by your teachers." emptyText="It will appear here once your teacher marks it." />;
  const isAdmin = user.role === "SUPER_ADMIN";
  return (
    <>
      <div className="toolbar">
        {isAdmin ? (
          <>
            <Segmented value={tab} onChange={setTab} options={[{ value: "mark", label: "Mark a class" }, { value: "records", label: "Saved records" }, { value: "teachers", label: "Teachers" }]} />
            <ImportButton kind={tab === "teachers" ? "teacher_attendance" : "attendance"} label={tab === "teachers" ? "Import teacher attendance" : "Import attendance"} onDone={() => setRev((n) => n + 1)} />
          </>
        ) : (
          <Segmented value={tab} onChange={setTab} options={[{ value: "mark", label: "Mark a class" }, { value: "mine", label: "My attendance" }]} />
        )}
      </div>
      {tab === "teachers" && isAdmin ? <TeacherAttendanceAdmin key={rev} /> : tab === "records" && isAdmin ? <AttendanceRecords key={rev} /> : tab === "mine" && !isAdmin ? (
        <OwnAttendance url="/academics/teacher-attendance/" sub="Days recorded by the Super Admin." emptyText="It will appear here once the Super Admin takes your attendance." />
      ) : (
        <StaffAttendance key={rev} isAdmin={isAdmin} />
      )}
    </>
  );
}

/* ───────────── Staff: mark a whole class in one go ───────────── */

function StaffAttendance({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useUI();
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayISO());

  const [students, setStudents] = useState<StudentProfile[] | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [saved, setSaved] = useState<Record<string, Mark>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listAll<SchoolClass>("/academics/classes/"), listAll<AcademicSession>("/academics/sessions/")])
      .then(([c, s]) => {
        setClasses(c);
        setSessions(s);
        const current = s.find((x) => x.is_current);
        setClassId((c.find((x) => x.session === current?.id) ?? c[0])?.id ?? "");
      })
      .catch((e) => {
        toast("error", errText(e, "Could not load classes."));
        setClasses([]);
      });
  }, [toast]);

  const loadSheet = useCallback(async () => {
    if (!classId) return;
    setStudents(null);
    try {
      const [st, att] = await Promise.all([listAll<StudentProfile>(`/academics/students/?school_class=${classId}`), listAll<Attendance>(`/academics/attendance/?date=${date}&school_class=${classId}`)]);
      const existing: Record<string, Mark> = {};
      att.forEach((a) => (existing[a.student] = a.status));
      setStudents(st);
      setMarks(existing);
      setSaved(existing);
    } catch (e) {
      toast("error", errText(e, "Could not load the class."));
      setStudents([]);
    }
  }, [classId, date, toast]);

  useEffect(() => {
    // Data fetch on mount / when a filter changes: state is set after the awaited request, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    loadSheet();
  }, [loadSheet]);

  const tally = useMemo(() => {
    const vals = Object.values(marks);
    const present = vals.filter((v) => v === "PRESENT").length;
    return { present, absent: vals.length - present, marked: vals.length };
  }, [marks]);
  const dirty = useMemo(() => JSON.stringify(marks) !== JSON.stringify(saved), [marks, saved]);
  const total = students?.length ?? 0;

  async function save() {
    if (tally.marked === 0) return;
    setSaving(true);
    try {
      const records = Object.entries(marks).map(([student, status]) => ({ student, status }));
      await api.post("/academics/attendance/bulk/", { date, records });
      setSaved({ ...marks });
      toast("success", `Attendance saved for ${records.length} ${records.length === 1 ? "student" : "students"}.`);
    } catch (e) {
      toast("error", errText(e, "Could not save attendance."));
    } finally {
      setSaving(false);
    }
  }

  const setAll = (status: Mark) => students && setMarks(Object.fromEntries(students.map((s) => [s.user, status])));

  if (classes === null) return <PageLoading icon="checkCircle" title="Attendance" sub="Pick a class and a date, tap P or A for each student, then save once." rows={4} />;

  if (classes.length === 0)
    return (
      <>
        <PageHeader icon="checkCircle" title="Attendance" />
        <EmptyState
          icon="layers"
          title="No classes set up yet"
          text={isAdmin ? "Create a session and a class first, then assign students to it." : "Ask the Super Admin to set up classes and assign students."}
          action={isAdmin ? <Link className="btn btn-primary btn-sm" to={dashPath("academics")}>Set up classes</Link> : undefined}
        />
      </>
    );

  return (
    <>
      <PageHeader icon="checkCircle" title="Attendance" sub="Pick a class and a date, tap P or A for each student, then save once." />

      <div className="toolbar">
        <div className="field-inline" style={{ flex: "2 1 220px" }}>
          <label htmlFor="attClass">Class</label>
          <Select id="attClass" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c, sessions)}
              </option>
            ))}
          </Select>
        </div>
        <div className="field-inline" style={{ flex: "1 1 160px" }}>
          <label htmlFor="attDate">Date</label>
          <DateField id="attDate" value={date} max={todayISO()} required onChange={(v) => v && setDate(v)} />
        </div>
      </div>

      {students === null ? (
        <Skeleton rows={6} />
      ) : students.length === 0 ? (
        <EmptyState icon="cap" title="No students in this class" text={isAdmin ? "Assign students to this class from the Students page." : "The Super Admin needs to assign students to this class."} action={isAdmin ? <Link className="btn btn-primary btn-sm" to={dashPath("students")}>Open students</Link> : undefined} />
      ) : (
        <>
          <div className="toolbar">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setAll("PRESENT")}>
              <Icon name="check" size={15} /> Everyone present
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMarks({})}>
              Clear
            </button>
          </div>
          <div className="sheet">
            {students.map((s, i) => {
              const m = marks[s.user];
              return (
                <div key={s.user} className={`sheet-row ${m === "PRESENT" ? "is-present" : m === "ABSENT" ? "is-absent" : ""}`}>
                  <span className="roll">{s.roll_number || i + 1}</span>
                  <span className="name">{s.full_name}</span>
                  <div className="pa" role="group" aria-label={`Attendance for ${s.full_name}`}>
                    <button type="button" className={`p ${m === "PRESENT" ? "on" : ""}`} aria-pressed={m === "PRESENT"} onClick={() => setMarks({ ...marks, [s.user]: "PRESENT" })}>
                      P
                    </button>
                    <button type="button" className={`a ${m === "ABSENT" ? "on" : ""}`} aria-pressed={m === "ABSENT"} onClick={() => setMarks({ ...marks, [s.user]: "ABSENT" })}>
                      A
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sticky-save">
            <div className="tally">
              <span>
                <b>{tally.present}</b> present
              </span>
              <span>
                <b>{tally.absent}</b> absent
              </span>
              <span>
                <b>{total - tally.marked}</b> unmarked
              </span>
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

/* ───────────── Student / Teacher: my own attendance ───────────── */

type DayRecord = Pick<Attendance, "id" | "date" | "status">;

function OwnAttendance({ url, sub, emptyText }: { url: string; sub: string; emptyText: string }) {
  const [records, setRecords] = useState<DayRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No person filter is sent: the API scopes the caller to their own rows.
    listAll<DayRecord>(url).then(setRecords).catch((e) => {
      setError(errText(e, "Could not load your attendance."));
      setRecords([]);
    });
  }, [url]);

  const stats = useMemo(() => {
    const present = records?.filter((r) => r.status === "PRESENT").length ?? 0;
    const total = records?.length ?? 0;
    return { present, absent: total - present, total, pct: total ? Math.round((present / total) * 100) : 0 };
  }, [records]);

  const byMonth = useMemo(() => {
    const groups = new Map<string, DayRecord[]>();
    [...(records ?? [])].sort((a, b) => b.date.localeCompare(a.date)).forEach((r) => {
      const key = new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      groups.set(key, [...(groups.get(key) ?? []), r]);
    });
    return [...groups.entries()];
  }, [records]);

  return (
    <>
      <PageHeader icon="checkCircle" title="My attendance" sub={sub} />
      {error && <p className="alert alert-error">{error}</p>}
      {records === null ? (
        <Skeleton rows={3} />
      ) : records.length === 0 ? (
        <EmptyState icon="clock" title="No attendance recorded yet" text={emptyText} />
      ) : (
        <>
          <section className="panel">
            <div className="split">
              <Ring percent={stats.pct} label={`${stats.pct}%`} sub="present" tone={stats.pct >= 75 ? "good" : stats.pct >= 60 ? "warn" : "bad"} size={150} />
              <div className="split-text">
                <span>
                  <b>{stats.present}</b> days present
                </span>
                <span>
                  <b>{stats.absent}</b> days absent
                </span>
                <span>{stats.total} days recorded</span>
              </div>
            </div>
          </section>
          {byMonth.map(([month, rows]) => (
            <section className="panel" key={month}>
              <div className="panel-title">
                <h2>{month}</h2>
              </div>
              <div className="day-chips">
                {rows.map((r) => (
                  <span key={r.id} className={`day-chip ${r.status === "PRESENT" ? "tone-good" : "tone-bad"}`} title={r.status.toLowerCase()}>
                    <b>{new Date(r.date + "T00:00:00").getDate()}</b>
                    {r.status === "PRESENT" ? "P" : "A"}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
