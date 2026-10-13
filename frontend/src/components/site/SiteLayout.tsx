import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { MobileTabBar } from "./MobileTabBar";
import { PageSkeleton, ProgressBusy, RouteProgress } from "../loading/Loading";

/** Header + footer around every public page. Resets scroll on navigation and honours #anchors. */
export function SiteLayout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) return void el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <RouteProgress />
      <SiteHeader />
      <main id="main">
        <Suspense
          fallback={
            <>
              <ProgressBusy />
              <PageSkeleton />
            </>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
      <MobileTabBar />
    </>
  );
}
