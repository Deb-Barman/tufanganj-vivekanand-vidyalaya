import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])/g;

/** Plain text where web addresses (http/https only) become tappable links. Never uses innerHTML, so it is safe for any text. */
export function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
