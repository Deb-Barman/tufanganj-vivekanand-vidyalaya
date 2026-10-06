import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { ApiError } from "../../lib/api";
import { AuthShell } from "../components/AuthShell";
import { AuthPasswordField } from "../components/AuthFields";

export function ChangePasswordPage() {
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate("/portal/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      variant={user?.role === "SUPER_ADMIN" ? "admin" : "staff"}
      showTabs={false}
      title="Set a new password"
      subtitle={`${user?.full_name ? `Welcome, ${user.full_name}. ` : ""}This is a temporary password issued by the office — choose a new one before continuing.`}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <AuthPasswordField id="curPass" label="Current (temporary) password" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
        <AuthPasswordField id="newPass" label="New password (min 10 characters)" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
        <AuthPasswordField id="confirmPass" label="Confirm new password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting && <span className="spin" aria-hidden="true" />}
          {submitting ? "Saving…" : "Save & Continue"}
        </button>
      </form>
    </AuthShell>
  );
}
