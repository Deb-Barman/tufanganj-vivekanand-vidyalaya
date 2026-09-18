import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { RoleBadge } from "../components/RoleBadge";
import "./DashboardShell.css";

interface NavItem {
  to: string;
  label: string;
  roles: Array<"SUPER_ADMIN" | "TEACHER" | "STUDENT">;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/portal/dashboard", label: "Overview", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/notices", label: "Notices", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/blog", label: "Blog & Articles", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/events", label: "Events", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/gallery", label: "Gallery", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/downloads", label: "Downloads", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/teachers", label: "Faculty Directory", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/attendance", label: "Attendance", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/results", label: "Results", roles: ["SUPER_ADMIN", "TEACHER", "STUDENT"] },
  { to: "/portal/dashboard/accounts", label: "Manage Accounts", roles: ["SUPER_ADMIN"] },
];

export function DashboardShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  function handleLogout() {
    logout();
    navigate("/portal", { replace: true });
  }

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-sidebar-head">
          <RoleBadge role={user.role} />
          <span className="dash-who-name">{user.full_name || "—"}</span>
        </div>
        <nav className="dash-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/portal/dashboard"}
              className={({ isActive }) => (isActive ? "dash-nav-link active" : "dash-nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="btn btn-ghost btn-sm dash-logout" onClick={handleLogout}>
          Log out
        </button>
      </aside>
      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  );
}
