import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { api } from "../../lib/api";
import type { ImportCatalog, ImportCommitResult, ImportKind, ImportPreview } from "../../types/api";
import { Icon } from "./icons";
import { Skeleton } from "./Skeletons";
import { errText } from "./kitHelpers";
import { SheetEditor } from "./SheetEditor";
import type { SheetProblems } from "./SheetEditor";
import { blankGrid, gridToCsv, isBlankRow, rowToIndex, trimGrid } from "./sheetHelpers";
import type { Grid } from "./sheetHelpers";
import "./bulk-import.css";

/* The catalog never changes while the app is open, so it is fetched once and shared. */
let catalogPromise: Promise<ImportCatalog> | null = null;
const loadCatalog = () => (catalogPromise ??= api.get<ImportCatalog>("/imports/").catch((e) => ((catalogPromise = null), Promise.reject(e))));

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** A spreadsheet opens "=cmd…" cells as formulas: prefix them so a name can never run as one. */
const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/* The typed sheet is kept for this browser tab only (sessionStorage), so a refresh or a dropped connection does not lose it. */
const draftKey = (kind: string) => `tvv-import-sheet:${kind}`;
function loadDraft(kind: string, cols: number): Grid | null {
  try {
    const raw = sessionStorage.getItem(draftKey(kind));
    const g = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(g) && g.length > 0 && g.every((r) => Array.isArray(r) && r.length === cols && r.every((c) => typeof c === "string"))) return g as Grid;
  } catch { /* storage blocked or corrupt: start fresh */ }
  return null;
}
function saveDraft(kind: string, grid: Grid) {
  try {
    if (grid.every(isBlankRow)) sessionStorage.removeItem(draftKey(kind));
    else sessionStorage.setItem(draftKey(kind), JSON.stringify(grid));
  } catch { /* ignore */ }
}

const MAX_BYTES = 2 * 1024 * 1024;
type Phase = "pick" | "checking" | "preview" | "saving" | "done";
type Filter = "all" | "problems" | "ready";
const PAGE = 150;

export interface BulkImportPanelProps {
  kind: string;
  /** Called after rows were saved, so the page behind the panel can refresh. */
  onDone?: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export default function BulkImportPanel({ kind, onDone, onBusyChange }: BulkImportPanelProps) {
  const [catalog, setCatalog] = useState<ImportCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [phase, setPhase] = useState<Phase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; rejected: number; credentials: ImportCommitResult["credentials"]; stoppedEarly: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /* "sheet" = type the rows here like in Excel (default); "file" = upload an .xlsx / .csv. `source` is how the checked data arrived. */
  const [mode, setMode] = useState<"sheet" | "file">("sheet");
  const [source, setSource] = useState<"sheet" | "file">("sheet");
  const [grid, setGrid] = useState<Grid>([]);
  const [problems, setProblems] = useState<SheetProblems>(new Map());

  useEffect(() => {
    let alive = true;
    loadCatalog().then((c) => alive && setCatalog(c), (e) => alive && setLoadError(errText(e, "Could not load the import options.")));
    return () => {
      alive = false;
    };
  }, []);

  const spec: ImportKind | undefined = catalog?.imports.find((i) => i.key === kind);
  const busy = phase === "checking" || phase === "saving";
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  const cols = spec?.columns.length ?? 0;
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (cols && grid.length === 0) setGrid(loadDraft(kind, cols) ?? blankGrid(cols));
  }, [cols, kind, grid.length]);
  useEffect(() => {
    if (!grid.length) return;
    const t = window.setTimeout(() => saveDraft(kind, grid), 400);
    return () => window.clearTimeout(t);
  }, [kind, grid]);

  const reset = useCallback(() => {
    setPhase("pick");
    setFile(null);
    setPreview(null);
    setError("");
    setResult(null);
    setFilter("all");
    setShown(PAGE);
    if (input.current) input.current.value = "";
  }, []);

  async function downloadSample(type: "csv" | "xlsx") {
    try {
      saveBlob(await api.download(`/imports/${kind}/sample/?type=${type}`), `tvv-${kind}-sample.${type}`);
    } catch (e) {
      setError(errText(e, "Could not download the sample file."));
    }
  }

  async function check(f: File, from: "sheet" | "file" = "file") {
    setError("");
    setSource(from);
    const name = f.name.toLowerCase();
    if (!/\.(xlsx|csv)$/.test(name)) return setError("Please choose an Excel (.xlsx) or CSV (.csv) file.");
    if (f.size > MAX_BYTES) return setError("That file is larger than 2 MB. Split it into smaller files.");
    setFile(f);
    setPhase("checking");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const p = await api.postForm<ImportPreview>(`/imports/${kind}/preview/`, fd);
      setPreview(p);
      if (from === "sheet") {
        const next: SheetProblems = new Map();
        for (const r of p.rows) if (!r.ok || r.warnings.length) next.set(rowToIndex(r.row), { errors: r.errors, warnings: r.warnings });
        setProblems(next);
      }
      setFilter(p.counts.invalid > 0 ? "problems" : "all");
      setShown(PAGE);
      setPhase("preview");
    } catch (e) {
      setError(errText(e, "The file could not be checked."));
      setPhase("pick");
    }
  }

  /** Turns the typed sheet into a CSV (in memory) and sends it through the same check as an uploaded file. */
  async function checkSheet() {
    if (!spec) return;
    const rows = trimGrid(grid, spec.columns.length, 0);
    if (rows.every(isBlankRow)) return setError("Type at least one row first.");
    if (rows.length > (catalog?.max_rows ?? 1000)) return setError(`The sheet has more than ${catalog?.max_rows ?? 1000} rows. Import them in smaller parts.`);
    const csv = gridToCsv(spec.columns.map((c) => c.label), rows);
    await check(new File([csv], "typed-data.csv", { type: "text/csv" }), "sheet");
  }

  /** Back from the check to the sheet, with the typed rows (and the messages on them) still there. */
  function backToSheet() {
    setPhase("pick");
    setPreview(null);
    setError("");
    setMode("sheet");
  }

  async function importNow() {
    if (!file || !preview) return;
    const rows = preview.rows.filter((r) => r.ok).map((r) => r.row);
    const size = Math.max(1, preview.chunk_size);
    const credentials: ImportCommitResult["credentials"] = [];
    let created = 0, updated = 0, skipped = 0, rejected = 0, stoppedEarly = "";
    const saved = new Set<number>();
    setPhase("saving");
    setProgress({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i += size) {
      const batch = rows.slice(i, i + size);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("rows", JSON.stringify(batch));
        const r = await api.postForm<ImportCommitResult>(`/imports/${kind}/commit/`, fd);
        created += r.created; updated += r.updated; skipped += r.skipped; rejected += r.rejected.length;
        const refused = new Set(r.rejected.map((x) => x.row));
        batch.forEach((n) => { if (!refused.has(n)) saved.add(n); });
        credentials.push(...r.credentials);
        setProgress({ done: Math.min(i + size, rows.length), total: rows.length });
      } catch (e) {
        stoppedEarly = errText(e, "The import stopped because of a network or server problem.");
        break;
      }
    }
    if (source === "sheet") {
      // Keep only what was NOT saved (rows with problems, or rows after a network stop) so the person can fix just those.
      const keep: Grid = [];
      const left: SheetProblems = new Map();
      grid.forEach((row, i) => {
        if (isBlankRow(row) || saved.has(i + 2)) return;
        const pr = problems.get(i);
        if (pr) left.set(keep.length, pr);
        keep.push(row);
      });
      setGrid(keep.length ? trimGrid(keep, cols) : blankGrid(cols));
      setProblems(left);
      if (!keep.length) saveDraft(kind, []);
    }
    setResult({ created, updated, skipped, rejected, credentials, stoppedEarly });
    setPhase("done");
    if (created + updated + skipped > 0) onDone?.();
  }

  function downloadCredentials() {
    if (!result) return;
    const lines = ["Full name,Username,Password", ...result.credentials.map((c) => [c.full_name, c.username, c.password].map(csvCell).join(","))];
    saveBlob(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `tvv-${kind}-new-passwords.csv`);
  }

  const visibleRows = useMemo(() => {
    const rows = preview?.rows ?? [];
    return rows.filter((r) => (filter === "all" ? true : filter === "problems" ? !r.ok : r.ok));
  }, [preview, filter]);

  if (loadError) return <p className="bi-error" role="alert">{loadError}</p>;
  if (!spec) return <Skeleton rows={3} />;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void check(f);
  };

  /* ───────── step 1: sample + choose file ───────── */
  if (phase === "pick" || phase === "checking")
    return (
      <div className="bi">
        <p className="bi-lead">{spec.description}</p>
        <div className="bi-filter bi-mode" role="tablist" aria-label="How do you want to add the data?">
          <button type="button" role="tab" aria-selected={mode === "sheet"} className={mode === "sheet" ? "on" : ""} onClick={() => setMode("sheet")}>Type in a sheet</button>
          <button type="button" role="tab" aria-selected={mode === "file"} className={mode === "file" ? "on" : ""} onClick={() => setMode("file")}>Upload a file</button>
        </div>

        {mode === "sheet" && (
          <>
            <SheetEditor columns={spec.columns} example={spec.example[0]} grid={grid} setGrid={setGrid} problems={problems} setProblems={setProblems} maxRows={catalog?.max_rows ?? 1000} disabled={phase === "checking"} onCheck={() => void checkSheet()} />
            <details className="bi-cols">
              <summary>What goes in each column?</summary>
              <div className="bi-scroll">
                <table className="bi-table">
                  <thead><tr><th>Column</th><th>Needed?</th><th>What to type</th></tr></thead>
                  <tbody>
                    {spec.columns.map((c) => (
                      <tr key={c.key}><td><b>{c.label}</b></td><td>{c.required ? <span className="bi-pill bi-req">Required</span> : <span className="bi-pill">Optional</span>}</td><td>{c.help || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="bi-notes">{spec.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </details>
            <p className="bi-safe"><Icon name="shield" size={15} /> Nothing is saved yet. You will see every row checked first.</p>
            {phase === "checking" && <p className="bi-note" aria-live="polite">Checking your rows…</p>}
          </>
        )}

        {mode === "file" && (<>
        <section className="bi-step">
          <h4><span>1</span> Get the sample file</h4>
          <p>Fill the sample the same way (same columns), then save it as Excel or CSV. Rows in the sample are only examples — delete them.</p>
          <div className="bi-row">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadSample("xlsx")}><Icon name="download" size={16} /> Excel sample (.xlsx)</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadSample("csv")}><Icon name="download" size={16} /> CSV sample (.csv)</button>
          </div>
          <details className="bi-cols">
            <summary>What goes in each column?</summary>
            <div className="bi-scroll">
              <table className="bi-table">
                <thead><tr><th>Column</th><th>Needed?</th><th>What to type</th></tr></thead>
                <tbody>
                  {spec.columns.map((c) => (
                    <tr key={c.key}><td><b>{c.label}</b></td><td>{c.required ? <span className="bi-pill bi-req">Required</span> : <span className="bi-pill">Optional</span>}</td><td>{c.help || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="bi-notes">{spec.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </details>
        </section>

        <section className="bi-step">
          <h4><span>2</span> Upload your file</h4>
          <div
            className={`bi-drop${drag ? " is-over" : ""}${phase === "checking" ? " is-busy" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
          >
            <Icon name="file" size={28} />
            {phase === "checking" ? (
              <strong>Checking {file?.name}…</strong>
            ) : (
              <>
                <strong>Drop your file here</strong>
                <span>or</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => input.current?.click()}>Choose file</button>
                <small>Excel (.xlsx) or CSV · up to {catalog?.max_rows ?? 1000} rows · max {catalog?.max_mb ?? 2} MB</small>
              </>
            )}
            <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void check(f); }} />
          </div>
          <p className="bi-safe"><Icon name="shield" size={15} /> Nothing is saved yet. You will see every row checked first.</p>
        </section>
        </>)}
        {error && <p className="bi-error" role="alert">{error}</p>}
      </div>
    );

  /* ───────── step 3: verify ───────── */
  if (phase === "preview" && preview) {
    const c = preview.counts;
    const blocked = preview.file_errors.length > 0;
    const cols = preview.columns;
    return (
      <div className="bi">
        <div className="bi-file"><Icon name="file" size={18} /> <b>{source === "sheet" ? "Your typed sheet" : preview.file_name}</b> {source === "sheet" ? <button type="button" className="link-btn" onClick={backToSheet}>← Back to the sheet</button> : <button type="button" className="link-btn" onClick={reset}>Choose another file</button>}</div>
        {blocked && (
          <div className="bi-error" role="alert"><b>This file cannot be imported yet:</b><ul>{preview.file_errors.map((m) => <li key={m}>{m}</li>)}</ul>
            {source === "sheet" ? <button type="button" className="btn btn-outline btn-sm" onClick={backToSheet}>← Back to the sheet</button> : <button type="button" className="btn btn-outline btn-sm" onClick={() => void downloadSample("xlsx")}><Icon name="download" size={16} /> Download the sample</button>}
          </div>
        )}
        {preview.unknown_columns.length > 0 && <p className="bi-note">Ignored columns (not recognised): {preview.unknown_columns.join(", ")}</p>}
        {!blocked && (
          <>
            <h4 className="bi-h">Check the data before you confirm</h4>
            <div className="bi-stats">
              <div><b>{preview.total}</b><span>rows in file</span></div>
              <div className="ok"><b>{c.valid}</b><span>ready to import</span></div>
              <div className={c.invalid ? "bad" : ""}><b>{c.invalid}</b><span>with problems</span></div>
              {c.create > 0 && <div><b>{c.create}</b><span>new</span></div>}
              {c.update > 0 && <div><b>{c.update}</b><span>will be updated</span></div>}
              {c.skip > 0 && <div><b>{c.skip}</b><span>already there (skipped)</span></div>}
            </div>
            <div className="bi-filter" role="tablist" aria-label="Show rows">
              {(["all", "problems", "ready"] as Filter[]).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? "on" : ""} onClick={() => { setFilter(f); setShown(PAGE); }}>
                  {f === "all" ? `All (${preview.total})` : f === "problems" ? `Problems (${c.invalid})` : `Ready (${c.valid})`}
                </button>
              ))}
            </div>
            <div className="bi-scroll">
              <table className="bi-table bi-data">
                <thead><tr><th>Row</th><th>Result</th><th>Notes</th>{cols.map((x) => <th key={x.key}>{x.label}</th>)}</tr></thead>
                <tbody>
                  {visibleRows.slice(0, shown).map((r) => (
                    <tr key={r.row} className={r.ok ? "" : "bad"}>
                      <td>{r.row}</td>
                      <td>{r.ok ? <span className={`bi-pill ${r.action === "create" ? "bi-new" : r.action === "update" ? "bi-upd" : "bi-skip"}`}>{r.action === "create" ? "New" : r.action === "update" ? "Update" : "Skip"}</span> : <span className="bi-pill bi-bad">Problem</span>}</td>
                      <td className="bi-msg">{r.errors.map((m) => <span key={m} className="e">{m}</span>)}{r.warnings.map((m) => <span key={m} className="w">{m}</span>)}{r.ok && r.warnings.length === 0 && <span className="ok">Looks good</span>}</td>
                      {cols.map((x) => <td key={x.key}>{r.display[x.key] ?? ""}</td>)}
                    </tr>
                  ))}
                  {visibleRows.length === 0 && <tr><td colSpan={cols.length + 3} className="bi-empty">Nothing to show here.</td></tr>}
                </tbody>
              </table>
            </div>
            {visibleRows.length > shown && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, visibleRows.length - shown)} more</button>}
            {c.invalid > 0 && <p className="bi-note">Rows with problems will <b>not</b> be imported. {source === "sheet" ? <>Go back to the sheet — the problem rows are marked in red with what to fix — or import the ready rows now and fix the rest afterwards.</> : <>Fix them in your file and upload again, or import the ready rows now and add the rest later.</>}</p>}
            <div className="bi-actions">
              {source === "sheet" ? <button type="button" className="btn btn-ghost btn-sm" onClick={backToSheet}>{c.invalid > 0 ? "← Fix rows in the sheet" : "← Back to the sheet"}</button> : <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>}
              <button type="button" className="btn btn-primary" disabled={c.valid === 0} onClick={() => void importNow()}>
                <Icon name="check" size={16} /> {c.invalid > 0 ? `Import ${c.valid} ready row${c.valid === 1 ? "" : "s"}` : `Confirm & import ${c.valid} row${c.valid === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
        {error && <p className="bi-error" role="alert">{error}</p>}
      </div>
    );
  }

  /* ───────── saving ───────── */
  if (phase === "saving") {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="bi bi-center" aria-live="polite">
        <strong>Importing… {progress.done} of {progress.total}</strong>
        <div className="pct-bar" style={{ width: "min(360px, 100%)" }}><i style={{ width: `${pct}%` }} /></div>
        <small>Please keep this window open. Creating accounts takes a few seconds per batch.</small>
      </div>
    );
  }

  /* ───────── done ───────── */
  return (
    <div className="bi">
      <div className={`bi-done${result?.stoppedEarly ? " warn" : ""}`}>
        <Icon name={result?.stoppedEarly ? "alert" : "checkCircle"} size={30} />
        <strong>{result?.stoppedEarly ? "Import stopped part-way" : "Import finished"}</strong>
        <div className="bi-stats">
          {!!result?.created && <div className="ok"><b>{result.created}</b><span>added</span></div>}
          {!!result?.updated && <div><b>{result.updated}</b><span>updated</span></div>}
          {!!result?.skipped && <div><b>{result.skipped}</b><span>already there</span></div>}
          {!!result?.rejected && <div className="bad"><b>{result.rejected}</b><span>not saved</span></div>}
        </div>
        {result?.stoppedEarly && <p className="bi-error" role="alert">{result.stoppedEarly} Rows saved before this are kept. Upload the same file again — saved rows will show as “already exists”, so nothing is duplicated.</p>}
      </div>
      {!!result?.credentials.length && (
        <div className="bi-creds">
          <b>New passwords were generated for {result.credentials.length} account{result.credentials.length === 1 ? "" : "s"}.</b>
          <p>Download the list now and hand it out. For safety it is <u>not stored anywhere</u> and cannot be shown again (you can still set a new password for anyone from the Accounts page).</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={downloadCredentials}><Icon name="download" size={16} /> Download passwords (CSV)</button>
        </div>
      )}
      <div className="bi-actions">
        {source === "sheet" ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { reset(); setMode("sheet"); }}>{grid.some((r) => !isBlankRow(r)) ? `Fix the ${grid.filter((r) => !isBlankRow(r)).length} row${grid.filter((r) => !isBlankRow(r)).length === 1 ? "" : "s"} that were not saved` : "Add more"}</button>
        ) : (
          <button type="button" className="btn btn-outline btn-sm" onClick={reset}>Import another file</button>
        )}
      </div>
    </div>
  );
}
