import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { HomePage } from "./pages/HomePage";
import { BlogPage } from "./pages/BlogPage";
import { LoginPage } from "./portal/pages/LoginPage";
import { AdminLoginPage } from "./portal/pages/AdminLoginPage";
import { ChangePasswordPage } from "./portal/pages/ChangePasswordPage";
import { DashboardShell } from "./portal/pages/DashboardShell";
import { OverviewPage } from "./portal/pages/OverviewPage";
import { RequireAuth } from "./portal/RequireAuth";
import { NoticesModule } from "./portal/modules/NoticesModule";
import { BlogModule } from "./portal/modules/BlogModule";
import { EventsModule } from "./portal/modules/EventsModule";
import { GalleryModule } from "./portal/modules/GalleryModule";
import { DownloadsModule } from "./portal/modules/DownloadsModule";
import { TeachersModule } from "./portal/modules/TeachersModule";
import { AttendanceModule } from "./portal/modules/AttendanceModule";
import { ResultsModule } from "./portal/modules/ResultsModule";
import { AccountsModule } from "./portal/modules/AccountsModule";

function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
      <Route path="/blog" element={<PublicLayout><BlogPage /></PublicLayout>} />
      <Route path="/portal" element={<PublicLayout><LoginPage /></PublicLayout>} />
      <Route path="/portal/admin" element={<PublicLayout><AdminLoginPage /></PublicLayout>} />
      <Route
        path="/portal/change-password"
        element={
          <PublicLayout>
            <RequireAuth>
              <ChangePasswordPage />
            </RequireAuth>
          </PublicLayout>
        }
      />
      <Route
        path="/portal/dashboard"
        element={
          <PublicLayout>
            <RequireAuth>
              <DashboardShell />
            </RequireAuth>
          </PublicLayout>
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
        <Route path="accounts" element={<AccountsModule />} />
      </Route>
    </Routes>
  );
}
