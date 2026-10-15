import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { TimetableEntry } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Segmented, Skeleton, classLabel, errText, fmtTime, listAll, useUI } from "../ui/kitExports";
import { PageLoading } from "../ui/PageLoading";
import { useRefData } from "../ui/useRefData";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const jsDayToIndex = (d: number) => (d === 0 ? 0 : d - 1); // Sunday has no classes -> show Monday
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function TimetableModule() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "SUPER_ADMIN" ? <TimetableEditor /> : <TimetableView teacher={user.role === "TEACHER"} />;
}

/* ───── Student + Teacher: read-only day view ───── */

function TimetableView({ teacher }: { teacher: boolean }) {
  const ref = useRefData();
  const [rows, setRows] = useState<TimetableEntry[] | null>(null);
  const [day, setDay] = useState(jsDayToIndex(new Date().getDay()));

  useEffect(() => {
    listAll<TimetableEntry>(`/academics/timetable/${teacher ? "?mine=1" : ""}`).then(setRows).catch(() => setRows([]));
  }, [teacher]);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = day === jsDayToIndex(now.getDay()) && now.getDay() !== 0;
  const list = useMemo(() => (rows ?? []).filter((r) => r.weekday === day).sort((a, b) => a.period - b.period), [rows, day]);
  const className = (id: string) => ref?.classes.find((c) => c.id === id)?.name ?? "";

  return (
    <>
      <PageHeader icon="clock" title={teacher ? "My periods" : "Timetable"} sub={teacher ? "Periods assigned to you by the school office." : "Your class timetable for the week."} />
      <div className="toolbar">
        <Segmented value={String(day)} onChange={(v) => setDay(Number(v))} options={DAYS.map((d, i) => ({ value: String(i), label: d }))} />
      </div>
      {rows === null ? (
        <Skeleton rows={5} />
      ) : list.length === 0 ? (
        <EmptyState icon="clock" title={rows.length === 0 ? "No timetable yet" : "No periods on this day"} text={rows.length === 0 ? (teacher ? "No periods have been assigned to you yet." : "The school office has not published your class timetable yet.") : "Enjoy the free day."} />
      ) : (
        <div className="list">
          {list.map((r) => {
            const live = isToday && nowMin >= minutes(r.start_time) && nowMin < minutes(r.end_time);
            const brk = !r.subject;
            return (
              <div key={r.id} className={`row-link ${live ? "tone-good" : brk ? "tone-muted" : ""}`} style={live ? { boxShadow: "var(--inset-sm), 0 0 0 1px var(--good)" } : undefined}>
                <span className="row-icon" style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14 }}>{r.period}</span>
                <span className="row-main">
                  <strong>{brk ? r.label : r.subject_name}{teacher && className(r.school_class) ? ` · ${className(r.school_class)}` : ""}</strong>
                  <span>{fmtTime(r.start_time)} – {fmtTime(r.end_time)}{!teacher && r.teacher_name ? ` · ${r.teacher_name}` : ""}{r.room ? ` · Room ${r.room}` : ""}</span>
                </span>
                {live && <span className="status-pill tone-good">now</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ───── Super Admin: build the timetable ───── */

function TimetableEditor() {
  const { toast, confirm } = useUI();
  const ref = useRefData(true);
  const [classId, setClassId] = useState("");
  const [day, setDay] = useState(0);
  const [rows, setRows] = useState<TimetableEntry[] | null>(null);
  const [edit, setEdit] = useState<Partial<TimetableEntry> | null>(null);
  const [saving, setSaving] = useState(false);

  const cid = classId || ref?.classes[0]?.id || "";
  const load = useCallback(async () => {
    if (!cid) return setRows([]);
    try {
      setRows(await listAll<TimetableEntry>(`/academics/timetable/?school_class=${cid}`));
    } catch (e) {
      toast("error", errText(e, "Could not load the timetable."));
      setRows([]);
    }
  }, [cid, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const list = useMemo(() => (rows ?? []).filter((r) => r.weekday === day).sort((a, b) => a.period - b.period), [rows, day]);
  const subjects = ref?.subjects.filter((s) => s.school_class === cid) ?? [];

  function openNew() {
    const last = list[list.length - 1];
    setEdit({ school_class: cid, weekday: day, period: (last?.period ?? 0) + 1, start_time: last?.end_time.slice(0, 5) ?? "09:00", end_time: "", subject: subjects[0]?.id ?? null, label: "", teacher: null, room: "" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      const body = { school_class: cid, weekday: edit.weekday, period: Number(edit.period), start_time: edit.start_time?.slice(0, 5), end_time: edit.end_time?.slice(0, 5), subject: edit.subject || null, label: edit.subject ? "" : edit.label ?? "", teacher: edit.teacher || null, room: edit.room ?? "" };
      if (edit.id) await api.patch(`/academics/timetable/${edit.id}/`, body);
      else await api.post("/academics/timetable/", body);
      toast("success", "Period saved.");
      setEdit(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not save the period."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: TimetableEntry) {
    if (!(await confirm({ title: "Delete this period?", message: `Period ${r.period} on ${DAYS[r.weekday]} will be removed.`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api.del(`/academics/timetable/${r.id}/`);
      toast("success", "Deleted.");
      load();
    } catch (err) {
      toast("error", errText(err, "Could not delete."));
    }
  }

  if (!ref) return <PageLoading icon="clock" title="Timetable" sub="Build each class's weekly timetable. Students and teachers see it on their dashboards." rows={4} />;
  if (ref.classes.length === 0) return (<><PageHeader icon="clock" title="Timetable" /><EmptyState icon="layers" title="Create a class first" text="Timetables belong to a class. Add classes and subjects under Classes & Subjects." /></>);

  return (
    <>
      <PageHeader icon="clock" title="Timetable" sub="Build each class's weekly timetable. Students and teachers see it on their dashboards." actions={<button type="button" className="btn btn-primary btn-sm" onClick={openNew}><Icon name="plus" size={16} /> Add period</button>} />
      <div className="toolbar">
        <div className="field-inline" style={{ flex: "1 1 240px" }}>
          <label htmlFor="ttClass">Class</label>
          <select id="ttClass" value={cid} onChange={(e) => setClassId(e.target.value)}>
            {ref.classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c, ref.sessions)}</option>)}
          </select>
        </div>
        <Segmented value={String(day)} onChange={(v) => setDay(Number(v))} options={DAYS.map((d, i) => ({ value: String(i), label: d, count: (rows ?? []).filter((r) => r.weekday === i).length || undefined }))} />
      </div>

      {rows === null ? <Skeleton rows={4} /> : list.length === 0 ? (
        <EmptyState icon="clock" title="No periods on this day" text="Add the first period for this class." action={<button type="button" className="btn btn-primary btn-sm" onClick={openNew}>Add period</button>} />
      ) : (
        <div className="list">
          {list.map((r) => (
            <div key={r.id} className="row-link">
              <span className="row-icon" style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14 }}>{r.period}</span>
              <span className="row-main"><strong>{r.subject ? r.subject_name : r.label}</strong><span>{fmtTime(r.start_time)} – {fmtTime(r.end_time)}{r.teacher_name ? ` · ${r.teacher_name}` : ""}{r.room ? ` · Room ${r.room}` : ""}</span></span>
              <button type="button" className="icon-btn" onClick={() => setEdit(r)} aria-label="Edit period"><Icon name="edit" size={17} /></button>
              <button type="button" className="icon-btn danger" onClick={() => remove(r)} aria-label="Delete period"><Icon name="trash" size={17} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={edit !== null} title={edit?.id ? "Edit period" : "Add period"} onClose={() => setEdit(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button><button type="submit" form="tt-form" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}>
        {edit && (
          <form id="tt-form" onSubmit={save} className="stack" style={{ gap: 14 }}>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="tPeriod">Period no.</label><input id="tPeriod" type="number" min={1} max={12} value={edit.period ?? ""} onChange={(e) => setEdit({ ...edit, period: Number(e.target.value) })} required /></div>
              <div className="form-field"><label htmlFor="tDay">Day</label><select id="tDay" value={edit.weekday} onChange={(e) => setEdit({ ...edit, weekday: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
              <div className="form-field"><label htmlFor="tStart">Starts</label><input id="tStart" type="time" value={edit.start_time?.slice(0, 5) ?? ""} onChange={(e) => setEdit({ ...edit, start_time: e.target.value })} required /></div>
              <div className="form-field"><label htmlFor="tEnd">Ends</label><input id="tEnd" type="time" value={edit.end_time?.slice(0, 5) ?? ""} onChange={(e) => setEdit({ ...edit, end_time: e.target.value })} required /></div>
            </div>
            <div className="form-field"><label htmlFor="tSub">Subject</label>
              <select id="tSub" value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value || null })}>
                <option value="">— none (break / assembly) —</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
            {!edit.subject && <div className="form-field"><label htmlFor="tLabel">Label</label><input id="tLabel" value={edit.label ?? ""} maxLength={60} placeholder="Break" onChange={(e) => setEdit({ ...edit, label: e.target.value })} required /></div>}
            {edit.subject && (
              <div className="form-grid">
                <div className="form-field"><label htmlFor="tTeacher">Teacher</label><select id="tTeacher" value={edit.teacher ?? ""} onChange={(e) => setEdit({ ...edit, teacher: e.target.value || null })}><option value="">— not set —</option>{ref.teachers.map((t) => <option key={t.user} value={t.user}>{t.full_name}</option>)}</select></div>
                <div className="form-field"><label htmlFor="tRoom">Room</label><input id="tRoom" value={edit.room ?? ""} maxLength={30} onChange={(e) => setEdit({ ...edit, room: e.target.value })} /></div>
              </div>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
