import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { ApiError } from "../../lib/api";
import { AuthShell } from "../components/AuthShell";
import { AuthPasswordField, AuthTextField } from "../components/AuthFields";

/** Super User (Head Sir) sign-in by email. Backed by /api/auth/admin-login/ (rejects everyone else). */
export function AdminLoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    const dest = (location.state as { from?: string })?.from ?? "/portal/dashboard";
    return <Navigate to={dest} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password, "admin");
      navigate("/portal/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      variant="admin"
      title="Super User Login"
      subtitle="Restricted area — Head Sir / Super Admin only."
      footer={
        <p className="auth-note">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Repeated failed attempts lock the account for 15 minutes.
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <AuthTextField id="adminEmail" label="Email" type="email" icon="mail" autoComplete="username" value={email} onChange={setEmail} autoFocus />
        <AuthPasswordField id="adminPass" label="Password" autoComplete="current-password" value={password} onChange={setPassword} />
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting && <span className="spin" aria-hidden="true" />}
          {submitting ? "Verifying…" : "Sign In as Super User"}
        </button>
      </form>
    </AuthShell>
  );
}
