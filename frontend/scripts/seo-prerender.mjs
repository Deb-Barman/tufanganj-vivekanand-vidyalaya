#!/usr/bin/env node
/**
 * Runs after `vite build`. Turns the single-page app's index.html into a real, crawlable site:
 *
 *   dist/<route>/index.html   one file per public page, each with its OWN <title>, description, canonical URL,
 *                             Open Graph / Twitter tags, JSON-LD (WebPage + BreadcrumbList) and a <noscript> summary
 *   dist/404.html             real HTTP 404 for unknown URLs (noindex)
 *   dist/shell.html           clean app shell (noindex) used by the /api/page function and by the portal / profile URLs
 *
 * Source of truth for titles, descriptions and the sitemap list: src/seo/routes.json.
 * Optional Vercel environment variables:
 *   GOOGLE_SITE_VERIFICATION   content of Google Search Console's HTML-tag verification
 *   BING_SITE_VERIFICATION     content of Bing Webmaster Tools' verification tag
 *   VITE_API_URL               Django API address → the browser connects to it early (preconnect)
 *   SITE_URL / VITE_SITE_URL   the website's own address once it has a custom domain (set BOTH to the same value, no trailing slash)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API_BASE, ROUTES, SITE, SITE_URL, abs, applyHead, noscriptHtml, pageGraph } from "../api/_seo.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Plain-text summary per page for the <noscript> block (build-time only: kept out of the browser bundle). */
const summaries = JSON.parse(readFileSync(join(root, "src/seo/summaries.json"), "utf8"));
const dist = join(root, "dist");
const indexPath = join(dist, "index.html");
if (!existsSync(indexPath)) {
  console.error("seo-prerender: dist/index.html not found — run `vite build` first.");
  process.exit(1);
}
let template = readFileSync(indexPath, "utf8");

// ---- once-per-site extras -------------------------------------------------------------------------------------
const extras = [];
const g = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const b = process.env.BING_SITE_VERIFICATION?.trim();
if (g) extras.push(`<meta name="google-site-verification" content="${g.replace(/"/g, "")}" />`);
if (b) extras.push(`<meta name="msvalidate.01" content="${b.replace(/"/g, "")}" />`);
if (process.env.VITE_API_URL) {
  try {
    const origin = new URL(process.env.VITE_API_URL).origin;
    extras.push(`<link rel="preconnect" href="${origin}" crossorigin />`, `<link rel="dns-prefetch" href="${origin}" />`);
  } catch { /* not a URL: skip */ }
}
if (!template.includes("<!--SEO_HEAD_EXTRAS-->")) throw new Error("seo-prerender: <!--SEO_HEAD_EXTRAS--> marker missing in index.html");
template = template.replace("<!--SEO_HEAD_EXTRAS-->", extras.join("\n    "));

const written = [];
const write = (rel, html) => {
  const file = join(dist, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  written.push(file);
};

// ---- one HTML file per public route ---------------------------------------------------------------------------
let count = 0;
for (const r of ROUTES) {
  const crumbs = r.path === "/" ? [{ name: "Home", path: "/" }] : [{ name: "Home", path: "/" }, { name: r.name, path: r.path }];
  const robots = r.robots || undefined;
  const html = applyHead(template, {
    title: r.title,
    description: r.description,
    canonical: robots?.startsWith("noindex") ? null : abs(r.path),
    robots,
    jsonLd: pageGraph({ path: r.path, name: r.title, description: r.description, type: r.type, crumbs }),
    noscript: noscriptHtml({ heading: r.title.split(/\s[–|]\s/)[0], text: summaries[r.path] ?? r.description, path: r.path }),
  });
  write(r.path === "/" ? "index.html" : `${r.path.slice(1)}/index.html`, html);
  count++;
}

// ---- 404 + shell ----------------------------------------------------------------------------------------------
const noindex = "noindex,nofollow";
write("404.html", applyHead(template, {
  title: `Page not found | ${SITE.name}`,
  description: `This page does not exist. Go to the home page of ${SITE.name}.`,
  canonical: null,
  robots: noindex,
  noscript: noscriptHtml({ heading: "Page not found", text: "The page you are looking for does not exist or has moved.", path: "" }),
}));
write("shell.html", applyHead(template, {
  title: SITE.name,
  description: `${SITE.name}, Tufanganj, Cooch Behar, West Bengal.`,
  canonical: null,
  robots: noindex,
}));

// ---- custom domain: SITE_URL (Vercel env var) replaces the default address in every generated file ------------------
const DEFAULT_URL = "https://tufanganj-vivekanand-vidyalaya.vercel.app";
if (SITE_URL !== DEFAULT_URL) {
  for (const file of [...written, join(dist, "robots.txt")]) {
    if (existsSync(file)) writeFileSync(file, readFileSync(file, "utf8").split(DEFAULT_URL).join(SITE_URL));
  }
  console.log(`seo-prerender: site address switched to ${SITE_URL}`);
}

console.log(`seo-prerender: ${count} pages + 404.html + shell.html written to dist/ (site ${SITE_URL}, api ${API_BASE})`);
