// GET /sitemap.xml  (vercel.json rewrites it here)
// Lists every public page of the site PLUS each published notice, blog post and achievement, read live from the school's API,
// so Google finds new notices without anyone editing a file. If the API is asleep, the fixed pages are still listed.
import { API_BASE, ROUTES, SITE_URL, abs, esc, fetchJson } from "./_seo.js";

export const config = { maxDuration: 10 };

/** Reads up to `maxPages` pages of a public DRF list; always returns an array. */
async function readAll(path, maxPages = 5) {
  const out = [];
  let url = `${API_BASE}${path}?page_size=200`;
  for (let i = 0; i < maxPages && url; i++) {
    const { data } = await fetchJson(url, 7000);
    if (!data) break;
    const rows = Array.isArray(data) ? data : data.results ?? [];
    out.push(...rows);
    // DRF returns absolute "next" links; keep the API address we were configured with.
    try {
      url = data.next ? `${API_BASE}${new URL(data.next).pathname}${new URL(data.next).search}` : null;
    } catch {
      url = null;
    }
  }
  return out;
}

const day = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString().slice(0, 10) : null);
const entry = (loc, { lastmod, changefreq, priority } = {}) =>
  `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${changefreq ? `<changefreq>${changefreq}</changefreq>` : ""}${priority ? `<priority>${priority}</priority>` : ""}</url>`;

export default async function handler(_req, res) {
  const [notices, posts, wins] = await Promise.all([
    readAll("/api/notices/public/"),
    readAll("/api/content/articles/public/"),
    readAll("/api/content/achievements/public/"),
  ]);

  const lines = ROUTES.filter((r) => r.sitemap !== false && !String(r.robots || "").startsWith("noindex")).map((r) =>
    entry(abs(r.path), { changefreq: r.changefreq, priority: r.priority }),
  );
  for (const n of notices) if (n?.id) lines.push(entry(`${SITE_URL}/notices/${n.id}`, { lastmod: day(n.updated_at || n.created_at), changefreq: "yearly", priority: "0.6" }));
  for (const p of posts) if (p?.slug) lines.push(entry(`${SITE_URL}/blog/${encodeURIComponent(p.slug)}`, { lastmod: day(p.updated_at || p.created_at), changefreq: "monthly", priority: "0.6" }));
  for (const a of wins) if (a?.id) lines.push(entry(`${SITE_URL}/achievements/${a.id}`, { lastmod: day(a.created_at), changefreq: "yearly", priority: "0.5" }));

  const live = notices.length + posts.length + wins.length > 0;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // A partial answer (API asleep) is cached only briefly so the full list returns as soon as the API wakes.
  res.setHeader("Cache-Control", live ? "public, s-maxage=3600, stale-while-revalidate=86400" : "public, s-maxage=300, stale-while-revalidate=600");
  res.setHeader("X-Robots-Tag", "noindex");
  res.status(200).send(xml);
}
