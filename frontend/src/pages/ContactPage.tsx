import { useState } from "react";
import type { FormEvent } from "react";
import { PageHero, Section } from "../components/site/PageHero";
import { Spinner } from "../components/loading/Loading";
import { api, ApiError } from "../lib/api";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

const blank = { name: "", email: "", phone: "", subject: "", message: "" };

export function ContactPage() {
  usePageMeta("Contact", `Contact ${SITE.nameFull}: address, office hours and a message form for the school office.`);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.email.trim() && !f.phone.trim()) return setErr("Please give an email address or a phone number so we can reply.");
    setBusy(true);
    try {
      await api.post("/content/contact/submit/", f, { auth: false });
      setSent(true);
      setF(blank);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Could not send your message. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHero crumb="Contact" eyebrow="Visit or write to us" title="Find the school. Ask us anything." lede="Send a message and the school office will reply, or visit us during office hours." />
      <Section>
        <div className="contact-layout">
          <div className="info-stack" data-reveal="left">
            <div className="info-card">
              <span className="f-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21ZM12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5Z" /></svg></span>
              <div><b>Address</b><p>{SITE.nameFull}<br />{SITE.town}</p></div>
            </div>
            <div className="info-card">
              <span className="f-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2" /></svg></span>
              <div><b>Office hours</b><p>{SITE.hours}</p></div>
            </div>
            {SITE.phone && (
              <div className="info-card"><span className="f-icon">☎</span><div><b>Phone</b><a href={`tel:${SITE.phone}`}>{SITE.phone}</a></div></div>
            )}
            {SITE.email && (
              <div className="info-card"><span className="f-icon">✉</span><div><b>Email</b><a href={`mailto:${SITE.email}`}>{SITE.email}</a></div></div>
            )}
            <div className="info-card">
              <span className="f-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M24 12.070C24 5.400 18.630 0 12 0S0 5.400 0 12.070C0 18.100 4.390 23.100 10.130 24v-8.440H7.080v-3.490h3.050V9.410c0-3.020 1.790-4.690 4.530-4.690 1.310 0 2.680.24 2.680.24v2.970h-1.510c-1.490 0-1.960.93-1.960 1.880v2.260h3.330l-.53 3.490h-2.800V24C19.610 23.100 24 18.100 24 12.070" /></svg></span>
              <div><b>Facebook</b><a href={SITE.facebook} target="_blank" rel="noopener noreferrer">facebook.com/TufanganjVivekanandaVidyalaya</a></div>
            </div>
            <div className="map-card">
              <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE.nameFull + ", " + SITE.town)}`}>Open in Google Maps ↗</a>
            </div>
          </div>

          <div className="form-card" data-reveal="right">
            {sent ? (
              <div className="success-box" role="status">
                <span className="ep-icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.500 4.500 4.500L19 7.500" /></svg></span>
                <h2>Message sent</h2>
                <p className="pg-sub" style={{ margin: 0 }}>Thank you. The school office will reply using the details you gave.</p>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setSent(false)}>Send another message</button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h2>Send a message</h2>
                <p className="pg-sub">For admissions, please use the <a href="/admissions" style={{ color: "var(--accent)", fontWeight: 700 }}>admission enquiry</a> form.</p>
                <div className="form-row">
                  <div className="form-field"><label htmlFor="cName">Your name</label><input id="cName" value={f.name} onChange={set("name")} required maxLength={120} autoComplete="name" /></div>
                  <div className="form-field"><label htmlFor="cPhone">Phone (optional)</label><input id="cPhone" value={f.phone} onChange={set("phone")} inputMode="tel" maxLength={20} autoComplete="tel" /></div>
                </div>
                <div className="form-field"><label htmlFor="cEmail">Email (or phone above)</label><input id="cEmail" type="email" value={f.email} onChange={set("email")} maxLength={254} autoComplete="email" /></div>
                <div className="form-field"><label htmlFor="cSubject">Subject</label><input id="cSubject" value={f.subject} onChange={set("subject")} required maxLength={150} /></div>
                <div className="form-field"><label htmlFor="cMsg">Message</label><textarea id="cMsg" rows={6} value={f.message} onChange={set("message")} required maxLength={4000} /></div>
                {err && <p className="alert alert-error" role="alert">{err}</p>}
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <button type="submit" className="btn btn-primary" disabled={busy || !f.name.trim() || !f.subject.trim() || f.message.trim().length < 10}>
                    {busy ? <><Spinner /> Sending…</> : "Send message"}
                  </button>
                  <span className="form-note">Your details are used only to reply to you.</span>
                </div>
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
