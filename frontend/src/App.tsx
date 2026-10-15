import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorScreen } from "./components/ErrorScreen";
import { SiteLayout } from "./components/site/SiteLayout";
import { DashboardSkeleton, ScreenLoader } from "./components/loading/Loading";
import { HomePage } from "./pages/HomePage";
import { DashboardLayout } from "./portal/DashboardLayout";
import { RequireAuth } from "./portal/RequireAuth";
import { RoleOnly } from "./portal/RoleOnly";
import { L, loadedModules } from "./routeLoaders";

/** React.lazy for a named export: each page becomes its own small download. If the page was preloaded
 *  (see lib/routePreload.ts) it renders right away, without a Suspense fallback flash. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyNamed<M extends Record<string, ComponentType<any>>, K extends keyof M>(load: () => Promise<M>, name: K) {
  const Lazy = lazy(() => load().then((m) => ({ default: m[name] })));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function Page(props: any) {
    const done = loadedModules.get(load) as M | undefined;
    if (done) {
      const Ready = done[name];
      return <Ready {...props} />;
    }
    return <Lazy {...props} />;
  };
}

// public site
const AboutPage = lazyNamed(L.AboutPage, "AboutPage");
const AcademicsPage = lazyNamed(L.AcademicsPage, "AcademicsPage");
const FacultyPage = lazyNamed(L.FacultyPage, "FacultyPage");
const AchievementsPage = lazyNamed(L.AchievementsPage, "AchievementsPage");
const CampusPage = lazyNamed(L.CampusPage, "CampusPage");
const NoticesPage = lazyNamed(L.NoticesPage, "NoticesPage");
const NoticeDetailPage = lazyNamed(L.NoticeDetailPage, "NoticeDetailPage");
const BlogPage = lazyNamed(L.BlogPage, "BlogPage");
const BlogPostPage = lazyNamed(L.BlogPostPage, "BlogPostPage");
const EventsPage = lazyNamed(L.EventsPage, "EventsPage");
const DownloadsPage = lazyNamed(L.DownloadsPage, "DownloadsPage");
const FaqPage = lazyNamed(L.FaqPage, "FaqPage");
const AdmissionsPage = lazyNamed(L.AdmissionsPage, "AdmissionsPage");
const ContactPage = lazyNamed(L.ContactPage, "ContactPage");
const PrivacyPage = lazyNamed(L.PrivacyPage, "PrivacyPage");
const TermsPage = lazyNamed(L.TermsPage, "TermsPage");
const GalleryPage = lazyNamed(L.GalleryPage, "GalleryPage");
const DeveloperPage = lazyNamed(L.DeveloperPage, "DeveloperPage");

// portal
const LoginPage = lazyNamed(L.LoginPage, "LoginPage");
const AdminLoginPage = lazyNamed(L.AdminLoginPage, "AdminLoginPage");
const ChangePasswordPage = lazyNamed(L.ChangePasswordPage, "ChangePasswordPage");
const DashboardShell = lazyNamed(L.DashboardShell, "DashboardShell");
const DashboardNotFound = lazyNamed(L.DashboardNotFound, "DashboardNotFound");
const OverviewPage = lazyNamed(L.OverviewPage, "OverviewPage");
const NoticesModule = lazyNamed(L.NoticesModule, "NoticesModule");
const BlogModule = lazyNamed(L.BlogModule, "BlogModule");
const EventsModule = lazyNamed(L.EventsModule, "EventsModule");
const GalleryModule = lazyNamed(L.GalleryModule, "GalleryModule");
const DownloadsModule = lazyNamed(L.DownloadsModule, "DownloadsModule");
const TeachersModule = lazyNamed(L.TeachersModule, "TeachersModule");
const AttendanceModule = lazyNamed(L.AttendanceModule, "AttendanceModule");
const ResultsModule = lazyNamed(L.ResultsModule, "ResultsModule");
const AccountsModule = lazyNamed(L.AccountsModule, "AccountsModule");
const AdmissionsModule = lazyNamed(L.AdmissionsModule, "AdmissionsModule");
const StudentsModule = lazyNamed(L.StudentsModule, "StudentsModule");
const AcademicSetupModule = lazyNamed(L.AcademicSetupModule, "AcademicSetupModule");
const MarksheetsModule = lazyNamed(L.MarksheetsModule, "MarksheetsModule");
const TimetableModule = lazyNamed(L.TimetableModule, "TimetableModule");
const HomeworkModule = lazyNamed(L.HomeworkModule, "HomeworkModule");
const ExamsModule = lazyNamed(L.ExamsModule, "ExamsModule");
const MessagesModule = lazyNamed(L.MessagesModule, "MessagesModule");
const AchievementsModule = lazyNamed(L.AchievementsModule, "AchievementsModule");

const ADMIN = ["SUPER_ADMIN"] as const;
const STAFF = ["SUPER_ADMIN", "TEACHER"] as const;

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="academics" element={<AcademicsPage />} />
        <Route path="faculty" element={<FacultyPage />} />
        <Route path="achievements" element={<AchievementsPage />} />
        <Route path="campus" element={<CampusPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="notices/:id" element={<NoticeDetailPage />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="admissions" element={<AdmissionsPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="developer" element={<DeveloperPage />} />

        <Route path="portal/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
      </Route>

      {/* dashboards: NO public header/footer around them */}
      <Route element={<DashboardLayout />}>
        <Route
          path="portal/dashboard"
          element={
            <RequireAuth>
              <Suspense fallback={<DashboardSkeleton />}>
                <DashboardShell />
              </Suspense>
            </RequireAuth>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="notices" element={<NoticesModule />} />
          <Route path="blog" element={<BlogModule />} />
          <Route path="events" element={<EventsModule />} />
          <Route path="gallery" element={<GalleryModule />} />
          <Route path="downloads" element={<DownloadsModule />} />
          <Route path="teachers" element={<TeachersModule />} />
          <Route path="attendance" element={<AttendanceModule />} />
          <Route path="results" element={<ResultsModule />} />
          <Route path="marksheets" element={<MarksheetsModule />} />
          <Route path="timetable" element={<TimetableModule />} />
          <Route path="homework" element={<HomeworkModule />} />
          <Route path="exams" element={<ExamsModule />} />
          <Route path="accounts" element={<RoleOnly roles={[...ADMIN]}><AccountsModule /></RoleOnly>} />
          <Route path="admissions" element={<RoleOnly roles={[...ADMIN]}><AdmissionsModule /></RoleOnly>} />
          <Route path="messages" element={<RoleOnly roles={[...ADMIN]}><MessagesModule /></RoleOnly>} />
          <Route path="achievements" element={<RoleOnly roles={[...ADMIN]}><AchievementsModule /></RoleOnly>} />
          <Route path="academics" element={<RoleOnly roles={[...ADMIN]}><AcademicSetupModule /></RoleOnly>} />
          <Route path="students" element={<RoleOnly roles={[...STAFF]}><StudentsModule /></RoleOnly>} />
          <Route path="*" element={<DashboardNotFound />} />
        </Route>
      </Route>

      {/* login screens are full-screen, with their own design */}
      <Route path="portal" element={<Suspense fallback={<ScreenLoader />}><LoginPage /></Suspense>} />
      <Route path="portal/admin" element={<Suspense fallback={<ScreenLoader />}><AdminLoginPage /></Suspense>} />

      {/* friendly aliases so any URL a visitor guesses still works */}
      <Route path="teacher" element={<Navigate to="/faculty" replace />} />
      <Route path="teachers" element={<Navigate to="/faculty" replace />} />
      <Route path="staff" element={<Navigate to="/faculty" replace />} />
      <Route path="about-us" element={<Navigate to="/about" replace />} />
      <Route path="contact-us" element={<Navigate to="/contact" replace />} />
      <Route path="admission" element={<Navigate to="/admissions" replace />} />
      <Route path="notice" element={<Navigate to="/notices" replace />} />
      <Route path="facilities" element={<Navigate to="/campus" replace />} />
      <Route path="event" element={<Navigate to="/events" replace />} />
      <Route path="forms" element={<Navigate to="/downloads" replace />} />
      <Route path="login" element={<Navigate to="/portal" replace />} />
      <Route path="student" element={<Navigate to="/portal" replace />} />

      {/* anything unmatched: a full-screen, non-scrolling 404 */}
      <Route path="*" element={<ErrorScreen code="404" />} />
    </Routes>
  );
}
