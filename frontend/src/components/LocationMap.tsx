import { useState } from "react";
import { SITE } from "../config/site";
import "./LocationMap.css";

/**
 * Neumorphic "Find us" map card for the Contact page.
 *  - Google Maps embed (no API key), lazy-loaded, with a shimmer until it is ready
 *  - tap-to-explore cover so the map never traps page scroll on phones
 *  - follows the site's light/dark theme
 *  - Get directions / Open in Maps / Copy address buttons
 */
const ADDRESS = `${SITE.nameFull}, ${SITE.town}`;
const hasPin = SITE.map.lat !== "" && SITE.map.lng !== "";
const target = hasPin ? `${SITE.map.lat},${SITE.map.lng}` : ADDRESS;
const EMBED = `https://maps.google.com/maps?q=${encodeURIComponent(target)}&z=${SITE.map.zoom}&output=embed`;
const OPEN = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
const DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}&travelmode=driving`;

const Pin = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;

export function LocationMap() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const canHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(ADDRESS);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = ADDRESS;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
    }
    setCopied(ok ? "ok" : "fail");
    window.setTimeout(() => setCopied(""), 2000);
  }

  return (
    <section className="loc-card" aria-label="School location map">
      <header className="loc-head">
        <span className="loc-pin"><Pin /></span>
        <div>
          <h2>Find the school</h2>
          <p>{ADDRESS}</p>
        </div>
      </header>

      <div className="loc-well">
        <div className="loc-frame" onMouseLeave={() => canHover && setUnlocked(false)}>
          {!ready && <div className="loc-skeleton" aria-hidden="true" />}
          <iframe
            className={ready ? "ready" : ""}
            title={`Map showing ${SITE.nameFull}`}
            src={EMBED}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            onLoad={() => setReady(true)}
          />
          <div className="loc-tint" aria-hidden="true" />
          <div className="loc-shade" aria-hidden="true" />
          <span className="loc-badge"><Pin /> Tufanganj</span>
          {!unlocked && (
            <button type="button" className="loc-cover" onClick={() => setUnlocked(true)}>
              <span className="loc-hint">{canHover ? "Click to explore map" : "Tap to explore map"}</span>
            </button>
          )}
          {unlocked && <button type="button" className="loc-lock" onClick={() => setUnlocked(false)} aria-label="Lock the map so the page can scroll">Lock map</button>}
        </div>
      </div>

      {hasPin && <p className="loc-coords"><span>LAT {SITE.map.lat} · LNG {SITE.map.lng}</span><span>Google Maps</span></p>}

      <div className="loc-actions">
        <a className="loc-btn primary" href={DIRECTIONS} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8-8-2Z" /></svg>
          Get directions
        </a>
        <a className="loc-btn" href={OPEN} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          Open in Maps
        </a>
        <button type="button" className={`loc-btn${copied === "ok" ? " done" : ""}`} onClick={copy} aria-live="polite">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
          {copied === "ok" ? "Copied ✓" : copied === "fail" ? "Copy failed" : "Copy address"}
        </button>
      </div>
    </section>
  );
}
