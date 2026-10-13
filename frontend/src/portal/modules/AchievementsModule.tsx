import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import type { Achievement } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Skeleton, StatusPill, errText, listAll, useUI } from "../ui/kitExports";

const CATS: Record<Achievement["category"], string> = { ACADEMIC: "Academic", SPORTS: "Sports", ARTS: "Arts & culture", OTHER: "Other" };
type Draft = { id?: string; title: string; year: string; category: Achievement["category"]; description: string; image: string | null };
const blank = (): Draft => ({ title: "", year: String(new Date().getFullYear()), category: "ACADEMIC", description: "", image: null });

export function AchievementsModule() {
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await listAll<Achievement>("/content/achievements/")); } catch (e) { toast("error", errText(e, "Could not load achievements.")); setItems([]); }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", draft.title.trim());
      fd.append("year", draft.year);
      fd.append("category", draft.category);
      fd.append("description", draft.description);
      if (file) fd.append("image", file);
      if (draft.id) await api.patch(`/content/achievements/${draft.id}/`, fd, { isMultipart: true });
      else await api.postForm("/content/achievements/", fd);
      toast("success", "Saved — it is now on the website's Achievements page.");
      setDraft(null);
      setFile(null);
      load();
    } catch (err) { toast("error", errText(err, "Could not save.")); } finally { setSaving(false); }
  }
  async function remove(a: Achievement) {
    if (!(await confirm({ title: "Remove this achievement?", message: `“${a.title}” will disappear from the website.`, confirmLabel: "Remove", danger: true }))) return;
    try { await api.del(`/content/achievements/${a.id}/`); load(); toast("success", "Removed."); } catch (err) { toast("error", errText(err, "Could not remove.")); }
  }

  return (
    <>
      <PageHeader icon="award" title="Achievements" sub="Add real, confirmed achievements. They appear on the public Achievements page, grouped by year." actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => { setFile(null); setDraft(blank()); }}><Icon name="plus" size={16} /> Add achievement</button>} />
      {items === null ? <Skeleton variant="cards" rows={3} /> : items.length === 0 ? (
        <EmptyState icon="award" title="No achievements yet" text="The public page shows a friendly “coming soon” message until you add the first one." action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(blank())}>Add the first</button>} />
      ) : (
        <div className="cards">
          {items.map((a) => (
            <article className="rcard" key={a.id}>
              <div className="rcard-head"><div className="row-main"><strong>{a.title}</strong><span>{a.year}</span></div><StatusPill tone="info">{CATS[a.category]}</StatusPill></div>
              {a.description && <p className="rcard-msg">{a.description}</p>}
              <div className="rcard-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setFile(null); setDraft({ id: a.id, title: a.title, year: String(a.year), category: a.category, description: a.description, image: a.image }); }}><Icon name="edit" size={15} /> Edit</button>
                <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} onClick={() => remove(a)} aria-label="Remove"><Icon name="trash" size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={draft !== null} title={draft?.id ? "Edit achievement" : "Add achievement"} onClose={() => setDraft(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button><button type="submit" form="ach-form" className="btn btn-primary btn-sm" disabled={saving || !draft?.title.trim()}>{saving ? "Saving…" : "Save"}</button></>}>
        {draft && (
          <form id="ach-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="aTitle">Title</label><input id="aTitle" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required /></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="aYear">Year</label><input id="aYear" type="number" min={1964} max={new Date().getFullYear() + 1} value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} required /></div>
              <div className="form-field"><label htmlFor="aCat">Category</label><select id="aCat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Achievement["category"] })}>{Object.entries(CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            <div className="form-field"><label htmlFor="aDesc">Details (optional)</label><textarea id="aDesc" rows={4} maxLength={1500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="form-field"><label htmlFor="aImg">Photo (optional{draft.image ? ", a new one replaces the current" : ""})</label><input id="aImg" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          </form>
        )}
      </Modal>
    </>
  );
}
