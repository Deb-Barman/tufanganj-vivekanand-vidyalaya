import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { DataCell, DataColumn, DataFilter, DataRows, DataTables, DeletePreview, DeleteResult } from "../../types/api";
import { EmptyState, Icon, Modal, PageHeader, Select, Skeleton, errText, fmtBytes, fmtDateTime, useDebounced, useUI } from "../ui/kitExports";
import { PageLoading } from "../ui/PageLoading";
import "../ui/admin-tools.css";
import "../ui/data-tools.css";

const SUB = "Browse, filter and clean up every table in the database — everything the Supabase website shows — without leaving the dashboard. Passwords are always hidden, and deleting always asks you to confirm.";

const OP_LABEL: Record<string, string> = {
  contains: "contains", equals: "is exactly", startswith: "starts with", empty: "is empty", not_empty: "is not empty",
  eq: "is", gt: "is more than", gte: "is at least", lt: "is less than", lte: "is at most",
  is_true: "is Yes", is_false: "is No", on: "is on", from: "is on or after", until: "is on or before",
};
const OPS: Record<string, string[]> = {
  text: ["contains", "equals", "startswith", "empty", "not_empty"],
  number: ["eq", "gt", "gte", "lt", "lte", "empty", "not_empty"],
  bool: ["is_true", "is_false"],
  date: ["on", "from", "until", "empty", "not_empty"],
  datetime: ["on", "from", "until", "empty", "not_empty"],
  choice: ["eq", "empty", "not_empty"],
  id: ["eq", "empty", "not_empty"],
};
const NO_VALUE = new Set(["empty", "not_empty", "is_true", "is_false"]);
const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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
  const [pageSize, setPageSize] = useState(25);
  const [ordering, setOrdering] = useState("");
  const [rows, setRows] = useState<DataRows | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Record<string, DataCell> | null>(null);
  const [exporting, setExporting] = useState(false);
  // filters
  const [filters, setFilters] = useState<DataFilter[]>([]);
  const [unused, setUnused] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [bField, setBField] = useState("");
  const [bOp, setBOp] = useState("");
  const [bValue, setBValue] = useState("");
  // selection + delete
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [del, setDel] = useState<{ scope: "ids" | "filtered"; ids: string[]; count: number } | null>(null);
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadTables = useCallback(() => {
    api.get<DataTables>("/auth/admin/data/").then(setTables).catch((e) => {
      toast("error", errText(e, "Could not load the table list."));
      setTables((t) => t ?? { tables: [], storage_files: null, storage_key: null });
    });
  }, [toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    loadTables();
  }, [loadTables]);

  const options = useMemo(() => {
    if (!tables) return [];
    const list = tables.tables.map((t) => ({ value: t.key, label: `${t.name} (${t.rows.toLocaleString("en-IN")})` }));
    if (tables.storage_key) list.push({ value: tables.storage_key, label: `Storage Files (${(tables.storage_files ?? 0).toLocaleString("en-IN")})` });
    return list;
  }, [tables]);
  const active = key || options[0]?.value || "";
  const isStorage = !!tables?.storage_key && active === tables.storage_key;
  const filtersJson = JSON.stringify(filters);

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (q.trim()) params.set("q", q.trim());
      if (ordering) params.set("ordering", ordering);
      if (filtersJson !== "[]") params.set("filters", filtersJson);
      if (unused) params.set("unused", "1");
      setRows(await api.get<DataRows>(`/auth/admin/data/${active}/?${params}`));
    } catch (e) {
      toast("error", errText(e, "Could not load this table."));
    } finally {
      setLoading(false);
    }
  }, [active, page, pageSize, q, ordering, filtersJson, unused, toast]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load();
  }, [load]);

  const resetView = () => { setPage(1); setSelected(new Set()); setAllMatching(false); };
  const pickTable = (k: string) => { setKey(k); setOrdering(""); setQuery(""); setRows(null); setFilters([]); setUnused(false); setBField(""); setBuilderOpen(false); resetView(); };
  const sortBy = (c: DataColumn) => {
    if (c.redacted) return;
    const current = rows?.ordering ?? "";
    setOrdering(current === c.name ? `-${c.name}` : c.name);
    setPage(1);
  };

  // ---- filter builder
  const filterable = useMemo(() => (rows?.columns ?? []).filter((c) => c.filter), [rows]);
  const bCol = filterable.find((c) => c.name === bField) ?? filterable[0];
  const bType = bCol?.filter ?? "text";
  const bOps = OPS[bType] ?? [];
  const bOpEff = bOps.includes(bOp) ? bOp : bOps[0];
  const needsValue = !!bOpEff && !NO_VALUE.has(bOpEff);
  const valueOk = !needsValue || bValue.trim() !== "" || bType === "choice";
  const filterText = (f: DataFilter) => {
    const col = rows?.columns.find((c) => c.name === f.field);
    const val = NO_VALUE.has(f.op) ? "" : col?.choices?.find((x) => x.value === f.value)?.label ?? f.value;
    return `${col?.label ?? f.field} ${OP_LABEL[f.op] ?? f.op} ${val}`.trim();
  };
  const addFilter = (f: DataFilter) => {
    setFilters((cur) => (cur.some((x) => x.field === f.field && x.op === f.op) ? cur.map((x) => (x.field === f.field && x.op === f.op ? f : x)) : [...cur, f].slice(0, 8)));
    resetView();
  };
  const addFromBuilder = () => {
    if (!bCol || !bOpEff || !valueOk) return;
    const value = needsValue ? (bType === "choice" && !bValue ? bCol.choices?.[0]?.value ?? "" : bValue.trim()) : "";
    addFilter({ field: bCol.name, op: bOpEff, value });
    setBValue("");
  };
  const dateCol = useMemo(() => {
    const cols = (rows?.columns ?? []).filter((c) => c.filter === "date" || c.filter === "datetime");
    return cols.find((c) => /created|submitted|uploaded|^date$/i.test(c.name)) ?? cols[0];
  }, [rows]);
  const quickDays = (days: number, op: "from" | "until") => dateCol && addFilter({ field: dateCol.name, op, value: isoDay(new Date(Date.now() - days * 86400000)) });

  // ---- selection
  const pkName = rows?.columns.find((c) => c.pk)?.name ?? "";
  const rowId = (r: Record<string, DataCell>) => String(r[pkName] ?? "");
  const pageIds = (rows?.results ?? []).map(rowId);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleRow = (id: string) => { setAllMatching(false); setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const togglePage = () => { setAllMatching(false); setSelected(allOnPage ? new Set() : new Set(pageIds)); };
  const selectedCount = allMatching ? rows?.count ?? 0 : selected.size;

  // ---- delete
  const deleteBody = (d: NonNullable<typeof del>) => (d.scope === "filtered" ? { scope: "filtered", q: q.trim(), filters, unused } : { ids: d.ids });
  async function openDelete(d: NonNullable<typeof del>) {
    setDel(d);
    setPreview(null);
    setPreviewError("");
    setTyped("");
    try {
      setPreview(await api.post<DeletePreview>(`/auth/admin/data/${active}/delete-preview/`, deleteBody(d)));
    } catch (e) {
      setPreviewError(errText(e, "Could not check what would be deleted."));
    }
  }
  const closeDelete = () => { if (!deleting) { setDel(null); setPreview(null); } };
  async function confirmDelete() {
    if (!del) return;
    setDeleting(true);
    try {
      const r = await api.post<DeleteResult>(`/auth/admin/data/${active}/delete/`, { ...deleteBody(del), confirm: "DELETE" });
      const extra = r.also_deleted.reduce((n, a) => n + a.count, 0);
      toast("success", `Deleted ${r.deleted.toLocaleString("en-IN")} record${r.deleted === 1 ? "" : "s"}${extra ? ` and ${extra.toLocaleString("en-IN")} linked record${extra === 1 ? "" : "s"}` : ""}.${r.failed.length ? ` ${r.failed.length} could not be removed.` : ""}`);
      setDel(null);
      setPreview(null);
      setDetail(null);
      setSelected(new Set());
      setAllMatching(false);
      loadTables();
      load();
    } catch (e) {
      toast("error", errText(e, "Could not delete."));
    } finally {
      setDeleting(false);
    }
  }

  async function exportCsv() {
    if (!rows || isStorage) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (ordering) params.set("ordering", ordering);
      if (filtersJson !== "[]") params.set("filters", filtersJson);
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
  const canExport = !!rows && !isStorage;
  const anyFilter = filters.length > 0 || unused || !!q.trim();
  const tableName = rows?.name ?? "this table";

  return (
    <>
      <PageHeader
        icon="table"
        title="Data view"
        sub={SUB}
        actions={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { load(); loadTables(); }} disabled={loading}><Icon name="refresh" size={16} /> Refresh</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv} disabled={!canExport || exporting}><Icon name="download" size={16} /> {exporting ? "Preparing…" : "Export CSV"}</button>
          </>
        }
      />

      <div className="toolbar data-bar">
        <div className="field-inline"><label htmlFor="dvTable">Table</label>
          <Select id="dvTable" searchable value={active} onChange={(e) => pickTable(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        </div>
        <div className="search-box"><Icon name="search" size={18} /><input value={query} onChange={(e) => { setQuery(e.target.value); resetView(); }} placeholder="Search text in this table" aria-label="Search this table" style={{ minHeight: 46 }} /></div>
        <button type="button" className={`btn btn-sm ${builderOpen || filters.length ? "btn-primary" : "btn-outline"}`} onClick={() => setBuilderOpen((o) => !o)} aria-expanded={builderOpen}><Icon name="layers" size={16} /> Filters{filters.length ? ` (${filters.length})` : ""}</button>
      </div>

      <div className="dv-filterbar">
        {builderOpen && rows && (
          <div className="dv-builder">
            <div className="form-field"><label htmlFor="dvfCol">Column</label>
              <Select id="dvfCol" searchable value={bCol?.name ?? ""} onChange={(e) => { setBField(e.target.value); setBOp(""); setBValue(""); }}>{filterable.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}</Select>
            </div>
            <div className="form-field"><label htmlFor="dvfOp">Condition</label>
              <Select id="dvfOp" value={bOpEff ?? ""} onChange={(e) => setBOp(e.target.value)}>{bOps.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</Select>
            </div>
            {needsValue && (
              <div className="form-field"><label htmlFor="dvfVal">Value</label>
                {bType === "choice" ? (
                  <Select id="dvfVal" value={bValue || bCol?.choices?.[0]?.value || ""} onChange={(e) => setBValue(e.target.value)}>{(bCol?.choices ?? []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>
                ) : (
                  <input id="dvfVal" type={bType === "number" ? "number" : bType === "date" || bType === "datetime" ? "date" : "text"} step={bType === "number" ? "any" : undefined} inputMode={bType === "number" ? "decimal" : undefined} value={bValue} onChange={(e) => setBValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFromBuilder()} placeholder={bType === "id" ? "Paste an ID" : "Type a value"} />
                )}
              </div>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={addFromBuilder} disabled={!valueOk || filters.length >= 8}><Icon name="plus" size={16} /> Add filter</button>
          </div>
        )}
        {rows && (
          <div className="dv-quick">
            {dateCol && (<><span>Quick:</span>
              <button type="button" onClick={() => quickDays(7, "from")}>Last 7 days</button>
              <button type="button" onClick={() => quickDays(30, "from")}>Last 30 days</button>
              <button type="button" onClick={() => quickDays(365, "until")} title="Handy for cleaning up old data">Older than 1 year</button></>)}
            {isStorage && <button type="button" className={unused ? "on" : ""} onClick={() => { setUnused((u) => !u); resetView(); }} title="Files that no record points to any more — safe to clean up">Unused files only</button>}
          </div>
        )}
        {(filters.length > 0 || unused) && (
          <div className="dv-chips" aria-label="Active filters">
            {filters.map((f, i) => (<span className="dv-chip" key={`${f.field}-${f.op}-${i}`}><span>{filterText(f)}</span><button type="button" aria-label="Remove filter" onClick={() => { setFilters(filters.filter((_, j) => j !== i)); resetView(); }}><Icon name="x" size={12} /></button></span>))}
            {unused && <span className="dv-chip"><span>Unused files only</span><button type="button" aria-label="Remove filter" onClick={() => { setUnused(false); resetView(); }}><Icon name="x" size={12} /></button></span>}
            <button type="button" className="link-btn" onClick={() => { setFilters([]); setUnused(false); resetView(); }}>Clear all</button>
          </div>
        )}
      </div>

      {rows && (
        <div className="data-meta">
          <span><b>{rows.count.toLocaleString("en-IN")}</b> row{rows.count === 1 ? "" : "s"}{anyFilter ? " match" : ""} · {rows.columns.length} columns · table <code>{rows.db_table}</code></span>
          <span className="field-inline" style={{ gap: 6 }}>Rows per page
            <select aria-label="Rows per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); resetView(); }} style={{ minHeight: 32, padding: "2px 8px" }}>{[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </span>
        </div>
      )}

      {selectedCount > 0 && rows && (
        <div className="dv-selbar" role="status">
          <span>
            {allMatching ? <>All <b>{rows.count.toLocaleString("en-IN")}</b> matching rows are selected. </> : <><b>{selected.size}</b> selected. </>}
            {!allMatching && allOnPage && rows.count > pageIds.length && <button type="button" className="link-btn" onClick={() => setAllMatching(true)}>Select all {rows.count.toLocaleString("en-IN")} matching rows</button>}
            {" "}<button type="button" className="link-btn" onClick={() => { setSelected(new Set()); setAllMatching(false); }}>Clear</button>
          </span>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => openDelete(allMatching ? { scope: "filtered", ids: [], count: rows.count } : { scope: "ids", ids: [...selected], count: selected.size })}><Icon name="trash" size={16} /> Delete {selectedCount.toLocaleString("en-IN")}</button>
        </div>
      )}

      {rows === null ? <Skeleton rows={6} /> : rows.results.length === 0 ? (
        <EmptyState icon="inbox" title={anyFilter ? "Nothing matches" : "This table is empty"} text={anyFilter ? "Try removing a filter or a different search word." : "No records have been saved here yet."} />
      ) : (
        <div className="data-wrap" aria-busy={loading} style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="dv-sel"><input type="checkbox" className="dv-check" checked={allOnPage} onChange={togglePage} aria-label="Select all rows on this page" /></th>
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
              {rows.results.map((r, i) => {
                const id = rowId(r);
                const on = allMatching || selected.has(id);
                return (
                  <tr key={i} tabIndex={0} className={on ? "is-selected" : ""} onClick={() => setDetail(r)} onKeyDown={(e) => e.key === "Enter" && setDetail(r)}>
                    <td className="dv-sel" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="dv-check" checked={on} disabled={allMatching} onChange={() => toggleRow(id)} aria-label="Select this row" /></td>
                    {rows.columns.map((c) => {
                      const sh = show(c, r[c.name]);
                      return <td key={c.name} className={sh.cls} title={sh.text.length > 40 ? sh.text : undefined}>{sh.text}</td>;
                    })}
                  </tr>
                );
              })}
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

      <Modal open={detail !== null} title={rows?.name ? `${rows.name} — record` : "Record"} onClose={() => setDetail(null)} size="lg" footer={<><button type="button" className="btn btn-danger btn-sm" onClick={() => detail && openDelete({ scope: "ids", ids: [rowId(detail)], count: 1 })}><Icon name="trash" size={16} /> Delete this record</button><button type="button" className="btn btn-primary btn-sm" onClick={() => setDetail(null)}>Close</button></>}>
        {detail && rows && (
          <dl className="kv">
            {rows.columns.map((c) => {
              const sh = show(c, detail[c.name]);
              return <div key={c.name}><dt>{c.label}</dt><dd className={sh.cls}>{sh.text}</dd></div>;
            })}
          </dl>
        )}
      </Modal>

      <Modal
        open={del !== null}
        title={`Delete from ${tableName}`}
        onClose={closeDelete}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={closeDelete} disabled={deleting}>Cancel</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={confirmDelete} disabled={deleting || !preview || preview.count === 0 || !!preview.error || typed !== "DELETE"}>{deleting ? "Deleting…" : preview ? `Delete ${preview.count.toLocaleString("en-IN")} permanently` : "Delete"}</button>
          </>
        }
      >
        <div className="dv-del">
          {previewError && <p className="warn" role="alert">{previewError}</p>}
          {!preview && !previewError && <Skeleton rows={3} />}
          {preview && (
            <>
              <p className="big">{preview.count === 0 ? <>Nothing can be deleted from this selection.</> : <>You are about to permanently delete <b>{preview.count.toLocaleString("en-IN")}</b> {isStorage ? "file" : "record"}{preview.count === 1 ? "" : "s"} from <b>{tableName}</b>. <b>This cannot be undone.</b></>}</p>
              {preview.samples.length > 0 && <div><h4>Includes</h4><ul>{preview.samples.map((x) => <li key={x}><code>{x}</code></li>)}{preview.count > preview.samples.length && <li>…and {(preview.count - preview.samples.length).toLocaleString("en-IN")} more</li>}</ul></div>}
              {preview.also.length > 0 && <div className="warn">These linked records will ALSO be deleted: {preview.also.map((a) => `${a.count.toLocaleString("en-IN")} ${a.name}`).join(", ")}.</div>}
              {preview.files > 0 && !isStorage && <p className="soft">{preview.files.toLocaleString("en-IN")} uploaded file{preview.files === 1 ? "" : "s"} will also be removed from storage.</p>}
              {preview.error && <p className="warn" role="alert">{preview.error}</p>}
              {preview.blocked_count > 0 && (
                <div className="soft"><b>{preview.blocked_count.toLocaleString("en-IN")} will be kept</b> (protected):<ul>{preview.blocked.slice(0, 5).map((b) => <li key={b.id}><code>{b.label}</code> — {b.reason}</li>)}</ul></div>
              )}
              {preview.count > 0 && !preview.error && (
                <div className="form-field"><label htmlFor="dvConfirm">Type <b>DELETE</b> to confirm</label><input id="dvConfirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="DELETE" /></div>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
