import { Link } from "react-router-dom";
import { PageHero, Section } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

const UPDATED = "October 2026";

export function PrivacyPage() {
  usePageMeta("Privacy", `How ${SITE.nameFull} handles personal information on this website.`);
  return (
    <>
      <PageHero crumb="Privacy" eyebrow={`Last updated ${UPDATED}`} title="Privacy" lede="What this website collects, and what it does with it." />
      <Section>
        <div className="prose">
          <h2 style={{ marginTop: 0 }}>What we collect</h2>
          <ul>
            <li><strong>Admission enquiries and contact messages</strong> — the details you type into the forms (name, phone or email, message). They are read only by the school office, to reply to you.</li>
            <li><strong>Student and staff accounts</strong> — created by the school office. Passwords are stored in a hashed form; nobody, including the office, can read them.</li>
            <li><strong>School records</strong> — attendance, marks and marksheets are visible only to the student, their teachers and the school office.</li>
            <li><strong>Your browser</strong> — your light/dark theme choice and your sign-in session are kept in your own browser. We do not use advertising trackers.</li>
          </ul>
          <h2>What we do not do</h2>
          <p>We do not sell your data and do not show advertisements. Forms are limited to a few submissions per hour to prevent spam, which means a technical record of your network address is kept for admission and contact forms.</p>
          <h2>Your choices</h2>
          <p>To correct or delete something you sent us, <Link to="/contact" style={{ color: "var(--accent)" }}>write to the school office</Link>.</p>
        </div>
      </Section>
    </>
  );
}

export function TermsPage() {
  usePageMeta("Terms of use", `Terms for using the ${SITE.nameFull} website and student portal.`);
  return (
    <>
      <PageHero crumb="Terms" eyebrow={`Last updated ${UPDATED}`} title="Terms of use" lede="Simple rules for using this website and the student portal." />
      <Section>
        <div className="prose">
          <h2 style={{ marginTop: 0 }}>Using the website</h2>
          <p>The public pages are for information about {SITE.name}. Please do not misuse the forms or attempt to disrupt the site.</p>
          <h2>Accounts</h2>
          <ul>
            <li>Accounts are issued by the school office. Your password is set by the school office. Keep it private, and ask the office if you forget it.</li>
            <li>Do not try to open another person's records. Access is limited by role.</li>
            <li>Repeated wrong passwords temporarily lock the account to protect it.</li>
          </ul>
          <h2>Content</h2>
          <p>Notices, articles and photographs belong to the school or the people who created them. Please do not copy them without permission.</p>
          <h2>Questions</h2>
          <p>Contact the school office through the <Link to="/contact" style={{ color: "var(--accent)" }}>contact page</Link>.</p>
        </div>
      </Section>
    </>
  );
}
