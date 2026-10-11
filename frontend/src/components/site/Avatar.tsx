/** Round initials badge (no photos are stored for teachers). */
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return (
    <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: size, height: size, borderRadius: "50%", fontWeight: 800, fontSize: size * 0.36, color: "var(--accent)", background: "var(--panel)", boxShadow: "var(--inset-sm), 0 0 0 2px rgba(var(--accent-glow), 0.25)", flex: "none" }}>
      {ini}
    </span>
  );
}
