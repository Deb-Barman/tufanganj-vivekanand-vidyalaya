import { useAuth } from "../../lib/AuthContext";

export function OverviewPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="dash-panel">
      <h2>Welcome, {user.full_name || "there"}</h2>
      <p className="dash-panel-sub">
        Signed in as {user.role.replace("_", " ").toLowerCase()}. Use the sidebar to manage notices, the school
        blog, events, gallery, downloads
        {user.role !== "STUDENT" ? ", and the faculty directory" : ""}
        {user.role === "SUPER_ADMIN" ? ", plus Teacher and Student accounts" : ""}.
      </p>
    </div>
  );
}
