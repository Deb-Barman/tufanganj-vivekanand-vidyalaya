import { Suspense, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { CommandPalette } from "../ui/CommandPalette";
import { Icon } from "../ui/icons";
import { dashPath, groupNav, navFor } from "../ui/nav";
import { UIProvider } from "../ui/kit";
import { Sidebar } from "../ui/Sidebar";
import { api } from "../../lib/api";
import { ProgressBusy } from "../../components/loading/Loading";
import { AdminOverviewSkeleton, HeroSkeleton, MemberOverviewSkeleton, ModuleSkeleton } from "../ui/Skeletons";
import { skeletonSpecFor } from "../ui/skeletonVariant";
import type { AdminStats } from "../../types/api";
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
  // Desktop: collapse the sidebar to an icon rail (remembered between visits).
  const [rail, setRail] = useState(() => {
    try {
      return localStorage.getItem("tvv_nav_rail") === "1";
    } catch {
      return false;
    }
  });
  const toggleRail = () =>
    setRail((r) => {
      try {
        localStorage.setItem("tvv_nav_rail", r ? "0" : "1");
      } catch {
        /* not remembered in private mode */
      }
      return !r;
    });
  // Number bubbles on menu rows (Super Admin: enquiries waiting). Failure just means no bubbles.
  const [badges, setBadges] = useState<Record<string, number>>({});
  const isAdmin = user?.role === "SUPER_ADMIN";
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    const pull = () => {
      if (document.visibilityState === "hidden") return;
      api.get<AdminStats>("/auth/admin/stats/").then((s) => alive && setBadges({ admissions: s.admissions.pending, accounts: s.password_requests ?? 0 }), () => undefined);
    };
    pull();
    const t = setInterval(pull, 120000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [isAdmin]);

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
      <div className={`console${rail ? " is-rail" : ""}`}>
        {drawer && <div className="console-scrim" onClick={() => setDrawer(false)} />}

        <Sidebar
          user={user}
          groups={groups}
          open={drawer}
          onClose={() => setDrawer(false)}
          rail={rail}
          onToggleRail={toggleRail}
          onLogout={handleLogout}
          onQuickJump={() => setPalette(true)}
          activePath={location.pathname}
          badges={badges}
        />

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
