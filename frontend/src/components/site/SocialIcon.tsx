import { SOCIAL_ICONS } from "../../lib/socialIcons";

/** A social site's real logo (inline SVG — no network request, no tracking). `website` gets a globe. */
export function SocialIcon({ name, size = 20, colored = true }: { name: string; size?: number; colored?: boolean }) {
  const icon = SOCIAL_ICONS[name];
  if (!icon)
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={colored && icon.hex !== "#000000" ? icon.hex : "currentColor"} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}
