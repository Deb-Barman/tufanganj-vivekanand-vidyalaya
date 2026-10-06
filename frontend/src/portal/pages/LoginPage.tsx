import { useCallback, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { LoginExperience } from "../login/LoginExperience";

/**
 * The one login page for Students and Teachers (backend: /api/auth/staff-login/,
 * which refuses Super Admins). One of two designs is shown at random.
 */
export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingIn, setSigningIn] = useState(false);
  const state = location.state as { from?: string; disabled?: boolean } | null;
  const dest = state?.from ?? "/portal/dashboard";

  const onSuccess = useCallback(() => navigate(dest, { replace: true }), [navigate, dest]);

  // Already signed in (e.g. opened /portal again) -> straight to the dashboard.
  // Held back while a sign-in is running so its success animation can finish.
  if (!loading && user && !signingIn) return <Navigate to={dest} replace />;

  return (
    <LoginExperience
      portal="staff"
      initialNotice={state?.disabled ? "Your account has been disabled. Contact the school office." : undefined}
      onSigningIn={setSigningIn}
      onSuccess={onSuccess}
    />
  );
}
