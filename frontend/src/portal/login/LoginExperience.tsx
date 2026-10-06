import { lazy, Suspense, useState } from "react";
import type { LoginViewProps } from "./types";

// Each design is its own chunk: a visitor downloads only the one they see.
const KoiLogin = lazy(() => import("./KoiLogin"));
const LampLogin = lazy(() => import("./LampLogin"));

const DESIGNS = [KoiLogin, LampLogin] as const;

/** Picks one of the two designs at random each time the login page opens. */
export function LoginExperience(props: LoginViewProps) {
  const [Design] = useState(() => DESIGNS[Math.floor(Math.random() * DESIGNS.length)]);
  return (
    <Suspense fallback={<div className="portal-loading" role="status">Loading…</div>}>
      <Design {...props} />
    </Suspense>
  );
}
