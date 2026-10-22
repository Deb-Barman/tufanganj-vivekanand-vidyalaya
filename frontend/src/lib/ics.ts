/** A one-day "Add to calendar" file (.ics) that opens in Google Calendar, Apple Calendar, Outlook… */
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function eventToIcs(ev: { id: string; title: string; event_date: string; description?: string; audience?: string }): string {
  const day = ev.event_date.replace(/-/g, "");
  const next = new Date(ev.event_date + "T00:00:00");
  next.setDate(next.getDate() + 1);
  const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const body = [ev.audience ? `For: ${ev.audience}` : "", ev.description ?? ""].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tufanganj Vivekananda Vidyalaya//School Portal//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${ev.id}@tufanganj-vivekananda-vidyalaya`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(ev.title)}`, ...(body ? [`DESCRIPTION:${esc(body)}`] : []), "LOCATION:Tufanganj Vivekananda Vidyalaya (H.S.)\\, Tufanganj\\, Cooch Behar",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadText(filename: string, text: string, type = "text/calendar") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
