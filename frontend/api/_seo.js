// Shared SEO helpers. Used by the build step (scripts/seo-prerender.mjs) AND by the Vercel functions in this folder
// (a file whose name starts with "_" is NOT turned into an endpoint by Vercel).
import routes from "../src/seo/routes.json" with { type: "json" };
import keywordData from "../src/seo/keywords.json" with { type: "json" };
import faqs from "../src/seo/faqs.json" with { type: "json" };

export const SITE = routes.site;
export const ROUTES = routes.routes;
export const SITE_URL = (process.env.SITE_URL || SITE.url).replace(/\/$/, "");
/** Django API (Render). VITE_API_URL is the same variable the frontend already uses on Vercel. */
export const API_BASE = (process.env.API_URL || process.env.VITE_API_URL || "https://tufanganj-vivekanand-vidyalaya.onrender.com").replace(/\/$/, "");

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const plain = (s) => String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
export const clip = (s, n = 158) => {
  const t = plain(s);
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), n - 30)).replace(/[\s,;:.–-]+$/, "") + "…";
};
export const abs = (path) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

export async function fetchJson(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) return { status: 404, data: null };
    if (!res.ok) return { status: res.status, data: null };
    return { status: 200, data: await res.json() };
  } catch {
    return { status: 0, data: null };
  } finally {
    clearTimeout(t);
  }
}

/** The school, described once. Referenced by @id from every page's JSON-LD. */
export const orgRef = { "@id": `${SITE_URL}/#school` };
export const websiteRef = { "@id": `${SITE_URL}/#website` };

// ---- keywords -----------------------------------------------------------------------------------------------------
/** Search phrases for a route: its keyword groups, de-duplicated, capped (the home page gets the widest set). */
export function keywordList(groups = [], max = 14) {
  const out = [];
  for (const g of groups) for (const k of keywordData.groups[g] ?? []) if (!out.includes(k)) out.push(k);
  return out.slice(0, max);
}
export const keywordsFor = (route) => keywordList(route?.kw ?? ["brand"], route?.path === "/" ? 40 : 14).join(", ");
export const ALL_KEYWORDS = Object.values(keywordData.groups).flat();

// ---- the school (EducationalOrganization + School) ------------------------------------------------------------
/** Only facts that exist in routes.json → site. Phone, e-mail, street address, postcode and pin are added automatically the day they are filled in. */
export function orgNode() {
  const c = SITE.contact ?? {};
  const address = { "@type": "PostalAddress", addressLocality: SITE.locality, addressRegion: SITE.region, addressCountry: SITE.country };
  if (c.streetAddress) address.streetAddress = c.streetAddress;
  if (c.postalCode) address.postalCode = c.postalCode;
  const node = {
    "@type": ["EducationalOrganization", "School"],
    "@id": orgRef["@id"],
    name: SITE.name,
    alternateName: SITE.alternateNames,
    description: SITE.description,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: abs(SITE.logo), width: SITE.logoSize, height: SITE.logoSize },
    image: abs(SITE.image),
    slogan: SITE.slogan,
    foundingDate: SITE.foundingDate,
    address,
    areaServed: [
      { "@type": "AdministrativeArea", name: `${SITE.locality}, ${SITE.district}, ${SITE.region}, India` },
      { "@type": "AdministrativeArea", name: `${SITE.district}, ${SITE.region}, India` },
    ],
    keywords: keywordList(["brand", "location", "level", "admission"], 26).join(", "),
    sameAs: SITE.sameAs,
  };
  if (c.telephone) node.telephone = c.telephone;
  if (c.email) node.email = c.email;
  if (c.latitude && c.longitude) node.geo = { "@type": "GeoCoordinates", latitude: Number(c.latitude), longitude: Number(c.longitude) };
  if (c.mapsUrl) { node.hasMap = c.mapsUrl; node.sameAs = [...SITE.sameAs, c.mapsUrl]; }
  return node;
}

/** Site-wide structured data: the school and the website. Replaces the placeholder block in index.html at build time. */
export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      orgNode(),
      {
        "@type": "WebSite",
        "@id": websiteRef["@id"],
        url: `${SITE_URL}/`,
        name: SITE.name,
        alternateName: ["Tufanganj Vivekanand Vidyalaya", "Tufanganj Vivekananda Vidyalaya", "TVV School", "তুফানগঞ্জ বিবেকানন্দ বিদ্যালয়"],
        description: SITE.description,
        inLanguage: "en-IN",
        publisher: orgRef,
      },
    ],
  };
}

/** Compact copy of the school for Article / BlogPosting author + publisher (Google wants a name and a logo inline, not only an @id). */
const orgInline = () => ({ "@type": "EducationalOrganization", "@id": orgRef["@id"], name: SITE.name, url: `${SITE_URL}/`, logo: { "@type": "ImageObject", url: abs(SITE.logo), width: SITE.logoSize, height: SITE.logoSize } });

/** Extra, page-specific structured data merged into a page node (FAQ questions, the school app). */
export function extraFor(path) {
  if (path === "/faq") {
    return { mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  }
  if (path === "/app") {
    return { mainEntity: { "@type": "MobileApplication", name: "TVV School", alternateName: `${SITE.name} school app`, operatingSystem: "Android", applicationCategory: "EducationalApplication", description: "Timetable, homework, projects, attendance and results for students, teachers and parents of Tufanganj Vivekananda Vidyalaya (H.S.).", publisher: orgRef } };
  }
  return {};
}

export function breadcrumbLd(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

/** WebPage-family node + breadcrumb for one URL. `extra` is merged into the page node. */
export function pageGraph({ path, name, description, type = "WebPage", crumbs, extra = {} }) {
  const url = abs(path);
  const node = { "@type": type, "@id": `${url}#webpage`, url, name, description, inLanguage: "en-IN", isPartOf: websiteRef, about: orgRef, ...extra };
  const graph = [node];
  if (crumbs?.length > 1) {
    const bc = breadcrumbLd(crumbs);
    bc["@id"] = `${url}#breadcrumb`;
    node.breadcrumb = { "@id": bc["@id"] };
    graph.push(bc);
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function articleGraph({ path, headline, description, datePublished, dateModified, type = "Article", crumbs }) {
  const url = abs(path);
  const article = {
    "@type": type,
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: clip(headline, 110),
    description,
    url,
    inLanguage: "en-IN",
    image: [abs(SITE.image)],
    author: orgInline(),
    publisher: orgInline(),
    isPartOf: websiteRef,
  };
  if (datePublished) article.datePublished = datePublished;
  if (dateModified || datePublished) article.dateModified = dateModified || datePublished;
  const graph = [article];
  if (crumbs?.length > 1) graph.push({ "@id": `${url}#breadcrumb`, ...breadcrumbLd(crumbs) });
  return { "@context": "https://schema.org", "@graph": graph };
}

const must = (html, re, label) => {
  if (!re.test(html)) throw new Error(`SEO template: could not find ${label} in index.html — update api/_seo.js or index.html`);
};
const swap = (html, re, to, label) => {
  must(html, re, label);
  return html.replace(re, () => to);
};

/**
 * Rewrites the <head> of the built index.html for ONE url. Throws if a tag it expects is missing
 * so a broken template can never silently ship the home page's tags on every URL.
 */
export function applyHead(html, m) {
  const title = esc(m.title);
  const desc = esc(m.description);
  const robots = m.robots || "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  let out = html;
  out = swap(out, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, "<title>");
  out = swap(out, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${desc}" />`, "meta description");
  out = swap(out, /<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="${esc(robots)}" />`, "meta robots");
  // Keywords: Google ignores this tag, but other engines read it. Added when the page has some, replaced when present, removed when not.
  const kwRe = /\s*<meta name="keywords" content="[^"]*"\s*\/?>/;
  out = out.replace(kwRe, "");
  if (m.keywords) out = out.replace(/(<meta name="description" content="[^"]*"\s*\/?>)/, (tag) => `${tag}\n    <meta name="keywords" content="${esc(m.keywords)}" />`);
  // One language, one URL per page: hreflang is not needed, and a copy that points every page at the home page is wrong.
  out = out.replace(/\s*<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*\/?>/g, "");
  // The canonical tag may be absent (the shell and 404 templates have none): remove it, replace it, or add it.
  const canonRe = /\s*<link rel="canonical" href="[^"]*"\s*\/?>/;
  if (m.canonical === null) out = out.replace(canonRe, "");
  else if (canonRe.test(out)) out = out.replace(canonRe, () => `\n    <link rel="canonical" href="${esc(m.canonical)}" />`);
  else {
    must(out, /<meta name="robots" content="[^"]*"\s*\/?>/, "meta robots (anchor for canonical)");
    out = out.replace(/<meta name="robots" content="[^"]*"\s*\/?>/, (tag) => `${tag}\n    <link rel="canonical" href="${esc(m.canonical)}" />`);
  }
  out = swap(out, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${title}" />`, "og:title");
  out = swap(out, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${desc}" />`, "og:description");
  out = swap(out, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${esc(m.canonical ?? SITE_URL + "/")}" />`, "og:url");
  out = swap(out, /<meta property="og:type" content="[^"]*"\s*\/?>/, `<meta property="og:type" content="${m.ogType || "website"}" />`, "og:type");
  out = swap(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${title}" />`, "twitter:title");
  out = swap(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${desc}" />`, "twitter:description");
  out = out.replace(/\s*<script type="application\/ld\+json" id="ld-page">[\s\S]*?<\/script>/, "");
  if (m.jsonLd) {
    const json = JSON.stringify(m.jsonLd).replace(/</g, "\\u003c");
    out = swap(out, /<\/head>/, `    <script type="application/ld+json" id="ld-page">${json}</script>\n  </head>`, "</head>");
  }
  out = out.replace(/\s*<noscript id="seo-content">[\s\S]*?<\/noscript>/, "");
  if (m.noscript) out = swap(out, /<div id="root"><\/div>/, `<div id="root"></div>\n    <noscript id="seo-content">${m.noscript}</noscript>`, "#root");
  return out;
}

const NAV_LINKS = [
  ["/", "Home"], ["/about", "About the school"], ["/admissions", "Admissions"], ["/academics", "Academics"], ["/notices", "Notices"],
  ["/achievements", "Results & achievements"], ["/faculty", "Teachers & staff"], ["/campus", "Campus"], ["/events", "Events"],
  ["/gallery", "Gallery"], ["/downloads", "Downloads"], ["/faq", "FAQ"], ["/school-in-tufanganj", "Choosing a school in Tufanganj"],
  ["/contact", "Contact"], ["/app", "School app"],
];

/**
 * Plain, crawlable content for visitors (and bots) without JavaScript. Mirrors what the page itself says.
 * `paragraphs` may be one string or a list; `text` is the older single-string form.
 */
export function noscriptHtml({ heading, text, paragraphs, path }) {
  const paras = (paragraphs ?? (text ? [text] : [])).map((p) => `<p>${esc(p)}</p>`).join("");
  const links = NAV_LINKS.filter(([p]) => p !== path).map(([p, l]) => `<li><a href="${p}">${esc(l)}</a></li>`).join("");
  return `<main><h1>${esc(heading)}</h1>${paras}<p>${esc(SITE.name)} — Tufanganj, Cooch Behar, West Bengal, India. Also written Tufanganj Vivekanand Vidyalaya.</p><nav aria-label="Main pages"><ul>${links}</ul></nav><p>This website works best with JavaScript turned on.</p></main>`;
}
