import { useRef } from "react";
import "./SocialLinks.css";

export interface SocialLink {
  name: string;
  href: string;
  /** Brand colour used for the hover fill-wipe and glow (any valid CSS background). */
  brand: string;
  /** Used for the hover glow shadow; a plain CSS color (brand colour at ~55% alpha). */
  glow: string;
  icon: React.ReactNode;
}

/**
 * Circular neumorphic social buttons with a magnetic pointer-pull, a
 * colour fill-wipe on hover, and a brand-coloured tooltip — ported from
 * the uploaded premium_ui_suite reference. Pass only links that are real,
 * published accounts for this school; this component does not invent any.
 */
export function SocialLinks({ links, className = "" }: { links: SocialLink[]; className?: string }) {
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <ul className={`social ${className}`}>
      {links.map((link) => (
        <SocialItem key={link.name} link={link} magnetic={!reduceMotion} />
      ))}
    </ul>
  );
}

function SocialItem({ link, magnetic }: { link: SocialLink; magnetic: boolean }) {
  const aRef = useRef<HTMLAnchorElement>(null);

  function onPointerMove(e: React.PointerEvent<HTMLLIElement>) {
    if (!magnetic || !aRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.24;
    const y = (e.clientY - r.top - r.height / 2) * 0.24 - 5;
    aRef.current.style.transform = `translate(${x}px, ${y}px)`;
  }
  function onPointerLeave() {
    if (aRef.current) aRef.current.style.transform = "";
  }

  return (
    <li
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ ["--b" as string]: link.brand, ["--b1" as string]: link.glow }}
    >
      <a ref={aRef} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.name}>
        <i className="fill" aria-hidden="true" />
        {link.icon}
      </a>
      <span className="tip">{link.name}</span>
    </li>
  );
}
