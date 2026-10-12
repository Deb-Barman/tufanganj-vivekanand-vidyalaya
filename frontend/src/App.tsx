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

/** React.lazy for a named export: each page becomes its own small download. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyNamed<M extends Record<string, ComponentType<any>>, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

// public site
const AboutPage = lazyNamed(() => import("./pages/AboutPage"), "AboutPage");
const AcademicsPage = lazyNamed(() => import("./pages/AcademicsPage"), "AcademicsPage");
const FacultyPage = lazyNamed(() => import("./pages/FacultyPage"), "FacultyPage");
const AchievementsPage = lazyNamed(() => import("./pages/AchievementsPage"), "AchievementsPage");
const CampusPage = lazyNamed(() => import("./pages/CampusPage"), "CampusPage");
const NoticesPage = lazyNamed(() => import("./pages/NoticesPage"), "NoticesPage");
const NoticeDetailPage = lazyNamed(() => import("./pages/NoticesPage"), "NoticeDetailPage");
const BlogPage = lazyNamed(() => import("./pages/BlogPage"), "BlogPage");
const BlogPostPage = lazyNamed(() => import("./pages/BlogPage"), "BlogPostPage");
const EventsPage = lazyNamed(() => import("./pages/EventsPage"), "EventsPage");
const DownloadsPage = lazyNamed(() => import("./pages/DownloadsPage"), "DownloadsPage");
const FaqPage = lazyNamed(() => import("./pages/FaqPage"), "FaqPage");
const AdmissionsPage = lazyNamed(() => import("./pages/AdmissionsPage"), "AdmissionsPage");
const ContactPage = lazyNamed(() => import("./pages/ContactPage"), "ContactPage");
const PrivacyPage = lazyNamed(() => import("./pages/LegalPages"), "PrivacyPage");
const TermsPage = lazyNamed(() => import("./pages/LegalPages"), "TermsPage");

// portal
const LoginPage = lazyNamed(() => import("./portal/pages/LoginPage"), "LoginPage");
const AdminLoginPage = lazyNamed(() => import("./portal/pages/AdminLoginPage"), "AdminLoginPage");
const ChangePasswordPage = lazyNamed(() => import("./portal/pages/ChangePasswordPage"), "ChangePasswordPage");
const DashboardShell = lazyNamed(() => import("./portal/pages/DashboardShell"), "DashboardShell");
const DashboardNotFound = lazyNamed(() => import("./portal/pages/DashboardNotFound"), "DashboardNotFound");
const OverviewPage = lazyNamed(() => import("./portal/pages/OverviewPage"), "OverviewPage");
const NoticesModule = lazyNamed(() => import("./portal/modules/NoticesModule"), "NoticesModule");
const BlogModule = lazyNamed(() => import("./portal/modules/BlogModule"), "BlogModule");
const EventsModule = lazyNamed(() => import("./portal/modules/EventsModule"), "EventsModule");
const GalleryModule = lazyNamed(() => import("./portal/modules/GalleryModule"), "GalleryModule");
const DownloadsModule = lazyNamed(() => import("./portal/modules/DownloadsModule"), "DownloadsModule");
const TeachersModule = lazyNamed(() => import("./portal/modules/TeachersModule"), "TeachersModule");
const AttendanceModule = lazyNamed(() => import("./portal/modules/AttendanceModule"), "AttendanceModule");
const ResultsModule = lazyNamed(() => import("./portal/modules/ResultsModule"), "ResultsModule");
const AccountsModule = lazyNamed(() => import("./portal/modules/AccountsModule"), "AccountsModule");
const AdmissionsModule = lazyNamed(() => import("./portal/modules/AdmissionsModule"), "AdmissionsModule");
const StudentsModule = lazyNamed(() => import("./portal/modules/StudentsModule"), "StudentsModule");
const AcademicSetupModule = lazyNamed(() => import("./portal/modules/AcademicSetupModule"), "AcademicSetupModule");
const MarksheetsModule = lazyNamed(() => import("./portal/modules/MarksheetsModule"), "MarksheetsModule");
const TimetableModule = lazyNamed(() => import("./portal/modules/TimetableModule"), "TimetableModule");
const HomeworkModule = lazyNamed(() => import("./portal/modules/HomeworkModule"), "HomeworkModule");
const ExamsModule = lazyNamed(() => import("./portal/modules/ExamsModule"), "ExamsModule");
const MessagesModule = lazyNamed(() => import("./portal/modules/MessagesModule"), "MessagesModule");
const AchievementsModule = lazyNamed(() => import("./portal/modules/AchievementsModule"), "AchievementsModule");

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
      <Route path="gallery" element={<Navigate to="/campus" replace />} />
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
