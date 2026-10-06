import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import { useAuth } from "../../lib/AuthContext";
import type { LoginPortal } from "../../lib/AuthContext";
import { ApiError } from "../../lib/api";

export type LoginPhase = "idle" | "loading" | "ok";

export interface LoginCopy {
  /** Label of the identifier field: students/teachers use a username, the hidden admin page an email. */
  idLabel: string;
  idType: "text" | "email";
  idAutoComplete: string;
}

export function loginCopy(portal: LoginPortal): LoginCopy {
  return portal === "admin"
    ? { idLabel: "Email address", idType: "email", idAutoComplete: "username" }
    : { idLabel: "Username", idType: "text", idAutoComplete: "username" };
}

interface Options {
  portal: LoginPortal;
  /** Notice shown on first paint (e.g. "account disabled" redirected here). */
  initialNotice?: string;
  /** Tells the page a sign-in is in flight so it doesn't redirect before the success animation. */
  onSigningIn: (active: boolean) => void;
  /** Called shortly after a successful sign-in, once the success state has been seen. */
  onSuccess: () => void;
  formRef: RefObject<HTMLFormElement | null>;
  idRef: RefObject<HTMLInputElement | null>;
  passRef: RefObject<HTMLInputElement | null>;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * All the behaviour of the login form, shared by both designs so the Koi and
 * Lamp pages differ only in how they look. Real authentication happens in
 * AuthContext.login(); nothing here decides who may sign in — the backend does.
 */
export function useLoginForm({ portal, initialNotice, onSigningIn, onSuccess, formRef, idRef, passRef }: Options) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errId, setErrId] = useState("");
  const [errPass, setErrPass] = useState("");
  const [status, setStatus] = useState<{ text: string; tone: "" | "bad" | "ok" }>(
    initialNotice ? { text: initialNotice, tone: "bad" } : { text: "", tone: "" }
  );
  const [phase, setPhase] = useState<LoginPhase>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const shake = useCallback(() => {
    const f = formRef.current;
    if (!f) return;
    f.classList.remove("shake");
    void f.offsetWidth; // restart the CSS animation
    f.classList.add("shake");
  }, [formRef]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (phase !== "idle") return;

      const id = identifier.trim();
      let bad: HTMLInputElement | null = null;
      let idMsg = "";
      let passMsg = "";
      if (portal === "admin" ? !EMAIL_RE.test(id) : id.length === 0) {
        idMsg = portal === "admin" ? "Enter a valid email address." : "Enter your username.";
        bad = idRef.current;
      }
      if (password.length === 0) {
        passMsg = "Enter your password.";
        if (!bad) bad = passRef.current;
      }
      setErrId(idMsg);
      setErrPass(passMsg);
      if (bad) {
        shake();
        bad.focus();
        setStatus({ text: "Fix the highlighted fields and try again.", tone: "bad" });
        return;
      }

      setStatus({ text: "", tone: "" });
      setPhase("loading");
      onSigningIn(true);
      // The free Render tier sleeps when idle; say so instead of looking frozen.
      const slow = window.setTimeout(
        () => setStatus({ text: "The school server is waking up. This can take up to a minute…", tone: "" }),
        5000
      );
      try {
        await login(id, password, portal);
        setPhase("ok");
        setStatus({ text: "Signed in. Taking you to your dashboard…", tone: "ok" });
        timer.current = window.setTimeout(onSuccess, 700);
      } catch (err) {
        onSigningIn(false);
        setPhase("idle");
        shake();
        // The backend's own message is already safe to show verbatim: wrong
        // credentials, disabled accounts and lockout timers all come from it.
        setStatus({
          text: err instanceof ApiError ? err.message : "Could not sign in. Please check your connection and try again.",
          tone: "bad",
        });
      } finally {
        window.clearTimeout(slow);
      }
    },
    [phase, identifier, password, portal, login, onSigningIn, onSuccess, shake, idRef, passRef]
  );

  return {
    identifier,
    password,
    setIdentifier: (v: string) => {
      setIdentifier(v);
      setErrId("");
    },
    setPassword: (v: string) => {
      setPassword(v);
      setErrPass("");
    },
    errId,
    errPass,
    status,
    phase,
    onSubmit,
  };
}
