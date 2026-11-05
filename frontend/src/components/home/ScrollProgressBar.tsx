import { useScrollProgress } from "./scroll";

/** A thin gradient line at the very top that fills (smoothly) as you scroll down the page. */
export function ScrollProgressBar() {
  const ref = useScrollProgress<HTMLDivElement>("page");
  return <div className="scroll-progress" ref={ref} aria-hidden="true"><div /></div>;
}
