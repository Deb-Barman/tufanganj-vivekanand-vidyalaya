import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { DashboardSkeleton } from "../components/loading/Loading";
import { loginPathForLastPortal, useAuth } from "../lib/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <DashboardSkeleton />;

  if (!user) {
    return <Navigate to={loginPathForLastPortal()} state={{ from: location.pathname }} replace />;
  }

  if (!user.is_active_account) {
    return <Navigate to="/portal" state={{ disabled: true }} replace />;
  }

  return <>{children}</>;
}
