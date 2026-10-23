import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { MORE, NAV } from "../../config/site";
import { useAuth } from "../../lib/AuthContext";
import { SocialIcons } from "../SocialIcons";
import { ThemeToggle } from "../ThemeToggle";
import "./MobileApp.css";

/**
 * Phone "app mode" for every public page EXCEPT the landing page (see SiteLayout): the website header and footer are
 * hidden and these take over — a round Back button at the top and a bottom tab bar, like a native app. They are only
 * ever shown by styles in MobileApp.css on phones; desktop and laptop screens never see them.
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
  more: svg(<><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>),
};

export function MobileAppChrome() {
  return (
    <>
      <AppBackButton />
      <MobileTabBar />
    </>
  );
}

function AppBackButton() {
  const navigate = useNavigate();
  const { key } = useLocation();
  // "default" = this page was opened directly (a shared link), so there is nothing to go back to inside the app
  const back = () => (key !== "default" ? navigate(-1) : navigate("/"));
  return (
    <button type="button" className="m-back" onClick={back} aria-label="Go back">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
    </button>
  );
}

export function MobileTabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  // The sheet belongs to the page it was opened on, so moving to another page closes it without any effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const more = openAt === pathname;
  const setMore = (v: boolean | ((x: boolean) => boolean)) => setOpenAt((cur) => ((typeof v === "function" ? v(cur === pathname) : v) ? pathname : null));
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [more]);

  const tabs: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
    { to: "/", label: "Home", icon: I.home, end: true },
    { to: "/notices", label: "Notices", icon: I.notices },
    { to: "/admissions", label: "Admission", icon: I.admissions },
    { to: "/contact", label: "Contact", icon: I.contact },
  ];
  const pages = [...NAV, ...MORE, { to: "/find-profile", label: "Profile Finder", desc: "Find a teacher or student" }];

  return (
    <>
      <nav className="m-tabs" aria-label="Quick navigation">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `m-tab${isActive ? " active" : ""}`}>
            {t.icon}
            <span>{t.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`m-tab${more ? " active" : ""}`} onClick={() => setMore((v) => !v)} aria-expanded={more} aria-haspopup="dialog">
          {I.more}
          <span>More</span>
        </button>
      </nav>

      {more && (
        <div className="m-sheet-back" onClick={() => setMore(false)}>
          <div className="m-sheet" role="dialog" aria-modal="true" aria-label="All pages" onClick={(e) => e.stopPropagation()}>
            <span className="m-sheet-handle" aria-hidden="true" />
            <Link to={user ? "/portal/dashboard" : "/portal"} className="m-sheet-cta">{user ? "Open my dashboard" : "Student & Staff Login"} <span aria-hidden="true">→</span></Link>
            <div className="m-sheet-grid">
              {pages.map((p) => (
                <Link key={p.to} to={p.to} className={pathname === p.to ? "on" : ""}>
                  <strong>{p.label}</strong>
                  <span>{p.desc}</span>
                </Link>
              ))}
            </div>
            <div className="m-sheet-foot">
              <ThemeToggle />
              <SocialIcons />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
