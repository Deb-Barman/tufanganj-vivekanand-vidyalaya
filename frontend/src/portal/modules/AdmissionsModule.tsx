import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { Admission } from "../../types/api";
import type { FormEvent } from "react";
import { EmptyState, Icon, Modal, PageHeader, Segmented, Skeleton, StatusPill, Avatar, errText, fmtDate, listAll, useUI } from "../ui/kitExports";

type Filter = "ALL" | Admission["status"];
const TONE = { PENDING: "warn", CONTACTED: "info", CLOSED: "good" } as const;

/** Indian 10-digit numbers get +91 for WhatsApp; anything else is passed through as digits. */
const waLink = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? "91" + digits : digits}`;
};

export function AdmissionsModule() {
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<Admission[] | null>(null);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<Admission | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAll<Admission>("/content/admissions/")
      .then((rows) => {
        setItems(rows);
        if (!rows.some((r) => r.status === "PENDING")) setFilter("ALL");
      })
      .catch((e) => {
        toast("error", errText(e, "Could not load admission enquiries."));
        setItems([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = { ALL: items?.length ?? 0, PENDING: 0, CONTACTED: 0, CLOSED: 0 };
    items?.forEach((i) => (c[i.status] += 1));
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => (filter === "ALL" || i.status === filter) && (!q || `${i.applicant_name} ${i.guardian_contact} ${i.applying_for_class}`.toLowerCase().includes(q)));
  }, [items, filter, query]);

  async function setStatus(a: Admission, status: Admission["status"]) {
    setBusy(a.id);
    try {
      const updated = await api.patch<Admission>(`/content/admissions/${a.id}/`, { status });
      setItems((prev) => prev?.map((x) => (x.id === a.id ? updated : x)) ?? prev);
      toast("success", `Marked ${status.toLowerCase()}.`);
    } catch (e) {
      toast("error", errText(e, "Could not update the enquiry."));
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      const updated = await api.patch<Admission>(`/content/admissions/${edit.id}/`, {
        applicant_name: edit.applicant_name.trim(),
        guardian_contact: edit.guardian_contact.trim(),
        applying_for_class: edit.applying_for_class.trim(),
        message: edit.message,
        status: edit.status,
      });
      setItems((prev) => prev?.map((x) => (x.id === edit.id ? updated : x)) ?? prev);
      toast("success", "Enquiry updated.");
      setEdit(null);
    } catch (err) {
      toast("error", errText(err, "Could not update the enquiry."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Admission) {
    const ok = await confirm({ title: "Delete this enquiry?", message: `${a.applicant_name}'s enquiry will be permanently removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    setBusy(a.id);
    try {
      await api.del(`/content/admissions/${a.id}/`);
      setItems((prev) => prev?.filter((x) => x.id !== a.id) ?? prev);
      toast("success", "Enquiry deleted.");
    } catch (e) {
      toast("error", errText(e, "Could not delete the enquiry."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader icon="inbox" title="Admissions" sub="Enquiries sent from the website's admission form. Call or WhatsApp the guardian, then track progress." />

      <div className="toolbar">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "PENDING", label: "Pending", count: counts.PENDING },
            { value: "CONTACTED", label: "Contacted", count: counts.CONTACTED },
            { value: "CLOSED", label: "Closed", count: counts.CLOSED },
            { value: "ALL", label: "All", count: counts.ALL },
          ]}
        />
        <div className="search-box grow">
          <Icon name="search" size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or class" aria-label="Search enquiries" />
        </div>
      </div>

      {items === null ? (
        <Skeleton variant="cards" rows={3} />
      ) : shown.length === 0 ? (
        <EmptyState icon="inbox" title={items.length === 0 ? "No enquiries yet" : "Nothing here"} text={items.length === 0 ? "When someone submits the admission form on the website, it will appear here." : "Try a different filter or search."} />
      ) : (
        <div className="cards">
          {shown.map((a) => (
            <article className="rcard" key={a.id}>
              <div className="rcard-head">
                <Avatar name={a.applicant_name} />
                <div className="row-main">
                  <strong>{a.applicant_name}</strong>
                  <span>
                    Applying for {a.applying_for_class} · {fmtDate(a.submitted_at)}
                  </span>
                </div>
                <StatusPill tone={TONE[a.status]}>{a.status.toLowerCase()}</StatusPill>
              </div>
              {a.message && <p className="rcard-msg">{a.message}</p>}
              <div className="rcard-meta">
                <span className="mini-meta">
                  <Icon name="phone" size={14} /> {a.guardian_contact}
                </span>
              </div>
              <div className="rcard-actions">
                <a className="btn btn-outline btn-sm" href={`tel:${a.guardian_contact}`}>
                  <Icon name="phone" size={15} /> Call
                </a>
                <a className="btn btn-outline btn-sm" href={waLink(a.guardian_contact)} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
                {a.status === "PENDING" && (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy === a.id} onClick={() => setStatus(a, "CONTACTED")}>
                    Mark contacted
                  </button>
                )}
                {a.status === "CONTACTED" && (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy === a.id} onClick={() => setStatus(a, "CLOSED")}>
                    Close
                  </button>
                )}
                {a.status === "CLOSED" && (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy === a.id} onClick={() => setStatus(a, "PENDING")}>
                    Reopen
                  </button>
                )}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEdit(a)}>
                  <Icon name="edit" size={15} /> Edit
                </button>
                <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} disabled={busy === a.id} onClick={() => remove(a)} aria-label={`Delete ${a.applicant_name}'s enquiry`}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={edit !== null} title="Edit enquiry" onClose={() => setEdit(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button><button type="submit" form="adm-form" className="btn btn-primary btn-sm" disabled={saving || !edit?.applicant_name.trim()}>{saving ? "Saving…" : "Save changes"}</button></>}>
        {edit && (
          <form id="adm-form" onSubmit={saveEdit} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="adName">Applicant name</label><input id="adName" value={edit.applicant_name} onChange={(e) => setEdit({ ...edit, applicant_name: e.target.value })} required /></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="adContact">Guardian contact</label><input id="adContact" value={edit.guardian_contact} onChange={(e) => setEdit({ ...edit, guardian_contact: e.target.value })} required /></div>
              <div className="form-field"><label htmlFor="adClass">Applying for class</label><input id="adClass" value={edit.applying_for_class} onChange={(e) => setEdit({ ...edit, applying_for_class: e.target.value })} required /></div>
            </div>
            <div className="form-field"><label htmlFor="adStatus">Status</label><select id="adStatus" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Admission["status"] })}><option value="PENDING">Pending</option><option value="CONTACTED">Contacted</option><option value="CLOSED">Closed</option></select></div>
            <div className="form-field"><label htmlFor="adMsg">Message</label><textarea id="adMsg" rows={4} value={edit.message} onChange={(e) => setEdit({ ...edit, message: e.target.value })} /></div>
          </form>
        )}
      </Modal>
    </>
  );
}
