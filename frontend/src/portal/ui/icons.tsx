import type { SVGProps } from "react";

/** Small hand-picked icon set (24x24, stroke). One component, no extra dependency. */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0",
  megaphone: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01",
  download: "M12 4v11m0 0 4-4m-4 4-4-4M5 20h14",
  copy: "M9 9h11v11H9zM5 15V4h11",
  printer: "M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  send: "M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z",
  users: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.5a4 4 0 0 0-3-3.9M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  check: "m5 12.5 4.5 4.5L19 7.5",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.5l3 3 5-6",
  clipboard: "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM8 6H6v15h12V6h-2M9 12h6M9 16h4",
  award: "M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8.5 13.5 7 22l5-3 5 3-1.5-8.5",
  file: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4",
  school: "M3 9.5 12 4l9 5.5M5 11v8M19 11v8M9 19v-5h6v5M3 19h18",
  layers: "m12 3 9 5-9 5-9-5ZM3 12.5l9 5 9-5M3 16.5l9 5 9-5",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1l-.3 2h-4l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 1.7-1l.3-2h4l.3 2a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.5-4.5",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  logout: "M9 4H5v16h4M16 8l4 4-4 4M20 12H9",
  chevronRight: "m9 6 6 6-6 6",
  chevronDown: "m6 9 6 6 6-6",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z",
  alert: "M12 4 2.5 20h19ZM12 10v4.5M12 17.5h.01",
  inbox: "M4 13l2.5-8h11L20 13M4 13v6h16v-6M4 13h5l1 2h4l1-2h5",
  cap: "M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z",
  arrowRight: "M5 12h14m-5-5 5 5-5 5",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  mail: "M3 6h18v12H3zM3 7l9 6.5L21 7",
  shield: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  chevronLeft: "m15 6-6 6 6 6",
  chevronUp: "m6 15 6-6 6 6",
  database: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3ZM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14",
  cloud: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4.5 4.5 0 0 1 17.5 18Z",
  server: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
