import type { SkeletonVariant } from "./Skeletons";

/** Which loading shape each dashboard page really has, so the skeleton shown while its code downloads
 *  is the SAME one the page shows while its data loads (no list → grid jump). Keep in sync with the modules. */
const GRID_PAGES = new Set(["gallery"]);
const CARD_PAGES = new Set(["notices", "messages", "accounts", "admissions", "students", "teachers", "achievements", "marksheets", "academics"]);
export function skeletonVariantFor(pathname: string): SkeletonVariant {
  const slug = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  return GRID_PAGES.has(slug) ? "grid" : CARD_PAGES.has(slug) ? "cards" : "list";
}
