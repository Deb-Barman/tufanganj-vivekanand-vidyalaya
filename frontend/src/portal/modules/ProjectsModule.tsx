import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { RESULT_TERMS } from "../../types/api";
import type { Project, ProjectCompletions } from "../../types/api";
import { ClassYearPicker } from "../ui/ClassYear";
import { useClassYears, yearQuery } from "../ui/classYears";
import { EmptyState, Icon, Modal, PageHeader, Skeleton, StatusPill, classLabel, errText, fmtDate, listAll, todayISO, useUI, Select, DateField } from "../ui/kitExports";
import { PageLoading } from "../ui/PageLoading";
import { useRefData } from "../ui/useRefData";

const short = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const daysFromToday = (iso: string) => Math.round((new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000);

/** One pill that says where a project stands between its start and its deadline. */
const statusLabel = (p: Pick<Project, "start_date" | "due_date" | "phase">, done?: boolean | null) => {
  if (p.phase === "upcoming") return { text: `Starts ${short(p.start_date)}`, tone: "info" as const };
  if (p.phase === "closed") return done ? { text: "Finished", tone: "good" as const } : { text: `Missed · ended ${short(p.due_date)}`, tone: "bad" as const };
  const diff = daysFromToday(p.due_date);
  if (diff === 0) return { text: "Deadline today", tone: "warn" as const };
  if (diff === 1) return { text: "Due tomorrow", tone: "warn" as const };
  if (diff <= 7) return { text: `${diff} days left`, tone: "warn" as const };
  return { text: `${diff} days left`, tone: "muted" as const };
};
const windowText = (p: Pick<Project, "start_date" | "due_date">) => `${short(p.start_date)} → ${short(p.due_date)}`;
const metaText = (p: Project) => [p.term_label || null, p.subject_name || null, p.created_by_name || null].filter(Boolean).join(" · ");

export function ProjectsModule() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "STUDENT" ? <StudentProjects /> : <StaffProjects />;
}

/* ───── Student: see projects and tick them off ───── */

function StudentProjects() {
  const { toast } = useUI();
  const [items, setItems] = useState<Project[] | null>(null);
  const years = useClassYears(true);
  const [year, setYear] = useState("");
  const [term, setTerm] = useState("");
  const yq = yearQuery(years, year);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setItems(null);
    listAll<Project>(`/academics/projects/${yq ? "?" + yq : ""}`).then(setItems).catch((e) => { toast("error", errText(e, "Could not load projects.")); setItems([]); });
  }, [toast, yq]);

  async function toggle(p: Project) {
    if (!p.can_tick) {
      toast("info", p.phase === "closed" ? `The deadline for this project was ${short(p.due_date)}, so it is locked.` : `This project starts on ${short(p.start_date)}.`);
      return;
    }
    const done = !p.done;
    setItems((prev) => prev?.map((x) => (x.id === p.id ? { ...x, done } : x)) ?? prev); // optimistic
    try {
      await api.post(`/academics/projects/${p.id}/done/`, { done });
    } catch (e) {
      setItems((prev) => prev?.map((x) => (x.id === p.id ? { ...x, done: !done } : x)) ?? prev);
      toast("error", errText(e, "Could not update."));
    }
  }

  const terms = useMemo(() => RESULT_TERMS.filter((t) => (items ?? []).some((p) => p.term === t.value)), [items]);
  const shown = (items ?? []).filter((p) => !term || p.term === term);
  const todo = shown.filter((p) => !p.done && p.phase !== "closed").sort((a, b) => a.due_date.localeCompare(b.due_date));
  const missed = shown.filter((p) => !p.done && p.phase === "closed");
  const done = shown.filter((p) => p.done);
  const pct = shown.length ? Math.round((done.length / shown.length) * 100) : 0;

  const row = (p: Project) => {
    const st = statusLabel(p, p.done);
    const locked = !p.can_tick;
    return (
      <div key={p.id} className="row-link" style={{ alignItems: "flex-start" }}>
        <button
          type="button"
          onClick={() => toggle(p)}
          aria-pressed={!!p.done}
          aria-disabled={locked}
          aria-label={locked ? (p.phase === "closed" ? "Locked: the deadline has passed" : "Locked: not started yet") : p.done ? "Mark as not done" : "Mark as done"}
          title={locked ? (p.phase === "closed" ? "Locked — the deadline has passed" : "Not started yet") : undefined}
          className="icon-btn"
          style={{ borderRadius: "50%", color: p.done ? "#fff" : "var(--fg-faint)", background: p.done ? "var(--good)" : undefined, opacity: locked && !p.done ? 0.5 : 1, cursor: locked ? "not-allowed" : "pointer" }}
        >
          <Icon name={locked && !p.done ? "lock" : "check"} size={18} />
        </button>
        <span className="row-main" style={{ whiteSpace: "normal" }}>
          <strong style={{ whiteSpace: "normal", textDecoration: p.done ? "line-through" : "none", opacity: p.done ? 0.6 : 1 }}>{p.title}</strong>
          <span style={{ whiteSpace: "normal" }}>{metaText(p)}{metaText(p) ? " · " : ""}{windowText(p)}</span>
          {p.details && <span style={{ whiteSpace: "pre-wrap", color: "var(--fg-soft)", marginTop: 4 }}>{p.details}</span>}
        </span>
        <StatusPill tone={st.tone}>{st.text}</StatusPill>
      </div>
    );
  };

  return (
    <>
      <PageHeader icon="layers" title="Projects" sub="Your class projects with their start date and deadline. Tap the circle when you finish one." />
      {((years && years.length > 1) || terms.length > 1) && (
        <div className="toolbar">
          {years && years.length > 1 && <ClassYearPicker years={years} value={year} onChange={setYear} />}
          {terms.length > 1 && (
            <div className="field-inline"><label htmlFor="prTermS">Semester</label>
              <Select id="prTermS" value={term} onChange={(e) => setTerm(e.target.value)}><option value="">All semesters</option>{terms.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
          )}
        </div>
      )}
      {items === null ? <Skeleton rows={4} /> : shown.length === 0 ? (
        <EmptyState icon="layers" title="No projects" text="No project has been given to your class yet." />
      ) : (
        <>
          <section className="panel" style={{ marginBottom: 18 }}>
            <div className="split" style={{ gap: 16 }}>
              <div className="split-text"><span><b>{done.length}</b> of {shown.length} done</span><div className="pct-bar tone-good" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div></div>
            </div>
          </section>
          {todo.length > 0 && <div className="list" style={{ marginBottom: 22 }}>{todo.map(row)}</div>}
          {missed.length > 0 && (<><p className="tabs-note" style={{ margin: "6px 0 10px" }}>Missed — the deadline has passed</p><div className="list" style={{ marginBottom: 22 }}>{missed.map(row)}</div></>)}
          {done.length > 0 && (<><p className="tabs-note" style={{ margin: "6px 0 10px" }}>Completed</p><div className="list">{done.map(row)}</div></>)}
        </>
      )}
    </>
  );
}

/* ───── Staff (teacher / Super Admin): set and manage projects ───── */

type Draft = Partial<Project> & { subject: string | null };

function StaffProjects() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const ref = useRefData();
  const [classId, setClassId] = useState("");
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<Project[] | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [who, setWho] = useState<ProjectCompletions | "loading" | null>(null);

  async function showWho(p: Project) {
    setWho("loading");
    try {
      setWho(await api.get<ProjectCompletions>(`/academics/projects/${p.id}/completions/`));
    } catch (err) {
      setWho(null);
      toast("error", errText(err, "Could not load who has finished."));
    }
  }

  const cid = classId || ref?.classes[0]?.id || "";
  const subjects = ref?.subjects.filter((s) => s.school_class === cid) ?? [];
  const load = useCallback(async () => {
    if (!cid) return setItems([]);
    try { setItems(await listAll<Project>(`/academics/projects/?school_class=${cid}`)); } catch (e) { toast("error", errText(e, "Could not load projects.")); setItems([]); }
  }, [cid, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const sorted = useMemo(() => (items ?? []).filter((p) => !term || p.term === term).sort((a, b) => b.due_date.localeCompare(a.due_date)), [items, term]);
  const blank = (): Draft => ({ subject: null, term: "SEM1", start_date: todayISO(), due_date: todayISO(), title: "", details: "" });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      const body = { school_class: cid, subject: edit.subject || null, term: edit.term ?? "", title: edit.title, details: edit.details ?? "", start_date: edit.start_date || todayISO(), due_date: edit.due_date };
      if (edit.id) await api.patch(`/academics/projects/${edit.id}/`, body);
      else await api.post("/academics/projects/", body);
      toast("success", "Project saved.");
      setEdit(null);
      load();
    } catch (err) { toast("error", errText(err, "Could not save.")); } finally { setSaving(false); }
  }
  async function remove(p: Project) {
    if (!(await confirm({ title: "Delete this project?", message: p.title, confirmLabel: "Delete", danger: true }))) return;
    try { await api.del(`/academics/projects/${p.id}/`); load(); toast("success", "Deleted."); } catch (err) { toast("error", errText(err, "Could not delete (you can only delete projects you set).")); }
  }

  const sub = "Give a project to a class: set the semester, start date, deadline and details. Students tick it when done; you see who has finished.";
  if (!ref) return <PageLoading icon="layers" title="Projects" sub={sub} rows={4} />;
  if (ref.classes.length === 0) return (<><PageHeader icon="layers" title="Projects" /><EmptyState icon="layers" title="No classes yet" text={isAdmin ? "Create classes first." : "Ask the Super Admin to set up classes."} /></>);

  return (
    <>
      <PageHeader icon="layers" title="Projects" sub={sub} actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit(blank())}><Icon name="plus" size={16} /> Give project</button>} />
      <div className="toolbar">
        <div className="field-inline" style={{ flex: "1 1 260px" }}><label htmlFor="prClass">Class</label>
          <Select id="prClass" value={cid} onChange={(e) => setClassId(e.target.value)}>{ref.classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c, ref.sessions)}</option>)}</Select></div>
        <div className="field-inline" style={{ flex: "1 1 200px" }}><label htmlFor="prTerm">Semester</label>
          <Select id="prTerm" value={term} onChange={(e) => setTerm(e.target.value)}><option value="">All semesters</option>{RESULT_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
      </div>
      {items === null ? <Skeleton rows={4} /> : sorted.length === 0 ? (
        <EmptyState icon="layers" title="No projects for this class" text="Use “Give project” to add the first one." />
      ) : (
        <div className="list">
          {sorted.map((p) => {
            const st = statusLabel(p);
            const pct = p.class_size ? Math.round(((p.submitted ?? 0) / p.class_size) * 100) : 0;
            const mine = isAdmin || p.created_by === user?.id;
            return (
              <div key={p.id} className="row-link" style={{ alignItems: "flex-start" }}>
                <span className="row-main" style={{ whiteSpace: "normal" }}>
                  <strong style={{ whiteSpace: "normal" }}>{p.title}</strong>
                  <span style={{ whiteSpace: "normal" }}>{metaText(p)}{metaText(p) ? " · " : ""}{windowText(p)} · {st.text}</span>
                  {p.details && <span style={{ whiteSpace: "pre-wrap", color: "var(--fg-soft)", marginTop: 4 }}>{p.details}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}><span className="pct-bar tone-good" style={{ flex: 1, maxWidth: 220 }}><i style={{ width: `${pct}%` }} /></span>{p.submitted ?? 0} of {p.class_size ?? 0} done{mine && <button type="button" className="link-btn" onClick={() => showWho(p)}>See who</button>}</span>
                </span>
                {mine && (<>
                  <button type="button" className="icon-btn" onClick={() => setEdit({ ...p })} aria-label={`Edit ${p.title}`}><Icon name="edit" size={17} /></button>
                  <button type="button" className="icon-btn danger" onClick={() => remove(p)} aria-label={`Delete ${p.title}`}><Icon name="trash" size={17} /></button>
                </>)}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={edit !== null} title={edit?.id ? "Edit project" : "Give a project"} onClose={() => setEdit(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button><button type="submit" form="pr-form" className="btn btn-primary btn-sm" disabled={saving || !edit?.title?.trim() || !edit?.due_date}>{saving ? "Saving…" : "Save"}</button></>}>
        {edit && (
          <form id="pr-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="prTitle">Project title</label><input id="prTitle" value={edit.title ?? ""} maxLength={200} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="prSem">Semester</label>
                <Select id="prSem" value={edit.term ?? ""} onChange={(e) => setEdit({ ...edit, term: e.target.value as Project["term"] })}><option value="">Not for one semester</option>{RESULT_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
              <div className="form-field"><label htmlFor="prSub">Subject (optional)</label>
                <Select id="prSub" value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value || null })}><option value="">Whole class — no subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            </div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="prStart">Start date</label><DateField id="prStart" value={edit.start_date ?? ""} required onChange={(v) => setEdit({ ...edit, start_date: v, due_date: edit.due_date && edit.due_date < v ? v : edit.due_date })} /></div>
              <div className="form-field"><label htmlFor="prDue">Deadline</label><DateField id="prDue" value={edit.due_date ?? ""} min={edit.start_date ?? undefined} required onChange={(v) => setEdit({ ...edit, due_date: v })} /></div>
            </div>
            <p className="modal-text" style={{ fontSize: 13 }}>Students of this class can tick the project as done only from the start date to the deadline. After the deadline it is locked: unfinished work shows as “Missed”.</p>
            <div className="form-field"><label htmlFor="prDetails">Details</label><textarea id="prDetails" rows={5} value={edit.details ?? ""} maxLength={4000} placeholder="What should students make or write? Marks, rules, how to submit…" onChange={(e) => setEdit({ ...edit, details: e.target.value })} /></div>
          </form>
        )}
      </Modal>
      <Modal open={who !== null} title={who && who !== "loading" ? `Who has finished — ${who.title}` : "Who has finished"} onClose={() => setWho(null)} footer={<button type="button" className="btn btn-primary btn-sm" onClick={() => setWho(null)}>Close</button>}>
        {who === "loading" || who === null ? <Skeleton rows={4} /> : who.students.length === 0 ? (
          <p className="modal-text">No students are assigned to this class yet.</p>
        ) : (
          <div className="list">
            {[...who.students].sort((a, b) => Number(a.done) - Number(b.done) || a.full_name.localeCompare(b.full_name)).map((r) => (
              <div key={r.student} className="row-link">
                <span className="row-main"><strong>{r.full_name}</strong><span>{r.roll_number ? `Roll ${r.roll_number}` : "No roll number"}{r.done && r.completed_at ? ` · ticked ${fmtDate(r.completed_at)}` : ""}</span></span>
                <StatusPill tone={r.done ? "good" : "muted"}>{r.done ? "done" : "not yet"}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
