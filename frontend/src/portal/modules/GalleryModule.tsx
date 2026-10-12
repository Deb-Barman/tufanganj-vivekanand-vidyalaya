import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { GalleryImage } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Skeleton, errText, listAll, useDebounced, useUI } from "../ui/kitExports";

type Draft = { id?: string; caption: string; image?: string };

export function GalleryModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const canManage = user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState<GalleryImage[] | null>(null);
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listAll<GalleryImage>("/content/gallery/"));
    } catch (e) {
      toast("error", errText(e, "Could not load the gallery."));
      setItems([]);
    }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter((i) => !s || i.caption.toLowerCase().includes(s));
  }, [items, q]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.id && !file) { toast("error", "Choose an image first."); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("caption", draft.caption.trim());
      if (file) fd.append("image", file);
      if (draft.id) await api.patch(`/content/gallery/${draft.id}/`, fd, { isMultipart: true });
      else await api.postForm("/content/gallery/", fd);
      toast("success", draft.id ? "Photo updated." : "Photo uploaded.");
      setDraft(null);
      setFile(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not save the photo."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(img: GalleryImage) {
    if (!(await confirm({ title: "Delete this photo?", message: img.caption || "It will be removed from the gallery.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/content/gallery/${img.id}/`);
      setItems((p) => p?.filter((x) => x.id !== img.id) ?? p);
      toast("success", "Photo deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete the photo."));
    }
  }

  return (
    <>
      <PageHeader icon="image" title="Gallery" sub={canManage ? "Upload, caption, replace or remove school photos (max 5 MB, JPEG/PNG/WebP)." : "School photo gallery."} actions={canManage && (<button type="button" className="btn btn-primary btn-sm" onClick={() => { setFile(null); setDraft({ caption: "" }); }}><Icon name="plus" size={16} /> Upload photo</button>)} />
      <div className="toolbar">
        <div className="search-box grow"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search captions" aria-label="Search photos" /></div>
      </div>
      {items === null ? <Skeleton rows={3} /> : shown.length === 0 ? (
        <EmptyState icon="image" title={items.length === 0 ? "No photos yet" : "Nothing found"} text={items.length === 0 && canManage ? "Use “Upload photo” to add the first one." : undefined} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
          {shown.map((img) => (
            <div key={img.id} className="stack" style={{ gap: 6 }}>
              <img src={img.image} alt={img.caption || "Gallery photo"} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }} />
              {img.caption && <span className="mini-meta">{img.caption}</span>}
              {canManage && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setFile(null); setDraft({ id: img.id, caption: img.caption, image: img.image }); }}><Icon name="edit" size={15} /> Edit</button>
                  <button type="button" className="icon-btn danger" onClick={() => remove(img)} aria-label="Delete photo"><Icon name="trash" size={17} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={draft !== null} title={draft?.id ? "Edit photo" : "Upload photo"} onClose={() => setDraft(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button><button type="submit" form="gallery-form" className="btn btn-primary btn-sm" disabled={saving || (!draft?.id && !file)}>{saving ? "Saving…" : draft?.id ? "Save changes" : "Upload"}</button></>}>
        {draft && (
          <form id="gallery-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            {draft.image && !file && <img src={draft.image} alt="Current" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} />}
            <div className="form-field"><label htmlFor="gFile">{draft.id ? "Replace image (optional)" : "Image"}</label><input id="gFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <div className="form-field"><label htmlFor="gCaption">Caption (optional)</label><input id="gCaption" value={draft.caption} maxLength={200} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} /></div>
          </form>
        )}
      </Modal>
    </>
  );
}
