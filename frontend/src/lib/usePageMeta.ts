import { useEffect } from "react";
import { SITE } from "../config/site";
import { SEO_SITE, cleanPath, pageSchema, routeFor } from "../seo/schema";
import type { Crumb } from "../seo/schema";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) return link?.remove();
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

function setJsonLd(data: unknown | null) {
  let el = document.head.querySelector<HTMLScriptElement>("script#ld-page");
  if (data === null) return el?.remove();
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "ld-page";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
}

const INDEX = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
const NOINDEX = "noindex,nofollow";

export interface PageMetaOptions {
  /** Ask search engines not to list this page. */
  noindex?: boolean;
  /** Replaces the automatic WebPage + BreadcrumbList structured data (e.g. an Article). */
  jsonLd?: unknown;
  ogType?: "website" | "article";
  /** Breadcrumb trail for the automatic structured data (dynamic pages). */
  crumbs?: Crumb[];
}

/**
 * Per-page <title>, description, canonical URL, robots, Open Graph / Twitter tags and JSON-LD.
 * For the fixed public pages the wording comes from src/seo/routes.json — the same file the build step uses for the static
 * HTML and the sitemap — so what a visitor sees in the tab, what Google reads from the HTML and what the sitemap lists never disagree.
 * Pages whose content comes from the database (notice, article…) pass their own title and description.
 */
export function usePageMeta(title: string, description: string, path?: string, opts: PageMetaOptions = {}) {
  const { noindex, jsonLd, ogType, crumbs } = opts;
  const jsonKey = jsonLd ? JSON.stringify(jsonLd) : "";
  const crumbKey = crumbs ? JSON.stringify(crumbs) : "";
  useEffect(() => {
    const pathname = cleanPath(path ?? window.location.pathname);
    const route = routeFor(pathname);
    const full = route ? route.title : title ? `${title} | ${SITE.nameFull}` : `${SITE.nameFull} — Tufanganj, Cooch Behar`;
    const desc = route ? route.description : description;
    const hidden = noindex || route?.robots?.startsWith("noindex");
    const url = `${SEO_SITE.url}${pathname === "/" ? "/" : pathname}`;
    document.title = full;
    setMeta("name", "description", desc);
    setMeta("name", "robots", hidden ? (route?.robots ?? NOINDEX) : INDEX);
    setMeta("property", "og:title", full);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", ogType ?? "website");
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", `${SEO_SITE.url}${SEO_SITE.image}`);
    setMeta("name", "twitter:title", full);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", `${SEO_SITE.url}${SEO_SITE.image}`);
    setCanonical(hidden ? null : url);
    if (hidden) setJsonLd(null);
    else if (jsonKey) setJsonLd(JSON.parse(jsonKey));
    else {
      const trail: Crumb[] = crumbKey ? JSON.parse(crumbKey) : pathname === "/" ? [] : [{ name: "Home", path: "/" }, { name: route?.name ?? title, path: pathname }];
      setJsonLd(pageSchema({ path: pathname, name: full, description: desc, type: route?.type, crumbs: trail }));
    }
  }, [title, description, path, noindex, jsonKey, ogType, crumbKey]);
}

/** For private screens (login, dashboards, error pages): keeps them out of search results. */
export function useNoIndex() {
  useEffect(() => {
    setMeta("name", "robots", NOINDEX);
    setCanonical(null);
    setJsonLd(null);
  }, []);
}
