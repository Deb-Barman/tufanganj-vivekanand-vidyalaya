import { Route, Routes } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./portal/pages/LoginPage";
import { DashboardPage } from "./portal/pages/DashboardPage";
import { RequireAuth } from "./portal/RequireAuth";

function PublicLayout({ children }: { children: React.ReactNode }) {
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
      <Route path="/portal" element={<PublicLayout><LoginPage /></PublicLayout>} />
      <Route
        path="/portal/dashboard"
        element={
          <PublicLayout>
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          </PublicLayout>
        }
      />
    </Routes>
  );
}
