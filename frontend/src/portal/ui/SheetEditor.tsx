import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, Dispatch, KeyboardEvent, SetStateAction } from "react";
import type { ImportColumn } from "../../types/api";
import { Icon } from "./icons";
import { useUI } from "./kitHelpers";
import { blankRow, dropHeaderLine, isBlankRow, parsePasted, pasteInto } from "./sheetHelpers";
import type { Grid } from "./sheetHelpers";
import "./bulk-sheet.css";

export type SheetProblems = Map<number, { errors: string[]; warnings: string[] }>;

interface RowProps {
  idx: number;
  cells: string[];
  columns: ImportColumn[];
  placeholders: string[] | null;
  problem: { errors: string[]; warnings: string[] } | undefined;
  onCell: (r: number, c: number, v: string) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>, r: number, c: number) => void;
  onKey: (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => void;
  onRemove: (r: number) => void;
}

/** One sheet line. Memoised: typing in a row only re-renders that row, so a 500-row sheet stays fast on a phone. */
const SheetRow = memo(function SheetRow({ idx, cells, columns, placeholders, problem, onCell, onPaste, onKey, onRemove }: RowProps) {
  const bad = !!problem?.errors.length;
  return (
    <>
      <tr className={bad ? "bad" : problem?.warnings.length ? "warn" : ""}>
        <th scope="row" className="sh-n">{idx + 1}</th>
        {columns.map((col, c) => (
          <td key={col.key}>
            <input
              value={cells[c] ?? ""}
              data-r={idx}
              data-c={c}
              placeholder={placeholders?.[c] ?? ""}
              aria-label={`${col.label}, row ${idx + 1}`}
              aria-invalid={bad || undefined}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="next"
              onChange={(e) => onCell(idx, c, e.target.value)}
              onPaste={(e) => onPaste(e, idx, c)}
              onKeyDown={(e) => onKey(e, idx, c)}
            />
          </td>
        ))}
        <td className="sh-x"><button type="button" className="icon-btn" onClick={() => onRemove(idx)} aria-label={`Remove row ${idx + 1}`}><Icon name="x" size={15} /></button></td>
      </tr>
      {problem && (
        <tr className="sh-msg">
          <td colSpan={columns.length + 2}>
            {problem.errors.map((m) => <span key={m} className="e">{m}</span>)}
            {problem.warnings.map((m) => <span key={m} className="w">{m}</span>)}
          </td>
        </tr>
      )}
    </>
  );
});

export interface SheetEditorProps {
  columns: ImportColumn[];
  example?: Record<string, string>;
  grid: Grid;
  setGrid: Dispatch<SetStateAction<Grid>>;
  problems: SheetProblems;
  setProblems: Dispatch<SetStateAction<SheetProblems>>;
  maxRows: number;
  disabled?: boolean;
  onCheck: () => void;
}

/** A small spreadsheet inside the page: type or paste rows, then "Check data". Replaces download → edit in Excel → upload. */
export function SheetEditor({ columns, example, grid, setGrid, problems, setProblems, maxRows, disabled, onCheck }: SheetEditorProps) {
  const { confirm } = useUI();
  const box = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const [pasteText, setPasteText] = useState("");
  const cols = columns.length;
  const labels = useMemo(() => columns.map((c) => c.label), [columns]);
  const placeholders = useMemo(() => (example ? columns.map((c) => example[c.key] ?? "") : null), [example, columns]);
  const filled = useMemo(() => grid.filter((r) => !isBlankRow(r)).length, [grid]);

  const untouch = useCallback((r: number) => setProblems((p) => (p.has(r) ? new Map([...p].filter(([k]) => k !== r)) : p)), [setProblems]);

  const onCell = useCallback((r: number, c: number, v: string) => {
    setGrid((g) => {
      const next = g.slice();
      next[r] = next[r].slice();
      next[r][c] = v;
      return next;
    });
    untouch(r);
  }, [setGrid, untouch]);

  const focusCell = (r: number, c: number) => requestAnimationFrame(() => box.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`)?.focus());

  const onKey = useCallback((e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const down = e.key === "Enter" || e.key === "ArrowDown";
    if (!down && e.key !== "ArrowUp") return;
    e.preventDefault();
    const to = down ? r + 1 : r - 1;
    if (to < 0) return;
    setGrid((g) => (to >= g.length && g.length < maxRows ? [...g, blankRow(cols)] : g));
    focusCell(to, c);
  }, [setGrid, maxRows, cols]);

  const onPaste = useCallback((e: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return; // a single value: let the browser paste it normally
    e.preventDefault();
    const rows = r === 0 && c === 0 ? dropHeaderLine(parsePasted(text), labels) : parsePasted(text);
    setGrid((g) => {
      const res = pasteInto(g, r, c, rows, cols, maxRows);
      setNote(res.cut ? `Pasted ${rows.length} rows — only the first ${maxRows} fit in one import.` : `Pasted ${rows.length} row${rows.length === 1 ? "" : "s"}.`);
      return res.grid;
    });
    setProblems(new Map());
  }, [labels, cols, maxRows, setGrid, setProblems]);

  const onRemove = useCallback((r: number) => {
    setGrid((g) => (g.length <= 1 ? [blankRow(cols)] : g.filter((_, i) => i !== r)));
    setProblems(new Map()); // the row numbers moved
  }, [setGrid, setProblems, cols]);

  function addRows(n: number) {
    setGrid((g) => [...g, ...Array.from({ length: Math.min(n, Math.max(0, maxRows - g.length)) }, () => blankRow(cols))]);
  }

  function addFromBox() {
    const rows = dropHeaderLine(parsePasted(pasteText), labels);
    if (!rows.length) { setNote("Nothing to add — paste the copied cells first."); return; }
    setGrid((g) => {
      let at = g.length;
      while (at > 0 && isBlankRow(g[at - 1])) at--;
      const res = pasteInto(g, at, 0, rows, cols, maxRows);
      setNote(res.cut ? `Added ${rows.length} rows — only the first ${maxRows} fit in one import.` : `Added ${rows.length} row${rows.length === 1 ? "" : "s"}.`);
      return res.grid;
    });
    setProblems(new Map());
    setPasteText("");
  }

  async function clearAll() {
    if (filled > 0 && !(await confirm({ title: "Clear the whole sheet?", message: `${filled} typed row${filled === 1 ? "" : "s"} will be removed.`, confirmLabel: "Clear", danger: true }))) return;
    setGrid(Array.from({ length: 8 }, () => blankRow(cols)));
    setProblems(new Map());
    setNote("");
  }

  const fillExample = () => {
    if (!example) return;
    setGrid((g) => {
      const next = g.slice();
      let at = next.findIndex(isBlankRow);
      if (at < 0) { next.push(blankRow(cols)); at = next.length - 1; }
      next[at] = columns.map((c) => example[c.key] ?? "");
      return next;
    });
  };

  const problemRows = problems.size;
  return (
    <div className="sh" ref={box}>
      <p className="bi-lead">Type each row like in Excel — one person or record per line. You can also copy cells from Excel or Google Sheets and paste them into the first cell. <b>Columns marked ✱ are required.</b> Nothing is saved until you check the data and confirm.</p>
      <div className="sh-bar">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => addRows(5)} disabled={grid.length >= maxRows}><Icon name="plus" size={15} /> Add 5 rows</button>
        {example && <button type="button" className="btn btn-ghost btn-sm" onClick={fillExample}>Insert an example row</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void clearAll()} disabled={filled === 0}>Clear sheet</button>
        <span className="sh-count" aria-live="polite">{filled} row{filled === 1 ? "" : "s"} filled{problemRows ? ` · ${problemRows} need fixing` : ""}</span>
      </div>

      <div className="sh-scroll">
        <table className="sh-table">
          <thead>
            <tr>
              <th className="sh-n" scope="col">#</th>
              {columns.map((c) => <th key={c.key} scope="col" title={c.help || c.label}>{c.label}{c.required && <b className="sh-req" aria-label="required"> ✱</b>}</th>)}
              <th className="sh-x" scope="col"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {grid.map((cells, i) => (
              <SheetRow key={i} idx={i} cells={cells} columns={columns} placeholders={i === 0 ? placeholders : null} problem={problems.get(i)} onCell={onCell} onPaste={onPaste} onKey={onKey} onRemove={onRemove} />
            ))}
          </tbody>
        </table>
      </div>

      <details className="sh-paste">
        <summary>Paste a whole table (best on a phone)</summary>
        <p>Copy the cells in Excel or Google Sheets, in the same column order as above, paste them here and tap “Add to sheet”. A first line with the column names is skipped automatically.</p>
        <textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste copied cells here…" aria-label="Paste copied cells" />
        <button type="button" className="btn btn-outline btn-sm" onClick={addFromBox} disabled={!pasteText.trim()}>Add to sheet</button>
      </details>
      {note && <p className="bi-note" role="status">{note}</p>}

      <div className="bi-actions">
        <button type="button" className="btn btn-primary" disabled={disabled || filled === 0} onClick={onCheck}><Icon name="checkCircle" size={16} /> Check {filled || ""} row{filled === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}
