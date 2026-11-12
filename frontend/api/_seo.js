// Shared SEO helpers. Used by the build step (scripts/seo-prerender.mjs) AND by the Vercel functions in this folder
// (a file whose name starts with "_" is NOT turned into an endpoint by Vercel).
import routes from "../src/seo/routes.json" with { type: "json" };

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
    author: orgRef,
    publisher: orgRef,
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
  ["/gallery", "Gallery"], ["/downloads", "Downloads"], ["/faq", "FAQ"], ["/contact", "Contact"], ["/app", "School app"],
];

/** Plain, crawlable content for visitors (and bots) without JavaScript. Mirrors what the page itself says. */
export function noscriptHtml({ heading, text, path }) {
  const links = NAV_LINKS.filter(([p]) => p !== path).map(([p, l]) => `<li><a href="${p}">${esc(l)}</a></li>`).join("");
  return `<main><h1>${esc(heading)}</h1><p>${esc(text)}</p><p>${esc(SITE.name)} — Tufanganj, Cooch Behar, West Bengal, India.</p><nav aria-label="Main pages"><ul>${links}</ul></nav><p>This website works best with JavaScript turned on.</p></main>`;
}
