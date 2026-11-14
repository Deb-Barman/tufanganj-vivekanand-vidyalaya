/**
 * Browser-side twin of api/_seo.js (which builds the same JSON-LD on the server / at build time).
 * Only used when someone navigates inside the app without a page load, so the structured data in <head> always matches the page.
 * Keep the two in step: same @id values, same types.
 */
import seo from "./routes.json";
import faqs from "./faqs.json";
import keywordData from "./keywords.json";

export interface SeoRoute {
  path: string;
  title: string;
  description: string;
  name: string;
  type: string;
  robots?: string;
  kw?: string[];
}

/** `VITE_SITE_URL` (Vercel env var) switches the whole site to a custom domain without touching the code. */
export const SEO_SITE = { ...seo.site, url: String(import.meta.env.VITE_SITE_URL || seo.site.url).replace(/\/$/, "") };
export const SEO_ROUTES: SeoRoute[] = seo.routes as SeoRoute[];
const BY_PATH = new Map(SEO_ROUTES.map((r) => [r.path, r]));

/** "/about/" → "/about"; "" → "/". */
export const cleanPath = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p) || "/";
/** Comma-separated search phrases for a route (the home page gets the widest set). Mirrors keywordsFor() in api/_seo.js. */
export const keywordsFor = (route?: SeoRoute): string => {
  const out: string[] = [];
  const groups = keywordData.groups as Record<string, string[]>;
  for (const g of route?.kw ?? ["brand"]) for (const k of groups[g] ?? []) if (!out.includes(k)) out.push(k);
  return out.slice(0, route?.path === "/" ? 40 : 14).join(", ");
};

/** Page-specific structured data merged into the page node. Mirrors extraFor() in api/_seo.js. */
export function extraFor(path: string): Record<string, unknown> {
  if (path === "/faq") return { mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  if (path === "/app") {
    return { mainEntity: { "@type": "MobileApplication", name: "TVV School", alternateName: `${seo.site.name} school app`, operatingSystem: "Android", applicationCategory: "EducationalApplication", description: "Timetable, homework, projects, attendance and results for students, teachers and parents of Tufanganj Vivekananda Vidyalaya (H.S.).", publisher: { "@id": `${SEO_SITE.url}/#school` } } };
  }
  return {};
}

export const routeFor = (path: string): SeoRoute | undefined => BY_PATH.get(cleanPath(path));

const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${SEO_SITE.url}${path}`);
const org = { "@id": `${SEO_SITE.url}/#school` };
const website = { "@id": `${SEO_SITE.url}/#website` };

const orgInline = () => ({ "@type": "EducationalOrganization", "@id": `${SEO_SITE.url}/#school`, name: seo.site.name, url: `${SEO_SITE.url}/`, logo: { "@type": "ImageObject", url: abs(seo.site.logo), width: seo.site.logoSize, height: seo.site.logoSize } });

export interface Crumb {
  name: string;
  path: string;
}

function breadcrumb(url: string, crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.path) })),
  };
}

export function pageSchema(opts: { path: string; name: string; description: string; type?: string; crumbs?: Crumb[] }) {
  const url = abs(opts.path);
  const node: Record<string, unknown> = { "@type": opts.type ?? "WebPage", "@id": `${url}#webpage`, url, name: opts.name, description: opts.description, inLanguage: "en-IN", isPartOf: website, about: org, ...extraFor(opts.path) };
  const graph: unknown[] = [node];
  if (opts.crumbs && opts.crumbs.length > 1) {
    node.breadcrumb = { "@id": `${url}#breadcrumb` };
    graph.push(breadcrumb(url, opts.crumbs));
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function articleSchema(opts: { path: string; headline: string; description: string; datePublished?: string; dateModified?: string; type?: "Article" | "BlogPosting"; crumbs?: Crumb[] }) {
  const url = abs(opts.path);
  const node: Record<string, unknown> = {
    "@type": opts.type ?? "Article",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: opts.headline.slice(0, 110),
    description: opts.description,
    url,
    inLanguage: "en-IN",
    image: [abs(SEO_SITE.image)],
    author: orgInline(),
    publisher: orgInline(),
    isPartOf: website,
  };
  if (opts.datePublished) node.datePublished = opts.datePublished;
  if (opts.dateModified || opts.datePublished) node.dateModified = opts.dateModified || opts.datePublished;
  const graph: unknown[] = [node];
  if (opts.crumbs && opts.crumbs.length > 1) graph.push(breadcrumb(url, opts.crumbs));
  return { "@context": "https://schema.org", "@graph": graph };
}
