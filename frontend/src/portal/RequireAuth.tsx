import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="portal-loading">Loading…</div>;

  if (!user) {
    return <Navigate to="/portal" state={{ from: location.pathname }} replace />;
  }

  if (!user.is_active_account) {
    return <Navigate to="/portal" state={{ disabled: true }} replace />;
  }

  if (user.must_change_password && location.pathname !== "/portal/change-password") {
    return <Navigate to="/portal/change-password" replace />;
  }

  return <>{children}</>;
}
