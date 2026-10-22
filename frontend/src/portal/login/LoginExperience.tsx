import { lazy, Suspense, useState } from "react";
import { ScreenLoader } from "../../components/loading/Loading";
import { ForgotPassword } from "./ForgotPassword";
import type { LoginViewProps } from "./types";

// Each design is its own chunk: a visitor downloads only the one they see.
const KoiLogin = lazy(() => import("./KoiLogin"));
const LampLogin = lazy(() => import("./LampLogin2"));
const NeumorphicLampLogin = lazy(() => import("./LampLogin3"));

const DESIGNS = [KoiLogin, LampLogin, NeumorphicLampLogin] as const;
const LAST_KEY = "tvv_last_login_design";

/**
 * Picks a design at random every time the login page opens — and never the same one
 * twice in a row, so a visitor who comes back always sees something different.
 * (Storage can be blocked, e.g. private mode; then it is simply plain random.)
 */
function pickDesign(): number {
  let last = -1;
  try {
    last = Number(localStorage.getItem(LAST_KEY) ?? -1);
  } catch {
    /* ignore */
  }
  const pool = DESIGNS.map((_, i) => i).filter((i) => i !== last);
  const next = pool[Math.floor(Math.random() * pool.length)];
  try {
    localStorage.setItem(LAST_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function LoginExperience(props: LoginViewProps) {
  const [Design] = useState(() => DESIGNS[pickDesign()]);
  return (
    <Suspense fallback={<ScreenLoader />}>
      <Design {...props} />
      {props.portal === "staff" && <ForgotPassword />}
    </Suspense>
  );
}
