import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { SchoolClass, Subject, TeacherProfile } from "../../types/api";
import { Link } from "react-router-dom";
import { FacultyCard } from "../../components/faculty/FacultyCard";
import { dashPath } from "../ui/nav";
import { EmptyState, Icon, Modal, PageHeader, Skeleton, errText, listAll, useUI } from "../ui/kitExports";

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
        sub={isAdmin ? "Our teachers. Each card is built from the teacher's own profile; tap a card to open the full profile." : isTeacher ? "Our teachers. Your card is built from your own profile — update it in My profile and it changes here and on the website." : "Our teachers. Tap a card to read the full profile."}
        actions={
          isTeacher && (
            <>
              <Link className="btn btn-primary btn-sm" to={dashPath("profile")}><Icon name="user" size={15} /> Edit my profile</Link>
              {mine && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(mine)}>
                  <Icon name="edit" size={15} /> School details
                </button>
              )}
            </>
          )
        }
      />

      {teachers === null ? (
        <Skeleton variant="cards" rows={3} />
      ) : teachers.length === 0 ? (
        <EmptyState icon="school" title="No teachers yet" text={isAdmin ? "Create Teacher accounts from the Accounts page and they will appear here." : "Teachers will appear here."} />
      ) : (
        <div className="fc-grid">
          {teachers.map((t, i) => {
            const taught = subjects.filter((s) => t.subjects_taught.includes(s.id)).map((s) => s.name);
            return (
              <FacultyCard
                key={t.user}
                index={i}
                name={t.full_name}
                department={t.department}
                years={t.years_experience}
                bio={t.bio}
                subjects={taught}
                card={t.profile}
                actions={isAdmin ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(t)}>
                    <Icon name="edit" size={15} /> Edit
                  </button>
                ) : undefined}
              />
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
