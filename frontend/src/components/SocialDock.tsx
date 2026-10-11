import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../config/site";
import "./SocialDock.css";

interface DockItem {
  label: string;
  href: string;
  external?: boolean;
  color: string;
  icon: React.ReactNode;
}

const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Only real destinations: the school's confirmed Facebook page plus pages on this site. */
const ITEMS: DockItem[] = [
  {
    label: "Facebook",
    href: SITE.facebook,
    external: true,
    color: "#2d7cff",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07" />
      </svg>
    ),
  },
  {
    label: "Write to us",
    href: "/contact",
    color: "#f5b942",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
        <path d="m3.5 7.5 8.5 6 8.5-6" />
      </svg>
    ),
  },
  {
    label: "Admissions",
    href: "/admissions",
    color: "#35c98a",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
      </svg>
    ),
  },
  {
    label: "Notices",
    href: "/notices",
    color: "#ff7a59",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
      </svg>
    ),
  },
  {
    label: "Student & staff login",
    href: "/portal",
    color: "#8b7bff",
    icon: (
      <svg viewBox="0 0 24 24" {...s}>
        <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
      </svg>
    ),
  },
];
const WORD = "REACH";

/**
 * "Connect" dock: five letters that flip into icons on hover / tap, with a
 * spinning ring and a cursor spotlight. Touch: first tap opens, second follows the link.
 */
export function SocialDock() {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <nav
      ref={ref}
      className={`dock ${open ? "open" : ""}`}
      aria-label="Connect with the school"
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
      onPointerMove={onMove}
      onFocus={() => setOpen(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}
      onClickCapture={(e) => {
        if (!open) {
          e.preventDefault();
          setOpen(true);
        }
      }}
    >
      {ITEMS.map((it, i) => {
        const inner = (
          <>
            <span className="face ltr">{WORD[i]}</span>
            <span className="face ico">{it.icon}</span>
            <span className="tip">{it.label}</span>
          </>
        );
        const style = { ["--i" as string]: i, ["--c" as string]: it.color } as React.CSSProperties;
        return it.external ? (
          <a key={it.label} className="dbtn" href={it.href} target="_blank" rel="noopener noreferrer" aria-label={it.label} style={style}>
            {inner}
          </a>
        ) : (
          <Link key={it.label} className="dbtn" to={it.href} aria-label={it.label} style={style}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
