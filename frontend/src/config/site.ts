/**
 * Single source of truth for school facts and site navigation.
 * Only facts already published on the site live here — add phone/email below
 * once the school confirms them and they will appear automatically.
 */
export const SITE = {
  name: "Tufanganj Vivekananda Vidyalaya",
  nameFull: "Tufanganj Vivekananda Vidyalaya (H.S.)",
  short: "T.V. Vidyalaya",
  since: 1964,
  town: "Tufanganj, Cooch Behar, West Bengal, India",
  hours: "Monday–Saturday, during the school term",
  motto: "Knowledge · Character · Progress",
  quote: { text: "Arise, awake, and stop not till the goal is reached.", by: "Swami Vivekananda" },
  /** Absolute site address, used for canonical links and the sitemap. */
  url: "https://tufanganj-vivekanand-vidyalaya.vercel.app",
  facebook: "https://facebook.com/TufanganjVivekanandaVidyalaya",
  instagram: "https://www.instagram.com/tufanganjvivekanandavidyalay",
  /** Paste the school's YouTube channel link here when it is ready — the icon turns into a link automatically. */
  youtube: "",
  /** Leave empty until confirmed by the school office. Shown on /contact only when filled in. */
  phone: "",
  email: "",
  /**
   * Optional exact pin for the Contact-page map. While lat/lng are empty the map is found by the
   * school's name + town. To pin the exact gate, open Google Maps, long-press the school, copy the
   * two numbers (e.g. 26.3150, 89.6583) and paste them here.
   */
  map: { lat: "", lng: "", zoom: 16 },
} as const;

export interface NavItem {
  to: string;
  label: string;
  desc: string;
}

/** Top navigation. */
export const NAV: NavItem[] = [
  { to: "/about", label: "About", desc: "Our story, values and the school at a glance" },
  { to: "/academics", label: "Academics", desc: "Science and Arts streams, Class XI–XII" },
  { to: "/faculty", label: "Faculty", desc: "Meet the teachers" },
  { to: "/achievements", label: "Achievements", desc: "Results and recognition" },
  { to: "/campus", label: "Campus", desc: "Sports, labs, library and more" },
  { to: "/notices", label: "Notices", desc: "Official announcements" },
  { to: "/blog", label: "Blog", desc: "Stories from school life" },
  { to: "/admissions", label: "Admissions", desc: "How to join the school" },
  { to: "/contact", label: "Contact", desc: "Visit or write to us" },
];

/** Extra pages reachable from the footer / home page. */
export const MORE: NavItem[] = [
  { to: "/events", label: "Events", desc: "School calendar" },
  { to: "/downloads", label: "Downloads", desc: "Forms and documents" },
  { to: "/faq", label: "FAQ", desc: "Questions parents ask" },
  { to: "/privacy", label: "Privacy", desc: "How we handle your data" },
  { to: "/terms", label: "Terms", desc: "Using this website" },
  { to: "/gallery", label: "Gallery", desc: "Photos from school life" },
];
