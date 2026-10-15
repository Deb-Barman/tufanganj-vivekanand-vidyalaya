import { useLocation } from "react-router-dom";
import { skeletonSpecFor } from "./skeletonVariant";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import "./skeletons.css";

/** One grey shape. Sizes in px or any CSS length. */
export function Bone({ w = "100%", h = 14, r, circle, style }: { w?: number | string; h?: number | string; r?: number | string; circle?: boolean; style?: CSSProperties }) {
  return <span className="bone" aria-hidden="true" style={{ width: w, height: h, borderRadius: circle ? "50%" : r, ...style }} />;
}

/** The free server sleeps when idle and needs up to a minute to wake: after a few seconds, say so. */
function SlowHint() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  if (!slow) return null;
  return (
    <p className="skeleton-slow" role="status">
      Still loading… the school server rests when nobody is using it and can take up to a minute to wake up. Thank you for waiting — this page will fill in by itself.
    </p>
  );
}

/* ───────────── rows / cards / photos that match the real modules ───────────── */

function RowSk({ i }: { i: number }) {
  return (
    <div className="row-link">
      <Bone w={38} h={38} r={12} />
      <span className="row-main">
        <Bone w={`${68 - (i % 3) * 12}%`} h={13} />
        <Bone w={`${44 + (i % 2) * 14}%`} h={10} />
      </span>
      {i % 2 === 0 && <Bone w={54} h={24} r={999} />}
    </div>
  );
}

function CardSk({ i }: { i: number }) {
  return (
    <article className="rcard">
      <div className="rcard-head">
        <Bone w={40} h={40} circle />
        <div className="row-main">
          <Bone w={`${60 - (i % 3) * 8}%`} h={14} />
          <Bone w="38%" h={10} />
        </div>
        <Bone w={58} h={22} r={999} />
      </div>
      <div className="sk-panel-lines">
        <Bone h={11} />
        <Bone w="78%" h={11} />
      </div>
      <div className="rcard-actions">
        <Bone w={84} h={34} r={10} />
        <Bone w={92} h={34} r={10} />
      </div>
    </article>
  );
}

export type SkeletonVariant = "list" | "cards" | "grid";

/** Drop-in loading state. Pick the variant that matches the page: list rows, cards or a photo grid. */
export function Skeleton({ rows = 4, variant = "list" }: { rows?: number; variant?: SkeletonVariant }) {
  return (
    <div className="sk-wrap" role="status" aria-busy="true" aria-label="Loading">
      {variant === "cards" ? (
        <div className="cards">{Array.from({ length: rows }, (_, i) => <CardSk key={i} i={i} />)}</div>
      ) : variant === "grid" ? (
        <div className="sk-photo-grid">
          {Array.from({ length: Math.max(rows, 4) * 2 }, (_, i) => (
            <div className="sk-photo" key={i}>
              <Bone h={0} style={{ aspectRatio: "1", height: "auto", borderRadius: 12 }} />
              <Bone w="60%" h={10} />
            </div>
          ))}
        </div>
      ) : (
        <div className="list">{Array.from({ length: rows }, (_, i) => <RowSk key={i} i={i} />)}</div>
      )}
      <SlowHint />
    </div>
  );
}

/* ───────────── page-level skeletons ───────────── */

export function PageHeadSkeleton() {
  return (
    <div className="page-head">
      <Bone w={54} h={54} r={18} />
      <div className="page-head-text" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Bone w="46%" h={24} />
        <Bone w="72%" h={12} />
      </div>
    </div>
  );
}

/** Suspense fallback while a dashboard page's code downloads: header + toolbar + the page's own skeleton shape. */
export function ModuleSkeleton({ variant = "list", rows, toolbar = true }: { variant?: SkeletonVariant; rows?: number; toolbar?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <PageHeadSkeleton />
      {toolbar && <ToolbarSkeleton />}
      <Skeleton variant={variant} rows={rows ?? (variant === "list" ? 4 : 3)} />
    </div>
  );
}

/** The search / filter row under a page title. */
export function ToolbarSkeleton() {
  return (
    <div className="toolbar" aria-hidden="true">
      <Bone w={190} h={42} r={14} />
      <Bone h={42} r={14} style={{ flex: "1 1 160px", width: "auto" }} />
    </div>
  );
}

/** Hero card placeholder (greeting + chips) for the overview page. */
export function HeroSkeleton() {
  return (
    <section className="hero-card" aria-hidden="true">
      <Bone w={110} h={12} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        <Bone w="52%" h={30} />
        <Bone w="34%" h={12} />
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}><Bone w={104} h={36} r={999} /><Bone w={104} h={36} r={999} /><Bone w={104} h={36} r={999} /></div>
      </div>
    </section>
  );
}

/** Teacher / Student overview while ANY of its data is still loading: one skeleton, then everything appears together. */
export function MemberOverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview">
      <StatsSkeleton />
      <div className="grid-3" style={{ marginTop: 0 }}>
        <PanelSk lines={4} />
        <PanelSk lines={3} />
      </div>
      <div className="grid-2" style={{ marginTop: 20 }}>
        <PanelSk lines={3} />
        <PanelSk lines={3} />
      </div>
      <PanelSk lines={3} />
    </div>
  );
}

function StatSk() {
  return (
    <div className="stat-card">
      <Bone w={44} h={44} r={15} />
      <Bone w={64} h={30} style={{ marginTop: 8 }} />
      <Bone w="70%" h={12} />
      <Bone w="48%" h={10} />
    </div>
  );
}

/** Big KPI tiles while numbers load. */
export function StatsSkeleton() {
  return (
    <div className="kpi-grid" aria-busy="true">
      {[0, 1, 2, 3].map((i) => <StatSk key={i} />)}
    </div>
  );
}

function PanelSk({ lines = 3, children }: { lines?: number; children?: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Bone w={150} h={16} />
        <Bone w={44} h={12} />
      </div>
      {children ?? <div className="list">{Array.from({ length: lines }, (_, i) => <RowSk key={i} i={i} />)}</div>}
    </section>
  );
}

/** Everything under the Super Admin hero: KPI tiles, two panels, chart + pipeline. */
export function AdminOverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview">
      <StatsSkeleton />
      <div className="grid-3" style={{ marginTop: 0 }}>
        <PanelSk lines={3} />
        <PanelSk>
          <div className="split">
            <Bone w={132} h={132} circle />
            <div className="split-text"><Bone w="70%" h={12} /><Bone w="50%" h={12} /><Bone w="60%" h={12} /></div>
          </div>
        </PanelSk>
      </div>
      <div className="grid-2" style={{ marginTop: 20 }}>
        <PanelSk>
          <div className="sk-bars">
            {[40, 70, 55, 85, 35, 60, 75].map((h, i) => <Bone key={i} h={`${h}%`} />)}
          </div>
        </PanelSk>
        <PanelSk>
          <div className="sk-panel-lines"><Bone h={14} r={999} /><Bone w="60%" h={10} /><RowSk i={1} /></div>
        </PanelSk>
      </div>
    </div>
  );
}

/** Whole-dashboard skeleton: sidebar (desktop) / top bar + tab bar (phone), hero, KPI tiles, panels.
 *  Self-contained on purpose: it must look right before any dashboard code or CSS has loaded. */
export function ShellSkeleton() {
  const { pathname } = useLocation();
  const isOverview = pathname.replace(/\/+$/, "") === "/portal/dashboard";
  const spec = skeletonSpecFor(pathname);
  return (
    <div className="shs" role="status" aria-busy="true" aria-label="Loading dashboard">
      <aside className="shs-side">
        <div style={{ display: "flex", gap: 11, alignItems: "center" }}><Bone w={34} h={34} circle /><div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}><Bone w="70%" h={14} /><Bone w="40%" h={9} /></div></div>
        <Bone h={72} r={20} style={{ margin: "8px 0" }} />
        {Array.from({ length: 8 }, (_, i) => <Bone key={i} h={40} r={12} style={{ opacity: 1 - i * 0.07 }} />)}
      </aside>
      <div className="shs-main">
        <div className="shs-top"><Bone w={38} h={38} r={12} /><Bone w="38%" h={16} style={{ flex: 1 }} /><Bone w={38} h={38} r={12} /></div>
        {isOverview ? (
          <>
            <div className="shs-hero">
              <Bone w={130} h={11} />
              <Bone w="58%" h={30} />
              <Bone w="82%" h={12} />
              <div className="sk-chips"><Bone w={112} h={38} r={999} /><Bone w={132} h={38} r={999} /><Bone w={104} h={38} r={999} /></div>
            </div>
            <div className="shs-kpis">
              {[0, 1, 2, 3].map((i) => (
                <div className="shs-card" key={i}><Bone w={44} h={44} r={15} /><Bone w={60} h={30} /><Bone w="70%" h={12} /><Bone w="45%" h={10} /></div>
              ))}
            </div>
            <div className="shs-card" style={{ gap: 14 }}>
              <Bone w={150} h={16} />
              {[0, 1, 2].map((i) => <Bone key={i} h={58} r={14} />)}
            </div>
          </>
        ) : (
          /* any other page: the same shape that page shows while its data loads (inline styles: this must work before any CSS loads) */
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><Bone w="34%" h={30} /><Bone w="62%" h={12} /></div>
            {spec.toolbar && <div style={{ display: "flex", gap: 12 }}><Bone w={190} h={42} r={14} /><Bone h={42} r={14} style={{ flex: 1, width: "auto" }} /></div>}
            {spec.variant === "grid" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
                {Array.from({ length: 8 }, (_, i) => <Bone key={i} h={150} r={16} />)}
              </div>
            ) : spec.variant === "cards" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {Array.from({ length: spec.rows }, (_, i) => <div className="shs-card" key={i}><Bone w="46%" h={16} /><Bone w="80%" h={11} /><Bone w="30%" h={11} /></div>)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Array.from({ length: spec.rows }, (_, i) => <Bone key={i} h={58} r={14} />)}
              </div>
            )}
          </>
        )}
      </div>
      <div className="shs-tabs">
        {[0, 1, 2, 3, 4].map((i) => <div key={i}><Bone w={24} h={24} r={8} /><Bone w={34} h={8} /></div>)}
      </div>
    </div>
  );
}
