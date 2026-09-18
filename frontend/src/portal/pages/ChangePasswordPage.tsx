import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { ApiError } from "../../lib/api";
import "./LoginPage.css";

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
    <div className="login-page">
      <div className="login-card">
        <h1>Set a new password</h1>
        <p className="login-sub">
          {user?.full_name ? `Welcome, ${user.full_name}. ` : ""}
          This is a temporary password issued by the office — choose a new one before continuing.
        </p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-field">
            <label htmlFor="curPass">Current (temporary) password</label>
            <input
              id="curPass"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="newPass">New password</label>
            <input
              id="newPass"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="confirmPass">Confirm new password</label>
            <input
              id="confirmPass"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="alert alert-error">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {submitting ? "Saving…" : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
