// Server-side <head> for pages whose content lives in the database: /notices/:id, /blog/:slug, /achievements/:id.
// vercel.json rewrites those URLs here. The function looks the item up, then returns the normal app shell with the right
// <title>, description, canonical URL, Open Graph tags, Article JSON-LD and a plain-text copy of the content — so Google,
// WhatsApp and Facebook see the real notice immediately instead of a generic page. Missing items return a real HTTP 404.
import { API_BASE, SITE, SITE_URL, abs, applyHead, articleGraph, clip, esc, fetchJson, pageGraph, plain } from "./_seo.js";

export const config = { maxDuration: 10 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[\p{L}\p{N}_-]{1,200}$/u;

async function getText(url, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** The clean app shell. Falls back to the home page's HTML (with its page-specific tags removed). */
async function loadShell(origin) {
  const shell = await getText(`${origin}/shell.html`);
  if (shell) return shell;
  const home = await getText(`${origin}/`);
  return home ? home.replace(/\s*<script type="application\/ld\+json" id="ld-page">[\s\S]*?<\/script>/, "").replace(/\s*<noscript id="seo-content">[\s\S]*?<\/noscript>/, "") : null;
}

const paragraphs = (text, max = 6000) =>
  String(text ?? "").slice(0, max).split(/\n{1,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");
const article = (title, body, backHref, backLabel) =>
  `<main><article><h1>${esc(title)}</h1>${paragraphs(body)}</article><p><a href="${backHref}">${esc(backLabel)}</a> · <a href="/">${esc(SITE.name)}</a></p></main>`;

function build(kind, id, data) {
  if (kind === "notice") {
    const path = `/notices/${id}`;
    const title = plain(data.title);
    const description = clip(data.body) || `School notice from ${SITE.name}.`;
    const crumbs = [{ name: "Home", path: "/" }, { name: "Notices", path: "/notices" }, { name: title, path }];
    return { title: `${clip(title, 70)} | School Notice – ${SITE.name}`, description, canonical: abs(path), ogType: "article",
      jsonLd: articleGraph({ path, headline: title, description, datePublished: data.created_at, dateModified: data.updated_at, crumbs }),
      noscript: article(title, data.body, "/notices", "All school notices") };
  }
  if (kind === "blog") {
    const path = `/blog/${encodeURIComponent(id)}`;
    const title = plain(data.title);
    const description = clip(data.excerpt || data.body) || `An article from ${SITE.name}.`;
    const crumbs = [{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name: title, path }];
    return { title: `${clip(title, 70)} | School Blog – ${SITE.name}`, description, canonical: abs(path), ogType: "article",
      jsonLd: articleGraph({ path, headline: title, description, datePublished: data.created_at, dateModified: data.updated_at, type: "BlogPosting", crumbs }),
      noscript: article(title, data.body, "/blog", "All articles") };
  }
  const path = `/achievements/${id}`;
  const title = plain(data.title);
  const description = clip(data.description) || `An achievement of ${SITE.name}.`;
  const crumbs = [{ name: "Home", path: "/" }, { name: "Achievements", path: "/achievements" }, { name: title, path }];
  return { title: `${clip(title, 70)} | Achievement – ${SITE.name}`, description, canonical: abs(path),
    jsonLd: pageGraph({ path, name: title, description, crumbs }),
    noscript: article(title, data.description, "/achievements", "All achievements") };
}

export default async function handler(req, res) {
  const kind = String(req.query.t || "");
  const id = decodeURIComponent(String(req.query.id || ""));
  const host = req.headers["x-forwarded-host"] || req.headers.host || new URL(SITE_URL).host;
  const origin = `${req.headers["x-forwarded-proto"] || "https"}://${host}`;

  const shell = await loadShell(origin);
  if (!shell) {
    res.setHeader("Retry-After", "60");
    return res.status(503).send("Temporarily unavailable. Please try again in a minute.");
  }

  const endpoint = { notice: `/api/notices/public/${id}/`, blog: `/api/content/articles/public/${encodeURIComponent(id)}/`, achievement: `/api/content/achievements/public/${id}/` }[kind];
  const valid = kind === "blog" ? SLUG.test(id) : UUID.test(id);
  const label = { notice: "Notice", blog: "Article", achievement: "Achievement" }[kind] || "Page";
  const section = { notice: "/notices", blog: "/blog", achievement: "/achievements" }[kind] || "/";

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // Unknown kind / malformed id / item deleted → a real 404 (so Google drops the URL).
  const notFound = () => {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(404).send(applyHead(shell, { title: `${label} not found | ${SITE.name}`, description: `This ${label.toLowerCase()} does not exist or was removed. See all pages of ${SITE.name}.`, canonical: null, robots: "noindex,nofollow" }));
  };
  if (!endpoint || !valid) return notFound();

  const { status, data } = await fetchJson(`${API_BASE}${endpoint}`, 8000);
  if (status === 404) return notFound();

  if (status === 200 && data) {
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return res.status(200).send(applyHead(shell, build(kind, id, data)));
  }

  // API asleep / error: serve the app with generic tags (the browser app then loads and sets the real ones itself).
  res.setHeader("Cache-Control", "public, s-maxage=20, stale-while-revalidate=60");
  const path = kind === "blog" ? `/blog/${encodeURIComponent(id)}` : `${section}/${id}`;
  res.status(200).send(applyHead(shell, { title: `${label} | ${SITE.name}`, description: `${label} from ${SITE.name}, Tufanganj, Cooch Behar.`, canonical: abs(path) }));
}
