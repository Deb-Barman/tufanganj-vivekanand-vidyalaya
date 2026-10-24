import { useCallback, useEffect, useRef, useState } from "react";
import { clearNotes, markAllRead, removeNote, useNotes } from "../../lib/notifications";
import type { Note } from "../../lib/notifications";
import { Icon } from "./icons";
import { Popover } from "./Popover";
import "./notifications.css";

/** "just now", "5 min ago", "Yesterday, 4:12 PM", "12 Oct, 4:12 PM". */
function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return `${Math.round(m / 60)} hr ago`;
  const yest = new Date(now - 86400000);
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${time}`;
}

const ICON = { success: "checkCircle", error: "alert", info: "sparkle" } as const;
const WORD = { success: "Done", error: "Problem", info: "Notice" } as const;

function Row({ n, now, uid }: { n: Note; now: number; uid: string }) {
  return (
    <li className={`nt-row tone-${n.kind}${n.read ? "" : " unread"}`}>
      <span className="nt-ico"><Icon name={ICON[n.kind]} size={17} /></span>
      <span className="nt-main">
        <span className="nt-text">{n.text}</span>
        <span className="nt-meta">{WORD[n.kind]} · {ago(n.at, now)}</span>
      </span>
      <button type="button" className="nt-x" onClick={() => removeNote(uid, n.id)} aria-label="Remove this notification"><Icon name="x" size={14} /></button>
    </li>
  );
}

/**
 * Bell for the dashboard header (all three dashboards). Lists the messages this browser has shown, newest first.
 * Desktop: a drop-down under the bell. Phones: a bottom sheet. The list lives in this browser only.
 */
export function NotificationBell({ uid }: { uid: string }) {
  const { notes, unread } = useNotes(uid);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const btn = useRef<HTMLButtonElement | null>(null);

  // Keep "5 min ago" fresh while the panel is open.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [open]);

  const show = () => {
    setNow(Date.now());
    setOpen(true);
  };
  // Opening shows what is new (blue dots); closing marks everything as read.
  const hide = useCallback(() => {
    setOpen(false);
    markAllRead(uid);
  }, [uid]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`icon-btn nt-bell${unread ? " has-new" : ""}`}
        onClick={() => (open ? hide() : show())}
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="nt-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>

      <Popover open={open} anchorRef={btn} onClose={hide} title="Notifications" className="nt-pop">
        <div className="nt-head">
          <h3>Notifications</h3>
          <span className="nt-actions">
            <button type="button" className="link-btn" onClick={() => markAllRead(uid)} disabled={unread === 0}>Mark all read</button>
            <button type="button" className="link-btn" onClick={() => clearNotes(uid)} disabled={notes.length === 0}>Clear all</button>
          </span>
        </div>
        {notes.length === 0 ? (
          <div className="nt-empty">
            <span className="nt-empty-ico"><Icon name="bell" size={24} /></span>
            <b>You are all caught up</b>
            <p>Messages like “Saved” or “Marked closed” will be listed here.</p>
          </div>
        ) : (
          <ul className="nt-list">{notes.map((n) => <Row key={n.id} n={n} now={now} uid={uid} />)}</ul>
        )}
        <p className="nt-foot"><Icon name="shield" size={13} /> Saved only in this browser — never on the school server.</p>
      </Popover>
    </>
  );
}
