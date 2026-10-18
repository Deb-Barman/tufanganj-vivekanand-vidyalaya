import { L } from "../routeLoaders";

/**
 * Downloads a page's code BEFORE it is needed, so navigating never shows a placeholder skeleton
 * while code loads and then a different skeleton while data loads — only the page's own skeleton shows.
 *
 *  1. at boot      → the page for the current URL (and the dashboard shell) loads in parallel with React;
 *  2. when idle    → every other page (they are small) is fetched quietly in the background;
 *  3. on touch/hover → the exact page behind a link is fetched the instant a finger or cursor reaches it.
 *
 * `import()` is cached by the browser/bundler, so calling this many times is free.
 */
type Loader = () => Promise<unknown>;

const PUBLIC: Record<string, Loader[]> = {
  "/about": [L.AboutPage], "/academics": [L.AcademicsPage], "/faculty": [L.FacultyPage], "/achievements": [L.AchievementsPage],
  "/campus": [L.CampusPage], "/notices": [L.NoticesPage], "/blog": [L.BlogPage], "/events": [L.EventsPage],
  "/downloads": [L.DownloadsPage], "/faq": [L.FaqPage], "/admissions": [L.AdmissionsPage], "/contact": [L.ContactPage],
  "/privacy": [L.PrivacyPage], "/terms": [L.TermsPage], "/gallery": [L.GalleryPage], "/developer": [L.DeveloperPage],
};

const MODULES: Record<string, Loader> = {
  notices: L.NoticesModule, blog: L.BlogModule, events: L.EventsModule, gallery: L.GalleryModule, downloads: L.DownloadsModule,
  teachers: L.TeachersModule, attendance: L.AttendanceModule, results: L.ResultsModule, marksheets: L.MarksheetsModule,
  timetable: L.TimetableModule, homework: L.HomeworkModule, exams: L.ExamsModule, accounts: L.AccountsModule,
  admissions: L.AdmissionsModule, messages: L.MessagesModule, achievements: L.AchievementsModule,
  academics: L.AcademicSetupModule, students: L.StudentsModule,
  database: L.DatabaseModule, data: L.DataViewModule,
  profile: L.ProfileModule, import: L.ImportModule, "attendance-report": L.AttendanceReportModule,
};

const DASH = "/portal/dashboard";

function loadersFor(pathname: string): Loader[] {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === DASH) return [L.DashboardShell, L.OverviewPage];
  if (p.startsWith(DASH + "/")) {
    const slug = p.slice(DASH.length + 1).split("/")[0];
    return MODULES[slug] ? [L.DashboardShell, MODULES[slug]] : [L.DashboardShell];
  }
  if (p === "/portal") return [L.LoginPage];
  if (p === "/portal/admin") return [L.AdminLoginPage];
  if (p.startsWith("/notices/")) return [L.NoticeDetailPage];
  if (p.startsWith("/blog/")) return [L.BlogPostPage];
  if (p.startsWith("/profile/")) return [L.PublicProfilePage];
  return PUBLIC[p] ?? [];
}

/** Resolves when the code for `pathname` has downloaded (never rejects). */
export function preloadPath(pathname: string): Promise<void> {
  return Promise.allSettled(loadersFor(pathname).map((l) => l())).then(() => undefined);
}

const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const whenIdle = (fn: () => void) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 4000 }) : window.setTimeout(fn, 1500));

/** Quietly fetch every public page after the first paint. */
export function preloadPublicPages() {
  if (saveData()) return;
  whenIdle(() => Object.keys(PUBLIC).forEach((p) => void preloadPath(p)));
}

/** Quietly fetch every dashboard page once the dashboard is open. */
export function preloadPortalPages() {
  if (saveData()) return;
  whenIdle(() => {
    void preloadPath(DASH);
    Object.keys(MODULES).forEach((slug) => void preloadPath(`${DASH}/${slug}`));
  });
}

/** One delegated listener: reaching a link with a finger/cursor starts loading its page. */
export function installLinkPrefetch() {
  const handler = (e: Event) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a.target === "_blank" || a.origin !== location.origin) return;
    void preloadPath(a.pathname);
  };
  document.addEventListener("pointerover", handler, { passive: true });
  document.addEventListener("touchstart", handler, { passive: true });
}
