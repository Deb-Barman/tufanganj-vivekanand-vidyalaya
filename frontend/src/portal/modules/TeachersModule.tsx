import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { SchoolClass, Subject, TeacherProfile } from "../../types/api";
import { Avatar, EmptyState, Icon, Modal, PageHeader, Skeleton, errText, listAll, useUI } from "../ui/kitExports";

export function TeachersModule() {
  const { user } = useAuth();
  const { toast } = useUI();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const isTeacher = user?.role === "TEACHER";

  const [teachers, setTeachers] = useState<TeacherProfile[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [editing, setEditing] = useState<TeacherProfile | null>(null);
  const [form, setForm] = useState({ department: "", bio: "", years: "", subjects: [] as string[] });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, s, c] = await Promise.all([listAll<TeacherProfile>("/academics/teachers/"), listAll<Subject>("/academics/subjects/"), listAll<SchoolClass>("/academics/classes/")]);
      setTeachers(t);
      setSubjects(s);
      setClasses(c);
    } catch (e) {
      toast("error", errText(e, "Could not load the faculty directory."));
      setTeachers([]);
    }
  }, [toast]);

  useEffect(() => {
    // Data fetch on mount / when a filter changes: state is set after the awaited request, not synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  function openEdit(t: TeacherProfile) {
    setEditing(t);
    setForm({ department: t.department, bio: t.bio, years: t.years_experience?.toString() ?? "", subjects: t.subjects_taught });
  }

  const subjectLabel = (s: Subject) => `${s.name} · ${classes.find((c) => c.id === s.school_class)?.name ?? ""}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { department: form.department, bio: form.bio, years_experience: form.years === "" ? null : Number(form.years) };
      // only the Super Admin edits subjects; a teacher's own save leaves them alone
      if (isAdmin) body.subjects_taught = form.subjects;
      await api.patch(isAdmin ? `/academics/teachers/${editing.user}/` : "/academics/teachers/me/", body);
      toast("success", "Profile saved.");
      setEditing(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not save the profile."));
    } finally {
      setSaving(false);
    }
  }

  const toggleSubject = (id: string) => setForm((f) => ({ ...f, subjects: f.subjects.includes(id) ? f.subjects.filter((x) => x !== id) : [...f.subjects, id] }));
  const mine = teachers?.find((t) => t.user === user?.id);

  return (
    <>
      <PageHeader
        icon="school"
        title="Faculty"
        sub={isAdmin ? "Teachers' public profiles. Edit department, bio, experience and the subjects each one teaches." : isTeacher ? "Our teachers. You can edit your own profile — it appears on the school website." : "Our teachers."}
        actions={
          isTeacher &&
          mine && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit(mine)}>
              <Icon name="edit" size={15} /> Edit my profile
            </button>
          )
        }
      />

      {teachers === null ? (
        <Skeleton rows={3} />
      ) : teachers.length === 0 ? (
        <EmptyState icon="school" title="No teachers yet" text={isAdmin ? "Create Teacher accounts from the Accounts page and they will appear here." : "Teachers will appear here."} />
      ) : (
        <div className="cards">
          {teachers.map((t) => {
            const taught = subjects.filter((s) => t.subjects_taught.includes(s.id));
            return (
              <article className="rcard" key={t.user}>
                <div className="rcard-head">
                  <Avatar name={t.full_name} />
                  <div className="row-main">
                    <strong>{t.full_name}</strong>
                    <span>
                      {t.department || "Department not set"}
                      {t.years_experience ? ` · ${t.years_experience} yrs` : ""}
                    </span>
                  </div>
                </div>
                {t.bio && <p className="rcard-msg">{t.bio}</p>}
                {taught.length > 0 && (
                  <div className="rcard-meta">
                    {taught.map((s) => (
                      <span key={s.id} className="status-pill tone-info">
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <div className="rcard-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(t)}>
                      <Icon name="edit" size={15} /> Edit
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={editing !== null}
        title={editing ? `Edit ${editing.full_name}` : ""}
        size="lg"
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="teacher-form" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="teacher-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="tDept">Department</label>
              <input id="tDept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} maxLength={100} />
            </div>
            <div className="form-field">
              <label htmlFor="tYears">Years of experience</label>
              <input id="tYears" type="number" min={0} max={60} inputMode="numeric" value={form.years} onChange={(e) => setForm({ ...form, years: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="tBio">Bio (shown on the website)</label>
            <textarea id="tBio" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          {isAdmin && subjects.length > 0 && (
            <div className="form-field">
              <label>Subjects taught</label>
              <div className="check-grid">
                {subjects.map((s) => (
                  <label key={s.id} className={`check ${form.subjects.includes(s.id) ? "on" : ""}`}>
                    <input type="checkbox" checked={form.subjects.includes(s.id)} onChange={() => toggleSubject(s.id)} />
                    {subjectLabel(s)}
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
