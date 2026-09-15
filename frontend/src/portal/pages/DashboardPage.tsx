import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { api, ApiError } from "../../lib/api";
import type { Notice, Paginated } from "../../types";
import { RoleBadge } from "../components/RoleBadge";
import "./DashboardPage.css";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [targetClass, setTargetClass] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canPublish = user?.role === "SUPER_ADMIN";

  async function loadNotices() {
    setLoadingNotices(true);
    setListError(null);
    try {
      const data = await api.get<Paginated<Notice>>("/notices/");
      setNotices(data.results);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not load notices.");
    } finally {
      setLoadingNotices(false);
    }
  }

  useEffect(() => {
    loadNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    logout();
    navigate("/portal", { replace: true });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await api.post<Notice>("/notices/", {
        title,
        body,
        target_class: targetClass,
      });
      setNotices((prev) => [created, ...prev]);
      setTitle("");
      setTargetClass("");
      setBody("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not post the notice.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.del(`/notices/${id}/`);
      setNotices((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not delete the notice.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="dashboard">
      <div className="dash-topbar">
        <div className="dash-who">
          <RoleBadge role={user.role} />
          <span>Welcome back, {user.full_name || user.username}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <section className="dash-panel">
        <h2>Notices</h2>
        <p className="dash-panel-sub">
          {canPublish
            ? "Publish a notice — it's visible immediately on the public site and to everyone in the portal."
            : "Notices published by the Super Admin. You have read-only access here."}
        </p>

        {canPublish && (
          <form className="notice-form" onSubmit={handleCreate}>
            <div className="ff-row">
              <div className="form-field">
                <label htmlFor="nTitle">Title</label>
                <input
                  id="nTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  placeholder="e.g. Half-Yearly Exam Routine"
                />
              </div>
              <div className="form-field">
                <label htmlFor="nClass">Target class (optional)</label>
                <input
                  id="nClass"
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                  maxLength={50}
                  placeholder="e.g. Class 10"
                />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="nBody">Details</label>
              <textarea
                id="nBody"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                placeholder="Write the notice text…"
              />
            </div>
            {formError && <p className="alert alert-error">{formError}</p>}
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ alignSelf: "flex-start" }}>
              {submitting ? "Posting…" : "Post Notice"}
            </button>
          </form>
        )}

        {listError && <p className="alert alert-error" style={{ marginTop: 16 }}>{listError}</p>}

        {loadingNotices ? (
          <p className="dash-loading">Loading notices…</p>
        ) : notices.length === 0 ? (
          <p className="dash-loading">No notices yet.</p>
        ) : (
          <div className="module-table-wrap">
            <table className="module-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Class</th>
                  <th>Posted</th>
                  <th>By</th>
                  {canPublish && <th />}
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}>
                    <td>{n.title}</td>
                    <td>{n.target_class || "All"}</td>
                    <td>{new Date(n.created_at).toLocaleDateString("en-IN")}</td>
                    <td>{n.created_by_name || "—"}</td>
                    {canPublish && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={deletingId === n.id}
                          onClick={() => handleDelete(n.id)}
                        >
                          {deletingId === n.id ? "Removing…" : "Remove"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dash-panel dash-panel-todo">
        <h2>Other modules</h2>
        <p className="dash-panel-sub">
          Students, Teachers, Classes/Subjects, Attendance, Results, Marksheets, Admissions and School Forms are
          scaffolded on the backend (see <code>academics/models.py</code>) but not yet wired to this dashboard. They
          will be added module-by-module, following the same pattern as Notices above.
        </p>
      </section>
    </div>
  );
}
