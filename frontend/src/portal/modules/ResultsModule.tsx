import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { Paginated, Result } from "../../types/api";

export function ResultsModule() {
  const { user } = useAuth();
  const isStaff = user?.role === "SUPER_ADMIN" || user?.role === "TEACHER";

  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Same principle as AttendanceModule — backend queryset scopes a
      // student to their own results; no client-side filter needed or trusted.
      const data = await api.get<Paginated<Result>>("/academics/results/");
      setResults(data.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load results.");
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
      <h2>Results</h2>
      <p className="dash-panel-sub">
        {isStaff
          ? "Recorded results across the school. Entry-by-subject UI is on the roadmap — see docs/NEXT_STEPS.md."
          : "Your own results — visible only to you and school staff."}
      </p>

      {error && <p className="alert alert-error" style={{ marginTop: 16 }}>{error}</p>}

      {loading ? (
        <p className="dash-loading">Loading…</p>
      ) : results.length === 0 ? (
        <p className="dash-empty">No results recorded yet.</p>
      ) : (
        <div className="module-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Marks</th>
                <th>Out of</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>{r.marks_obtained}</td>
                  <td>{r.full_marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
