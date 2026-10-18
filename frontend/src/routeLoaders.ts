/**
 * Every lazily-loaded page, in one place. App.tsx renders them; routePreload.ts downloads them
 * early so the page's own loading skeleton is the only one a visitor ever sees.
 */
type Loader = () => Promise<unknown>;

/** Modules that have finished downloading, keyed by their loader. A page whose code is already here renders
 *  immediately instead of suspending for a tick (which would flash a placeholder skeleton). */
export const loadedModules = new WeakMap<Loader, unknown>();
function track<F extends Loader>(load: F): F {
  const wrapped = (() => load().then((m) => (loadedModules.set(wrapped, m), m))) as F;
  return wrapped;
}

export const L = {
  AboutPage: track(() => import("./pages/AboutPage")),
  AcademicsPage: track(() => import("./pages/AcademicsPage")),
  FacultyPage: track(() => import("./pages/FacultyPage")),
  AchievementsPage: track(() => import("./pages/AchievementsPage")),
  CampusPage: track(() => import("./pages/CampusPage")),
  NoticesPage: track(() => import("./pages/NoticesPage")),
  NoticeDetailPage: track(() => import("./pages/NoticesPage")),
  BlogPage: track(() => import("./pages/BlogPage")),
  BlogPostPage: track(() => import("./pages/BlogPage")),
  EventsPage: track(() => import("./pages/EventsPage")),
  DownloadsPage: track(() => import("./pages/DownloadsPage")),
  FaqPage: track(() => import("./pages/FaqPage")),
  AdmissionsPage: track(() => import("./pages/AdmissionsPage")),
  ContactPage: track(() => import("./pages/ContactPage")),
  PrivacyPage: track(() => import("./pages/LegalPages")),
  TermsPage: track(() => import("./pages/LegalPages")),
  GalleryPage: track(() => import("./pages/GalleryPage")),
  DeveloperPage: track(() => import("./pages/DeveloperPage")),
  PublicProfilePage: track(() => import("./pages/PublicProfilePage")),
  LoginPage: track(() => import("./portal/pages/LoginPage")),
  AdminLoginPage: track(() => import("./portal/pages/AdminLoginPage")),
  DashboardShell: track(() => import("./portal/pages/DashboardShell")),
  DashboardNotFound: track(() => import("./portal/pages/DashboardNotFound")),
  OverviewPage: track(() => import("./portal/pages/OverviewPage")),
  NoticesModule: track(() => import("./portal/modules/NoticesModule")),
  BlogModule: track(() => import("./portal/modules/BlogModule")),
  EventsModule: track(() => import("./portal/modules/EventsModule")),
  GalleryModule: track(() => import("./portal/modules/GalleryModule")),
  DownloadsModule: track(() => import("./portal/modules/DownloadsModule")),
  TeachersModule: track(() => import("./portal/modules/TeachersModule")),
  AttendanceModule: track(() => import("./portal/modules/AttendanceModule")),
  ResultsModule: track(() => import("./portal/modules/ResultsModule")),
  AccountsModule: track(() => import("./portal/modules/AccountsModule")),
  AdmissionsModule: track(() => import("./portal/modules/AdmissionsModule")),
  StudentsModule: track(() => import("./portal/modules/StudentsModule")),
  AcademicSetupModule: track(() => import("./portal/modules/AcademicSetupModule")),
  MarksheetsModule: track(() => import("./portal/modules/MarksheetsModule")),
  TimetableModule: track(() => import("./portal/modules/TimetableModule")),
  HomeworkModule: track(() => import("./portal/modules/HomeworkModule")),
  ExamsModule: track(() => import("./portal/modules/ExamsModule")),
  MessagesModule: track(() => import("./portal/modules/MessagesModule")),
  AchievementsModule: track(() => import("./portal/modules/AchievementsModule")),
  DatabaseModule: track(() => import("./portal/modules/DatabaseModule")),
  DataViewModule: track(() => import("./portal/modules/DataViewModule")),
  ProfileModule: track(() => import("./portal/modules/ProfileModule")),
  ImportModule: track(() => import("./portal/modules/ImportModule")),
  AttendanceReportModule: track(() => import("./portal/modules/AttendanceReportModule")),
} as const;
