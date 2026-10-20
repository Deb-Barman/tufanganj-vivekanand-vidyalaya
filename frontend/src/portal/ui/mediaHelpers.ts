import { normalizeFileLink, normalizeImageLink } from "../../lib/mediaLinks";

export interface MediaValue {
  file: File | null;
  /** What the person pasted (checked live; the server re-checks it). */
  link: string;
}
export const emptyMedia: MediaValue = { file: null, link: "" };

/** Add the chosen picture/file to a FormData: the upload OR the pasted link (never both). */
export function appendMedia(fd: FormData, v: MediaValue, uploadName: string, linkName: string) {
  if (v.file) fd.append(uploadName, v.file);
  else if (v.link.trim()) fd.append(linkName, v.link.trim());
}
export const mediaChosen = (v: MediaValue) => !!v.file || !!v.link.trim();

export function checkLink(kind: "image" | "file", link: string) {
  return kind === "image" ? normalizeImageLink(link) : normalizeFileLink(link);
}
/** True when something is typed in the link box but it is not an acceptable link (disable Save). */
export const mediaInvalid = (kind: "image" | "file", v: MediaValue) => !!v.link.trim() && !checkLink(kind, v.link).ok;

