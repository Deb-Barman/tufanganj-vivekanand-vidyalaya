import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Notice } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Skeleton, errText, fmtDate, listAll, useDebounced, useUI } from "../ui/kitExports";

type Draft = { id?: string; title: string; target_class: string; body: string };
const blank = (): Draft => ({ title: "", target_class: "", body: "" });

export function NoticesModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const canPublish = user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState<Notice[] | null>(null);
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listAll<Notice>("/notices/"));
    } catch (e) {
      toast("error", errText(e, "Could not load notices."));
      setItems([]);
    }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter((n) => !s || `${n.title} ${n.body} ${n.target_class}`.toLowerCase().includes(s));
  }, [items, q]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      const body = { title: draft.title.trim(), body: draft.body, target_class: draft.target_class.trim() };
      if (draft.id) await api.patch(`/notices/${draft.id}/`, body);
      else await api.post("/notices/", body);
      toast("success", draft.id ? "Notice updated." : "Notice published — it is live on the website.");
      setDraft(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not save the notice."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(n: Notice) {
    if (!(await confirm({ title: "Delete this notice?", message: `“${n.title}” will disappear from the website and the portal.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/notices/${n.id}/`);
      setItems((p) => p?.filter((x) => x.id !== n.id) ?? p);
      toast("success", "Notice deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete the notice."));
    }
  }

  return (
    <>
      <PageHeader
        icon="megaphone"
        title="Notices"
        sub={canPublish ? "Publish, edit or remove notices — changes show immediately on the public site and in the portal." : "Notices published by the Super Admin."}
        actions={canPublish && (<button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(blank())}><Icon name="plus" size={16} /> New notice</button>)}
      />
      <div className="toolbar">
        <div className="search-box grow"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notices" aria-label="Search notices" /></div>
      </div>
      {items === null ? <Skeleton variant="cards" rows={4} /> : shown.length === 0 ? (
        <EmptyState icon="megaphone" title={items.length === 0 ? "No notices yet" : "Nothing found"} text={items.length === 0 && canPublish ? "Use “New notice” to publish the first one." : undefined} />
      ) : (
        <div className="cards">
          {shown.map((n) => (
            <article className="rcard" key={n.id}>
              <div className="rcard-head">
                <div className="row-main"><strong>{n.title}</strong><span>{n.target_class ? `For ${n.target_class}` : "For everyone"} · {fmtDate(n.created_at)}{n.created_by_name ? ` · ${n.created_by_name}` : ""}</span></div>
              </div>
              <p className="rcard-msg" style={open === n.id ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.body}</p>
              <div className="rcard-actions">
                {n.body.length > 160 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(open === n.id ? null : n.id)}>{open === n.id ? "Show less" : "Read all"}</button>}
                {canPublish && (
                  <>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft({ id: n.id, title: n.title, target_class: n.target_class, body: n.body })}><Icon name="edit" size={15} /> Edit</button>
                    <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} onClick={() => remove(n)} aria-label={`Delete ${n.title}`}><Icon name="trash" size={17} /></button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={draft !== null} title={draft?.id ? "Edit notice" : "New notice"} onClose={() => setDraft(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button><button type="submit" form="notice-form" className="btn btn-primary btn-sm" disabled={saving || !draft?.title.trim() || !draft?.body.trim()}>{saving ? "Saving…" : draft?.id ? "Save changes" : "Publish"}</button></>}>
        {draft && (
          <form id="notice-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="nTitle">Title</label><input id="nTitle" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required /></div>
            <div className="form-field"><label htmlFor="nClass">Target class (optional)</label><input id="nClass" value={draft.target_class} maxLength={50} placeholder="Leave empty for everyone" onChange={(e) => setDraft({ ...draft, target_class: e.target.value })} /></div>
            <div className="form-field"><label htmlFor="nBody">Details</label><textarea id="nBody" rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} required /></div>
          </form>
        )}
      </Modal>
    </>
  );
}
