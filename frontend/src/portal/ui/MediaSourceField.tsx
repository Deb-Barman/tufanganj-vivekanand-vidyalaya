import { useEffect, useMemo, useRef, useState } from "react";
import { linkSource } from "../../lib/mediaLinks";
import { Icon } from "./icons";
import { checkLink, emptyMedia, mediaChosen } from "./mediaHelpers";
import type { MediaValue } from "./mediaHelpers";
import "./media-source.css";

function LinkPreview({ url }: { url: string }) {
  const [state, setState] = useState<"loading" | "ok" | "broken">("loading");
  return (
    <div className="ms-preview">
      {/* referrerPolicy: some hosts refuse pictures when a page of another site shows them */}
      <img src={url} alt="Preview of the linked picture" referrerPolicy="no-referrer" onLoad={() => setState("ok")} onError={() => setState("broken")} style={{ display: state === "broken" ? "none" : "block" }} />
      {state === "loading" && <span className="ms-hint">Loading preview…</span>}
      {state === "broken" && <p className="ms-msg bad" role="alert">This link was accepted but the picture will not load. Check that its sharing is set to “Anyone with the link”, then paste it again.</p>}
    </div>
  );
}

export interface MediaSourceFieldProps {
  kind: "image" | "file";
  value: MediaValue;
  onChange: (v: MediaValue) => void;
  label: string;
  accept?: string;
  /** When editing: what is saved now, so the person knows leaving this empty keeps it. */
  current?: { url: string | null; source: "upload" | "link" | null };
  idPrefix?: string;
}

/** "Upload" or "Paste a link" — the link option keeps the school's free storage empty. */
export function MediaSourceField({ kind, value, onChange, label, accept, current, idPrefix = "ms" }: MediaSourceFieldProps) {
  const [mode, setMode] = useState<"upload" | "link">(value.link ? "link" : "upload");
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (value.file && kind === "image" ? URL.createObjectURL(value.file) : null), [value.file, kind]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const result = value.link.trim() ? checkLink(kind, value.link) : null;
  const switchTo = (m: "upload" | "link") => {
    setMode(m);
    onChange(emptyMedia);
  };
  const noun = kind === "image" ? "picture" : "file";

  return (
    <div className="ms form-field">
      <span className="ms-label" id={`${idPrefix}-label`}>{label}</span>
      <div className="ms-tabs" role="tablist" aria-labelledby={`${idPrefix}-label`}>
        <button type="button" role="tab" aria-selected={mode === "upload"} className={mode === "upload" ? "on" : ""} onClick={() => switchTo("upload")}>Upload</button>
        <button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? "on" : ""} onClick={() => switchTo("link")}>Paste a link</button>
      </div>

      {mode === "upload" ? (
        <div className="ms-body">
          <input ref={fileInput} id={`${idPrefix}-file`} type="file" accept={accept} onChange={(e) => onChange({ file: e.target.files?.[0] ?? null, link: "" })} aria-labelledby={`${idPrefix}-label`} />
          {preview && <div className="ms-preview"><img src={preview} alt="Selected picture" /></div>}
          <p className="ms-hint">Uploads use the school's storage space. To save space, use <button type="button" className="ms-link" onClick={() => switchTo("link")}>a link</button> instead.</p>
        </div>
      ) : (
        <div className="ms-body">
          <input id={`${idPrefix}-link`} type="url" inputMode="url" autoComplete="off" spellCheck={false} value={value.link} placeholder={kind === "image" ? "Paste a Google Drive / Imgur / picture link" : "Paste a Google Drive / Dropbox share link"} onChange={(e) => onChange({ file: null, link: e.target.value })} aria-labelledby={`${idPrefix}-label`} aria-invalid={result?.ok === false} />
          {result?.ok === false && <p className="ms-msg bad" role="alert">{result.error}</p>}
          {result?.ok && (
            <p className="ms-msg good"><Icon name="checkCircle" size={15} /> Link accepted · {linkSource(result.url)}{result.note ? ` — ${result.note}` : ""}</p>
          )}
          {result?.ok && kind === "image" && <LinkPreview key={result.url} url={result.url} />}
          {result?.ok && kind === "file" && <a className="ms-test" href={result.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={14} /> Test the link</a>}
        </div>
      )}

      {current?.url && !mediaChosen(value) && (
        <p className="ms-current">
          {kind === "image" && current.source && <img src={current.url} alt="" referrerPolicy="no-referrer" />}
          <span>Saved now: {current.source === "link" ? `a link (${linkSource(current.url)})` : `an uploaded ${noun}`}. Leave this empty to keep it.</span>
        </p>
      )}

      <details className="ms-help">
        <summary>How do I get a link?</summary>
        <ol>
          <li>Upload the {noun} to <b>Google Drive</b> (drive.google.com) from your phone or computer.</li>
          <li>Tap <b>⋮ → Share</b> → under General access choose <b>“Anyone with the link”</b>.</li>
          <li>Tap <b>Copy link</b> and paste it here.</li>
        </ol>
        <p>{kind === "image" ? "Imgur, Dropbox and direct picture addresses (ending in .jpg or .png) work too. " : "Dropbox and OneDrive share links work too. "}{kind === "image" && "Facebook, Instagram and X posts are web pages, not pictures: save the picture to Drive first (pictures copied straight from those sites can stop working later)."}</p>
      </details>
    </div>
  );
}
