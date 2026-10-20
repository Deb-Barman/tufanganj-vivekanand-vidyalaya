import { useEffect, useState } from "react";
import { MediaSourceField } from "../ui/MediaSourceField";
import { appendMedia, emptyMedia, mediaInvalid } from "../ui/mediaHelpers";
import type { MediaValue } from "../ui/mediaHelpers";
import type { FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Article, Paginated } from "../../types/api";

export function BlogModule() {
  const { user } = useAuth();
  const canPublish = user?.role === "SUPER_ADMIN";

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState<MediaValue>(emptyMedia);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setListError(null);
    try {
      // Super Admin's queryset (server-side) includes drafts; everyone
      // else's is filtered to published only — same endpoint, scoped by
      // the backend, never by a frontend filter.
      const data = await api.get<Paginated<Article>>("/content/articles/");
      setArticles(data.results);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not load articles.");
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
      const formData = new FormData();
      formData.append("title", title);
      formData.append("excerpt", excerpt);
      formData.append("body", body);
      formData.append("published", "false");
      if (mediaInvalid("image", cover)) { setFormError("Fix the cover picture link first."); setSubmitting(false); return; }
      appendMedia(formData, cover, "cover_image", "cover_link");
      const created = await api.postForm<Article>("/content/articles/", formData);
      setArticles((prev) => [created, ...prev]);
      setTitle("");
      setExcerpt("");
      setBody("");
      setCover(emptyMedia);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save the article.");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePublish(article: Article) {
    setBusyId(article.id);
    try {
      const updated = await api.patch<Article>(`/content/articles/${article.id}/`, { published: !article.published });
      setArticles((prev) => prev.map((a) => (a.id === article.id ? updated : a)));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not update the article.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await api.del(`/content/articles/${id}/`);
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not delete the article.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="dash-panel">
      <h2>Blog & Articles</h2>
      <p className="dash-panel-sub">
        {canPublish
          ? "Draft, publish, or unpublish articles. Only published articles show on the public site."
          : "Published school news and articles."}
      </p>

      {canPublish && (
        <form className="dash-form" onSubmit={handleCreate}>
          <div className="form-field">
            <label htmlFor="aTitle">Title</label>
            <input id="aTitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>
          <div className="form-field">
            <label htmlFor="aExcerpt">Excerpt (short summary)</label>
            <input id="aExcerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={300} />
          </div>
          <MediaSourceField kind="image" idPrefix="aCover" label="Cover picture (optional)" accept="image/jpeg,image/png,image/webp" value={cover} onChange={setCover} />
          <div className="form-field">
            <label htmlFor="aBody">Body</label>
            <textarea id="aBody" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          {formError && <p className="alert alert-error">{formError}</p>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ alignSelf: "flex-start" }}>
            {submitting ? "Saving…" : "Save as Draft"}
          </button>
        </form>
      )}

      {listError && <p className="alert alert-error" style={{ marginTop: 16 }}>{listError}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : articles.length === 0 ? (
        <p className="dash-empty">No articles yet.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Posted</th>
                {canPublish && <th />}
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{a.published ? "Published" : "Draft"}</td>
                  <td>{new Date(a.created_at).toLocaleDateString("en-IN")}</td>
                  {canPublish && (
                    <td style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => togglePublish(a)}>
                        {a.published ? "Unpublish" : "Publish"}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => handleDelete(a.id)}>
                        Delete
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
