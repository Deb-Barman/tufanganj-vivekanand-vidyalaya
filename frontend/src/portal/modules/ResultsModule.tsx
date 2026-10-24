import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { AcademicSession, Result, ResultTerm, SchoolClass, StudentProfile, Subject } from "../../types/api";
import { RESULT_TERMS, termLabel } from "../../types/api";
import { ResultRecords } from "./RecordsManager";
import { ImportButton } from "../ui/ImportButton";
import { EmptyState, PageHeader, Segmented, Skeleton, classLabel, errText, listAll, useUI, Select } from "../ui/kitExports";
import { ResultsExplorer } from "../../components/portfolio/ResultsExplorer";
import type { PortfolioClass, PortfolioSemester } from "../../types/api";
import { PageLoading } from "../ui/PageLoading";
import { dashPath } from "../ui/nav";

export function ResultsModule() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"enter" | "records">("enter");
  const [rev, setRev] = useState(0); // bumped after an import so the lists reload
  if (!user) return null;
  if (user.role === "STUDENT") return <StudentResults />;
  const isAdmin = user.role === "SUPER_ADMIN";
  return (
    <>
      {isAdmin && <div className="toolbar"><Segmented value={tab} onChange={setTab} options={[{ value: "enter", label: "Enter marks" }, { value: "records", label: "Saved results" }]} /><ImportButton kind="results" label="Import marks" onDone={() => setRev((n) => n + 1)} /></div>}
      {isAdmin && tab === "records" ? <ResultRecords key={rev} /> : <StaffResults key={rev} isAdmin={isAdmin} />}
    </>
  );
}


/* ───────────── Staff: enter a whole class's marks for one subject ───────────── */

function StaffResults({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useUI();
  const [sessions, setSessions] = useState<AcademicSession[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [sessionId, setSessionId] = useState("");
  const [term, setTerm] = useState<ResultTerm>("SEM1");
  const [classPick, setClassPick] = useState("");
  const [subjectPick, setSubjectPick] = useState("");
  const [fullMarks, setFullMarks] = useState("100");

  const [students, setStudents] = useState<StudentProfile[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listAll<AcademicSession>("/academics/sessions/"), listAll<SchoolClass>("/academics/classes/"), listAll<Subject>("/academics/subjects/")])
      .then(([s, c, sub]) => {
        setSessions(s);
        setClasses(c);
        setSubjects(sub);
        setSessionId((s.find((x) => x.is_current) ?? s[0])?.id ?? "");
      })
      .catch((e) => {
        toast("error", errText(e, "Could not load classes and subjects."));
        setSessions([]);
      });
  }, [toast]);

  const sessionClasses = useMemo(() => classes.filter((c) => c.session === sessionId), [classes, sessionId]);
  // A pick that no longer belongs to its parent (e.g. after changing session) falls back to the first valid option.
  const classId = sessionClasses.some((c) => c.id === classPick) ? classPick : sessionClasses[0]?.id ?? "";
  const classSubjects = useMemo(() => subjects.filter((s) => s.school_class === classId), [subjects, classId]);
  const subjectId = classSubjects.some((s) => s.id === subjectPick) ? subjectPick : classSubjects[0]?.id ?? "";

  const loadSheet = useCallback(async () => {
    if (!classId || !subjectId || !sessionId) {
      setStudents([]);
      return;
    }
    setStudents(null);
    try {
      const [st, res] = await Promise.all([listAll<StudentProfile>(`/academics/students/?school_class=${classId}`), listAll<Result>(`/academics/results/?subject=${subjectId}&session=${sessionId}&term=${term}`)]);
      const existing: Record<string, string> = {};
      res.forEach((r) => (existing[r.student] = String(Number(r.marks_obtained))));
      if (res[0]) setFullMarks(String(Number(res[0].full_marks)));
      setStudents(st);
      setValues(existing);
      setInitial(existing);
    } catch (e) {
      toast("error", errText(e, "Could not load marks."));
      setStudents([]);
    }
  }, [classId, subjectId, sessionId, term, toast]);

  useEffect(() => {
    // Data fetch on mount / when a filter changes: state is set after the awaited request, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    loadSheet();
  }, [loadSheet]);

  const full = Number(fullMarks);
  const fullValid = Number.isFinite(full) && full >= 1 && full <= 999;
  const invalid = (v: string) => v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0 || (fullValid && Number(v) > full));
  const entered = Object.values(values).filter((v) => v !== "");
  const anyInvalid = entered.some(invalid);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const average = entered.length && fullValid ? Math.round((entered.reduce((a, v) => a + Number(v), 0) / entered.length / full) * 100) : null;

  async function save() {
    if (!fullValid || anyInvalid || entered.length === 0) return;
    setSaving(true);
    try {
      const records = Object.entries(values)
        .filter(([, v]) => v !== "")
        .map(([student, v]) => ({ student, marks_obtained: Number(v).toFixed(2) }));
      await api.post("/academics/results/bulk/", { subject: subjectId, session: sessionId, term, full_marks: full.toFixed(2), records });
      setInitial({ ...values });
      toast("success", `${termLabel(term)} marks saved for ${records.length} ${records.length === 1 ? "student" : "students"}.`);
    } catch (e) {
      toast("error", errText(e, "Could not save marks."));
    } finally {
      setSaving(false);
    }
  }

  if (sessions === null) return <PageLoading icon="award" title="Results" sub="Choose session, class and subject, then type each student's marks. Saving again simply updates them." rows={4} />;

  if (sessions.length === 0 || classes.length === 0 || subjects.length === 0)
    return (
      <>
        <PageHeader icon="award" title="Results" />
        <EmptyState
          icon="layers"
          title="Classes and subjects are needed first"
          text={isAdmin ? "Add a session, a class and its subjects, then come back to enter marks." : "Ask the Super Admin to set up classes and subjects."}
          action={isAdmin ? <Link className="btn btn-primary btn-sm" to={dashPath("academics")}>Set up classes</Link> : undefined}
        />
      </>
    );

  return (
    <>
      <PageHeader icon="award" title="Results" sub="Choose session, semester, class and subject, then type each student's marks. Saving again simply updates them." />

      <div className="toolbar">
        <div className="field-inline" style={{ flex: "1 1 130px" }}>
          <label htmlFor="rSession">Session</label>
          <Select id="rSession" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.is_current ? " (current)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="field-inline" style={{ flex: "1 1 150px" }}>
          <label htmlFor="rTerm">Semester</label>
          <Select id="rTerm" value={term} onChange={(e) => setTerm(e.target.value as ResultTerm)}>
            {RESULT_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>
        <div className="field-inline" style={{ flex: "2 1 180px" }}>
          <label htmlFor="rClass">Class</label>
          <Select id="rClass" value={classId} onChange={(e) => setClassPick(e.target.value)} disabled={sessionClasses.length === 0}>
            {sessionClasses.length === 0 && <option value="">No classes in this session</option>}
            {sessionClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c, sessions)}
              </option>
            ))}
          </Select>
        </div>
        <div className="field-inline" style={{ flex: "2 1 160px" }}>
          <label htmlFor="rSubject">Subject</label>
          <Select id="rSubject" value={subjectId} onChange={(e) => setSubjectPick(e.target.value)} disabled={classSubjects.length === 0}>
            {classSubjects.length === 0 && <option value="">No subjects in this class</option>}
            {classSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="field-inline" style={{ flex: "0 1 110px" }}>
          <label htmlFor="rFull">Full marks</label>
          <input id="rFull" inputMode="decimal" value={fullMarks} onChange={(e) => setFullMarks(e.target.value)} className={fullValid ? "" : "invalid"} />
        </div>
      </div>

      {students === null ? (
        <Skeleton rows={6} />
      ) : !classId || !subjectId ? (
        <EmptyState icon="book" title="Pick a class and subject" text="This class has no subjects yet." />
      ) : students.length === 0 ? (
        <EmptyState icon="cap" title="No students in this class" text="Assign students to the class from the Students page first." />
      ) : (
        <>
          <div className="sheet">
            {students.map((s, i) => {
              const v = values[s.user] ?? "";
              return (
                <div key={s.user} className="sheet-row">
                  <span className="roll">{s.roll_number || i + 1}</span>
                  <span className="name">{s.full_name}</span>
                  <input
                    className={`mark-input ${invalid(v) ? "invalid" : ""}`}
                    inputMode="decimal"
                    placeholder={`/ ${fullValid ? full : "—"}`}
                    value={v}
                    aria-label={`Marks for ${s.full_name}`}
                    aria-invalid={invalid(v)}
                    onChange={(e) => setValues({ ...values, [s.user]: e.target.value.replace(/[^0-9.]/g, "") })}
                  />
                </div>
              );
            })}
          </div>
          <div className="sticky-save">
            <div className="tally">
              <span>
                <b>{entered.length}</b> of {students.length} entered
              </span>
              {average !== null && (
                <span>
                  class average <b>{average}%</b>
                </span>
              )}
              {(anyInvalid || !fullValid) && <span style={{ color: "var(--danger)" }}>Check the highlighted marks</span>}
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty || anyInvalid || !fullValid || entered.length === 0}>
              {saving ? "Saving…" : dirty ? "Save marks" : "Saved ✓"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

/* ───────────── Student: my results ───────────── */

const TERM_ORDER = RESULT_TERMS.map((t) => t.value as string);
const pctOf = (got: number, full: number) => (full ? Math.round((got / full) * 100) : 0);

function StudentResults() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listAll<Result>("/academics/results/"), listAll<Subject>("/academics/subjects/"), listAll<SchoolClass>("/academics/classes/"), listAll<AcademicSession>("/academics/sessions/")])
      .then(([r, sub, cl, s]) => {
        setResults(r);
        setSubjects(sub);
        setClasses(cl);
        setSessions(s);
      })
      .catch((e) => {
        setError(errText(e, "Could not load your results."));
        setResults([]);
      });
  }, []);

  /** Class → semesters → subjects (the same shape the public profile uses), oldest class first. */
  const { grouped, overall } = useMemo(() => {
    const byClass = new Map<string, Map<string, Result[]>>();
    let got = 0;
    let full = 0;
    results?.forEach((r) => {
      const classId = subjects.find((s) => s.id === r.subject)?.school_class ?? "?";
      const terms = byClass.get(classId) ?? new Map<string, Result[]>();
      terms.set(r.term, [...(terms.get(r.term) ?? []), r]);
      byClass.set(classId, terms);
      got += Number(r.marks_obtained);
      full += Number(r.full_marks);
    });
    const out: PortfolioClass[] = [...byClass.entries()].map(([classId, terms]) => {
      const c = classes.find((x) => x.id === classId);
      let cGot = 0;
      let cFull = 0;
      const semesters: PortfolioSemester[] = [...terms.entries()]
        .sort(([a], [b]) => TERM_ORDER.indexOf(a) - TERM_ORDER.indexOf(b))
        .map(([term, rows]) => {
          const g = rows.reduce((a, r) => a + Number(r.marks_obtained), 0);
          const f = rows.reduce((a, r) => a + Number(r.full_marks), 0);
          cGot += g;
          cFull += f;
          return {
            term, label: termLabel(term), percent: pctOf(g, f), subject_count: rows.length, got: g, full: f,
            subjects: rows
              .map((r) => ({ name: subjects.find((s) => s.id === r.subject)?.name ?? "Subject", got: Number(r.marks_obtained), full: Number(r.full_marks), percent: pctOf(Number(r.marks_obtained), Number(r.full_marks)) }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          };
        });
      return { class_label: c ? `${c.name}${c.stream ? " " + c.stream : ""}` : "Class", session: sessions.find((s) => s.id === c?.session)?.label ?? "", percent: pctOf(cGot, cFull), semesters };
    });
    out.sort((a, b) => a.session.localeCompare(b.session) || a.class_label.localeCompare(b.class_label));
    return { grouped: out, overall: pctOf(got, full) };
  }, [results, subjects, classes, sessions]);

  return (
    <>
      <PageHeader icon="award" title="My results" sub="Every class, every semester, every subject — in one place." />
      {error && <p className="alert alert-error">{error}</p>}
      {results === null ? (
        <Skeleton rows={4} />
      ) : results.length === 0 ? (
        <EmptyState icon="award" title="No marks yet" text="Your marks will appear here once your teachers enter them." />
      ) : (
        <section className="panel">
          <ResultsExplorer classes={grouped} overall={overall} />
        </section>
      )}
    </>
  );
}
