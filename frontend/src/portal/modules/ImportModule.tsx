import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { ImportCatalog } from "../../types/api";
import { Icon, PageHeader, Skeleton, errText } from "../ui/kitExports";
import { lazy, Suspense } from "react";
import "../ui/bulk-import.css";

const BulkImportPanel = lazy(() => import("../ui/BulkImportPanel"));

/** Super Admin → "Bulk import": one page to import anything from Excel / CSV (the same wizard is also on each page). */
export function ImportModule() {
  const [catalog, setCatalog] = useState<ImportCatalog | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<ImportCatalog>("/imports/").then((c) => alive && setCatalog(c), (e) => alive && setError(errText(e, "Could not load the import options.")));
    return () => {
      alive = false;
    };
  }, []);

  const current = catalog?.imports.find((i) => i.key === kind);
  return (
    <>
      <PageHeader icon="file" title="Bulk import" sub="Choose what to import, then type the rows in a sheet right here (or paste them from Excel / Google Sheets). Every row is checked before anything is saved. You can still upload an Excel or CSV file instead." />
      {error && <p className="bi-error" role="alert">{error}</p>}
      {!catalog && !error && <Skeleton rows={4} />}
      {catalog && !current && (
        <div className="bi-kinds">
          {catalog.imports.map((i) => (
            <button key={i.key} type="button" className="bi-kind" onClick={() => setKind(i.key)}>
              <b>{i.title}</b>
              <span>{i.description}</span>
            </button>
          ))}
        </div>
      )}
      {current && (
        <section className="panel">
          <div className="panel-title">
            <h3>{current.title}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKind(null)}><Icon name="chevronLeft" size={16} /> All imports</button>
          </div>
          <Suspense fallback={<Skeleton rows={3} />}>
            <BulkImportPanel key={current.key} kind={current.key} />
          </Suspense>
        </section>
      )}
    </>
  );
}
