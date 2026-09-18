Upload the real school logo here as either:

  school_logo.png
  school_logo.jpg

Either filename works — src/components/SchoolLogo.tsx tries .png first,
then .jpg, then falls back to a placeholder crest if neither is present.

If you use school_logo.jpg instead of .png, also update the favicon link
in index.html (it currently points to /school_logo.png specifically,
since a plain HTML <link> tag can't do the same try-both fallback the
React component does).

Recommended: a square image, ideally 512x512px or larger, transparent or
white background works best since the header renders it inside a circle.

Delete this file once the real logo is in place.
