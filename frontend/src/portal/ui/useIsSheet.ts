import { useEffect, useState } from "react";

/** True on phones, where pickers open as a bottom sheet instead of a floating menu. */
export function useIsSheet(): boolean {
  const query = "(max-width: 720px)";
  const [sheet, setSheet] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setSheet(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return sheet;
}
