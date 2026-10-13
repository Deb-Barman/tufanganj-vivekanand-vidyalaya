import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import type { AcademicSession, SchoolClass, Subject } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Segmented, Skeleton, StatusPill, errText, listAll, useUI } from "../ui/kitExports";

type Tab = "sessions" | "classes" | "subjects";

export function AcademicSetupModule() {
  const { toast, confirm } = useUI();
  const [tab, setTab] = useState<Tab>("sessions");
  const [sessions, setSessions] = useState<AcademicSession[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);

  const reload = useCallback(async () => {
    try {
      const [s, c, sub] = await Promise.all([listAll<AcademicSession>("/academics/sessions/"), listAll<SchoolClass>("/academics/classes/"), listAll<Subject>("/academics/subjects/")]);
      setSessions(s);
      setClasses(c);
      setSubjects(sub);
    } catch (e) {
      toast("error", errText(e, "Could not load classes and subjects."));
      setSessions([]);
      setClasses([]);
      setSubjects([]);
    }
  }, [toast]);

  useEffect(() => {
    // Data fetch on mount / when a filter changes: state is set after the awaited request, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    reload();
  }, [reload]);

  const loading = sessions === null || classes === null || subjects === null;
  const className = (id: string) => {
    const c = classes?.find((x) => x.id === id);
    return c ? `${c.name}${c.stream ? " · " + c.stream : ""}` : "—";
  };
  const sessionLabel = (id: string) => sessions?.find((x) => x.id === id)?.label ?? "—";

  async function remove(kind: "sessions" | "classes" | "subjects", id: string, label: string, warn: string) {
    const ok = await confirm({ title: `Delete ${label}?`, message: warn, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.del(`/academics/${kind}/${id}/`);
      toast("success", "Deleted.");
      reload();
    } catch (e) {
      toast("error", errText(e, "Could not delete."));
    }
  }

  return (
    <>
      <PageHeader icon="layers" title="Classes & Subjects" sub="Set up academic sessions, the classes inside them, and each class's subjects. Attendance and results are built on these." />
      <div className="toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "sessions", label: "Sessions", count: sessions?.length },
            { value: "classes", label: "Classes", count: classes?.length },
            { value: "subjects", label: "Subjects", count: subjects?.length },
          ]}
        />
      </div>

      {loading ? (
        <Skeleton variant="cards" rows={4} />
      ) : tab === "sessions" ? (
        <SessionsTab sessions={sessions} onChanged={reload} onDelete={(s) => remove("sessions", s.id, `session ${s.label}`, "Every class, subject, result and marksheet in this session will be deleted with it. This cannot be undone.")} />
      ) : tab === "classes" ? (
        <ClassesTab classes={classes} sessions={sessions} sessionLabel={sessionLabel} onChanged={reload} onDelete={(c) => remove("classes", c.id, c.name, "Its subjects and their results will be deleted. Students stay but lose this class.")} />
      ) : (
        <SubjectsTab subjects={subjects} classes={classes} className={className} onChanged={reload} onDelete={(s) => remove("subjects", s.id, s.name, "Results recorded for this subject will be deleted too.")} />
      )}
    </>
  );
}

/* ───── Sessions ───── */

function SessionsTab({ sessions, onChanged, onDelete }: { sessions: AcademicSession[]; onChanged: () => void; onDelete: (s: AcademicSession) => void }) {
  const { toast } = useUI();
  const [editing, setEditing] = useState<AcademicSession | "new" | null>(null);
  const [label, setLabel] = useState("");
  const [current, setCurrent] = useState(false);
  const [saving, setSaving] = useState(false);

  function open(s: AcademicSession | "new") {
    setEditing(s);
    setLabel(s === "new" ? "" : s.label);
    setCurrent(s === "new" ? sessions.length === 0 : s.is_current);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === "new") await api.post("/academics/sessions/", { label: label.trim(), is_current: current });
      else if (editing) await api.patch(`/academics/sessions/${editing.id}/`, { label: label.trim(), is_current: current });
      toast("success", "Session saved.");
      setEditing(null);
      onChanged();
    } catch (err) {
      toast("error", errText(err, "Could not save the session."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => open("new")}>
          <Icon name="plus" size={16} /> New session
        </button>
      </div>
      {sessions.length === 0 ? (
        <EmptyState icon="calendar" title="No sessions yet" text="Start with the current academic year, for example “2026” or “2026-27”." />
      ) : (
        <div className="cards">
          {sessions.map((s) => (
            <article className="rcard" key={s.id}>
              <div className="rcard-head">
                <span className="row-icon" style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 14, background: "var(--panel)", boxShadow: "var(--inset-sm)", color: "var(--accent)" }}>
                  <Icon name="calendar" />
                </span>
                <div className="row-main">
                  <strong>{s.label}</strong>
                  <span>Academic session</span>
                </div>
                {s.is_current && <StatusPill tone="good">current</StatusPill>}
              </div>
              <div className="rcard-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => open(s)}>
                  <Icon name="edit" size={15} /> Edit
                </button>
                <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} onClick={() => onDelete(s)} aria-label={`Delete session ${s.label}`}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={editing !== null}
        title={editing === "new" ? "New session" : "Edit session"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="session-form" className="btn btn-primary btn-sm" disabled={saving || !label.trim()}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="session-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
          <div className="form-field">
            <label htmlFor="sLabel">Label</label>
            <input id="sLabel" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={20} placeholder="2026-27" required />
          </div>
          <label className="check">
            <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} />
            Make this the current session
          </label>
        </form>
      </Modal>
    </>
  );
}

/* ───── Classes ───── */

function ClassesTab({ classes, sessions, sessionLabel, onChanged, onDelete }: { classes: SchoolClass[]; sessions: AcademicSession[]; sessionLabel: (id: string) => string; onChanged: () => void; onDelete: (c: SchoolClass) => void }) {
  const { toast } = useUI();
  const [editing, setEditing] = useState<SchoolClass | "new" | null>(null);
  const [name, setName] = useState("");
  const [stream, setStream] = useState("");
  const [session, setSession] = useState("");
  const [saving, setSaving] = useState(false);

  function open(c: SchoolClass | "new") {
    setEditing(c);
    setName(c === "new" ? "" : c.name);
    setStream(c === "new" ? "" : c.stream);
    setSession(c === "new" ? (sessions.find((s) => s.is_current) ?? sessions[0])?.id ?? "" : c.session);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: name.trim(), stream: stream.trim(), session };
      if (editing === "new") await api.post("/academics/classes/", body);
      else if (editing) await api.patch(`/academics/classes/${editing.id}/`, body);
      toast("success", "Class saved.");
      setEditing(null);
      onChanged();
    } catch (err) {
      toast("error", errText(err, "Could not save the class (it may already exist in that session)."));
    } finally {
      setSaving(false);
    }
  }

  if (sessions.length === 0) return <EmptyState icon="calendar" title="Create a session first" text="Classes belong to an academic session. Add one in the Sessions tab." />;

  return (
    <>
      <div className="toolbar">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => open("new")}>
          <Icon name="plus" size={16} /> New class
        </button>
      </div>
      {classes.length === 0 ? (
        <EmptyState icon="school" title="No classes yet" text="Add classes like “Class XI” with a stream such as Science, Arts or Commerce." />
      ) : (
        <div className="cards">
          {classes.map((c) => (
            <article className="rcard" key={c.id}>
              <div className="rcard-head">
                <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 14, background: "var(--panel)", boxShadow: "var(--inset-sm)", color: "var(--accent)" }}>
                  <Icon name="school" />
                </span>
                <div className="row-main">
                  <strong>{c.name}</strong>
                  <span>{c.stream || "No stream"} · Session {sessionLabel(c.session)}</span>
                </div>
              </div>
              <div className="rcard-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => open(c)}>
                  <Icon name="edit" size={15} /> Edit
                </button>
                <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} onClick={() => onDelete(c)} aria-label={`Delete ${c.name}`}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={editing !== null}
        title={editing === "new" ? "New class" : "Edit class"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="class-form" className="btn btn-primary btn-sm" disabled={saving || !name.trim() || !session}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="class-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="cName">Class</label>
              <input id="cName" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="Class XI" required />
            </div>
            <div className="form-field">
              <label htmlFor="cStream">Stream (optional)</label>
              <input id="cStream" value={stream} onChange={(e) => setStream(e.target.value)} maxLength={20} placeholder="Science" />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="cSession">Session</label>
            <select id="cSession" value={session} onChange={(e) => setSession(e.target.value)} required>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.is_current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ───── Subjects ───── */

function SubjectsTab({ subjects, classes, className, onChanged, onDelete }: { subjects: Subject[]; classes: SchoolClass[]; className: (id: string) => string; onChanged: () => void; onDelete: (s: Subject) => void }) {
  const { toast } = useUI();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const [name, setName] = useState("");
  const [klass, setKlass] = useState("");
  const [saving, setSaving] = useState(false);

  function open(s: Subject | "new") {
    setEditing(s);
    setName(s === "new" ? "" : s.name);
    setKlass(s === "new" ? filter || classes[0]?.id || "" : s.school_class);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: name.trim(), school_class: klass };
      if (editing === "new") await api.post("/academics/subjects/", body);
      else if (editing) await api.patch(`/academics/subjects/${editing.id}/`, body);
      toast("success", "Subject saved.");
      setEditing(null);
      onChanged();
    } catch (err) {
      toast("error", errText(err, "Could not save the subject."));
    } finally {
      setSaving(false);
    }
  }

  if (classes.length === 0) return <EmptyState icon="school" title="Create a class first" text="Subjects belong to a class. Add one in the Classes tab." />;
  const shown = subjects.filter((s) => !filter || s.school_class === filter);

  return (
    <>
      <div className="toolbar">
        <div className="field-inline" style={{ flex: "1 1 220px" }}>
          <label htmlFor="subFilter">Class</label>
          <select id="subFilter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {className(c.id)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => open("new")} style={{ alignSelf: "flex-end" }}>
          <Icon name="plus" size={16} /> New subject
        </button>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="book" title="No subjects here yet" text="Add the subjects taught in this class." />
      ) : (
        <div className="cards">
          {shown.map((s) => (
            <article className="rcard" key={s.id}>
              <div className="rcard-head">
                <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 14, background: "var(--panel)", boxShadow: "var(--inset-sm)", color: "var(--accent)" }}>
                  <Icon name="book" />
                </span>
                <div className="row-main">
                  <strong>{s.name}</strong>
                  <span>{className(s.school_class)}</span>
                </div>
              </div>
              <div className="rcard-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => open(s)}>
                  <Icon name="edit" size={15} /> Edit
                </button>
                <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} onClick={() => onDelete(s)} aria-label={`Delete ${s.name}`}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={editing !== null}
        title={editing === "new" ? "New subject" : "Edit subject"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="subject-form" className="btn btn-primary btn-sm" disabled={saving || !name.trim() || !klass}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="subject-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
          <div className="form-field">
            <label htmlFor="subName">Subject</label>
            <input id="subName" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Physics" required />
          </div>
          <div className="form-field">
            <label htmlFor="subClass">Class</label>
            <select id="subClass" value={klass} onChange={(e) => setKlass(e.target.value)} required>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {className(c.id)}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </>
  );
}
