import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Notice, Paginated } from "../../types/api";

export function NoticesModule() {
  const { user } = useAuth();
  const canPublish = user?.role === "SUPER_ADMIN";

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [targetClass, setTargetClass] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      const data = await api.get<Paginated<Notice>>("/notices/");
      setNotices(data.results);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not load notices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await api.post<Notice>("/notices/", { title, body, target_class: targetClass });
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

  return (
    <section className="dash-panel">
      <h2>Notices</h2>
      <p className="dash-panel-sub">
        {canPublish
          ? "Publish a notice — visible immediately on the public site and in the portal."
          : "Notices published by the Super Admin. Read-only for your role."}
      </p>

      {canPublish && (
        <form className="dash-form" onSubmit={handleCreate}>
          <div className="ff-row">
            <div className="form-field">
              <label htmlFor="nTitle">Title</label>
              <input id="nTitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </div>
            <div className="form-field">
              <label htmlFor="nClass">Target class (optional)</label>
              <input id="nClass" value={targetClass} onChange={(e) => setTargetClass(e.target.value)} maxLength={50} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="nBody">Details</label>
            <textarea id="nBody" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          {formError && <p className="alert alert-error">{formError}</p>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ alignSelf: "flex-start" }}>
            {submitting ? "Posting…" : "Post Notice"}
          </button>
        </form>
      )}

      {listError && <p className="alert alert-error" style={{ marginTop: 16 }}>{listError}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : notices.length === 0 ? (
        <p className="dash-empty">No notices yet.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Class</th>
                <th>Posted</th>
                {canPublish && <th />}
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id}>
                  <td>{n.title}</td>
                  <td>{n.target_class || "All"}</td>
                  <td>{new Date(n.created_at).toLocaleDateString("en-IN")}</td>
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
  );
}
