import { useCallback, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { LoginExperience } from "../login/LoginExperience";

/**
 * Head Sir's sign-in (backend: /api/auth/admin-login/, which refuses everyone
 * else). It is deliberately NOT linked from anywhere on the site: the public
 * login page is for Students and Teachers only. It uses the same designs.
 */
export function AdminLoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingIn, setSigningIn] = useState(false);
  const dest = (location.state as { from?: string } | null)?.from ?? "/portal/dashboard";
  const onSuccess = useCallback(() => navigate(dest, { replace: true }), [navigate, dest]);

  if (!loading && user && !signingIn) return <Navigate to={dest} replace />;

  return <LoginExperience portal="admin" onSigningIn={setSigningIn} onSuccess={onSuccess} />;
}
