import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import type { Paginated, Role, User } from "../../types/api";

interface CreateResult {
  username: string;
  password: string;
  role: Role;
}

export function AccountsModule() {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"TEACHER" | "STUDENT">("STUDENT");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState<CreateResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.get<Paginated<User>>("/auth/admin/users/");
      setAccounts(data.results);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function generateTempPassword() {
    // Meets the backend's MinimumLengthValidator (10 chars) with a mix
    // that also clears CommonPasswordValidator/NumericPasswordValidator.
    return `${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}!9`;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLastCreated(null);
    setSubmitting(true);
    const tempPassword = generateTempPassword();
    try {
      await api.post<User>("/auth/admin/users/", {
        username,
        password: tempPassword,
        full_name: fullName,
        role,
      });
      setLastCreated({ username, password: tempPassword, role });
      setUsername("");
      setFullName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(account: User) {
    setBusyId(account.id);
    try {
      await api.patch(`/auth/admin/users/${account.id}/`, { is_active_account: !account.is_active_account });
      await load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not update account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="dash-panel">
      <h2>Manage Accounts</h2>
      <p className="dash-panel-sub">
        The only way Teacher/Student accounts are created — public sign-up is disabled. New accounts get a temporary
        password shown once below; share it securely and the portal forces a change on first login.
      </p>

      <form className="dash-form" onSubmit={handleCreate}>
        <div className="ff-row">
          <div className="form-field">
            <label htmlFor="accUser">Username</label>
            <input id="accUser" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          </div>
          <div className="form-field">
            <label htmlFor="accRole">Role</label>
            <select id="accRole" value={role} onChange={(e) => setRole(e.target.value as "TEACHER" | "STUDENT")}>
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="accName">Full name</label>
          <input id="accName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        {formError && <p className="alert alert-error">{formError}</p>}
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ alignSelf: "flex-start" }}>
          {submitting ? "Creating…" : "Create Account"}
        </button>
      </form>

      {lastCreated && (
        <div className="alert alert-info" style={{ marginTop: 16 }}>
          <strong>Account created — copy this now, it won't be shown again:</strong>
          <br />
          Username: {lastCreated.username}
          <br />
          Temporary password: <code>{lastCreated.password}</code>
          <br />
          Role: {lastCreated.role}
        </div>
      )}

      {listError && <p className="alert alert-error" style={{ marginTop: 16 }}>{listError}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="dash-empty">No Teacher/Student accounts yet.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.full_name}</td>
                  <td>{a.role}</td>
                  <td>{a.is_active_account ? "Active" : "Disabled"}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => toggleActive(a)}>
                      {a.is_active_account ? "Disable" : "Re-enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
