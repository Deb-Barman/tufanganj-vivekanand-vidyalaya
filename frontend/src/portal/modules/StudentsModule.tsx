import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { AcademicSession, SchoolClass, StudentProfile } from "../../types/api";
import { Avatar, EmptyState, Icon, Modal, PageHeader, Skeleton, StatusPill, errText, listAll, useDebounced, useUI } from "../ui/kitExports";
import { dashPath } from "../ui/nav";

export function StudentsModule() {
  const { user } = useAuth();
  const { toast } = useUI();
  const isAdmin = user?.role === "SUPER_ADMIN";

  const [students, setStudents] = useState<StudentProfile[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [query, setQuery] = useState("");
  const q = useDebounced(query);

  const [editing, setEditing] = useState<StudentProfile | null>(null);
  const [form, setForm] = useState({ school_class: "", roll_number: "", guardian_name: "", guardian_contact: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listAll<SchoolClass>("/academics/classes/"), listAll<AcademicSession>("/academics/sessions/")])
      .then(([c, s]) => {
        setClasses(c);
        setSessions(s);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (classFilter) params.set("school_class", classFilter);
    if (q.trim()) params.set("search", q.trim());
    try {
      setStudents(await listAll<StudentProfile>(`/academics/students/${params.size ? "?" + params : ""}`));
    } catch (e) {
      toast("error", errText(e, "Could not load students."));
      setStudents([]);
    }
  }, [classFilter, q, toast]);

  useEffect(() => {
    // Data fetch on mount / when a filter changes: state is set after the awaited request, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const classLabel = (id: string | null) => {
    if (!id) return null;
    const c = classes.find((x) => x.id === id);
    if (!c) return null;
    const sess = sessions.find((s) => s.id === c.session);
    return `${c.name}${c.stream ? " " + c.stream : ""}${sess ? " · " + sess.label : ""}`;
  };

  function openEdit(s: StudentProfile) {
    setEditing(s);
    setForm({ school_class: s.school_class ?? "", roll_number: s.roll_number, guardian_name: s.guardian_name, guardian_contact: s.guardian_contact });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/academics/students/${editing.user}/`, { ...form, school_class: form.school_class || null });
      toast("success", `${editing.full_name} updated.`);
      setEditing(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not save the student."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        icon="cap"
        title="Students"
        sub={isAdmin ? "Every student's class, roll number and guardian. New students are added from Accounts." : "Students in the school. Contact the Super Admin to change class details."}
        actions={
          isAdmin && (
            <Link to={dashPath("accounts")} className="btn btn-primary btn-sm">
              <Icon name="plus" size={16} /> Add student
            </Link>
          )
        }
      />

      <div className="toolbar">
        <div className="search-box grow">
          <Icon name="search" size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username or roll number" aria-label="Search students" />
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class">
          <option value="">All classes</option>
          <option value="none">No class assigned</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {classLabel(c.id)}
            </option>
          ))}
        </select>
      </div>

      {students === null ? (
        <Skeleton rows={4} />
      ) : students.length === 0 ? (
        <EmptyState icon="cap" title="No students found" text={classFilter || q ? "Try clearing the search or class filter." : "Create Student accounts from the Accounts page and they will appear here."} />
      ) : (
        <>
          <p className="tabs-note" style={{ marginBottom: 12 }}>
            {students.length} {students.length === 1 ? "student" : "students"}
          </p>
          <div className="cards">
            {students.map((s) => {
              const label = classLabel(s.school_class);
              return (
                <article className="rcard" key={s.user}>
                  <div className="rcard-head">
                    <Avatar name={s.full_name} />
                    <div className="row-main">
                      <strong>{s.full_name}</strong>
                      <span>{s.username}</span>
                    </div>
                    {label ? <StatusPill tone="info">{s.roll_number ? `Roll ${s.roll_number}` : "No roll"}</StatusPill> : <StatusPill tone="bad">no class</StatusPill>}
                  </div>
                  <div className="rcard-meta">
                    <span className="mini-meta">
                      <Icon name="school" size={14} /> {label ?? "Class not assigned"}
                    </span>
                    {(s.guardian_name || s.guardian_contact) && (
                      <span className="mini-meta">
                        <Icon name="user" size={14} /> {s.guardian_name || "Guardian"}
                      </span>
                    )}
                  </div>
                  <div className="rcard-actions">
                    {s.guardian_contact && (
                      <a className="btn btn-outline btn-sm" href={`tel:${s.guardian_contact}`}>
                        <Icon name="phone" size={15} /> {s.guardian_contact}
                      </a>
                    )}
                    {isAdmin && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit(s)}>
                        <Icon name="edit" size={15} /> Edit
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={editing !== null}
        title={editing ? `Edit ${editing.full_name}` : ""}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="student-form" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        <form id="student-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
          <div className="form-field">
            <label htmlFor="stClass">Class</label>
            <select id="stClass" value={form.school_class} onChange={(e) => setForm({ ...form, school_class: e.target.value })}>
              <option value="">— not assigned —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="stRoll">Roll number</label>
            <input id="stRoll" value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} maxLength={20} />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="stGuard">Guardian name</label>
              <input id="stGuard" value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} maxLength={150} />
            </div>
            <div className="form-field">
              <label htmlFor="stPhone">Guardian phone</label>
              <input id="stPhone" inputMode="tel" value={form.guardian_contact} onChange={(e) => setForm({ ...form, guardian_contact: e.target.value })} maxLength={20} />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
