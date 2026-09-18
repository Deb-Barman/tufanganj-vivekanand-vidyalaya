import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { EventItem, Paginated } from "../../types/api";

export function EventsModule() {
  const { user } = useAuth();
  const canManage = user?.role === "SUPER_ADMIN";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [audience, setAudience] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Paginated<EventItem>>("/content/events/");
      setEvents(data.results);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not load events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await api.post<EventItem>("/content/events/", {
        title,
        event_date: eventDate,
        audience,
        description,
      });
      setEvents((prev) => [...prev, created].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setTitle("");
      setEventDate("");
      setAudience("");
      setDescription("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not add the event.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await api.del(`/content/events/${id}/`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Could not remove the event.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="dash-panel">
      <h2>Events</h2>
      <p className="dash-panel-sub">{canManage ? "Add or remove upcoming school events." : "Upcoming school events."}</p>

      {canManage && (
        <form className="dash-form" onSubmit={handleCreate}>
          <div className="ff-row">
            <div className="form-field">
              <label htmlFor="eTitle">Title</label>
              <input id="eTitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-field">
              <label htmlFor="eDate">Date</label>
              <input id="eDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="eAudience">Audience (optional)</label>
            <input id="eAudience" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. All Classes" />
          </div>
          <div className="form-field">
            <label htmlFor="eDesc">Description</label>
            <textarea id="eDesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {formError && <p className="alert alert-error">{formError}</p>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ alignSelf: "flex-start" }}>
            {submitting ? "Adding…" : "Add Event"}
          </button>
        </form>
      )}

      {listError && <p className="alert alert-error" style={{ marginTop: 16 }}>{listError}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : events.length === 0 ? (
        <p className="dash-empty">No upcoming events.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Date</th>
                <th>Audience</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.title}</td>
                  <td>{new Date(ev.event_date).toLocaleDateString("en-IN")}</td>
                  <td>{ev.audience || "All"}</td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === ev.id} onClick={() => handleDelete(ev.id)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
