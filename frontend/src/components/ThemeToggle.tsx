import { useTheme } from "../lib/theme";
import type { ThemePreference } from "../lib/theme";
import "./ThemeToggle.css";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
  {
    value: "light",
    label: "Light theme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System theme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark theme",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2z" />
      </svg>
    ),
  },
];

/**
 * Three-way segmented control: Light / System / Dark. A sliding "thumb"
 * (pure CSS, driven by the selected index) glides between options.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const index = OPTIONS.findIndex((o) => o.value === preference);

  return (
    <div
      className={`theme-toggle ${className}`}
      role="radiogroup"
      aria-label="Colour theme"
      style={{ ["--i" as string]: index }}
    >
      <span className="tt-thumb" aria-hidden="true" />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={preference === o.value}
          aria-label={o.label}
          title={o.label}
          className={preference === o.value ? "tt-btn on" : "tt-btn"}
          onClick={() => setPreference(o.value)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
