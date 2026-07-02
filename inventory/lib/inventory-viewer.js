// inventory-viewer.js — lean read-only viewer over the committed items.json
// read-model (git is the database; this file renders it, never writes).
// ES module: the pure helpers below are imported by proofs/viewer.unit.test.ts;
// DOM wiring runs only in a browser. CSP-clean: no inline JS, no eval, no
// off-origin fetch (connect-src 'self').

export const REPO_BLOB_BASE = "https://github.com/Lucent-Financial-Group/Zeta/blob/main/";

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function matchesQuery(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [item.name, item.brand, item.model_pn, item.serial, item.location, item.category, item.assignment_purpose, item.assigned_machine, item.notes]
    .some((f) => String(f ?? "").toLowerCase().includes(q));
}

export function filterItems(items, query, status) {
  return items.filter((i) => matchesQuery(i, query) && (!status || i.status === status));
}

// Ordinal comparison (codepoint order) — culture-invariant by default.
export function compareItems(a, b, key, dir) {
  const av = a[key] ?? "";
  const bv = b[key] ?? "";
  const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
  return dir === "desc" ? -cmp : cmp;
}

export function totals(items) {
  const value = items.reduce((s, i) => s + (Number(i.value_usd) || 0) * (Number(i.qty) || 0), 0);
  return { count: items.length, value: Math.round(value * 100) / 100 };
}

export function rowHtml(item) {
  const sample = item.sample ? ' <span class="badge badge-warning">sample</span>' : "";
  const name = `<a href="${REPO_BLOB_BASE}${escapeHtml(item.file)}">${escapeHtml(item.name)}</a>${sample}`;
  const value = `$${(Number(item.value_usd) || 0).toLocaleString("en-US")}`;
  return `<tr><td>${name}</td><td>${escapeHtml(item.brand)}</td><td>${escapeHtml(item.device_type)}</td><td><span class="badge status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.location)}</td><td>${item.qty}</td><td>${value}</td></tr>`;
}

function render(state) {
  const body = document.getElementById("items-body");
  const note = document.getElementById("empty-note");
  const badge = document.getElementById("totals-badge");
  const visible = filterItems(state.items, state.query, state.status).sort((a, b) => compareItems(a, b, state.sortKey, state.sortDir));
  body.innerHTML = visible.map(rowHtml).join("");
  note.hidden = visible.length > 0;
  const t = totals(visible);
  badge.textContent = `${t.count} items · $${t.value.toLocaleString("en-US")}`;
}

async function main() {
  const state = { items: [], query: "", status: "", sortKey: "name", sortDir: "asc" };
  const res = await fetch("items.json");
  const payload = await res.json();
  state.items = payload.items ?? [];
  document.getElementById("search").addEventListener("input", (e) => { state.query = e.target.value; render(state); });
  document.getElementById("status-filter").addEventListener("change", (e) => { state.status = e.target.value; render(state); });
  for (const th of document.querySelectorAll("th[data-sort]")) {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      state.sortDir = state.sortKey === key && state.sortDir === "asc" ? "desc" : "asc";
      state.sortKey = key;
      render(state);
    });
  }
  render(state);
}

if (typeof document !== "undefined" && document.getElementById && document.getElementById("items-table")) {
  main().catch((e) => {
    const badge = document.getElementById("totals-badge");
    if (badge) badge.textContent = `failed to load items.json: ${e.message}`;
  });
}
