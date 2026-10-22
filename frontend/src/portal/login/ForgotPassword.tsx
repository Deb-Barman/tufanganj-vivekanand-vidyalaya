import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api";
import "./forgot-password.css";

/**
 * "Forgot password?" for Students and Teachers. Nobody (not even the Super Admin) can read a password — only a one-way
 * fingerprint is stored — so this sends a request to the school office, who set a new password and hand it over.
 */
export function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ detail: string }>("/auth/forgot-password/", { username: username.trim().replace(/^@/, ""), note: note.trim() }, { auth: false });
      setDone(res.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    setOpen(false);
    setDone(null);
    setError(null);
  };

  return (
    <>
      <button type="button" className="fp-pill" onClick={() => setOpen(true)}>Forgot password?</button>
      {open &&
        createPortal(
          <div className="fpw-back" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div className="fpw" role="dialog" aria-modal="true" aria-labelledby="fpw-title">
              <h2 id="fpw-title">Forgot your password?</h2>
              {done ? (
                <>
                  <p className="fpw-ok">{done}</p>
                  <p className="fpw-small">Please check with the school office in a day or two. Keep your username handy.</p>
                  <button type="button" className="fpw-btn" onClick={close}>Done</button>
                </>
              ) : (
                <form onSubmit={submit}>
                  <p className="fpw-small">Passwords are stored in a scrambled form that no one can read — not even the school office. They will set a <b>new</b> one for you and hand it over.</p>
                  <label htmlFor="fpw-user">Your username</label>
                  <input ref={input} id="fpw-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={150} />
                  <label htmlFor="fpw-note">Class and roll number, or anything that helps the office know it is you <span>(optional)</span></label>
                  <input id="fpw-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Class 9, roll 12" />
                  {error && <p className="fpw-err" role="alert">{error}</p>}
                  <div className="fpw-actions">
                    <button type="button" className="fpw-ghost" onClick={close}>Cancel</button>
                    <button type="submit" className="fpw-btn" disabled={busy || !username.trim()}>{busy ? "Sending…" : "Tell the school office"}</button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
