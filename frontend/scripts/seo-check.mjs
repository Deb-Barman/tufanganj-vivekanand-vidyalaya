#!/usr/bin/env node
/**
 * SEO self-check for the BUILT site (run `npm run build` first, then `npm run seo:check`).
 * Fails (exit 1) on anything that would hurt indexing: missing/duplicate titles or descriptions, wrong canonicals, invalid JSON-LD,
 * private pages that are indexable, a broken vercel.json, a robots.txt without a sitemap line, broken internal links in the static HTML.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_KEYWORDS, ROUTES, SITE, SITE_URL, applyHead } from "../api/_seo.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
let errors = 0;
let warns = 0;
const fail = (m) => { errors++; console.error("  ✗ " + m); };
const warn = (m) => { warns++; console.warn("  ! " + m); };
const ok = (m) => console.log("  ✓ " + m);
const read = (f) => readFileSync(join(dist, f), "utf8");
const tag = (html, re) => html.match(re)?.[1];

console.log("Pages");
const titles = new Map();
const descs = new Map();
for (const r of ROUTES) {
  const file = r.path === "/" ? "index.html" : `${r.path.slice(1)}/index.html`;
  if (!existsSync(join(dist, file))) { fail(`${r.path}: ${file} missing`); continue; }
  const html = read(file);
  const title = tag(html, /<title>([\s\S]*?)<\/title>/);
  const desc = tag(html, /<meta name="description" content="([^"]*)"/);
  const canon = tag(html, /<link rel="canonical" href="([^"]*)"/);
  const robots = tag(html, /<meta name="robots" content="([^"]*)"/);
  const hidden = String(r.robots || "").startsWith("noindex");
  if (!title || title.length < 20) fail(`${r.path}: title missing/short`);
  else if (title.length > 95) warn(`${r.path}: title is ${title.length} chars (Google shows about 60, but reads all of it)`);
  if (!desc || desc.length < 70) fail(`${r.path}: description missing/short`);
  else if (desc.length > 180) warn(`${r.path}: description is ${desc.length} chars`);
  if (titles.has(title)) fail(`${r.path}: same title as ${titles.get(title)}`); else titles.set(title, r.path);
  if (descs.has(desc)) fail(`${r.path}: same description as ${descs.get(desc)}`); else descs.set(desc, r.path);
  if (hidden) {
    if (canon) fail(`${r.path}: noindex page must not have a canonical`);
    if (!/noindex/.test(robots || "")) fail(`${r.path}: robots meta is "${robots}", expected noindex`);
  } else {
    if (canon !== `${SITE_URL}${r.path === "/" ? "/" : r.path}`) fail(`${r.path}: canonical is ${canon}`);
    if (!/^index,follow/.test(robots || "")) fail(`${r.path}: robots meta is "${robots}"`);
    if (tag(html, /<meta property="og:url" content="([^"]*)"/) !== canon) fail(`${r.path}: og:url differs from canonical`);
  }
  const lds = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  if (lds.length < (hidden ? 1 : 2)) fail(`${r.path}: expected site + page JSON-LD, found ${lds.length}`);
  for (const m of lds) { try { JSON.parse(m[1]); } catch (e) { fail(`${r.path}: invalid JSON-LD (${e.message})`); } }
  if (!/<noscript id="seo-content"><main><h1>/.test(html)) fail(`${r.path}: <noscript> content with an H1 is missing`);
  if (!/<meta property="og:image" content="https:\/\/[^"]+og-image\.jpg"/.test(html)) fail(`${r.path}: og:image missing`);
  if (!/twitter:card" content="summary_large_image"/.test(html)) fail(`${r.path}: twitter:card missing`);
  if (/hreflang=/.test(html)) fail(`${r.path}: hreflang present (single-language site; a copy pointing at "/" is wrong)`);
  if (!hidden && !/<meta name="keywords" content="[^"]{10,}"/.test(html)) fail(`${r.path}: keywords meta missing`);
  if (!hidden && !/<h1>[^<]{5,}<\/h1>/.test(html)) fail(`${r.path}: <noscript> H1 missing`);
  if (!hidden && /id="tvv-loader"/.test(html) === false) fail(`${r.path}: intro markup missing (template changed?)`);
  if (r.path === "/") {
    for (const must of ["Tufanganj Vivekananda Vidyalaya", "Tufanganj Vivekanand Vidyalaya"]) if (!title.includes(must) && !desc.includes(must)) fail(`/: "${must}" is in neither the title nor the description`);
    if (!title.includes("Vivekanand Vidyalaya")) fail("/: title lacks the Vivekanand spelling");
  }
  if (r.path === "/faq" && !html.includes('"@type":"Question"')) fail("/faq: FAQ structured data missing");
  if (r.path === "/app" && !html.includes("MobileApplication")) fail("/app: app structured data missing");
  // internal links in the static HTML must point at real pages
  for (const m of html.matchAll(/<noscript id="seo-content">[\s\S]*?<\/noscript>/g))
    for (const l of m[0].matchAll(/href="(\/[^"#?]*)"/g)) {
      const p = l[1];
      if (p !== "/" && !ROUTES.some((x) => x.path === p) && !existsSync(join(dist, p))) fail(`${r.path}: broken internal link ${p}`);
    }
}
ok(`${ROUTES.length} pages checked, ${titles.size} unique titles`);

console.log("Special pages");
for (const f of ["404.html", "shell.html"]) {
  const html = read(f);
  if (!/<meta name="robots" content="noindex,nofollow"/.test(html)) fail(`${f}: must be noindex`);
  if (/<link rel="canonical"/.test(html)) fail(`${f}: must not have a canonical`);
}
ok("404.html and shell.html are noindex");

console.log("Server-side templates (used by api/page.js)");
{
  const shell = read("shell.html");
  const out = applyHead(shell, { title: "T", description: "D", canonical: `${SITE_URL}/notices/x`, ogType: "article", jsonLd: { "@context": "https://schema.org", "@graph": [] }, noscript: "<main><h1>T</h1></main>" });
  const n = (re) => (out.match(re) || []).length;
  if (n(/<meta name="robots"/g) !== 1 || !/content="index,follow/.test(out)) fail("applyHead: robots meta lost or still noindex");
  if (n(/rel="canonical"/g) !== 1) fail("applyHead: canonical missing or duplicated");
  if (n(/id="ld-page"/g) !== 1 || n(/id="seo-content"/g) !== 1) fail("applyHead: JSON-LD / noscript not inserted exactly once");
  if (/\$1/.test(out)) fail("applyHead: stray replacement token in output");
  ok("applyHead gives a shell exactly one robots, canonical, JSON-LD and noscript block");
}

console.log("robots.txt / vercel.json");
const robots = read("robots.txt");
if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) fail("robots.txt has no Sitemap line");
if (/^Disallow:\s*\/\s*$/m.test(robots)) fail("robots.txt blocks the whole site");
if (/Disallow:\s*\/assets/.test(robots)) fail("robots.txt blocks /assets (Google needs CSS/JS)");
for (const p of ["/portal"]) if (!robots.includes(`Disallow: ${p}`)) fail(`robots.txt should disallow ${p}`);
ok("robots.txt allows the site, blocks only private areas, lists the sitemap");
let v;
try { v = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")); } catch (e) { fail("vercel.json is not valid JSON: " + e.message); }
if (v) {
  if (v.rewrites?.some((r) => r.source === "/(.*)")) fail("vercel.json still rewrites EVERY url to the app (soft-404s)");
  if (!v.rewrites?.some((r) => r.source === "/sitemap.xml")) fail("vercel.json has no /sitemap.xml rewrite");
  if (v.trailingSlash !== false) fail('vercel.json should set "trailingSlash": false (one URL per page)');
  for (const r of v.redirects ?? []) if (r.permanent !== true) warn(`redirect ${r.source} is not permanent`);
  ok(`vercel.json: ${v.rewrites.length} rewrites, ${v.redirects.length} permanent redirects, ${v.headers.length} header rules`);
}
for (const f of ["api/sitemap.js", "api/page.js"]) if (!existsSync(join(root, f))) fail(f + " missing");
if (existsSync(join(dist, "sitemap.xml"))) fail("a static sitemap.xml in dist would hide the live /api/sitemap one");

console.log("Site-wide");
{
  const home = read("index.html");
  const m = home.match(/<script type="application\/ld\+json" id="ld-site">([\s\S]*?)<\/script>/);
  let g; try { g = JSON.parse(m[1])["@graph"]; } catch { fail("ld-site JSON-LD missing or invalid"); }
  if (g) {
    const school = g.find((n) => [].concat(n["@type"]).includes("School"));
    const web = g.find((n) => n["@type"] === "WebSite");
    if (!school || !web) fail("ld-site must hold a School and a WebSite");
    else {
      for (const k of ["name", "alternateName", "description", "url", "logo", "foundingDate", "address", "areaServed", "sameAs", "keywords"]) if (!school[k]) fail(`School JSON-LD lacks ${k}`);
      if (!school.alternateName.some((n) => /[\u0980-\u09FF]/.test(n))) fail("School JSON-LD has no Bengali name");
      if (!school.alternateName.includes("Tufanganj Vivekanand Vidyalaya")) fail("School JSON-LD lacks the Vivekanand spelling");
      // invented-fact guard: these may only appear when filled in routes.json → site.contact
      for (const [k, v] of [["telephone", SITE.contact?.telephone], ["email", SITE.contact?.email], ["geo", SITE.contact?.latitude]]) if (!v && school[k]) fail(`School JSON-LD has ${k} but routes.json does not`);
      ok(`School + WebSite JSON-LD valid, ${school.alternateName.length} alternate names (incl. Bengali), no invented contact facts`);
    }
  }
  if (ALL_KEYWORDS.length < 40) fail(`only ${ALL_KEYWORDS.length} keywords defined (target 40+)`); else ok(`${ALL_KEYWORDS.length} search phrases defined`);
  for (const f of ["favicon.ico", "favicon-48.png", "favicon-96.png", "icon-192.png", "llms.txt", "og-image.jpg", "manifest.webmanifest"]) if (!existsSync(join(dist, f))) fail(`dist/${f} missing`);
  if (existsSync(join(dist, "README_LOGO.txt"))) fail("README_LOGO.txt is being published");
  if (existsSync(join(root, "public/sitemap.xml"))) fail("public/sitemap.xml exists in the source: delete it (it hides the live sitemap)");
  const mf = JSON.parse(read("manifest.webmanifest"));
  if (!mf.lang || !mf.icons?.length) fail("manifest lacks lang or icons"); else ok("manifest, favicons and llms.txt present");
  const fq = JSON.parse(readFileSync(join(root, "src/seo/faqs.json"), "utf8"));
  const bad = fq.filter((x) => !x.q || !x.a || x.a.length < 20);
  if (bad.length) fail("FAQ entries without a question or answer"); else ok(`${fq.length} FAQ entries`);
  const jsonLdText = ROUTES.map((r) => read(r.path === "/" ? "index.html" : `${r.path.slice(1)}/index.html`)).join("");
  if (/"(telephone|email|streetAddress|postalCode)"/.test(jsonLdText) && !SITE.contact?.telephone && !SITE.contact?.email && !SITE.contact?.streetAddress) fail("contact details appear in JSON-LD without being configured");
}

console.log(errors ? `\n${errors} error(s), ${warns} warning(s)` : `\nAll SEO checks passed${warns ? ` (${warns} warning(s))` : ""}.`);
process.exit(errors ? 1 : 0);
