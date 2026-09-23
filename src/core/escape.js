const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text for HTML/SVG element content and quoted attributes of either quote style. */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
