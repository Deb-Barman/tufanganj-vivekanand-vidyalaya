import { useEffect, useMemo, useRef } from "react";
import type { PortfolioAttendance } from "../../types/api";
import "./portfolio.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Attendance like a GitHub contribution calendar: one square per day for the last 12 months,
 * green = present, red = absent, faint = no school / not marked. Weeks run left → right, Monday on top.
 */
export function AttendanceHeatmap({ data }: { data: PortfolioAttendance }) {
  const scroller = useRef<HTMLDivElement>(null);
  const { weeks, monthLabels } = useMemo(() => {
    const marks = new Map(data.days);
    const end = new Date(data.to + "T00:00:00");
    const start = new Date(data.from + "T00:00:00");
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7)); // back to Monday
    const weeks: { date: string; mark?: "P" | "A"; inRange: boolean }[][] = [];
    const labels: { week: number; text: string }[] = [];
    let lastMonth = -1;
    while (cursor <= end) {
      const week: { date: string; mark?: "P" | "A"; inRange: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const key = iso(cursor);
        const inRange = cursor >= start && cursor <= end;
        week.push({ date: key, mark: marks.get(key), inRange });
        if (i === 0 && cursor.getMonth() !== lastMonth && cursor <= end) {
          lastMonth = cursor.getMonth();
          if (weeks.length === 0 || cursor.getDate() <= 14) {
            // a month label needs ~3 weeks of room: a short first month gives way to the next one
            if (labels.length && weeks.length - labels[labels.length - 1].week < 3) labels.pop();
            labels.push({ week: weeks.length, text: MONTHS[lastMonth] });
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }
    return { weeks, monthLabels: labels };
  }, [data]);

  // Start scrolled to "today" (the right edge) on small screens.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);

  const pretty = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <figure className="hm" aria-label={`Attendance calendar: ${data.present} days present, ${data.absent} absent in the last 12 months`}>
      <div className="hm-scroll" ref={scroller}>
        <div className="hm-grid" style={{ ["--weeks" as string]: weeks.length }}>
          <div className="hm-months" aria-hidden="true">
            {monthLabels.map((m) => <span key={m.week} style={{ gridColumn: m.week + 1 }}>{m.text}</span>)}
          </div>
          <div className="hm-days" aria-hidden="true"><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /><span /></div>
          <div className="hm-cells">
            {weeks.map((w, wi) => (
              <div className="hm-week" key={wi}>
                {w.map((d) => (
                  <i
                    key={d.date}
                    className={`hm-cell${!d.inRange ? " out" : d.mark === "P" ? " p" : d.mark === "A" ? " a" : ""}`}
                    title={d.inRange ? `${pretty(d.date)} — ${d.mark === "P" ? "Present" : d.mark === "A" ? "Absent" : "No school / not marked"}` : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="hm-legend" aria-hidden="true">
        <span><i className="hm-cell" /> No school</span>
        <span><i className="hm-cell p" /> Present</span>
        <span><i className="hm-cell a" /> Absent</span>
      </figcaption>
    </figure>
  );
}
