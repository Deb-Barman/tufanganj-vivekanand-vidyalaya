import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Article } from "../../types/api";
import { AdjustedImg } from "../../components/media/AdjustedImg";
import { MediaSourceField } from "../ui/MediaSourceField";
import { appendMedia, emptyMedia, mediaInvalid } from "../ui/mediaHelpers";
import type { MediaValue } from "../ui/mediaHelpers";
import { SkBlog } from "../ui/Skeletons";
import { EmptyState, Icon, Modal, PageHeader, StatusPill, errText, fmtDate, listAll, useUI } from "../ui/kitExports";
import "./blog.css";

type Draft = { id?: string; title: string; excerpt: string; body: string; cover: string | null; source?: Article["source"]; adjust: string };
const blank = (): Draft => ({ title: "", excerpt: "", body: "", cover: null, adjust: "" });

/** Blog & Articles. Everyone reads published articles as cards; the Super Admin writes, edits, publishes and deletes. */
export function BlogModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const canPublish = user?.role === "SUPER_ADMIN";

  const [articles, setArticles] = useState<Article[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cover, setCover] = useState<MediaValue>(emptyMedia);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState<Article | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // The server decides what each role may see (drafts are for the Super Admin only) — never a frontend filter.
      setArticles(await listAll<Article>("/content/articles/"));
    } catch (e) {
      toast("error", errText(e, "Could not load articles."));
      setArticles([]);
    }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const openNew = () => { setCover(emptyMedia); setDraft(blank()); };
  const openEdit = (a: Article) => { setCover(emptyMedia); setDraft({ id: a.id, title: a.title, excerpt: a.excerpt, body: a.body, cover: a.cover_image, source: a.source, adjust: a.cover_adjust ?? "" }); };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (mediaInvalid("image", cover)) { toast("error", "Fix the cover picture link first."); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", draft.title);
      fd.append("excerpt", draft.excerpt);
      fd.append("body", draft.body);
      appendMedia(fd, cover, "cover_image", "cover_link");
      fd.append("cover_adjust", draft.adjust);
      if (draft.id) {
        const updated = await api.patch<Article>(`/content/articles/${draft.id}/`, fd, { isMultipart: true });
        setArticles((p) => p?.map((a) => (a.id === updated.id ? updated : a)) ?? p);
        toast("success", "Article saved.");
      } else {
        fd.append("published", "false");
        const created = await api.postForm<Article>("/content/articles/", fd);
        setArticles((p) => [created, ...(p ?? [])]);
        toast("success", "Saved as a draft. Press Publish when it is ready.");
      }
      setDraft(null);
      setCover(emptyMedia);
    } catch (err) {
      toast("error", errText(err, "Could not save the article."));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(a: Article) {
    setBusyId(a.id);
    try {
      const updated = await api.patch<Article>(`/content/articles/${a.id}/`, { published: !a.published });
      setArticles((p) => p?.map((x) => (x.id === a.id ? updated : x)) ?? p);
      toast("success", updated.published ? "Published on the website." : "Moved back to drafts.");
    } catch (err) {
      toast("error", errText(err, "Could not update the article."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(a: Article) {
    if (!(await confirm({ title: "Delete this article?", message: `“${a.title}” will be removed for good.`, confirmLabel: "Delete", danger: true }))) return;
    setBusyId(a.id);
    try {
      await api.del(`/content/articles/${a.id}/`);
      setArticles((p) => p?.filter((x) => x.id !== a.id) ?? p);
      toast("success", "Article deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete the article."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        icon="book"
        title="Blog & Articles"
        sub={canPublish ? "Write, publish or unpublish articles. Only published articles show on the public website." : "School news and stories."}
        actions={canPublish && (<button type="button" className="btn btn-primary btn-sm" onClick={openNew}><Icon name="plus" size={16} /> New article</button>)}
      />

      {articles === null ? (
        <SkBlog />
      ) : articles.length === 0 ? (
        <EmptyState icon="book" title="No articles yet" text={canPublish ? "Use “New article” to write the first one." : "New stories appear here as soon as the school publishes them."} />
      ) : (
        <div className="bl-grid">
          {articles.map((a) => (
            <article className="bl-card" key={a.id}>
              <button type="button" className="bl-open" onClick={() => setReading(a)} aria-label={`Read: ${a.title}`}>
                <span className="bl-cover">
                  {a.cover_image ? <AdjustedImg src={a.cover_image} adjust={a.cover_adjust} alt="" /> : <Icon name="book" size={34} />}
                  {canPublish && <span className="bl-flag"><StatusPill tone={a.published ? "good" : "warn"}>{a.published ? "Published" : "Draft"}</StatusPill></span>}
                </span>
                <span className="bl-body">
                  <strong>{a.title}</strong>
                  {a.excerpt && <span className="bl-ex">{a.excerpt}</span>}
                  <span className="bl-meta"><span>{fmtDate(a.created_at)}</span><span className="bl-read">Read →</span></span>
                </span>
              </button>
              {canPublish && (
                <div className="bl-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(a)}><Icon name="edit" size={15} /> Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => togglePublish(a)}>{a.published ? "Unpublish" : "Publish"}</button>
                  <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} disabled={busyId === a.id} onClick={() => remove(a)} aria-label={`Delete ${a.title}`}><Icon name="trash" size={17} /></button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal open={reading !== null} title={reading?.title ?? ""} size="lg" onClose={() => setReading(null)} footer={reading?.published ? <a className="btn btn-outline btn-sm" href={`/blog/${reading.slug}`} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} /> Open on the website</a> : undefined}>
        {reading && (
          <div className="bl-read-view">
            {reading.cover_image && <div className="bl-read-cover"><AdjustedImg src={reading.cover_image} adjust={reading.cover_adjust} alt="" loading="eager" /></div>}
            <p className="bl-read-meta">{fmtDate(reading.created_at)}{canPublish && !reading.published ? " · Draft" : ""}</p>
            <div className="bl-read-body">{reading.body}</div>
          </div>
        )}
      </Modal>

      <Modal
        open={draft !== null}
        title={draft?.id ? "Edit article" : "New article"}
        size="lg"
        onClose={() => setDraft(null)}
        footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button><button type="submit" form="article-form" className="btn btn-primary btn-sm" disabled={saving || !draft?.title.trim() || !draft?.body.trim() || mediaInvalid("image", cover)}>{saving ? "Saving…" : draft?.id ? "Save changes" : "Save as draft"}</button></>}
      >
        {draft && (
          <form id="article-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="aTitle">Title</label><input id="aTitle" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={200} required /></div>
            <div className="form-field"><label htmlFor="aExcerpt">Excerpt (short summary)</label><input id="aExcerpt" value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} maxLength={300} /></div>
            <MediaSourceField
              kind="image"
              idPrefix="aCover"
              label={draft.id ? "Cover picture (optional — a new one replaces the current)" : "Cover picture (optional)"}
              accept="image/jpeg,image/png,image/webp"
              value={cover}
              onChange={setCover}
              current={draft.id ? { url: draft.cover, source: draft.source ?? null } : undefined}
              adjust={{ value: draft.adjust, onChange: (v) => setDraft((d) => (d ? { ...d, adjust: v } : d)), shape: "wide" }}
            />
            <div className="form-field"><label htmlFor="aBody">Body</label><textarea id="aBody" rows={9} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} required /></div>
          </form>
        )}
      </Modal>
    </>
  );
}
