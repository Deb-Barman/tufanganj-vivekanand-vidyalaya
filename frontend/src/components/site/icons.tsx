import type { ReactNode } from "react";

const p = (d: string): ReactNode => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Icon per public route (used by the home "Explore" grid and elsewhere). */
export const ICONS: Record<string, ReactNode> = {
  "/about": p("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01"),
  "/academics": p("M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"),
  "/faculty": p("M3 9.5 12 4l9 5.5M5 11v8M19 11v8M9 19v-5h6v5M3 19h18"),
  "/achievements": p("M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8.5 13.5 7 22l5-3 5 3-1.5-8.5"),
  "/campus": p("M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01"),
  "/notices": p("M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"),
  "/blog": p("M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"),
  "/admissions": p("M4 13l2.5-8h11L20 13M4 13v6h16v-6M4 13h5l1 2h4l1-2h5"),
  "/contact": p("M3 6h18v12H3zM3 7l9 6.5L21 7"),
  "/events": p("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"),
  "/faq": p("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"),
  "/downloads": p("M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"),
};
