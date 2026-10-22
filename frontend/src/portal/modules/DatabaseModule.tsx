import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { DatabaseOverview } from "../../types/api";
import { EmptyState, Icon, PageHeader, Ring, Skeleton, StatCard, StatusPill, errText, fmtBytes, fmtDateTime, useUI } from "../ui/kitExports";
import { SkDatabase } from "../ui/Skeletons";
import "../ui/admin-tools.css";

const tone = (pct: number | null): "good" | "warn" | "bad" => (pct == null ? "good" : pct >= 90 ? "bad" : pct >= 70 ? "warn" : "good");
const mbText = (mb: number | null) => (mb == null ? "—" : mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toLocaleString("en-IN", { maximumFractionDigits: 1 })} MB`);
const SOURCE: Record<DatabaseOverview["storage"]["source"], string> = {
  supabase: "Read from Supabase Storage",
  s3: "Counted from the storage bucket",
  disk: "Local disk (development)",
  unavailable: "Could not read storage",
};

export function DatabaseModule() {
  const { toast } = useUI();
  const [data, setData] = useState<DatabaseOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await api.get<DatabaseOverview>("/auth/admin/database/"));
      setFailed(false);
    } catch (e) {
      setFailed(true);
      toast("error", errText(e, "Could not load the database details."));
    } finally {
      setBusy(false);
    }
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const actions = (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={busy}><Icon name="refresh" size={16} /> {busy ? "Refreshing…" : "Refresh"}</button>
      {data && <a className="btn btn-primary btn-sm" href={data.dashboard_url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16} /> Open Supabase</a>}
    </>
  );
  const sub = "How much of your Supabase plan the school is using — database size, file storage and every table. Read-only.";

  if (!data && !failed) return (<><PageHeader icon="database" title="Database" sub={sub} /><SkDatabase /></>);
  if (!data) return (<><PageHeader icon="database" title="Database" sub={sub} actions={actions} /><EmptyState icon="alert" title="Could not load" text="The server did not answer. Try again in a moment." action={<button type="button" className="btn btn-primary btn-sm" onClick={load}>Try again</button>} /></>);

  const { database: db, storage: st, server, tables } = data;
  const maxBytes = Math.max(1, ...tables.map((t) => t.bytes ?? 0));
  const maxRows = Math.max(1, ...tables.map((t) => t.rows));
  const hasSizes = tables.some((t) => t.bytes != null);

  return (
    <>
      <PageHeader icon="database" title="Database" sub={sub} actions={actions} />

      <div className="db-meters">
        <section className="panel db-meter">
          <Ring percent={db.percent ?? 0} label={db.percent == null ? "—" : `${db.percent}%`} sub="used" tone={tone(db.percent)} size={150} />
          <div className="db-meter-text">
            <h2><Icon name="database" size={18} /> Database</h2>
            <p className="db-big">{mbText(db.mb)} <span>of {mbText(db.limit_mb)}</span></p>
            <p className="db-small">Everything the portal stores as records: accounts, results, attendance, notices, messages…</p>
            {db.percent != null && db.percent >= 70 && <StatusPill tone={db.percent >= 90 ? "bad" : "warn"}>{db.percent >= 90 ? "Almost full — upgrade or clean up" : "Getting full"}</StatusPill>}
          </div>
        </section>

        <section className="panel db-meter">
          <Ring percent={st.percent ?? 0} label={st.percent == null ? "—" : `${st.percent}%`} sub="used" tone={tone(st.percent)} size={150} />
          <div className="db-meter-text">
            <h2><Icon name="cloud" size={18} /> File storage</h2>
            <p className="db-big">{mbText(st.mb)} <span>of {mbText(st.limit_mb)}</span></p>
            <p className="db-small">{st.files.toLocaleString("en-IN")} file{st.files === 1 ? "" : "s"} — gallery photos, blog covers, forms, marksheets. {SOURCE[st.source]}{st.truncated ? " (first 5,000 files counted)" : ""}.</p>
            {st.percent != null && st.percent >= 70 && <StatusPill tone={st.percent >= 90 ? "bad" : "warn"}>{st.percent >= 90 ? "Almost full — delete old files" : "Getting full"}</StatusPill>}
          </div>
        </section>
      </div>

      <div className="kpi-grid">
        <StatCard icon="table" label="Tables" value={data.totals.tables} note="School data tables" />
        <StatCard icon="layers" label="Records" value={data.totals.rows} note="Rows across all tables" tone="good" />
        <StatCard icon="server" label="Open connections" value={server.connections ?? 0} note={server.connections == null ? "Shown for PostgreSQL" : server.max_connections ? `of ${server.max_connections} allowed` : "Right now"} tone="warn" />
        <StatCard icon="file" label="Stored files" value={st.files} note={`${st.buckets.length} bucket${st.buckets.length === 1 ? "" : "s"}`} />
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <section className="panel">
          <div className="panel-title"><h2><Icon name="cloud" size={18} /> Storage buckets</h2></div>
          {st.buckets.length === 0 ? <p className="db-small">No buckets could be read.</p> : (
            <div className="list">
              {st.buckets.map((b) => (
                <div key={b.name} className="db-row">
                  <span className="row-main"><strong>{b.name}</strong><span>{b.files.toLocaleString("en-IN")} file{b.files === 1 ? "" : "s"}</span></span>
                  <span className="db-num">{fmtBytes(b.bytes)}</span>
                  <span className="pct-bar db-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, (b.bytes / Math.max(1, st.bytes)) * 100)}%` }} /></span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-title"><h2><Icon name="server" size={18} /> Server</h2></div>
          <dl className="db-facts">
            <div><dt>Engine</dt><dd>{server.engine === "postgresql" ? "PostgreSQL" : server.engine}{server.version ? ` ${server.version}` : ""}</dd></div>
            <div><dt>Running since</dt><dd>{server.started_at ? fmtDateTime(server.started_at) : "—"}</dd></div>
            <div><dt>Connections</dt><dd>{server.connections ?? "—"}{server.max_connections ? ` / ${server.max_connections}` : ""}</dd></div>
            <div><dt>Database size</dt><dd>{fmtBytes(db.bytes)}</dd></div>
          </dl>
          <p className="db-small" style={{ marginTop: 14 }}>{data.limits_note} Bandwidth, auth logs and backups are only shown on the Supabase website.</p>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-title"><h2><Icon name="table" size={18} /> Tables</h2><span className="mini-meta">{hasSizes ? "Biggest first" : "Size is only reported for PostgreSQL"}</span></div>
        <div className="list">
          {tables.map((t) => (
            <div key={t.key} className="db-row">
              <span className="row-main"><strong>{t.name}</strong><span><code>{t.db_table}</code> · {t.rows.toLocaleString("en-IN")} row{t.rows === 1 ? "" : "s"}</span></span>
              <span className="db-num">{fmtBytes(t.bytes)}</span>
              <span className="pct-bar db-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, ((hasSizes ? (t.bytes ?? 0) / maxBytes : t.rows / maxRows)) * 100)}%` }} /></span>
            </div>
          ))}
        </div>
      </section>

      {data.file_columns.length > 0 && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-title"><h2><Icon name="image" size={18} /> Uploaded files by feature</h2></div>
          <div className="db-chips">
            {data.file_columns.map((f) => <span key={`${f.table}-${f.field}`} className="status-pill tone-muted">{f.table} · {f.field}: {f.uploaded.toLocaleString("en-IN")}</span>)}
          </div>
        </section>
      )}
      {busy && <Skeleton rows={1} />}
    </>
  );
}
