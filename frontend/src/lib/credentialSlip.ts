/** Sign-in details to hand over to a student/teacher: a text message (WhatsApp/SMS) and a printable slip. */
export interface SlipData {
  username: string;
  password: string;
  name?: string;
}

const SCHOOL = "Tufanganj Vivekananda Vidyalaya (H.S.)";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function slipText(c: SlipData, origin: string): string {
  return [
    `${SCHOOL} — School Portal`,
    c.name ? `Name: ${c.name}` : "",
    `Username: ${c.username}`,
    `Password: ${c.password}`,
    `Sign in: ${origin}/portal`,
    "Please keep this password private.",
  ].filter(Boolean).join("\n");
}

export const whatsappLink = (c: SlipData, origin: string) => `https://wa.me/?text=${encodeURIComponent(slipText(c, origin))}`;

/** Opens a clean one-card page and the browser's print dialog (on a phone: "Save as PDF" or print). */
export function printSlip(c: SlipData, origin: string): boolean {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign-in details</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;color:#1b1d2e;background:#fff}
  .slip{max-width:420px;margin:0 auto;border:2px dashed #8a90b5;border-radius:16px;padding:22px}
  h1{font-size:15px;margin:0 0 2px;letter-spacing:.02em} h2{font-size:12px;margin:0 0 18px;color:#6b7090;font-weight:600;text-transform:uppercase;letter-spacing:.1em}
  dl{margin:0;display:grid;gap:12px} dt{font-size:11px;font-weight:700;color:#6b7090;text-transform:uppercase;letter-spacing:.08em}
  dd{margin:2px 0 0;font:600 18px ui-monospace,Menlo,Consolas,monospace;word-break:break-all}
  p{font-size:12px;color:#6b7090;margin:16px 0 0;line-height:1.5}
  @media print{body{padding:0}}
</style></head><body><div class="slip">
<h1>${esc(SCHOOL)}</h1><h2>School Portal · sign-in details</h2>
<dl>${c.name ? `<div><dt>Name</dt><dd style="font-family:inherit">${esc(c.name)}</dd></div>` : ""}
<div><dt>Username</dt><dd>${esc(c.username)}</dd></div>
<div><dt>Password</dt><dd>${esc(c.password)}</dd></div>
<div><dt>Sign in at</dt><dd style="font-size:14px">${esc(origin)}/portal</dd></div></dl>
<p>Keep this password private and do not share it with anyone. If you forget it, use “Forgot password?” on the sign-in page or ask the school office.</p>
</div><script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`);
  w.document.close();
  return true;
}
