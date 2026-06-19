/**
 * Trigger a browser file download from a Blob payload.
 *
 * Creates an object URL from the blob, attaches an anchor to the document
 * with the provided filename, programmatically clicks it, and revokes the
 * URL after the click. Standard pattern for streaming binary downloads
 * (here: PDF / Excel report exports from `/reports/export`).
 *
 * NOTE: the anchor is appended/removed in a try/finally so a stuck DOM
 * append never leaks a temporary element across downloads if the user
 * dismisses the browser's confirmation dialog.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }
}
