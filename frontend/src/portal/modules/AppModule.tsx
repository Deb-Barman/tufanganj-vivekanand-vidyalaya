import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { APP_PLATFORMS } from "../../types/api";
import type { AppPlatform, AppRelease } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Select, Skeleton, StatusPill, errText, fmtDate, listAll, useUI } from "../ui/kitExports";

type Draft = { id?: string; name: string; platform: AppPlatform; version: string; size_text: string; notes: string; download_link: string; is_published: boolean };
const blank = (): Draft => ({ name: "TVV School App", platform: "ANDROID", version: "", size_text: "", notes: "", download_link: "", is_published: true });

/** Super Admin → "App": the downloads shown on the public /app page. Each one is a pasted public link. */
export function AppModule() {
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<AppRelease[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listAll<AppRelease>("/content/apps/"));
    } catch (e) {
      toast("error", errText(e, "Could not load the app downloads."));
      setItems([]);
    }
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
      const { id, ...body } = draft;
      if (id) await api.patch(`/content/apps/${id}/`, body);
      else await api.post("/content/apps/", body);
      toast("success", id ? "App updated." : "App added to the website.");
      setDraft(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not save the app."));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(a: AppRelease) {
    try {
      await api.patch(`/content/apps/${a.id}/`, { is_published: !a.is_published });
      setItems((p) => p?.map((x) => (x.id === a.id ? { ...x, is_published: !a.is_published } : x)) ?? p);
      toast("success", a.is_published ? "Hidden from the website." : "Now shown on the website.");
    } catch (err) {
      toast("error", errText(err, "Could not change it."));
    }
  }

  async function remove(a: AppRelease) {
    if (!(await confirm({ title: "Delete this app?", message: `“${a.name}” will be removed from the App page.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/content/apps/${a.id}/`);
      setItems((p) => p?.filter((x) => x.id !== a.id) ?? p);
      toast("success", "Deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete."));
    }
  }

  return (
    <>
      <PageHeader icon="phone" title="App" sub="People download the school app from the website's App page (/app). Add each app file as a link — upload the file to Google Drive (Anyone with the link) or GitHub Releases, then paste the link here." actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(blank())}><Icon name="plus" size={16} /> Add app</button>} />
      <div className="toolbar"><a className="btn btn-outline btn-sm" href="/app" target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} /> Open the App page</a></div>
      {items === null ? <Skeleton rows={3} /> : items.length === 0 ? (
        <EmptyState icon="phone" title="No app added yet" text="Use “Add app” to put a download on the website. Until then the App page shows how to add the website to a phone's home screen." />
      ) : (
        <div className="list">
          {items.map((a) => (
            <div key={a.id} className="row-link" style={{ alignItems: "flex-start" }}>
              <span className="row-icon"><Icon name="phone" size={20} /></span>
              <span className="row-main" style={{ whiteSpace: "normal" }}>
                <strong style={{ whiteSpace: "normal" }}>{a.name}</strong>
                <span style={{ whiteSpace: "normal" }}>{a.platform_label}{a.version ? ` · v${a.version}` : ""}{a.size_text ? ` · ${a.size_text}` : ""} · updated {fmtDate(a.updated_at)}</span>
              </span>
              <StatusPill tone={a.is_published ? "good" : "muted"}>{a.is_published ? "shown" : "hidden"}</StatusPill>
              <a className="btn btn-outline btn-sm" href={a.download_url ?? a.download_link} target="_blank" rel="noopener noreferrer"><Icon name="download" size={15} /> Test</a>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggle(a)}>{a.is_published ? "Hide" : "Show"}</button>
              <button type="button" className="icon-btn" onClick={() => setDraft({ id: a.id, name: a.name, platform: a.platform, version: a.version, size_text: a.size_text, notes: a.notes, download_link: a.download_link, is_published: a.is_published ?? true })} aria-label={`Edit ${a.name}`}><Icon name="edit" size={17} /></button>
              <button type="button" className="icon-btn danger" onClick={() => void remove(a)} aria-label={`Delete ${a.name}`}><Icon name="trash" size={17} /></button>
            </div>
          ))}
        </div>
      )}
      <Modal open={draft !== null} title={draft?.id ? "Edit app" : "Add app"} onClose={() => setDraft(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button><button type="submit" form="app-form" className="btn btn-primary btn-sm" disabled={saving || !draft?.name.trim() || !draft?.download_link.trim()}>{saving ? "Saving…" : draft?.id ? "Save changes" : "Add"}</button></>}>
        {draft && (
          <form id="app-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="apName">App name</label><input id="apName" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="apPlat">Device</label><Select id="apPlat" value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value as AppPlatform })}>{APP_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select></div>
              <div className="form-field"><label htmlFor="apVer">Version (optional)</label><input id="apVer" value={draft.version} maxLength={30} placeholder="1.0" onChange={(e) => setDraft({ ...draft, version: e.target.value })} /></div>
            </div>
            <div className="form-field"><label htmlFor="apLink">Download link</label><input id="apLink" type="url" inputMode="url" value={draft.download_link} maxLength={1000} placeholder="https://drive.google.com/file/d/…" onChange={(e) => setDraft({ ...draft, download_link: e.target.value })} required />
              <small style={{ color: "var(--fg-faint)" }}>A Google Drive file shared with “Anyone with the link”, a GitHub Releases file, or a store page. Use “Test” afterwards to check it opens.</small></div>
            <div className="form-field"><label htmlFor="apSize">File size (optional)</label><input id="apSize" value={draft.size_text} maxLength={30} placeholder="24 MB" onChange={(e) => setDraft({ ...draft, size_text: e.target.value })} /></div>
            <div className="form-field"><label htmlFor="apNotes">What’s new (optional)</label><textarea id="apNotes" rows={4} value={draft.notes} maxLength={2000} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}><input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} /> Show on the website</label>
          </form>
        )}
      </Modal>
    </>
  );
}
