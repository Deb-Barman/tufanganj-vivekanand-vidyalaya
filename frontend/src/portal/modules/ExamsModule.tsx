import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Exam } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Segmented, Skeleton, classLabel, errText, fmtTime, listAll, todayISO, useUI } from "../ui/kitExports";
import { useRefData } from "../ui/useRefData";

export function ExamsModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const staff = user?.role !== "STUDENT";
  const ref = useRefData();
  const [items, setItems] = useState<Exam[] | null>(null);
  const [tab, setTab] = useState<"up" | "past">("up");
  const [edit, setEdit] = useState<Partial<Exam> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await listAll<Exam>("/academics/exams/")); } catch (e) { toast("error", errText(e, "Could not load exams.")); setItems([]); }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const today = todayISO();
  const shown = (items ?? []).filter((e) => (tab === "up" ? e.date >= today : e.date < today)).sort((a, b) => (tab === "up" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  const subjectsOf = (cid?: string) => ref?.subjects.filter((s) => s.school_class === cid) ?? [];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      const body = { school_class: edit.school_class, subject: edit.subject, name: edit.name, date: edit.date, start_time: edit.start_time ? edit.start_time.slice(0, 5) : null, room: edit.room ?? "" };
      if (edit.id) await api.patch(`/academics/exams/${edit.id}/`, body); else await api.post("/academics/exams/", body);
      toast("success", "Exam saved."); setEdit(null); load();
    } catch (err) { toast("error", errText(err, "Could not save.")); } finally { setSaving(false); }
  }
  async function remove(x: Exam) {
    if (!(await confirm({ title: "Delete this exam?", message: `${x.name} — ${x.subject_name}`, confirmLabel: "Delete", danger: true }))) return;
    try { await api.del(`/academics/exams/${x.id}/`); load(); } catch (err) { toast("error", errText(err, "Could not delete.")); }
  }
  function openNew() {
    const c = ref?.classes[0];
    setEdit({ school_class: c?.id, subject: subjectsOf(c?.id)[0]?.id, name: "", date: today, start_time: "10:00", room: "" });
  }

  return (
    <>
      <PageHeader icon="calendar" title="Exams" sub={staff ? "Schedule exams for a class. Students see only their own class." : "Your upcoming exams."} actions={staff && <button type="button" className="btn btn-primary btn-sm" onClick={openNew} disabled={!ref || ref.classes.length === 0}><Icon name="plus" size={16} /> Schedule exam</button>} />
      <div className="toolbar"><Segmented value={tab} onChange={setTab} options={[{ value: "up", label: "Upcoming" }, { value: "past", label: "Past" }]} /></div>
      {items === null ? <Skeleton rows={4} /> : shown.length === 0 ? (
        <EmptyState icon="calendar" title={tab === "up" ? "No upcoming exams" : "No past exams"} text={tab === "up" ? "When an exam is scheduled for your class, it appears here." : undefined} />
      ) : (
        <div className="list">
          {shown.map((x) => {
            const d = new Date(x.date + "T00:00:00");
            const days = Math.round((d.getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
            return (
              <div key={x.id} className="row-link">
                <span className="row-icon" style={{ flexDirection: "column", lineHeight: 1, width: 52, height: 52 }}><b style={{ fontSize: 18, color: "var(--fg)" }}>{d.getDate()}</b><small style={{ fontSize: 10, textTransform: "uppercase" }}>{d.toLocaleDateString("en-IN", { month: "short" })}</small></span>
                <span className="row-main"><strong>{x.name} · {x.subject_name}</strong><span>{staff ? `${x.class_name} · ` : ""}{x.start_time ? fmtTime(x.start_time) : "Time to be announced"}{x.room ? ` · Room ${x.room}` : ""}{tab === "up" ? ` · ${days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}` : ""}</span></span>
                {staff && (<><button type="button" className="icon-btn" onClick={() => setEdit(x)} aria-label="Edit"><Icon name="edit" size={17} /></button><button type="button" className="icon-btn danger" onClick={() => remove(x)} aria-label="Delete"><Icon name="trash" size={17} /></button></>)}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={edit !== null} title={edit?.id ? "Edit exam" : "Schedule exam"} onClose={() => setEdit(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button><button type="submit" form="exam-form" className="btn btn-primary btn-sm" disabled={saving || !edit?.name?.trim()}>{saving ? "Saving…" : "Save"}</button></>}>
        {edit && ref && (
          <form id="exam-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="exClass">Class</label><select id="exClass" value={edit.school_class} onChange={(e) => setEdit({ ...edit, school_class: e.target.value, subject: subjectsOf(e.target.value)[0]?.id })}>{ref.classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c, ref.sessions)}</option>)}</select></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="exSub">Subject</label><select id="exSub" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })}>{subjectsOf(edit.school_class).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="form-field"><label htmlFor="exName">Exam name</label><input id="exName" value={edit.name ?? ""} maxLength={100} placeholder="Unit Test II" onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></div>
              <div className="form-field"><label htmlFor="exDate">Date</label><input id="exDate" type="date" value={edit.date ?? ""} onChange={(e) => setEdit({ ...edit, date: e.target.value })} required /></div>
              <div className="form-field"><label htmlFor="exTime">Start time</label><input id="exTime" type="time" value={edit.start_time?.slice(0, 5) ?? ""} onChange={(e) => setEdit({ ...edit, start_time: e.target.value })} /></div>
            </div>
            <div className="form-field"><label htmlFor="exRoom">Room (optional)</label><input id="exRoom" value={edit.room ?? ""} maxLength={30} onChange={(e) => setEdit({ ...edit, room: e.target.value })} /></div>
          </form>
        )}
      </Modal>
    </>
  );
}
