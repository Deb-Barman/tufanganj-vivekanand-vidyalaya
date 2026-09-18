import { Hero } from "../components/Hero";
import { TrustBar } from "../components/TrustBar";
import { Academics } from "../components/Academics";
import { Faculty } from "../components/Faculty";
import { Achievements } from "../components/Achievements";
import { Campus } from "../components/Campus";
import { NoticesSection } from "../components/NoticesSection";
import { Faq } from "../components/Faq";
import { Admissions } from "../components/Admissions";
import { Contact } from "../components/Contact";

export function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Academics />
      <Faculty />
      <Achievements />
      <Campus />
      <NoticesSection />
      <Faq />
      <Admissions />
      <Contact />
    </>
  );
}
