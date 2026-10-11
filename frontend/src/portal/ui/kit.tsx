import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Icon } from "./icons";
import type { IconName } from "./icons";
import { UIContext, initials, useCountUp } from "./kitHelpers";
import type { Toast, ConfirmOptions } from "./kitHelpers";
import "./console.css";

/* ───────────── toasts + confirm ───────────── */

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6500 : 3800);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );

  const settle = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UIContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <Icon name={t.kind === "success" ? "checkCircle" : t.kind === "error" ? "alert" : "sparkle"} size={18} />
              <span>{t.text}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
      <Modal
        open={pending !== null}
        title={pending?.title ?? ""}
        onClose={() => settle(false)}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => settle(false)}>
              Cancel
            </button>
            <button type="button" className={`btn btn-sm ${pending?.danger ? "btn-danger" : "btn-primary"}`} onClick={() => settle(true)}>
              {pending?.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      >
        {pending?.message && <p className="modal-text">{pending.message}</p>}
      </Modal>
    </UIContext.Provider>
  );
}

/* ───────────── modal / bottom sheet ───────────── */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-grip" aria-hidden="true" />
        <header className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────────── building blocks ───────────── */

export function PageHeader({ icon, title, sub, actions }: { icon: IconName; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <span className="page-head-icon">
        <Icon name={icon} size={24} />
      </span>
      <div className="page-head-text">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - ((i * 13) % 35)}%` }} />
      ))}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function StatusPill({ tone, children }: { tone: "good" | "warn" | "bad" | "info" | "muted"; children: ReactNode }) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}

export function StatCard({
  icon,
  label,
  value,
  note,
  tone = "accent",
  to,
  suffix,
}: {
  icon: IconName;
  label: string;
  value: number;
  note?: string;
  tone?: "accent" | "good" | "warn" | "bad";
  to?: string;
  suffix?: string;
}) {
  const shown = useCountUp(value);
  const body = (
    <>
      <span className={`stat-icon tone-${tone}`}>
        <Icon name={icon} size={22} />
      </span>
      <span className="stat-value">{shown.toLocaleString("en-IN")}{suffix}</span>
      <span className="stat-label">{label}</span>
      {note && <span className="stat-note">{note}</span>}
    </>
  );
  return to ? (
    <Link className="stat-card lift" to={to}>
      {body}
    </Link>
  ) : (
    <div className="stat-card">{body}</div>
  );
}

/** Donut ring, 0-100. */
export function Ring({ percent, label, sub, tone = "good", size = 132 }: { percent: number; label: string; sub?: string; tone?: "good" | "warn" | "bad" | "accent"; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${label}: ${Math.round(clamped)} percent`}>
        <circle cx="60" cy="60" r={r} className="ring-track" />
        <circle cx="60" cy="60" r={r} className={`ring-fill tone-${tone}`} strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)} transform="rotate(-90 60 60)" />
      </svg>
      <div className="ring-text">
        <strong>{label}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

/** Stacked bars: one column per day, present (good) over absent (bad). */
export function AttendanceBars({ days }: { days: { date: string; present: number; absent: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.present + d.absent));
  return (
    <div className="bars" role="img" aria-label="Attendance for the last 7 days">
      {days.map((d) => {
        const total = d.present + d.absent;
        const label = new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });
        return (
          <div className="bar-col" key={d.date} title={`${d.date}: ${d.present} present, ${d.absent} absent`}>
            <div className="bar-track">
              <div className="bar-stack" style={{ height: `${(total / max) * 100}%` }}>
                {d.absent > 0 && <span className="bar-seg bad" style={{ flex: d.absent }} />}
                {d.present > 0 && <span className="bar-seg good" style={{ flex: d.present }} />}
              </div>
            </div>
            <span className="bar-label">{label}</span>
            <span className="bar-num">{total || "–"}</span>
          </div>
        );
      })}
    </div>
  );
}

