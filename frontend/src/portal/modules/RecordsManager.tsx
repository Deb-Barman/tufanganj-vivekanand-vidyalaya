import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import type { AcademicSession, Attendance, Result, SchoolClass, StudentProfile, Subject } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Skeleton, StatusPill, classLabel, errText, fmtDate, listAll, useDebounced, useUI } from "../ui/kitExports";

/* Super-Admin tools to correct or remove single saved rows — the same power the Django admin gave. */

function useClassData() {
  const [d, setD] = useState<{ classes: SchoolClass[]; sessions: AcademicSession[]; subjects: Subject[] } | null>(null);
  useEffect(() => {
    Promise.all([listAll<SchoolClass>("/academics/classes/"), listAll<AcademicSession>("/academics/sessions/"), listAll<Subject>("/academics/subjects/")])
      .then(([classes, sessions, subjects]) => setD({ classes, sessions, subjects }))
      .catch(() => setD({ classes: [], sessions: [], subjects: [] }));
  }, []);
  return d;
}

/* ───────────── Attendance records ───────────── */

export function AttendanceRecords() {
  const { toast, confirm } = useUI();
  const ref = useClassData();
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [rows, setRows] = useState<Attendance[] | null>(null);
  const [edit, setEdit] = useState<Attendance | null>(null);
  const [saving, setSaving] = useState(false);

  const cid = classId || ref?.classes[0]?.id || "";

  const load = useCallback(async () => {
    if (!cid) return;
    setRows(null);
    try {
      const [st, att] = await Promise.all([
        listAll<StudentProfile>(`/academics/students/?school_class=${cid}`),
        listAll<Attendance>(`/academics/attendance/?school_class=${cid}${date ? `&date=${date}` : ""}`),
      ]);
      setStudents(st);
      setRows(att);
    } catch (e) {
      toast("error", errText(e, "Could not load attendance records."));
      setRows([]);
    }
  }, [cid, date, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const nameOf = (id: string) => students.find((s) => s.user === id)?.full_name ?? "Student";
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || nameOf(r.student).toLowerCase().includes(s)).sort((a, b) => b.date.localeCompare(a.date) || nameOf(a.student).localeCompare(nameOf(b.student)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, students]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/academics/attendance/${edit.id}/`, { date: edit.date, status: edit.status });
      toast("success", "Attendance record updated.");
      setEdit(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not update (that student may already have a record on that date)."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Attendance) {
    if (!(await confirm({ title: "Delete this record?", message: `${nameOf(r.student)} — ${fmtDate(r.date)} will be removed.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/academics/attendance/${r.id}/`);
      setRows((p) => p?.filter((x) => x.id !== r.id) ?? p);
      toast("success", "Record deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete the record."));
    }
  }

  if (!ref) return <Skeleton rows={4} />;
  return (
    <>
      <PageHeader icon="checkCircle" title="Attendance records" sub="Find a saved attendance row, correct it or delete it." />
      <div className="toolbar">
        <div className="field-inline" style={{ flex: "1 1 220px" }}><label htmlFor="arClass">Class</label><select id="arClass" value={cid} onChange={(e) => setClassId(e.target.value)}>{ref.classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c, ref.sessions)}</option>)}</select></div>
        <div className="field-inline"><label htmlFor="arDate">Date</label><input id="arDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {date && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDate("")}>All dates</button>}
        <div className="search-box grow"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student" aria-label="Search student" /></div>
      </div>
      {rows === null ? <Skeleton rows={5} /> : shown.length === 0 ? (
        <EmptyState icon="checkCircle" title="No records" text="Nothing saved for this class and date yet." />
      ) : (
        <div className="list">
          {shown.map((r) => (
            <div key={r.id} className="row-link">
              <span className="row-main"><strong>{nameOf(r.student)}</strong><span>{fmtDate(r.date)}</span></span>
              <StatusPill tone={r.status === "PRESENT" ? "good" : "bad"}>{r.status.toLowerCase()}</StatusPill>
              <button type="button" className="icon-btn" onClick={() => setEdit(r)} aria-label="Edit record"><Icon name="edit" size={17} /></button>
              <button type="button" className="icon-btn danger" onClick={() => remove(r)} aria-label="Delete record"><Icon name="trash" size={17} /></button>
            </div>
          ))}
        </div>
      )}
      <Modal open={edit !== null} title="Edit attendance record" onClose={() => setEdit(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button><button type="submit" form="att-rec-form" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}>
        {edit && (
          <form id="att-rec-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <p className="modal-text">{nameOf(edit.student)}</p>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="arEDate">Date</label><input id="arEDate" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} required /></div>
              <div className="form-field"><label htmlFor="arEStatus">Status</label><select id="arEStatus" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Attendance["status"] })}><option value="PRESENT">Present</option><option value="ABSENT">Absent</option></select></div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

/* ───────────── Result records ───────────── */

export function ResultRecords() {
  const { toast, confirm } = useUI();
  const ref = useClassData();
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [rows, setRows] = useState<Result[] | null>(null);
  const [edit, setEdit] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);

  const sid = sessionId || (ref?.sessions.find((s) => s.is_current) ?? ref?.sessions[0])?.id || "";
  const classes = ref?.classes.filter((c) => c.session === sid) ?? [];
  const cid = classes.some((c) => c.id === classId) ? classId : classes[0]?.id || "";
  const subjects = ref?.subjects.filter((s) => s.school_class === cid) ?? [];
  const subId = subjects.some((s) => s.id === subjectId) ? subjectId : subjects[0]?.id || "";

  const load = useCallback(async () => {
    if (!sid || !subId || !cid) { setRows([]); return; }
    setRows(null);
    try {
      const [st, res] = await Promise.all([listAll<StudentProfile>(`/academics/students/?school_class=${cid}`), listAll<Result>(`/academics/results/?subject=${subId}&session=${sid}`)]);
      setStudents(st);
      setRows(res);
    } catch (e) {
      toast("error", errText(e, "Could not load result records."));
      setRows([]);
    }
  }, [sid, cid, subId, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const nameOf = (id: string) => students.find((s) => s.user === id)?.full_name ?? "Student";
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || nameOf(r.student).toLowerCase().includes(s)).sort((a, b) => nameOf(a.student).localeCompare(nameOf(b.student)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, students]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/academics/results/${edit.id}/`, { marks_obtained: edit.marks_obtained, full_marks: edit.full_marks });
      toast("success", "Result updated.");
      setEdit(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not update the result."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Result) {
    if (!(await confirm({ title: "Delete this result?", message: `${nameOf(r.student)} — ${r.marks_obtained}/${r.full_marks} will be removed.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/academics/results/${r.id}/`);
      setRows((p) => p?.filter((x) => x.id !== r.id) ?? p);
      toast("success", "Result deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete the result."));
    }
  }

  if (!ref) return <Skeleton rows={4} />;
  return (
    <>
      <PageHeader icon="award" title="Result records" sub="Find a saved mark, correct it or delete it." />
      <div className="toolbar">
        <div className="field-inline"><label htmlFor="rrSession">Session</label><select id="rrSession" value={sid} onChange={(e) => setSessionId(e.target.value)}>{ref.sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div className="field-inline"><label htmlFor="rrClass">Class</label><select id="rrClass" value={cid} onChange={(e) => setClassId(e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c, ref.sessions)}</option>)}</select></div>
        <div className="field-inline"><label htmlFor="rrSubject">Subject</label><select id="rrSubject" value={subId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="search-box grow"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student" aria-label="Search student" /></div>
      </div>
      {rows === null ? <Skeleton rows={5} /> : shown.length === 0 ? (
        <EmptyState icon="award" title="No results saved" text={subjects.length === 0 ? "This class has no subjects yet." : "No marks have been entered for this subject and session."} />
      ) : (
        <div className="list">
          {shown.map((r) => (
            <div key={r.id} className="row-link">
              <span className="row-main"><strong>{nameOf(r.student)}</strong><span>{Number(r.marks_obtained)} out of {Number(r.full_marks)}</span></span>
              <button type="button" className="icon-btn" onClick={() => setEdit(r)} aria-label="Edit result"><Icon name="edit" size={17} /></button>
              <button type="button" className="icon-btn danger" onClick={() => remove(r)} aria-label="Delete result"><Icon name="trash" size={17} /></button>
            </div>
          ))}
        </div>
      )}
      <Modal open={edit !== null} title="Edit result" onClose={() => setEdit(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button><button type="submit" form="res-rec-form" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}>
        {edit && (
          <form id="res-rec-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <p className="modal-text">{nameOf(edit.student)}</p>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="rrMarks">Marks obtained</label><input id="rrMarks" type="number" step="0.01" min={0} value={edit.marks_obtained} onChange={(e) => setEdit({ ...edit, marks_obtained: e.target.value })} required /></div>
              <div className="form-field"><label htmlFor="rrFull">Full marks</label><input id="rrFull" type="number" step="0.01" min={1} value={edit.full_marks} onChange={(e) => setEdit({ ...edit, full_marks: e.target.value })} required /></div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
