import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

/** "@username" search box used in the footer and on the Profile Finder page. Goes to /find-profile?u=… */
export function ProfileFinderForm({ initial = "", id = "pf-find", autoFocus = false, className = "" }: { initial?: string; id?: string; autoFocus?: boolean; className?: string }) {
  const [value, setValue] = useState(initial);
  const navigate = useNavigate();
  const go = (e: FormEvent) => {
    e.preventDefault();
    const name = value.trim().replace(/^@/, "");
    if (name) navigate(`/find-profile?u=${encodeURIComponent(name)}`);
  };
  return (
    <form className={`pf-form ${className}`} onSubmit={go} role="search" aria-label="Profile Finder">
      <label className="sr-only" htmlFor={id}>Username</label>
      <span className="pf-input">
        <span className="pf-at" aria-hidden="true">@</span>
        <input id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder="username" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={150} autoFocus={autoFocus} />
      </span>
      <button type="submit" className="pf-go" disabled={!value.trim()}>Find profile</button>
    </form>
  );
}
