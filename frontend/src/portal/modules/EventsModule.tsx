import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { EventItem } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Segmented, Skeleton, errText, fmtDate, listAll, todayISO, useDebounced, useUI, DateField } from "../ui/kitExports";

type Draft = { id?: string; title: string; event_date: string; audience: string; description: string };
const blank = (): Draft => ({ title: "", event_date: todayISO(), audience: "", description: "" });

export function EventsModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const canManage = user?.role === "SUPER_ADMIN";

  const [items, setItems] = useState<EventItem[] | null>(null);
  const [tab, setTab] = useState<"up" | "past" | "all">("up");
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listAll<EventItem>("/content/events/"));
    } catch (e) {
      toast("error", errText(e, "Could not load events."));
      setItems([]);
    }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const today = todayISO();
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? [])
      .filter((e) => (tab === "all" || (tab === "up" ? e.event_date >= today : e.event_date < today)) && (!s || `${e.title} ${e.audience} ${e.description}`.toLowerCase().includes(s)))
      .sort((a, b) => (tab === "past" ? b.event_date.localeCompare(a.event_date) : a.event_date.localeCompare(b.event_date)));
  }, [items, tab, q, today]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      const body = { title: draft.title.trim(), event_date: draft.event_date, audience: draft.audience.trim(), description: draft.description };
      if (draft.id) await api.patch(`/content/events/${draft.id}/`, body);
      else await api.post("/content/events/", body);
      toast("success", draft.id ? "Event updated." : "Event added.");
      setDraft(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not save the event."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(ev: EventItem) {
    if (!(await confirm({ title: "Delete this event?", message: `“${ev.title}” will be removed from the calendar.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/content/events/${ev.id}/`);
      setItems((p) => p?.filter((x) => x.id !== ev.id) ?? p);
      toast("success", "Event deleted.");
    } catch (err) {
      toast("error", errText(err, "Could not delete the event."));
    }
  }

  return (
    <>
      <PageHeader icon="calendar" title="Events" sub={canManage ? "Add, edit or remove school events." : "School events."} actions={canManage && (<button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(blank())}><Icon name="plus" size={16} /> Add event</button>)} />
      <div className="toolbar">
        <Segmented value={tab} onChange={setTab} options={[{ value: "up", label: "Upcoming" }, { value: "past", label: "Past" }, { value: "all", label: "All" }]} />
        <div className="search-box grow"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events" aria-label="Search events" /></div>
      </div>
      {items === null ? <Skeleton rows={4} /> : shown.length === 0 ? (
        <EmptyState icon="calendar" title={items.length === 0 ? "No events yet" : "Nothing here"} text={items.length === 0 && canManage ? "Use “Add event” to put the first one on the calendar." : "Try another tab or search."} />
      ) : (
        <div className="list">
          {shown.map((ev) => {
            const d = new Date(ev.event_date + "T00:00:00");
            return (
              <div key={ev.id} className="row-link">
                <span className="row-icon" style={{ flexDirection: "column", lineHeight: 1, width: 52, height: 52 }}><b style={{ fontSize: 18, color: "var(--fg)" }}>{d.getDate()}</b><small style={{ fontSize: 10, textTransform: "uppercase" }}>{d.toLocaleDateString("en-IN", { month: "short" })}</small></span>
                <span className="row-main"><strong>{ev.title}</strong><span>{fmtDate(ev.event_date)} · {ev.audience || "Everyone"}{ev.description ? ` · ${ev.description.slice(0, 80)}${ev.description.length > 80 ? "…" : ""}` : ""}</span></span>
                {canManage && (<><button type="button" className="icon-btn" onClick={() => setDraft({ id: ev.id, title: ev.title, event_date: ev.event_date, audience: ev.audience, description: ev.description })} aria-label={`Edit ${ev.title}`}><Icon name="edit" size={17} /></button><button type="button" className="icon-btn danger" onClick={() => remove(ev)} aria-label={`Delete ${ev.title}`}><Icon name="trash" size={17} /></button></>)}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={draft !== null} title={draft?.id ? "Edit event" : "Add event"} onClose={() => setDraft(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button><button type="submit" form="event-form" className="btn btn-primary btn-sm" disabled={saving || !draft?.title.trim()}>{saving ? "Saving…" : "Save"}</button></>}>
        {draft && (
          <form id="event-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="eTitle">Title</label><input id="eTitle" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required /></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="eDate">Date</label><DateField id="eDate" value={draft.event_date} onChange={(v) => setDraft({ ...draft, event_date: v })} required /></div>
              <div className="form-field"><label htmlFor="eAud">Audience (optional)</label><input id="eAud" value={draft.audience} maxLength={100} placeholder="e.g. All classes" onChange={(e) => setDraft({ ...draft, audience: e.target.value })} /></div>
            </div>
            <div className="form-field"><label htmlFor="eDesc">Description</label><textarea id="eDesc" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          </form>
        )}
      </Modal>
    </>
  );
}
