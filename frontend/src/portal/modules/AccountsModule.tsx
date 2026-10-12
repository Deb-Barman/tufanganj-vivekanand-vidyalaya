import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../lib/api";
import type { Role, User } from "../../types/api";
import { Avatar, EmptyState, Icon, Modal, PageHeader, Segmented, Skeleton, StatusPill, errText, fmtDate, listAll, useDebounced, useUI } from "../ui/kitExports";

type Filter = "ALL" | "STUDENT" | "TEACHER" | "ISSUES";
type Creds = { title: string; username: string; password: string; role?: Role };
type Draft = { id: string; username: string; full_name: string; phone: string; email: string };

// Meets the backend validators (10+ chars, not common, not all numeric).
const tempPassword = () => `${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}!9`;
const isLocked = (u: User) => !!u.locked_until && new Date(u.locked_until) > new Date();

export function AccountsModule() {
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<User[] | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [busy, setBusy] = useState<string | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cUser, setCUser] = useState("");
  const [cName, setCName] = useState("");
  const [cRole, setCRole] = useState<"TEACHER" | "STUDENT">("STUDENT");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listAll<User>("/auth/admin/users/"));
    } catch (e) {
      toast("error", errText(e, "Could not load accounts."));
      setItems([]);
    }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const counts = useMemo(() => {
    const list = items ?? [];
    return { ALL: list.length, STUDENT: list.filter((u) => u.role === "STUDENT").length, TEACHER: list.filter((u) => u.role === "TEACHER").length, ISSUES: list.filter((u) => !u.is_active_account || isLocked(u)).length };
  }, [items]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter((u) => {
      const okFilter = filter === "ALL" || (filter === "ISSUES" ? !u.is_active_account || isLocked(u) : u.role === filter);
      return okFilter && (!s || `${u.full_name} ${u.username} ${u.email} ${u.phone}`.toLowerCase().includes(s));
    });
  }, [items, filter, q]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const password = tempPassword();
    try {
      await api.post<User>("/auth/admin/users/", { username: cUser.trim(), password, full_name: cName.trim(), role: cRole });
      setCreds({ title: "Account created — copy this now, it won't be shown again", username: cUser.trim(), password, role: cRole });
      setCreateOpen(false);
      setCUser("");
      setCName("");
      load();
    } catch (err) {
      toast("error", errText(err, "Could not create the account."));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      await api.patch(`/auth/admin/users/${draft.id}/`, { username: draft.username.trim(), full_name: draft.full_name.trim(), phone: draft.phone.trim(), email: draft.email.trim() });
      toast("success", "Account updated.");
      setDraft(null);
      load();
    } catch (err) {
      toast("error", errText(err, "Could not update the account."));
    } finally {
      setSaving(false);
    }
  }

  async function run(u: User, fn: () => Promise<unknown>, ok: string) {
    setBusy(u.id);
    try {
      await fn();
      toast("success", ok);
      await load();
    } catch (err) {
      toast("error", errText(err, "That did not work."));
    } finally {
      setBusy(null);
    }
  }

  const toggleActive = (u: User) => run(u, () => api.patch(`/auth/admin/users/${u.id}/`, { is_active_account: !u.is_active_account }), u.is_active_account ? "Account disabled." : "Account re-enabled.");
  const unlock = (u: User) => run(u, () => api.post(`/auth/admin/users/${u.id}/unlock/`, {}), "Account unlocked.");

  async function resetPassword(u: User) {
    if (!(await confirm({ title: "Reset password?", message: `${u.full_name} will get a new temporary password and must change it at next sign-in. Their current password stops working.`, confirmLabel: "Reset" }))) return;
    const password = tempPassword();
    setBusy(u.id);
    try {
      await api.post(`/auth/admin/users/${u.id}/reset-password/`, { new_password: password });
      setCreds({ title: "Password reset — copy this now, it won't be shown again", username: u.username, password });
      load();
    } catch (err) {
      toast("error", errText(err, "Could not reset the password."));
    } finally {
      setBusy(null);
    }
  }

  async function remove(u: User) {
    if (!(await confirm({ title: "Delete this account?", message: `${u.full_name} (${u.username}) and their profile, attendance, results, marksheets and homework records will be permanently deleted. To keep the records, disable the account instead.`, confirmLabel: "Delete permanently", danger: true }))) return;
    run(u, () => api.del(`/auth/admin/users/${u.id}/`), "Account deleted.");
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Copied.");
    } catch {
      toast("info", "Select the text and copy it manually.");
    }
  }

  return (
    <>
      <PageHeader icon="users" title="Accounts" sub="Create, edit, reset, unlock, disable or delete Teacher and Student logins. Public sign-up is off — this is the only place accounts come from." actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> New account</button>} />

      {creds && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <strong>{creds.title}</strong>
          <div style={{ marginTop: 8 }}>Username: <code>{creds.username}</code></div>
          <div>Temporary password: <code>{creds.password}</code></div>
          <div className="rcard-actions" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(`Username: ${creds.username}\nTemporary password: ${creds.password}`)}>Copy both</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreds(null)}>I have saved it</button>
          </div>
        </div>
      )}

      <div className="toolbar">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "ALL", label: "All", count: counts.ALL }, { value: "STUDENT", label: "Students", count: counts.STUDENT }, { value: "TEACHER", label: "Teachers", count: counts.TEACHER }, { value: "ISSUES", label: "Needs attention", count: counts.ISSUES }]} />
        <div className="search-box grow"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username, phone" aria-label="Search accounts" /></div>
      </div>

      {items === null ? <Skeleton rows={4} /> : shown.length === 0 ? (
        <EmptyState icon="users" title={items.length === 0 ? "No accounts yet" : "Nothing here"} text={items.length === 0 ? "Create the first Teacher or Student account." : "Try another filter or search."} />
      ) : (
        <div className="cards">
          {shown.map((u) => (
            <article className="rcard" key={u.id}>
              <div className="rcard-head">
                <Avatar name={u.full_name} />
                <div className="row-main"><strong>{u.full_name}</strong><span>@{u.username} · {u.role === "TEACHER" ? "Teacher" : "Student"}</span></div>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {!u.is_active_account && <StatusPill tone="bad">disabled</StatusPill>}
                  {isLocked(u) && <StatusPill tone="warn">locked</StatusPill>}
                  {u.must_change_password && u.is_active_account && <StatusPill tone="info">first login pending</StatusPill>}
                </span>
              </div>
              <div className="rcard-meta">
                <span className="mini-meta">Created {fmtDate(u.created_at)}</span>
                <span className="mini-meta">{u.last_login ? `Last sign-in ${fmtDate(u.last_login)}` : "Never signed in"}</span>
                {u.phone && <span className="mini-meta"><Icon name="phone" size={14} /> {u.phone}</span>}
              </div>
              <div className="rcard-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft({ id: u.id, username: u.username, full_name: u.full_name, phone: u.phone ?? "", email: u.email ?? "" })}><Icon name="edit" size={15} /> Edit</button>
                <button type="button" className="btn btn-outline btn-sm" disabled={busy === u.id} onClick={() => resetPassword(u)}><Icon name="lock" size={15} /> Reset password</button>
                {isLocked(u) && <button type="button" className="btn btn-primary btn-sm" disabled={busy === u.id} onClick={() => unlock(u)}>Unlock</button>}
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy === u.id} onClick={() => toggleActive(u)}>{u.is_active_account ? "Disable" : "Re-enable"}</button>
                <button type="button" className="icon-btn danger" style={{ marginLeft: "auto" }} disabled={busy === u.id} onClick={() => remove(u)} aria-label={`Delete ${u.full_name}`}><Icon name="trash" size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={createOpen} title="New account" onClose={() => setCreateOpen(false)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" form="acc-create" className="btn btn-primary btn-sm" disabled={saving || cUser.trim().length < 3 || !cName.trim()}>{saving ? "Creating…" : "Create account"}</button></>}>
        <form id="acc-create" onSubmit={create} className="stack" style={{ gap: 14 }}>
          <div className="form-field"><label htmlFor="accName">Full name</label><input id="accName" value={cName} onChange={(e) => setCName(e.target.value)} required /></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="accUser">Username</label><input id="accUser" value={cUser} minLength={3} onChange={(e) => setCUser(e.target.value)} required /></div>
            <div className="form-field"><label htmlFor="accRole">Role</label><select id="accRole" value={cRole} onChange={(e) => setCRole(e.target.value as "TEACHER" | "STUDENT")}><option value="STUDENT">Student</option><option value="TEACHER">Teacher</option></select></div>
          </div>
          <p className="modal-text">A temporary password is generated and shown once. The person must change it at first sign-in.</p>
        </form>
      </Modal>

      <Modal open={draft !== null} title="Edit account" onClose={() => setDraft(null)} footer={<><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button><button type="submit" form="acc-edit" className="btn btn-primary btn-sm" disabled={saving || !draft || draft.username.trim().length < 3 || !draft.full_name.trim()}>{saving ? "Saving…" : "Save changes"}</button></>}>
        {draft && (
          <form id="acc-edit" onSubmit={saveEdit} className="stack" style={{ gap: 14 }}>
            <div className="form-field"><label htmlFor="eaName">Full name</label><input id="eaName" value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} required /></div>
            <div className="form-field"><label htmlFor="eaUser">Username (used to sign in)</label><input id="eaUser" value={draft.username} minLength={3} onChange={(e) => setDraft({ ...draft, username: e.target.value })} required /></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="eaPhone">Phone</label><input id="eaPhone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
              <div className="form-field"><label htmlFor="eaMail">Email</label><input id="eaMail" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
