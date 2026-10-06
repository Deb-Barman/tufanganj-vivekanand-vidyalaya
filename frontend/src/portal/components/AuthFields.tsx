import { useState } from "react";

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  type?: "text" | "email";
  icon: "user" | "mail";
  autoFocus?: boolean;
}

const ICONS = {
  user: <path d="M20 21a8 8 0 1 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
};

export function AuthTextField({ id, label, value, onChange, autoComplete, type = "text", icon, autoFocus }: FieldProps) {
  return (
    <div className="af">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        placeholder=" "
        required
        autoFocus={autoFocus}
      />
      <label htmlFor={id}>{label}</label>
      <svg className="af-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[icon]}
      </svg>
      <span className="af-line" aria-hidden="true" />
    </div>
  );
}

export function AuthPasswordField({ id, label, value, onChange, autoComplete }: Omit<FieldProps, "icon" | "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="af">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder=" "
        required
      />
      <label htmlFor={id}>{label}</label>
      <svg className="af-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <button type="button" className="af-eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {show ? (
            <><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.8M6.5 7.6A16.6 16.6 0 0 0 2.5 12S6 18 12 18a9.7 9.7 0 0 0 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
          ) : (
            <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="3" /></>
          )}
        </svg>
      </button>
      <span className="af-line" aria-hidden="true" />
    </div>
  );
}
