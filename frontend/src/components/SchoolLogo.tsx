import { useState } from "react";

// Expected upload path: frontend/public/school_logo.png OR
// frontend/public/school_logo.jpg — either works, tried in that order.
// Anything in `public/` is served from the site root, so the browser
// requests /school_logo.png directly; Vite doesn't process it further.
const LOGO_CANDIDATES = ["/school_logo.png", "/school_logo.jpg"];

function CrestFallback({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#5D46B9" />
      <circle cx="100" cy="100" r="98" fill="none" stroke="#48368F" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="81" fill="#FBFAFD" />
      <circle cx="100" cy="100" r="73" fill="none" stroke="#5D46B9" strokeWidth="4" />
      <circle cx="100" cy="104" r="46" fill="#382A6F" />
      <text x="100" y="116" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="46" fill="#FBFAFD">
        T
      </text>
    </svg>
  );
}

/**
 * Renders the real school logo once it's uploaded to
 * frontend/public/school_logo.png (or .jpg). Until then — or if the file
 * fails to load for any reason — falls back to a placeholder crest so the
 * header never breaks or shows a broken-image icon.
 */
export function SchoolLogo({ size = 34, className }: { size?: number; className?: string }) {
  const [candidateIndex, setCandidateIndex] = useState(0);

  if (candidateIndex >= LOGO_CANDIDATES.length) {
    return <CrestFallback size={size} />;
  }

  return (
    <img
      src={LOGO_CANDIDATES[candidateIndex]}
      alt="Tufanganj Vivekananda Vidyalaya school logo"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: "50%" }}
      onError={() => setCandidateIndex((i) => i + 1)}
    />
  );
}
