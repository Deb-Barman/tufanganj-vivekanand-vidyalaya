import { lazy, Suspense, useState } from "react";
import { ScreenLoader } from "../../components/loading/Loading";
import type { LoginViewProps } from "./types";

// Each design is its own chunk: a visitor downloads only the one they see.
const KoiLogin = lazy(() => import("./KoiLogin"));
const LampLogin = lazy(() => import("./LampLogin2"));

const DESIGNS = [KoiLogin, LampLogin] as const;

/** Picks one of the two designs at random each time the login page opens. */
export function LoginExperience(props: LoginViewProps) {
  const [Design] = useState(() => DESIGNS[Math.floor(Math.random() * DESIGNS.length)]);
  return (
    <Suspense fallback={<ScreenLoader />}>
      <Design {...props} />
    </Suspense>
  );
}
