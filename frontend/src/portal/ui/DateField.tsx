import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { Icon } from "./icons";
import { Popover } from "./Popover";
import "./neo-fields.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const today = () => {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
};
const parse = (v: string | undefined | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? "");
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};
/** Adds days to an ISO date without any timezone surprises. */
const addDays = (v: string, n: number) => {
  const p = parse(v)!;
  const d = new Date(Date.UTC(p.y, p.m, p.d + n));
  return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const pretty = (v: string) => {
  const p = parse(v);
  return p ? new Date(Date.UTC(p.y, p.m, p.d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
};
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

interface DateFieldProps {
  id?: string;
  /** yyyy-mm-dd, or "" for no date */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

/** Neumorphic calendar picker (replaces <input type="date">). Value is always yyyy-mm-dd. */
export function DateField({ id, value, onChange, min, max, required, disabled, placeholder = "Select date", className = "", style, ...rest }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const sel = parse(value);
  const base = sel ?? parse(today())!;
  const [ym, setYm] = useState({ y: base.y, m: base.m });
  const [focus, setFocus] = useState(value || today());
  const btn = useRef<HTMLButtonElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const [yearPage, setYearPage] = useState(Math.floor(base.y / 12) * 12);

  const blocked = (v: string) => (!!min && v < min) || (!!max && v > max);

  const openIt = () => {
    if (disabled) return;
    const b = parse(value) ?? parse(today())!;
    setYm({ y: b.y, m: b.m });
    setFocus(value || (blocked(today()) ? (min ?? today()) : today()));
    setView("days");
    setOpen(true);
  };
  const close = () => setOpen(false);

  const choose = (v: string) => {
    if (blocked(v)) return;
    onChange(v);
    setOpen(false);
    btn.current?.focus();
  };

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay();
    const out: { v: string; day: number; out: boolean }[] = [];
    const prevDays = daysIn(ym.y, ym.m - 1 < 0 ? 11 : ym.m - 1);
    for (let i = first - 1; i >= 0; i--) {
      const m = ym.m === 0 ? 11 : ym.m - 1;
      const y = ym.m === 0 ? ym.y - 1 : ym.y;
      out.push({ v: iso(y, m, prevDays - i), day: prevDays - i, out: true });
    }
    for (let d = 1; d <= daysIn(ym.y, ym.m); d++) out.push({ v: iso(ym.y, ym.m, d), day: d, out: false });
    let n = 1;
    while (out.length % 7 !== 0 || out.length < 42) {
      const m = ym.m === 11 ? 0 : ym.m + 1;
      const y = ym.m === 11 ? ym.y + 1 : ym.y;
      out.push({ v: iso(y, m, n), day: n, out: true });
      n++;
    }
    return out;
  }, [ym]);

  const shiftMonth = (n: number) => setYm(({ y, m }) => {
    const t = m + n;
    return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
  });

  useEffect(() => {
    if (open && view === "days") grid.current?.querySelector<HTMLElement>(`[data-v="${focus}"]`)?.focus({ preventScroll: true });
  }, [focus, open, view, ym]);

  /** Move the keyboard focus to a date, switching month when it falls outside the one shown. */
  const go = (v: string) => {
    const p = parse(v)!;
    setFocus(v);
    setYm({ y: p.y, m: p.m });
  };
  const onGridKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      go(addDays(focus, step[e.key]));
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      const p = parse(focus)!;
      const t = p.m + (e.key === "PageDown" ? 1 : -1);
      const y = p.y + Math.floor(t / 12);
      const m = ((t % 12) + 12) % 12;
      go(iso(y, m, Math.min(p.d, daysIn(y, m))));
    }
  };

  const todayIso = today();
  const label = sel ? pretty(value) : "";

  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`neo-select neo-date ${open ? "open" : ""} ${label ? "" : "is-empty"} ${className}`}
        style={style}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={rest["aria-label"]}
        onClick={() => (open ? close() : openIt())}
      >
        <Icon name="calendar" size={18} className="neo-lead" />
        <span className="neo-select-text">{label || placeholder}</span>
        <Icon name="chevronDown" size={18} className="neo-chevron" />
      </button>
      <Popover open={open} anchorRef={btn} onClose={close} title={rest["aria-label"] ?? "Pick a date"} className="neo-cal">
        <div className="cal-head">
          <button type="button" className="cal-nav" aria-label="Previous" onClick={() => (view === "days" ? shiftMonth(-1) : view === "months" ? setYm((s) => ({ ...s, y: s.y - 1 })) : setYearPage((y) => y - 12))}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className="cal-title" aria-live="polite" onClick={() => { setYearPage(Math.floor(ym.y / 12) * 12); setView(view === "days" ? "months" : view === "months" ? "years" : "days"); }}>
            {view === "days" ? `${MONTHS[ym.m]} ${ym.y}` : view === "months" ? String(ym.y) : `${yearPage} – ${yearPage + 11}`}
            <Icon name={view === "days" ? "chevronDown" : "chevronUp"} size={15} />
          </button>
          <button type="button" className="cal-nav" aria-label="Next" onClick={() => (view === "days" ? shiftMonth(1) : view === "months" ? setYm((s) => ({ ...s, y: s.y + 1 })) : setYearPage((y) => y + 12))}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        {view === "days" && (
          <div key={`${ym.y}-${ym.m}`} className="cal-body">
            <div className="cal-week" aria-hidden="true">{DAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="cal-grid" ref={grid} role="grid" aria-label={`${MONTHS[ym.m]} ${ym.y}`} onKeyDown={onGridKey}>
              {cells.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  data-v={c.v}
                  role="gridcell"
                  tabIndex={c.v === focus ? 0 : -1}
                  disabled={blocked(c.v)}
                  aria-selected={c.v === value}
                  aria-label={pretty(c.v)}
                  className={`cal-day ${c.out ? "out" : ""} ${c.v === value ? "sel" : ""} ${c.v === todayIso ? "today" : ""}`}
                  onClick={() => choose(c.v)}
                >
                  {c.day}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "months" && (
          <div className="cal-pick cal-body">
            {MONTHS.map((m, i) => (
              <button key={m} type="button" className={`cal-cell ${i === ym.m ? "sel" : ""}`} onClick={() => { setYm((s) => ({ ...s, m: i })); setFocus(iso(ym.y, i, Math.min(parse(focus)?.d ?? 1, daysIn(ym.y, i)))); setView("days"); }}>
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        )}

        {view === "years" && (
          <div className="cal-pick cal-body">
            {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => (
              <button key={y} type="button" className={`cal-cell ${y === ym.y ? "sel" : ""}`} onClick={() => { setYm((s) => ({ ...s, y })); setView("months"); }}>
                {y}
              </button>
            ))}
          </div>
        )}

        <div className="cal-foot">
          <button type="button" className="cal-link" disabled={blocked(todayIso)} onClick={() => choose(todayIso)}>Today</button>
          {!required && value && <button type="button" className="cal-link muted" onClick={() => { onChange(""); close(); }}>Clear</button>}
          <button type="button" className="cal-link muted" onClick={close}>Close</button>
        </div>
      </Popover>
    </>
  );
}

/* ───────────────────────── time ───────────────────────── */

interface TimeFieldProps {
  id?: string;
  /** HH:MM (24 h) — "HH:MM:SS" is accepted too. "" for none. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

const prettyTime = (v: string) => {
  const m = /^(\d{2}):(\d{2})/.exec(v);
  if (!m) return "";
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
};

/** Neumorphic time picker (replaces <input type="time">). */
export function TimeField({ id, value, onChange, required, disabled, placeholder = "Select time", className = "", style, ...rest }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const hourCol = useRef<HTMLDivElement | null>(null);
  const minCol = useRef<HTMLDivElement | null>(null);
  const m = /^(\d{2}):(\d{2})/.exec(value);
  const h24 = m ? +m[1] : 9;
  const min = m ? +m[2] : 0;
  const pm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const minutes = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, i) => i * 5);
    return base.includes(min) ? base : [...base, min].sort((a, b) => a - b);
  }, [min]);

  const emit = (h: number, mi: number, isPm: boolean) => onChange(`${pad((h % 12) + (isPm ? 12 : 0))}:${pad(mi)}`);

  useEffect(() => {
    if (!open) return;
    for (const col of [hourCol.current, minCol.current]) col?.querySelector<HTMLElement>(".sel")?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`neo-select neo-date ${open ? "open" : ""} ${m ? "" : "is-empty"} ${className}`}
        style={style}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={rest["aria-label"]}
        onClick={() => { if (!disabled) { if (!m) onChange(`${pad(h24)}:${pad(min)}`); setOpen((o) => !o); } }}
      >
        <Icon name="clock" size={18} className="neo-lead" />
        <span className="neo-select-text">{m ? prettyTime(value) : placeholder}</span>
        <Icon name="chevronDown" size={18} className="neo-chevron" />
      </button>
      <Popover open={open} anchorRef={btn} onClose={() => setOpen(false)} title={rest["aria-label"] ?? "Pick a time"} className="neo-time">
        <div className="time-cols">
          <div className="time-col" ref={hourCol} role="listbox" aria-label="Hour">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <button key={h} type="button" role="option" aria-selected={h === h12} className={`time-opt ${h === h12 ? "sel" : ""}`} onClick={() => emit(h, min, pm)}>{pad(h)}</button>
            ))}
          </div>
          <div className="time-col" ref={minCol} role="listbox" aria-label="Minute">
            {minutes.map((mi) => (
              <button key={mi} type="button" role="option" aria-selected={mi === min} className={`time-opt ${mi === min ? "sel" : ""}`} onClick={() => emit(h12, mi, pm)}>{pad(mi)}</button>
            ))}
          </div>
          <div className="time-ampm" role="radiogroup" aria-label="AM or PM">
            {["AM", "PM"].map((x) => (
              <button key={x} type="button" role="radio" aria-checked={(x === "PM") === pm} className={`time-opt ${(x === "PM") === pm ? "sel" : ""}`} onClick={() => emit(h12, min, x === "PM")}>{x}</button>
            ))}
          </div>
        </div>
        <div className="cal-foot">
          {!required && value && <button type="button" className="cal-link muted" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>}
          <button type="button" className="cal-link" onClick={() => { setOpen(false); btn.current?.focus(); }}>Done</button>
        </div>
      </Popover>
    </>
  );
}
