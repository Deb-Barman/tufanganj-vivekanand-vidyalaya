import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { DataCell, DataColumn, DataRows, DataTables } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Select, Skeleton, errText, fmtBytes, fmtDateTime, useDebounced, useUI } from "../ui/kitExports";
import { PageLoading } from "../ui/PageLoading";
import "../ui/admin-tools.css";

const SUB = "Browse every table in the database — the same records the Supabase website shows — without leaving the dashboard. Read-only; passwords are always hidden.";
const NUMERIC = new Set(["IntegerField", "BigIntegerField", "SmallIntegerField", "PositiveIntegerField", "PositiveSmallIntegerField", "DecimalField", "FloatField"]);

function show(col: DataColumn, v: DataCell): { text: string; cls: string } {
  if (col.redacted && v) return { text: "••••••••", cls: "masked" };
  if (v === null || v === undefined) return { text: "null", cls: "null" };
  if (typeof v === "boolean") return { text: v ? "✓ true" : "✗ false", cls: "" };
  if (col.type === "DateTimeField" && typeof v === "string") return { text: fmtDateTime(v), cls: "" };
  if (col.name === "size" && typeof v === "number") return { text: fmtBytes(v), cls: "num" };
  if (typeof v === "number" || (NUMERIC.has(col.type) && v !== "")) return { text: String(v), cls: "num" };
  return { text: String(v), cls: "" };
}

export function DataViewModule() {
  const { toast } = useUI();
  const [tables, setTables] = useState<DataTables | null>(null);
  const [key, setKey] = useState("");
  const [query, setQuery] = useState("");
  const q = useDebounced(query, 350);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("");
  const [rows, setRows] = useState<DataRows | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Record<string, DataCell> | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<DataTables>("/auth/admin/data/").then(setTables).catch((e) => {
      toast("error", errText(e, "Could not load the table list."));
      setTables({ tables: [], storage_files: null, storage_key: null });
    });
  }, [toast]);

  const options = useMemo(() => {
    if (!tables) return [];
    const list = tables.tables.map((t) => ({ value: t.key, label: `${t.name} (${t.rows.toLocaleString("en-IN")})` }));
    if (tables.storage_key) list.push({ value: tables.storage_key, label: `Storage Files (${(tables.storage_files ?? 0).toLocaleString("en-IN")})` });
    return list;
  }, [tables]);
  const active = key || options[0]?.value || "";

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "25" });
      if (q.trim()) params.set("q", q.trim());
      if (ordering) params.set("ordering", ordering);
      setRows(await api.get<DataRows>(`/auth/admin/data/${active}/?${params}`));
    } catch (e) {
      toast("error", errText(e, "Could not load this table."));
    } finally {
      setLoading(false);
    }
  }, [active, page, q, ordering, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const pickTable = (k: string) => { setKey(k); setPage(1); setOrdering(""); setQuery(""); setRows(null); };
  const sortBy = (c: DataColumn) => {
    if (c.redacted) return;
    const current = rows?.ordering ?? "";
    setOrdering(current === c.name ? `-${c.name}` : c.name);
    setPage(1);
  };

  async function exportCsv() {
    if (!rows || active === tables?.storage_key) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (ordering) params.set("ordering", ordering);
      const blob = await api.download(`/auth/admin/data/${active}/export/?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rows.db_table}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("success", "CSV downloaded.");
    } catch (e) {
      toast("error", errText(e, "Could not export this table."));
    } finally {
      setExporting(false);
    }
  }

  if (!tables) return <PageLoading icon="table" title="Data view" sub={SUB} toolbar variant="list" rows={5} />;
  if (options.length === 0) return (<><PageHeader icon="table" title="Data view" sub={SUB} /><EmptyState icon="table" title="No tables found" text="The server did not return any tables." /></>);

  const sortedBy = rows?.ordering ?? "";
  const canExport = !!rows && active !== tables.storage_key;

  return (
    <>
      <PageHeader
        icon="table"
        title="Data view"
        sub={SUB}
        actions={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={loading}><Icon name="refresh" size={16} /> Refresh</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv} disabled={!canExport || exporting}><Icon name="download" size={16} /> {exporting ? "Preparing…" : "Export CSV"}</button>
          </>
        }
      />

      <div className="toolbar data-bar">
        <div className="field-inline"><label htmlFor="dvTable">Table</label>
          <Select id="dvTable" searchable value={active} onChange={(e) => pickTable(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        </div>
        <div className="search-box"><Icon name="search" size={18} /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search text in this table" aria-label="Search this table" style={{ minHeight: 46 }} /></div>
      </div>

      {rows && (
        <div className="data-meta">
          <span><b>{rows.count.toLocaleString("en-IN")}</b> row{rows.count === 1 ? "" : "s"} · {rows.columns.length} columns · table <code>{rows.db_table}</code></span>
          <span>Click a row to see everything in it</span>
        </div>
      )}

      {rows === null ? <Skeleton rows={6} /> : rows.results.length === 0 ? (
        <EmptyState icon="inbox" title={q ? "Nothing matches" : "This table is empty"} text={q ? "Try a different search word." : "No records have been saved here yet."} />
      ) : (
        <div className="data-wrap" aria-busy={loading} style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
          <table className="data-table">
            <thead>
              <tr>
                {rows.columns.map((c) => {
                  const on = sortedBy === c.name || sortedBy === `-${c.name}`;
                  return (
                    <th key={c.name} className={on ? "sorted" : ""} aria-sort={on ? (sortedBy.startsWith("-") ? "descending" : "ascending") : "none"}>
                      <button type="button" onClick={() => sortBy(c)} disabled={c.redacted} title={c.redacted ? "Hidden for security" : `Sort by ${c.label}`}>
                        {c.label}{on && <Icon name={sortedBy.startsWith("-") ? "chevronDown" : "chevronUp"} size={13} />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.results.map((r, i) => (
                <tr key={i} tabIndex={0} onClick={() => setDetail(r)} onKeyDown={(e) => e.key === "Enter" && setDetail(r)}>
                  {rows.columns.map((c) => {
                    const s = show(c, r[c.name]);
                    return <td key={c.name} className={s.cls} title={s.text.length > 40 ? s.text : undefined}>{s.text}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.pages > 1 && (
        <div className="data-pager">
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}><Icon name="chevronLeft" size={16} /> Prev</button>
          <span>Page {rows.page} of {rows.pages}</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= rows.pages || loading} onClick={() => setPage((p) => p + 1)}>Next <Icon name="chevronRight" size={16} /></button>
        </div>
      )}

      <Modal open={detail !== null} title={rows?.name ? `${rows.name} — record` : "Record"} onClose={() => setDetail(null)} size="lg" footer={<button type="button" className="btn btn-primary btn-sm" onClick={() => setDetail(null)}>Close</button>}>
        {detail && rows && (
          <dl className="kv">
            {rows.columns.map((c) => {
              const s = show(c, detail[c.name]);
              return <div key={c.name}><dt>{c.label}</dt><dd className={s.cls}>{s.text}</dd></div>;
            })}
          </dl>
        )}
      </Modal>
    </>
  );
}
