import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { RouteProgress } from "../components/loading/Loading";
import { useNoIndex } from "../lib/usePageMeta";

/**
 * Wrapper for every dashboard (Super Admin, Teacher, Student).
 * Deliberately NO public-site header or footer: the dashboard has its own
 * navigation (sidebar on desktop, drawer + tab bar on phones).
 */
export function DashboardLayout() {
  const { pathname } = useLocation();
  useNoIndex();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return (
    <>
      <RouteProgress />
      <Outlet />
    </>
  );
}
