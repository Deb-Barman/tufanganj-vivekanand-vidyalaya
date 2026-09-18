import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Paginated, TeacherProfile } from "../../types/api";

export function TeachersModule() {
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";

  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Paginated<TeacherProfile>>("/academics/teachers/");
      setTeachers(data.results);
      if (isTeacher) {
        // Backend get_or_create's an empty profile row on first GET, so
        // this always succeeds for a teacher — no need to handle a
        // missing-profile case here.
        const mine = await api.get<TeacherProfile>("/academics/teachers/me/");
        setBio(mine.bio);
        setDepartment(mine.department);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the faculty directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveOwnProfile() {
    setSaving(true);
    try {
      await api.patch("/academics/teachers/me/", { bio, department });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dash-panel">
      <h2>Faculty Directory</h2>
      <p className="dash-panel-sub">Verified teacher profiles, shown on the public site.</p>

      {isTeacher && (
        <div className="dash-form">
          <div className="form-field">
            <label htmlFor="tDept">Department</label>
            <input id="tDept" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} />
          </div>
          <div className="form-field">
            <label htmlFor="tBio">Bio</label>
            <textarea id="tBio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveOwnProfile} style={{ alignSelf: "flex-start" }}>
            {saving ? "Saving…" : "Save My Profile"}
          </button>
        </div>
      )}

      {error && <p className="alert alert-error" style={{ marginTop: 16 }}>{error}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : teachers.length === 0 ? (
        <p className="dash-empty">No teacher profiles yet.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Experience</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.user}>
                  <td>{t.full_name}</td>
                  <td>{t.department || "—"}</td>
                  <td>{t.years_experience != null ? `${t.years_experience} yrs` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
