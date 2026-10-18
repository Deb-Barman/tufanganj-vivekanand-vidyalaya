import { lazy, Suspense, useState } from "react";
import { Icon } from "./icons";
import { Modal } from "./kit";
import { Skeleton } from "./Skeletons";

// The import screen is only downloaded when someone opens it.
const BulkImportPanel = lazy(() => import("./BulkImportPanel"));

/** "Import from Excel/CSV" button for a page header: opens the import wizard for one kind of data in a popup. */
export function ImportButton({ kind, onDone, label = "Import Excel / CSV" }: { kind: string; onDone?: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
        <Icon name="file" size={16} /> {label}
      </button>
      <Modal open={open} title="Import from Excel / CSV" size="lg" onClose={() => !busy && setOpen(false)}>
        <Suspense fallback={<Skeleton rows={3} />}>
          <BulkImportPanel kind={kind} onDone={onDone} onBusyChange={setBusy} />
        </Suspense>
      </Modal>
    </>
  );
}
