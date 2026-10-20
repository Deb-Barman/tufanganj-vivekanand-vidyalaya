import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { SchoolForm } from "../../types/api";
import { MediaSourceField } from "../ui/MediaSourceField";
import { appendMedia, emptyMedia, mediaChosen, mediaInvalid } from "../ui/mediaHelpers";
import type { MediaValue } from "../ui/mediaHelpers";
import { EmptyState, Icon, Modal, PageHeader, Skeleton, errText, fmtDate, listAll, useDebounced, useUI } from "../ui/kitExports";

type Draft = { id?: string; title: string; file?: string; source?: SchoolForm["source"] };

export function DownloadsModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const canManage = user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState<SchoolForm[] | null>(null);
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [media, setMedia] = useState<MediaValue>(emptyMedia);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listAll<SchoolForm>("/content/forms/"));
    } catch (e) {
      toast("error", errText(e, "Could not load downloads."));
      setItems([]);
    }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter((i) => !s || i.title.toLowerCase().includes(s));
  }, [items, q]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.id && !mediaChosen(media)) { toast("error", "Upload a file or paste a link first."); return; }
    if (mediaInvalid("file", media)) { toast("error", "Fix the file link first."); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", draft.title.trim());
      appendMedia(fd, media, "file", "file_link");
      if (draft.id) await api.patch(`/content/forms/${draft.id}/`, fd, { isMultipart: true });
      else await api.postForm("/content/forms/", fd);
      toast("success", draft.id ? "Download updated." : "File uploaded.");
      setDraft(null);
      setMedia(emptyMedia);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not save the file."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(f: SchoolForm) {
    if (!(await confirm({ title: "Delete this file?", message: `“${f.title}” will be removed from the Downloads page.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/content/forms/${f.id}/`);
      setItems((p) => p?.filter((x) => x.id !== f.id) ?? p);
      toast("success", "File deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete the file."));
    }
  }

  return (
    <>
      <PageHeader icon="download" title="Downloads" sub={canManage ? "Add forms and documents by upload (max 10 MB) or — to save storage — by pasting a Google Drive share link." : "Downloadable school forms and documents."} actions={canManage && (<button type="button" className="btn btn-primary btn-sm" onClick={() => { setMedia(emptyMedia); setDraft({ title: "" }); }}><Icon name="plus" size={16} /> Add file</button>)} />
      <div className="toolbar">
        <div className="search-box grow"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search downloads" aria-label="Search downloads" /></div>
      </div>
      {items === null ? <Skeleton rows={3} /> : shown.length === 0 ? (
        <EmptyState icon="download" title={items.length === 0 ? "No files yet" : "Nothing found"} text={items.length === 0 && canManage ? "Use “Upload file” to add the first one." : undefined} />
      ) : (
        <div className="list">
          {shown.map((f) => (
            <div key={f.id} className="row-link">
              <span className="row-icon"><Icon name="file" size={20} /></span>
              <span className="row-main"><strong>{f.title}</strong><span>{f.source === "link" ? "Link" : "Uploaded"} · {fmtDate(f.created_at)}</span></span>
              <a className="btn btn-outline btn-sm" href={f.file} target="_blank" rel="noopener noreferrer"><Icon name="download" size={15} /> Open</a>
              {canManage && (<><button type="button" className="icon-btn" onClick={() => { setMedia(emptyMedia); setDraft({ id: f.id, title: f.title, file: f.file, source: f.source }); }} aria-label={`Edit ${f.title}`}><Icon name="edit" size={17} /></button><button type="button" className="icon-btn danger" onClick={() => remove(f)} aria-label={`Delete ${f.title}`}><Icon name="trash" size={17} /></button></>)}
            </div>
          ))}
        </div>
      )}
      <Modal open={draft !== null} title={draft?.id ? "Edit download" : "Add file"} onClose={() => setDraft(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button><button type="submit" form="download-form" className="btn btn-primary btn-sm" disabled={saving || !draft?.title.trim() || (!draft?.id && !mediaChosen(media)) || mediaInvalid("file", media)}>{saving ? "Saving…" : draft?.id ? "Save changes" : "Add"}</button></>}>
        {draft && (
          <form id="download-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="fTitle">Title</label><input id="fTitle" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required /></div>
            <MediaSourceField kind="file" idPrefix="f" label={draft.id ? "Replace file (optional)" : "File"} accept=".pdf,.doc,.docx" value={media} onChange={setMedia} current={draft.id ? { url: draft.file ?? null, source: draft.source ?? null } : undefined} />
          </form>
        )}
      </Modal>
    </>
  );
}
