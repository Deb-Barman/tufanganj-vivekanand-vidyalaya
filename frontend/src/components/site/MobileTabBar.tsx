import { useEffect } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";

/**
 * Bottom tab bar for the public site — phones only (shown by styles/mobile.css, hidden everywhere else).
 * Five big thumb-reachable destinations, like a native app.
 */
const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const I = {
  home: svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>),
  notices: svg(<><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18.2 6.5a8 8 0 0 1 0 11" /></>),
  admissions: svg(<><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>),
  contact: svg(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>),
  user: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6" /></>),
};

export function MobileTabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  // lets CSS reserve room under the page for the bar (phones only)
  useEffect(() => {
    document.body.classList.add("has-mtabs");
    return () => document.body.classList.remove("has-mtabs");
  }, []);

  const items: { to: string; label: string; icon: ReactNode; end?: boolean; on?: boolean }[] = [
    { to: "/", label: "Home", icon: I.home, end: true },
    { to: "/notices", label: "Notices", icon: I.notices },
    { to: "/admissions", label: "Admission", icon: I.admissions },
    { to: "/contact", label: "Contact", icon: I.contact },
    { to: user ? "/portal/dashboard" : "/portal", label: user ? "Dashboard" : "Login", icon: I.user, on: pathname.startsWith("/portal") },
  ];

  return (
    <nav className="m-tabs" aria-label="Quick navigation">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `m-tab${isActive || it.on ? " active" : ""}`}>
          {it.icon}
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
