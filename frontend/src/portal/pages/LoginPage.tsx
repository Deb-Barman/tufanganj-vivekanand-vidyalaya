import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { ApiError } from "../../lib/api";
import { AuthShell } from "../components/AuthShell";
import { AuthPasswordField, AuthTextField } from "../components/AuthFields";

/** Student & Teacher sign-in. Backed by /api/auth/staff-login/ (rejects Super Admins). */
export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    const dest = (location.state as { from?: string })?.from ?? "/portal/dashboard";
    return <Navigate to={dest} replace />;
  }

  const disabledNotice = (location.state as { disabled?: boolean })?.disabled;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password, "staff");
      navigate("/portal/dashboard", { replace: true });
    } catch (err) {
      // The backend's own message is already safe to show verbatim — it
      // covers wrong credentials, disabled accounts and lockout timers.
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      variant="staff"
      title="Student & Teacher Login"
      subtitle="Use the username and password issued by the school office."
      footer={
        <p className="auth-note">
          No public sign-up — accounts are issued only by the school office.
          <br />
          Head Sir? <Link to="/portal/admin">Use the Super User login</Link>.
        </p>
      }
    >
      {disabledNotice && <p className="alert alert-error" style={{ marginTop: 16 }}>Your account has been disabled. Contact the school office.</p>}
      <form onSubmit={handleSubmit} className="auth-form">
        <AuthTextField id="loginUser" label="Username" icon="user" autoComplete="username" value={username} onChange={setUsername} />
        <AuthPasswordField id="loginPass" label="Password" autoComplete="current-password" value={password} onChange={setPassword} />
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting && <span className="spin" aria-hidden="true" />}
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </AuthShell>
  );
}
