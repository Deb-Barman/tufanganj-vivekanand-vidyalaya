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

  return <>{children}</>;
}
