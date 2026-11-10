/** Pure helpers for the in-browser import sheet (no React): parsing pasted cells and turning the grid into a CSV file. */

export type Grid = string[][];

export const START_ROWS = 8;
export const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");

export const blankRow = (cols: number): string[] => Array.from({ length: cols }, () => "");
export const blankGrid = (cols: number, rows = START_ROWS): Grid => Array.from({ length: rows }, () => blankRow(cols));
export const isBlankRow = (r: string[]) => r.every((c) => !c.trim());

/** Excel / Google Sheets copy cells as tab-separated text; CSV text is accepted too. Quotes around a cell are removed. */
export function parsePasted(text: string): string[][] {
  const src = text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  if (!src.trim()) return [];
  const firstLine = src.split("\n", 1)[0];
  const delim = firstLine.includes("\t") ? "\t" : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  while (rows.length && rows[rows.length - 1].every((c) => !c.trim())) rows.pop(); // a trailing newline
  return rows.map((r) => r.map((c) => c.replace(/\u00a0/g, " ").trim()));
}

/** If the pasted block starts with the column names, drop that line (people copy the header along with the data). */
export function dropHeaderLine(rows: string[][], labels: string[]): string[][] {
  if (!rows.length) return rows;
  const want = new Set(labels.map(norm));
  const filled = rows[0].filter((c) => c.trim());
  const hits = filled.filter((c) => want.has(norm(c))).length;
  // Most of the filled cells in the first line are column names (it may cover only some of the columns).
  return hits >= 1 && hits >= Math.ceil(filled.length * 0.6) && (hits >= 2 || filled.length === 1) ? rows.slice(1) : rows;
}

// Note: no "formula guard" here. This CSV is read by the server (never opened in Excel), and a leading apostrophe
// would end up inside names and phone numbers such as +91….
const q = (v: string) => `"${v.replace(/"/g, '""')}"`;

/**
 * The grid as CSV text: line 1 = the column labels, then ONE line per grid row — blank rows included, so that
 * "row N" in the server's check is always "row N-1 of the sheet" and errors can be shown on the right line.
 */
export function gridToCsv(labels: string[], grid: Grid): string {
  const lines = [labels.map(q).join(",")];
  for (const r of grid) lines.push(r.map((c) => q(c.trim())).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

/** Server row number (sheet row, header = 1) → index in the grid. */
export const rowToIndex = (row: number) => row - 2;

/** Place pasted cells into the grid starting at (r, c). Grows the grid (up to `maxRows`) and ignores extra columns. */
export function pasteInto(grid: Grid, r: number, c: number, cells: string[][], cols: number, maxRows: number): { grid: Grid; added: number; cut: boolean } {
  const next = grid.map((row) => row.slice());
  let cut = false;
  cells.forEach((line, i) => {
    const at = r + i;
    if (at >= maxRows) { cut = true; return; }
    while (next.length <= at) next.push(blankRow(cols));
    line.forEach((value, j) => {
      if (c + j < cols) next[at][c + j] = value;
    });
  });
  return { grid: next, added: cells.length, cut };
}

/** Remove trailing blank rows but always keep a few empty ones to type into. */
export function trimGrid(grid: Grid, cols: number, keep = START_ROWS): Grid {
  let end = grid.length;
  while (end > 0 && isBlankRow(grid[end - 1])) end--;
  const out = grid.slice(0, end);
  while (out.length < keep) out.push(blankRow(cols));
  return out;
}
