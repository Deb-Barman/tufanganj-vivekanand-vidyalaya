#!/usr/bin/env node
/**
 * Generates the standalone error pages from ONE source of truth:
 *   src/errors/catalog.json        (copy for every status code)
 *   src/styles/error-screen.css    (the design, shared with the React ErrorScreen)
 *
 * Output
 *   public/errors/<code>.html            static, self-contained (CSS inlined) — served by Vercel at /errors/<code>.html
 *   ../backend/templates/errors/<code>.html   Django templates (only if ../backend exists)
 *
 * Run:  npm run build:errors
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(root, "src/errors/catalog.json"), "utf8"));
const css = readFileSync(join(root, "src/styles/error-screen.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\n\s*/g, "\n").trim();

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SPARKS = [
  ["8%", "3px", "9s", "0.2s"], ["19%", "2px", "12s", "2.4s"], ["31%", "4px", "10s", "4.1s"], ["43%", "2px", "13s", "1.1s"],
  ["55%", "3px", "9.5s", "5.6s"], ["66%", "2px", "11s", "3.3s"], ["77%", "4px", "12.5s", "0.8s"], ["88%", "3px", "10.5s", "6.4s"],
];
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const REFRESH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/></svg>';

/** target: "static" (absolute /paths) or "django" ({{ asset_base }} / {{ home_url }} placeholders). */
function page(code, c, target) {
  const dj = target === "django";
  const asset = (p) => (dj ? `{{ asset_base }}${p}` : `/${p}`);
  const home = dj ? "{{ home_url }}" : "/";
  const action = ([kind, label], primary) => {
    const cls = `e-btn ${primary ? "primary" : "ghost"}`;
    if (kind === "retry") return `<button type="button" class="${cls}" data-retry>${esc(label)} ${REFRESH}</button>`;
    if (kind === "back") return `<button type="button" class="${cls}" data-back>${esc(label)}</button>`;
    const href = kind === "portal" ? `${home}portal` : home;
    return `<a class="${cls}" href="${href}">${esc(label)} ${primary ? ARROW : ""}</a>`;
  };
  const sparks = SPARKS.map(([x, s, d, t]) => `<i style="--x:${x};--s:${s};--d:${d};--t:${t}"></i>`).join("");
  const body = `<div class="tvv-err" role="main">
<div class="e-frame">
<header class="e-head">
<a class="e-brand" href="${home}" aria-label="Tufanganj Vivekananda Vidyalaya — home"><img class="e-seal" src="${asset("school_logo.png")}" alt="" width="56" height="56"><span class="e-school">Tufanganj Vivekananda Vidyalaya<small>Higher Secondary · Cooch Behar</small></span></a>
</header>
<main class="e-stage">
<section class="e-copy">
<span class="e-pill"><i></i>Error ${code} · ${esc(c.label)}</span>
<p class="e-code" data-code="${code}" aria-hidden="true">${code}</p>
<span class="e-rule"></span>
<h1 class="e-title">${esc(c.heading)}</h1>
<p class="e-support">${esc(c.support)}</p>
<blockquote class="e-quote"><p>“${esc(c.quote)}”</p><cite>${esc(c.cite)}</cite></blockquote>
<div class="e-actions">${action(c.primary, true)}${action(c.secondary, false)}</div>
</section>
<div class="e-art" aria-hidden="true"><div class="e-frameart"><span class="e-glow"></span><span class="e-ring"></span><span class="e-ring two"></span>
<img class="e-img dark" src="${asset("swami-dark.webp")}" alt="" width="750" height="1000" decoding="async">
<img class="e-img light" src="${asset("swami-light.webp")}" alt="" width="750" height="1000" decoding="async">
<div class="e-sparks">${sparks}</div></div></div>
</main>
<footer class="e-foot"><span class="e-copyr">© <span id="yr">${new Date().getFullYear()}</span> Tufanganj Vivekananda Vidyalaya (H.S.)</span><span>HTTP <b>${code}</b></span></footer>
</div>
</div>`;

  // Theme must be decided BEFORE first paint (no light/dark flash). Shares the SPA's "tvv-theme" key.
  const themeBoot = `(function(){try{var p=localStorage.getItem("tvv-theme");var d=p==="dark"||((p!=="light")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","dark")}})();`;
  const script = `(function(){var r=document.documentElement;var yr=document.getElementById("yr");if(yr)yr.textContent=new Date().getFullYear();var re=document.querySelector("[data-retry]");if(re)re.addEventListener("click",function(){re.disabled=true;re.firstChild.nodeValue="Retrying… ";location.reload()});var bk=document.querySelector("[data-back]");if(bk)bk.addEventListener("click",function(){history.length>1?history.back():location.assign("${home}")})})();`;
  const wrap = (s) => (dj ? `{% verbatim %}${s}{% endverbatim %}` : s);

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${code} · ${esc(c.title)} | Tufanganj Vivekananda Vidyalaya</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#050507">
<meta name="color-scheme" content="dark light">
<link rel="icon" type="image/png" href="${asset("favicon-64.png")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Hanken+Grotesk:wght@500;700&display=swap">
<link rel="preload" as="image" href="${asset("swami-dark.webp")}" media="(prefers-color-scheme: dark)">
<script>${wrap(themeBoot)}</script>
<style>
html,body{height:100%;margin:0;overflow:hidden;background:#050507}
[data-theme="light"] body{background:#fbf3e3}
${wrap(css)}
</style>
</head>
<body>
${body}
<script>${wrap(script)}</script>
</body>
</html>
`;
}

const outStatic = join(root, "public/errors");
mkdirSync(outStatic, { recursive: true });
const backendDir = join(root, "../backend");
const outDjango = join(backendDir, "templates/errors");
const hasBackend = existsSync(backendDir);
if (hasBackend) mkdirSync(outDjango, { recursive: true });

for (const [code, c] of Object.entries(catalog)) {
  writeFileSync(join(outStatic, `${code}.html`), page(code, c, "static"));
  if (hasBackend) writeFileSync(join(outDjango, `${code}.html`), page(code, c, "django"));
}
console.log(`✓ ${Object.keys(catalog).length} error pages → public/errors/${hasBackend ? " and backend/templates/errors/" : ""}`);
