import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { RoleBadge } from "../components/RoleBadge";
import { CommandPalette } from "../ui/CommandPalette";
import { Icon } from "../ui/icons";
import { dashPath, groupNav, navFor } from "../ui/nav";
import { Avatar, UIProvider } from "../ui/kit";
import { ProgressBusy } from "../../components/loading/Loading";
import { AdminOverviewSkeleton, HeroSkeleton, MemberOverviewSkeleton, ModuleSkeleton } from "../ui/Skeletons";
import { skeletonSpecFor } from "../ui/skeletonVariant";
import { SchoolLogo } from "../../components/SchoolLogo";
import { SITE } from "../../config/site";
import { preloadPortalPages } from "../../lib/routePreload";
import "./DashboardShell.css";

/** Items pinned to the phone tab bar, per role (the 5th tab is always "More"). */
const TAB_KEYS: Record<string, string[]> = {
  SUPER_ADMIN: ["", "admissions", "messages", "attendance"],
  TEACHER: ["", "attendance", "homework", "timetable"],
  STUDENT: ["", "timetable", "homework", "results"],
};

export function DashboardShell() {
  useEffect(() => preloadPortalPages(), []);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // The drawer is "open for" a specific path, so it closes by itself as soon as the page changes.
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const drawer = drawerFor === location.pathname;
  const setDrawer = (open: boolean) => setDrawerFor(open ? location.pathname : null);
  const [palette, setPalette] = useState(false);

  const items = useMemo(() => (user ? navFor(user.role) : []), [user]);
  const groups = useMemo(() => groupNav(items), [items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;

  const current = items.find((i) => dashPath(i.to) === location.pathname.replace(/\/$/, "")) ?? items[0];
  const tabs = (TAB_KEYS[user.role] ?? []).map((k) => items.find((i) => i.to === k)).filter((i): i is NonNullable<typeof i> => Boolean(i));

  function handleLogout() {
    logout();
    navigate("/portal", { replace: true });
  }

  return (
    <UIProvider>
      <div className="console">
        {drawer && <div className="console-scrim" onClick={() => setDrawer(false)} />}

        <aside className={`console-side ${drawer ? "open" : ""}`} aria-label="Dashboard navigation">
          <div className="side-head">
            <Link to="/" className="side-brand" aria-label={`${SITE.short} — public website`}>
              <SchoolLogo size={34} />
              <span className="side-brand-text">
                <strong>{SITE.short}</strong>
                <small>Dashboard</small>
              </span>
            </Link>
            <button type="button" className="icon-btn side-close" onClick={() => setDrawer(false)} aria-label="Close menu">
              <Icon name="x" size={20} />
            </button>
          </div>

          <div className="side-who">
            <Avatar name={user.full_name || user.username} size={46} />
            <div className="side-who-text">
              <span className="side-who-name">{user.full_name || user.username}</span>
              <RoleBadge role={user.role} />
            </div>
          </div>

          <nav aria-label="Sections">
            {groups.map((g) => (
              <div className="side-group" key={g.group}>
                <span className="side-group-label">{g.group}</span>
                {g.items.map((item) => (
                  <NavLink key={item.to || "home"} to={dashPath(item.to)} end={item.to === ""} className={({ isActive }) => (isActive ? "side-link active" : "side-link")}>
                    <Icon name={item.icon} size={19} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="side-foot">
            <button type="button" className="side-kbd" onClick={() => setPalette(true)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Icon name="search" size={17} /> Quick jump
              </span>
              <kbd>Ctrl K</kbd>
            </button>
            <Link to="/" className="side-link">
              <Icon name="external" size={19} /> View website
            </Link>
            <button type="button" className="side-link" onClick={handleLogout} style={{ background: "none", border: 0, cursor: "pointer", font: "inherit", textAlign: "left", width: "100%" }}>
              <Icon name="logout" size={19} /> Log out
            </button>
          </div>
        </aside>

        <div className="console-main">
          <div className="console-top">
            <button type="button" className="icon-btn" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Icon name="menu" size={20} />
            </button>
            <span className="console-top-title">{!current || current.to === "" ? "Dashboard" : current.label}</span>
            <button type="button" className="icon-btn" onClick={() => setPalette(true)} aria-label="Search pages">
              <Icon name="search" size={19} />
            </button>
          </div>

          <main className="console-page" key={location.pathname}>
            <Suspense
              fallback={
                <>
                  <ProgressBusy />
                  {location.pathname.replace(/\/+$/, "") === "/portal/dashboard" ? (
                    <>
                      <HeroSkeleton />
                      {user.role === "SUPER_ADMIN" ? <AdminOverviewSkeleton /> : <MemberOverviewSkeleton />}
                    </>
                  ) : (
                    <ModuleSkeleton {...skeletonSpecFor(location.pathname, user.role)} />
                  )}
                </>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>

        <nav className="console-tabs" aria-label="Quick navigation">
          {tabs.map((t) => (
            <NavLink key={t.to || "home"} to={dashPath(t.to)} end={t.to === ""} className={({ isActive }) => (isActive ? "tab-link active" : "tab-link")}>
              <Icon name={t.icon} size={21} />
              {t.label === "Overview" ? "Home" : t.label}
            </NavLink>
          ))}
          <button type="button" className="tab-link" onClick={() => setDrawer(true)}>
            <Icon name="menu" size={21} />
            More
          </button>
        </nav>

        <CommandPalette items={items} open={palette} onClose={() => setPalette(false)} />
      </div>
    </UIProvider>
  );
}
