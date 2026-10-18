import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Homework, HomeworkCompletions } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Skeleton, StatusPill, classLabel, errText, fmtDate, listAll, todayISO, useUI, Select, DateField } from "../ui/kitExports";
import { PageLoading } from "../ui/PageLoading";
import { useRefData } from "../ui/useRefData";

const short = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const daysFromToday = (iso: string) => Math.round((new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000);

/** One pill that says where a homework item stands in its start–end window. */
const dueLabel = (h: Pick<Homework, "start_date" | "due_date" | "phase">, done?: boolean | null) => {
  if (h.phase === "upcoming") return { text: `Opens ${short(h.start_date ?? h.due_date)}`, tone: "info" as const };
  if (h.phase === "closed") return done ? { text: "Finished", tone: "good" as const } : { text: `Missed · ended ${short(h.due_date)}`, tone: "bad" as const };
  const diff = daysFromToday(h.due_date);
  if (diff === 0) return { text: "Last day today", tone: "warn" as const };
  if (diff === 1) return { text: "Ends tomorrow", tone: "warn" as const };
  return { text: `Ends ${short(h.due_date)}`, tone: "muted" as const };
};
const windowText = (h: Pick<Homework, "start_date" | "due_date">) => (h.start_date ? `${short(h.start_date)} → ${short(h.due_date)}` : `until ${short(h.due_date)}`);

export function HomeworkModule() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "STUDENT" ? <StudentHomework /> : <StaffHomework />;
}

/* ───── Student: tick things off ───── */

function StudentHomework() {
  const { toast } = useUI();
  const [items, setItems] = useState<Homework[] | null>(null);
  useEffect(() => {
    listAll<Homework>("/academics/homework/").then(setItems).catch((e) => { toast("error", errText(e, "Could not load homework.")); setItems([]); });
  }, [toast]);

  async function toggle(h: Homework) {
    if (!h.can_tick) {
      toast("info", h.phase === "closed" ? `The end date for this homework was ${short(h.due_date)}, so it is locked.` : `This homework opens on ${short(h.start_date ?? h.due_date)}.`);
      return;
    }
    const done = !h.done;
    setItems((p) => p?.map((x) => (x.id === h.id ? { ...x, done } : x)) ?? p); // optimistic
    try {
      await api.post(`/academics/homework/${h.id}/done/`, { done });
    } catch (e) {
      setItems((p) => p?.map((x) => (x.id === h.id ? { ...x, done: !done } : x)) ?? p);
      toast("error", errText(e, "Could not update."));
    }
  }

  const todo = (items ?? []).filter((h) => !h.done && h.phase !== "closed");
  const missed = (items ?? []).filter((h) => !h.done && h.phase === "closed");
  const done = (items ?? []).filter((h) => h.done);
  const pct = items && items.length ? Math.round((done.length / items.length) * 100) : 0;

  const row = (h: Homework) => {
    const due = dueLabel(h, h.done);
    const locked = !h.can_tick;
    return (
      <div key={h.id} className="row-link" style={{ alignItems: "flex-start" }}>
        <button
          type="button"
          onClick={() => toggle(h)}
          aria-pressed={!!h.done}
          aria-disabled={locked}
          aria-label={locked ? (h.phase === "closed" ? "Locked: the end date has passed" : "Locked: not started yet") : h.done ? "Mark as not done" : "Mark as done"}
          title={locked ? (h.phase === "closed" ? "Locked — the end date has passed" : "Not started yet") : undefined}
          className="icon-btn"
          style={{ borderRadius: "50%", color: h.done ? "#fff" : "var(--fg-faint)", background: h.done ? "var(--good)" : undefined, opacity: locked && !h.done ? 0.5 : 1, cursor: locked ? "not-allowed" : "pointer" }}
        >
          <Icon name={locked && !h.done ? "lock" : "check"} size={18} />
        </button>
        <span className="row-main" style={{ whiteSpace: "normal" }}>
          <strong style={{ whiteSpace: "normal", textDecoration: h.done ? "line-through" : "none", opacity: h.done ? 0.6 : 1 }}>{h.title}</strong>
          <span style={{ whiteSpace: "normal" }}>{h.subject_name}{h.created_by_name ? ` · ${h.created_by_name}` : ""} · {windowText(h)}</span>
          {h.details && <span style={{ whiteSpace: "pre-wrap", color: "var(--fg-soft)", marginTop: 4 }}>{h.details}</span>}
        </span>
        <StatusPill tone={due.tone}>{due.text}</StatusPill>
      </div>
    );
  };

  return (
    <>
      <PageHeader icon="clipboard" title="Homework" sub="Tap the circle when you finish a task. You can only tick it between its start and end date." />
      {items === null ? <Skeleton rows={4} /> : items.length === 0 ? (
        <EmptyState icon="clipboard" title="No homework" text="Nothing has been set for your class yet." />
      ) : (
        <>
          <section className="panel" style={{ marginBottom: 18 }}>
            <div className="split" style={{ gap: 16 }}>
              <div className="split-text"><span><b>{done.length}</b> of {items.length} done</span><div className="pct-bar tone-good" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div></div>
            </div>
          </section>
          {todo.length > 0 && <div className="list" style={{ marginBottom: 22 }}>{todo.map(row)}</div>}
          {missed.length > 0 && (<><p className="tabs-note" style={{ margin: "6px 0 10px" }}>Missed — the end date has passed</p><div className="list" style={{ marginBottom: 22 }}>{missed.map(row)}</div></>)}
          {done.length > 0 && (<><p className="tabs-note" style={{ margin: "6px 0 10px" }}>Completed</p><div className="list">{done.map(row)}</div></>)}
        </>
      )}
    </>
  );
}

/* ───── Staff: set and manage homework ───── */

function StaffHomework() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const ref = useRefData();
  const [classId, setClassId] = useState("");
  const [items, setItems] = useState<Homework[] | null>(null);
  const [edit, setEdit] = useState<Partial<Homework> | null>(null);
  const [saving, setSaving] = useState(false);
  const [who, setWho] = useState<HomeworkCompletions | "loading" | null>(null);

  async function showWho(h: Homework) {
    setWho("loading");
    try {
      setWho(await api.get<HomeworkCompletions>(`/academics/homework/${h.id}/completions/`));
    } catch (err) {
      setWho(null);
      toast("error", errText(err, "Could not load who has finished."));
    }
  }

  const cid = classId || ref?.classes[0]?.id || "";
  const subjects = ref?.subjects.filter((s) => s.school_class === cid) ?? [];
  const load = useCallback(async () => {
    if (!cid) return setItems([]);
    try { setItems(await listAll<Homework>(`/academics/homework/?school_class=${cid}`)); } catch (e) { toast("error", errText(e, "Could not load homework.")); setItems([]); }
  }, [cid, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => b.due_date.localeCompare(a.due_date)), [items]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      const body = { school_class: cid, subject: edit.subject, title: edit.title, details: edit.details ?? "", start_date: edit.start_date || todayISO(), due_date: edit.due_date };
      if (edit.id) await api.patch(`/academics/homework/${edit.id}/`, body);
      else await api.post("/academics/homework/", body);
      toast("success", "Homework saved.");
      setEdit(null);
      load();
    } catch (err) { toast("error", errText(err, "Could not save.")); } finally { setSaving(false); }
  }
  async function remove(h: Homework) {
    if (!(await confirm({ title: "Delete this homework?", message: h.title, confirmLabel: "Delete", danger: true }))) return;
    try { await api.del(`/academics/homework/${h.id}/`); load(); toast("success", "Deleted."); } catch (err) { toast("error", errText(err, "Could not delete (you can only delete homework you set).")); }
  }

  if (!ref) return <PageLoading icon="clipboard" title="Homework" sub="Set homework for a class. Students tick it off; you see how many have finished." rows={4} />;
  if (ref.classes.length === 0) return (<><PageHeader icon="clipboard" title="Homework" /><EmptyState icon="layers" title="No classes yet" text={isAdmin ? "Create classes and subjects first." : "Ask the Super Admin to set up classes and subjects."} /></>);

  return (
    <>
      <PageHeader icon="clipboard" title="Homework" sub="Set homework for a class. Students tick it off; you see how many have finished." actions={<button type="button" className="btn btn-primary btn-sm" disabled={subjects.length === 0} onClick={() => setEdit({ subject: subjects[0]?.id, start_date: todayISO(), due_date: todayISO(), title: "", details: "" })}><Icon name="plus" size={16} /> Set homework</button>} />
      <div className="toolbar">
        <div className="field-inline" style={{ flex: "1 1 260px" }}><label htmlFor="hwClass">Class</label>
          <Select id="hwClass" value={cid} onChange={(e) => setClassId(e.target.value)}>{ref.classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c, ref.sessions)}</option>)}</Select></div>
      </div>
      {items === null ? <Skeleton rows={4} /> : sorted.length === 0 ? (
        <EmptyState icon="clipboard" title="No homework for this class" text={subjects.length === 0 ? "This class has no subjects yet." : "Use “Set homework” to add the first task."} />
      ) : (
        <div className="list">
          {sorted.map((h) => {
            const due = dueLabel(h);
            const pct = h.class_size ? Math.round(((h.submitted ?? 0) / h.class_size) * 100) : 0;
            return (
              <div key={h.id} className="row-link" style={{ alignItems: "flex-start" }}>
                <span className="row-main" style={{ whiteSpace: "normal" }}>
                  <strong style={{ whiteSpace: "normal" }}>{h.title}</strong>
                  <span style={{ whiteSpace: "normal" }}>{h.subject_name} · {windowText(h)} · {due.text}{h.created_by_name ? ` · ${h.created_by_name}` : ""}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}><span className="pct-bar tone-good" style={{ flex: 1, maxWidth: 220 }}><i style={{ width: `${pct}%` }} /></span>{h.submitted ?? 0} of {h.class_size ?? 0} done{(isAdmin || h.created_by === user?.id) && <button type="button" className="link-btn" onClick={() => showWho(h)}>See who</button>}</span>
                </span>
                <button type="button" className="icon-btn" onClick={() => setEdit(h)} aria-label="Edit"><Icon name="edit" size={17} /></button>
                <button type="button" className="icon-btn danger" onClick={() => remove(h)} aria-label="Delete"><Icon name="trash" size={17} /></button>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={edit !== null} title={edit?.id ? "Edit homework" : "Set homework"} onClose={() => setEdit(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button><button type="submit" form="hw-form" className="btn btn-primary btn-sm" disabled={saving || !edit?.title?.trim()}>{saving ? "Saving…" : "Save"}</button></>}>
        {edit && (
          <form id="hw-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="hwSub">Subject</label><Select id="hwSub" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="hwStart">Start date</label><DateField id="hwStart" value={edit.start_date ?? ""} required onChange={(v) => setEdit({ ...edit, start_date: v, due_date: edit.due_date && edit.due_date < v ? v : edit.due_date })} /></div>
              <div className="form-field"><label htmlFor="hwDue">End date</label><DateField id="hwDue" value={edit.due_date ?? ""} min={edit.start_date ?? undefined} required onChange={(v) => setEdit({ ...edit, due_date: v })} /></div>
            </div>
            <p className="modal-text" style={{ fontSize: 13 }}>Students can tick this homework as done only from the start date to the end date. After the end date it is locked: unfinished work shows as “Missed”.</p>
            <div className="form-field"><label htmlFor="hwTitle">Title</label><input id="hwTitle" value={edit.title ?? ""} maxLength={200} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></div>
            <div className="form-field"><label htmlFor="hwDetails">Details (optional)</label><textarea id="hwDetails" rows={4} value={edit.details ?? ""} maxLength={2000} onChange={(e) => setEdit({ ...edit, details: e.target.value })} /></div>
          </form>
        )}
      </Modal>
      <Modal open={who !== null} title={who && who !== "loading" ? `Who has finished — ${who.title}` : "Who has finished"} onClose={() => setWho(null)} footer={<button type="button" className="btn btn-primary btn-sm" onClick={() => setWho(null)}>Close</button>}>
        {who === "loading" || who === null ? <Skeleton rows={4} /> : who.students.length === 0 ? (
          <p className="modal-text">No students are assigned to this class yet.</p>
        ) : (
          <div className="list">
            {[...who.students].sort((a, b) => Number(a.done) - Number(b.done) || a.full_name.localeCompare(b.full_name)).map((r) => (
              <div key={r.student} className="row-link">
                <span className="row-main"><strong>{r.full_name}</strong><span>{r.roll_number ? `Roll ${r.roll_number}` : "No roll number"}{r.done && r.completed_at ? ` · ticked ${fmtDate(r.completed_at)}` : ""}</span></span>
                <StatusPill tone={r.done ? "good" : "muted"}>{r.done ? "done" : "not yet"}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
