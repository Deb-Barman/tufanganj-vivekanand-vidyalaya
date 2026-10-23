import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { PageSkeleton, ProgressBusy, RouteProgress } from "../loading/Loading";
import { MobileAppChrome } from "./MobileTabBar";

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

  // The landing page keeps its header and footer everywhere. Every other page is "app mode" on phones only (see
  // MobileApp.css): header and footer hidden, a Back button and bottom tabs instead. `display: contents` = no layout change.
  const shell = pathname === "/" ? "shell-site" : "shell-app";

  return (
    <div className={shell} style={{ display: "contents" }}>
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
      {shell === "shell-app" && <MobileAppChrome />}
    </div>
  );
}
