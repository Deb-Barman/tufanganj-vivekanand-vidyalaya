import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { AcademicSession, Marksheet, StudentProfile } from "../../types/api";
import { Avatar, EmptyState, Icon, Modal, PageHeader, Skeleton, errText, fmtDate, listAll, useUI } from "../ui/kitExports";

export function MarksheetsModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const isStaff = user?.role !== "STUDENT";

  const [sheets, setSheets] = useState<Marksheet[] | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);

  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [m, s, st] = await Promise.all([
        listAll<Marksheet>("/academics/marksheets/"),
        listAll<AcademicSession>("/academics/sessions/"),
        isStaff ? listAll<StudentProfile>("/academics/students/") : Promise.resolve([] as StudentProfile[]),
      ]);
      setSheets(m);
      setSessions(s);
      setStudents(st);
    } catch (e) {
      toast("error", errText(e, "Could not load marksheets."));
      setSheets([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openUpload() {
    setStudentId(students[0]?.user ?? "");
    setSessionId((sessions.find((s) => s.is_current) ?? sessions[0])?.id ?? "");
    setFile(null);
    setOpen(true);
  }

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("student", studentId);
      fd.append("session", sessionId);
      fd.append("file", file);
      await api.postForm("/academics/marksheets/create/", fd);
      toast("success", "Marksheet uploaded.");
      setOpen(false);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not upload (a marksheet may already exist for that student and session)."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: Marksheet, name: string) {
    const ok = await confirm({ title: "Delete this marksheet?", message: `${name}'s marksheet will be removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.del(`/academics/marksheets/${m.id}/`);
      setSheets((p) => p?.filter((x) => x.id !== m.id) ?? p);
      toast("success", "Marksheet deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete."));
    }
  }

  const nameOf = (id: string) => students.find((s) => s.user === id)?.full_name ?? "Student";
  const sessionOf = (id: string) => sessions.find((s) => s.id === id)?.label ?? "";

  return (
    <>
      <PageHeader
        icon="file"
        title="Marksheets"
        sub={isAdmin ? "Upload each student's official marksheet (PDF or photo). Students can download their own." : isStaff ? "Official marksheets uploaded by the Super Admin." : "Your official marksheets."}
        actions={
          isAdmin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={openUpload} disabled={students.length === 0 || sessions.length === 0}>
              <Icon name="plus" size={16} /> Upload marksheet
            </button>
          )
        }
      />

      {sheets === null ? (
        <Skeleton rows={3} />
      ) : sheets.length === 0 ? (
        <EmptyState icon="file" title="No marksheets yet" text={isAdmin ? (students.length === 0 || sessions.length === 0 ? "Add students and a session first, then upload marksheets here." : "Use “Upload marksheet” to add the first one.") : "A marksheet will appear here once the school uploads it."} />
      ) : (
        <div className="cards">
          {sheets.map((m) => {
            const name = isStaff ? nameOf(m.student) : user?.full_name || "You";
            return (
              <article className="rcard" key={m.id}>
                <div className="rcard-head">
                  <Avatar name={name} />
                  <div className="row-main">
                    <strong>{name}</strong>
                    <span>
                      Session {sessionOf(m.session)} · {fmtDate(m.generated_at)}
                    </span>
                  </div>
                </div>
                <div className="rcard-actions">
                  {m.file ? (
                    <a className="btn btn-primary btn-sm" href={m.file} target="_blank" rel="noopener noreferrer">
                      <Icon name="download" size={15} /> Open / download
                    </a>
                  ) : (
                    <span className="mini-meta">No file attached</span>
                  )}
                  {isAdmin && (
                    <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} onClick={() => remove(m, name)} aria-label={`Delete ${name}'s marksheet`}>
                      <Icon name="trash" size={17} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        title="Upload marksheet"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="marksheet-form" className="btn btn-primary btn-sm" disabled={saving || !file || !studentId || !sessionId}>
              {saving ? "Uploading…" : "Upload"}
            </button>
          </>
        }
      >
        <form id="marksheet-form" onSubmit={upload} className="stack" style={{ gap: 14 }}>
          <div className="form-field">
            <label htmlFor="msStudent">Student</label>
            <select id="msStudent" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
              {students.map((s) => (
                <option key={s.user} value={s.user}>
                  {s.full_name}
                  {s.roll_number ? ` (Roll ${s.roll_number})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="msSession">Session</label>
            <select id="msSession" value={sessionId} onChange={(e) => setSessionId(e.target.value)} required>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="msFile">File (PDF, PNG, JPEG or WebP — up to 10 MB)</label>
            <input id="msFile" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>
        </form>
      </Modal>
    </>
  );
}
