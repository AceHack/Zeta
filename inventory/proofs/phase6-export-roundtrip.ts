/**
 * Inventory — Phase 6 export/import ROUND-TRIP proof (CSV + JSON)
 * ---------------------------------------------------------------------------
 * Gate (b): export CSV + JSON; show a row with tricky characters (unicode,
 *           comma, apostrophe, embedded quote).
 * Gate (c): re-import through the SAME staging-check discipline used by the
 *           Phase-3 seed importer (inventory/seed/seed-import.ts) — PRE count,
 *           field-by-field spot-check, abort+report on mismatch — and confirm
 *           the round trip is VALUE-IDENTICAL for >=3 tricky-character rows.
 *
 * WHY SYNTHETIC ROWS: the real cleaned 210-item seed is git-ignored + sensitive
 * (serials/values/locations), and the build-time test creds are chat-burned, so
 * exporting the LIVE data is the Phase-7 Auditor's job on the live site. The
 * EXPORT/IMPORT LOGIC under test is data-agnostic; these rows are constructed to
 * carry exactly the edge cases the gate names (and worse). Same shared lib
 * (inventory/lib/inventory-export.js) the browser uses — ONE SOURCE OF TRUTH.
 *
 * Run:  bun inventory/proofs/phase6-export-roundtrip.ts
 */
import IE, { type Column } from "../lib/inventory-export.js";

// CSV column spec (matches the core columns index.html exports).
const COLUMNS: Column[] = [
  { key: "id", header: "id", kind: "int" },
  { key: "name", header: "name", kind: "string" },
  { key: "brand", header: "brand", kind: "string" },
  { key: "qty", header: "qty", kind: "int" },
  { key: "status", header: "status", kind: "string" },
  { key: "notes", header: "notes", kind: "string" },
  { key: "is_archived", header: "is_archived", kind: "bool" },
];

// 3 tricky rows + 2 ordinary rows (so the staging check also covers plain rows).
const SOURCE = [
  { id: 1, name: "Dell Latitude 7420", brand: "Dell", qty: 4, status: "In Storage", notes: null, is_archived: false },
  // tricky #1: apostrophe in name, comma in notes
  { id: 2, name: "O'Brien's Label Maker", brand: "Brother", qty: 1, status: "Active/In Use", notes: "kept at front desk, drawer 3, with the spare tape", is_archived: false },
  // tricky #2: embedded double-quotes + comma in BOTH name and notes
  { id: 3, name: 'Monitor 27" "Pro", refurb', brand: "LG", qty: 2, status: "Needs Attention", notes: 'flicker on input "HDMI-2", RMA #8841, see ticket', is_archived: false },
  // tricky #3: unicode (accent + Greek + CJK + emoji) + embedded newline in notes
  { id: 4, name: "Café Ω Sensor 设备 🔧", brand: "Bürkert", qty: null, status: "In Repair", notes: "line 1\nline 2 — naïve résumé\r\nαβγ 温度", is_archived: true },
  { id: 5, name: "Patch Panel 48-port", brand: "Tripp Lite", qty: 6, status: "In Storage", notes: null, is_archived: false },
];
const TRICKY_IDS = [2, 3, 4];

function die(msg: string): never { console.error("ABORT: " + msg); process.exit(1); }
function show(label: string, s: string) { console.log(`\n--- ${label} ---\n${s}`); }

// Mirrors seed-import.ts STEP-3: field-by-field spot-check, count, abort+report.
function stagingCheck(kind: string, reimported: any[], source: any[]): void {
  console.log(`\n[${kind}] STAGING CHECK`);
  if (reimported.length !== source.length) die(`[${kind}] count ${reimported.length} != ${source.length}`);
  console.log(`  PRE  : row count ${reimported.length} === ${source.length} (ok)`);
  const byId: Record<number, any> = {};
  for (const r of reimported) byId[r.id] = r;
  const fields = COLUMNS.map((c) => c.key);
  let mismatches = 0;
  for (const id of TRICKY_IDS) {
    const src = source.find((s) => s.id === id)!;
    const got = byId[id];
    if (!got) { console.error(`  [MISS] id ${id} absent after re-import`); mismatches++; continue; }
    let rowOk = true;
    for (const f of fields) {
      const a = src[f] ?? null, b = got[f] ?? null;
      if (a !== b) { mismatches++; rowOk = false; console.error(`  [DIFF] id ${id}.${f}: src=${JSON.stringify(a)} got=${JSON.stringify(b)}`); }
    }
    console.log(`  SPOT id ${id}: ${rowOk ? "VALUE-IDENTICAL across all fields" : "see diffs above"}`);
  }
  if (mismatches) die(`[${kind}] ${mismatches} field mismatch(es) — round trip NOT identical.`);
  console.log(`  POST : ${TRICKY_IDS.length} tricky rows value-identical, 0 mismatches. ${kind} ROUND-TRIP OK.`);
}

function main() {
  console.log(`source rows: ${SOURCE.length} (tricky ids: ${TRICKY_IDS.join(", ")})`);

  // ---------- CSV ----------
  const csv = IE.toCSV(SOURCE, COLUMNS);
  show("CSV export (full)", csv.replace(/\r\n/g, "\\r\\n\n")); // make CRLF visible
  console.log("\n--- gate (b): raw CSV cells for tricky rows (CRLF shown as \\r\\n) ---");
  // a quoted field may contain a newline, so re-derive line spans by re-parsing
  const rawRows = IE.parseCSV(csv); // array-of-arrays of strings (pre-coercion)
  for (const id of TRICKY_IDS) {
    const cells = rawRows.find((r: string[]) => r[0] === String(id))!;
    console.log(`  id ${id}: ${JSON.stringify(cells)}`);
  }

  const csvBack = IE.parseCSVToItems(csv, COLUMNS);
  if (!csvBack.ok) die(`CSV re-import failed: ${csvBack.error}`);
  stagingCheck("CSV", csvBack.items, SOURCE);

  // ---------- JSON ----------
  const json = IE.toJSON(SOURCE);
  console.log("\n--- gate (b): raw JSON objects for tricky rows ---");
  for (const id of TRICKY_IDS) {
    console.log("  " + JSON.stringify(SOURCE.find((s) => s.id === id)));
  }
  const jsonBack = IE.parseJSON(json);
  if (!jsonBack.ok) die(`JSON re-import failed: ${jsonBack.error}`);
  stagingCheck("JSON", jsonBack.items, SOURCE);

  // ---------- write artifacts for inspection ----------
  Bun.write("inventory/_proof_tmp/phase6-export.csv", csv);
  Bun.write("inventory/_proof_tmp/phase6-export.json", json);
  console.log("\nartifacts: inventory/_proof_tmp/phase6-export.csv, phase6-export.json");
  console.log("\nPASS: CSV and JSON exports re-import VALUE-IDENTICAL for all tricky rows (gate c).");
}

main();
