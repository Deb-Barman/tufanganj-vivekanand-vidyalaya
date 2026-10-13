import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { ContactMessage } from "../../types/api";
import { Avatar, EmptyState, Icon, PageHeader, Segmented, Skeleton, StatusPill, errText, fmtDate, listAll, useUI } from "../ui/kitExports";

type Filter = "ALL" | ContactMessage["status"];
const TONE = { NEW: "warn", READ: "info", REPLIED: "good" } as const;

export function MessagesModule() {
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<ContactMessage[] | null>(null);
  const [filter, setFilter] = useState<Filter>("NEW");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listAll<ContactMessage>("/content/contact/")
      .then((rows) => { setItems(rows); if (!rows.some((r) => r.status === "NEW")) setFilter("ALL"); })
      .catch((e) => { toast("error", errText(e, "Could not load messages.")); setItems([]); });
  }, [toast]);

  const counts = useMemo(() => {
    const c = { ALL: items?.length ?? 0, NEW: 0, READ: 0, REPLIED: 0 };
    items?.forEach((i) => (c[i.status] += 1));
    return c;
  }, [items]);
  const shown = (items ?? []).filter((i) => filter === "ALL" || i.status === filter);

  async function setStatus(m: ContactMessage, status: ContactMessage["status"]) {
    setBusy(m.id);
    try {
      const updated = await api.patch<ContactMessage>(`/content/contact/${m.id}/`, { status });
      setItems((p) => p?.map((x) => (x.id === m.id ? updated : x)) ?? p);
    } catch (e) { toast("error", errText(e, "Could not update.")); } finally { setBusy(null); }
  }
  async function remove(m: ContactMessage) {
    if (!(await confirm({ title: "Delete this message?", message: `From ${m.name}: ${m.subject}`, confirmLabel: "Delete", danger: true }))) return;
    try { await api.del(`/content/contact/${m.id}/`); setItems((p) => p?.filter((x) => x.id !== m.id) ?? p); toast("success", "Deleted."); } catch (e) { toast("error", errText(e, "Could not delete.")); }
  }

  return (
    <>
      <PageHeader icon="mail" title="Messages" sub="Messages sent from the website's Contact page. Reply by email, phone or WhatsApp, then mark them replied." />
      <div className="toolbar">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "NEW", label: "New", count: counts.NEW }, { value: "READ", label: "Read", count: counts.READ }, { value: "REPLIED", label: "Replied", count: counts.REPLIED }, { value: "ALL", label: "All", count: counts.ALL }]} />
      </div>
      {items === null ? <Skeleton variant="cards" rows={3} /> : shown.length === 0 ? (
        <EmptyState icon="mail" title={items.length === 0 ? "No messages yet" : "Nothing here"} text={items.length === 0 ? "When someone writes through the Contact page, it appears here." : "Try a different filter."} />
      ) : (
        <div className="cards">
          {shown.map((m) => {
            const digits = m.phone.replace(/\D/g, "");
            return (
              <article className="rcard" key={m.id}>
                <div className="rcard-head">
                  <Avatar name={m.name} />
                  <div className="row-main"><strong>{m.name}</strong><span>{fmtDate(m.created_at)}</span></div>
                  <StatusPill tone={TONE[m.status]}>{m.status.toLowerCase()}</StatusPill>
                </div>
                <strong style={{ fontSize: 15 }}>{m.subject}</strong>
                <p className="rcard-msg">{m.message}</p>
                <div className="rcard-actions">
                  {m.email && <a className="btn btn-outline btn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}`} onClick={() => m.status === "NEW" && setStatus(m, "READ")}><Icon name="mail" size={15} /> Email</a>}
                  {m.phone && <a className="btn btn-outline btn-sm" href={`tel:${m.phone}`}><Icon name="phone" size={15} /> Call</a>}
                  {m.phone && <a className="btn btn-outline btn-sm" href={`https://wa.me/${digits.length === 10 ? "91" + digits : digits}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                  {m.status !== "REPLIED" ? <button type="button" className="btn btn-primary btn-sm" disabled={busy === m.id} onClick={() => setStatus(m, "REPLIED")}>Mark replied</button> : <button type="button" className="btn btn-ghost btn-sm" disabled={busy === m.id} onClick={() => setStatus(m, "READ")}>Reopen</button>}
                  <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} onClick={() => remove(m)} aria-label="Delete message"><Icon name="trash" size={17} /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
