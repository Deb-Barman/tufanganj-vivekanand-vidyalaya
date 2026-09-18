import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Paginated, SchoolForm } from "../../types/api";

export function DownloadsModule() {
  const { user } = useAuth();
  const canManage = user?.role === "SUPER_ADMIN";

  const [forms, setForms] = useState<SchoolForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Paginated<SchoolForm>>("/content/forms/");
      setForms(data.results);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not load forms.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setFormError("Choose a file first.");
      return;
    }
    if (!title.trim()) {
      setFormError("Give the form a title.");
      return;
    }
    setFormError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      const created = await api.postForm<SchoolForm>("/content/forms/", formData);
      setForms((prev) => [created, ...prev]);
      setFile(null);
      setTitle("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(form: SchoolForm) {
    setBusyId(form.id);
    try {
      await api.del(`/content/forms/${form.id}/`);
      setForms((prev) => prev.filter((f) => f.id !== form.id));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not delete file.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="dash-panel">
      <h2>Downloads</h2>
      <p className="dash-panel-sub">
        {canManage ? "Upload downloadable forms and documents (max 10 MB, PDF/Word)." : "Downloadable school forms and documents."}
      </p>

      {canManage && (
        <form className="dash-form" onSubmit={handleUpload}>
          <div className="ff-row">
            <div className="form-field">
              <label htmlFor="fTitle">Title</label>
              <input id="fTitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </div>
            <div className="form-field">
              <label htmlFor="fFile">File</label>
              <input id="fFile" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          {formError && <p className="alert alert-error">{formError}</p>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={uploading} style={{ alignSelf: "flex-start" }}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      )}

      {listError && <p className="alert alert-error" style={{ marginTop: 16 }}>{listError}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : forms.length === 0 ? (
        <p className="dash-empty">No forms uploaded yet.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Uploaded</th>
                <th />
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td>{f.title}</td>
                  <td>{new Date(f.created_at).toLocaleDateString("en-IN")}</td>
                  <td>
                    <a href={f.file} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                      Download
                    </a>
                  </td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === f.id} onClick={() => handleDelete(f)}>
                        Remove
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
