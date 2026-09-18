import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Attendance, Paginated } from "../../types/api";

export function AttendanceModule() {
  const { user } = useAuth();
  const isStaff = user?.role === "SUPER_ADMIN" || user?.role === "TEACHER";

  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // No student filter is sent here on purpose: the backend's queryset
      // (academics/views.py AttendanceListCreateView.get_queryset) scopes
      // a student to their own records automatically and ignores any
      // ?student= a non-staff caller might try to pass — verified against
      // the live backend, not just assumed from reading the code.
      const data = await api.get<Paginated<Attendance>>("/academics/attendance/");
      setRecords(data.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="dash-panel">
      <h2>Attendance</h2>
      <p className="dash-panel-sub">
        {isStaff
          ? "Recent attendance records across the school. Per-class marking UI is on the roadmap — see docs/NEXT_STEPS.md."
          : "Your own attendance record — visible only to you and school staff."}
      </p>

      {error && <p className="alert alert-error" style={{ marginTop: 16 }}>{error}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : records.length === 0 ? (
        <p className="dash-empty">No attendance records yet.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString("en-IN")}</td>
                  <td>{r.status === "PRESENT" ? "Present" : "Absent"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
