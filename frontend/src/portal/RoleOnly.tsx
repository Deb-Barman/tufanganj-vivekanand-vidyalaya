import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import type { Role } from "../types/api";

/** Hides a dashboard page from roles that should not open it (the API enforces this too; this just avoids dead-end screens). */
export function RoleOnly({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/portal/dashboard" replace />;
  return <>{children}</>;
}
