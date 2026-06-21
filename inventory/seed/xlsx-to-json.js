/**
 * Inventory — Phase 3 seed converter (xlsx -> typed JSON)
 * ---------------------------------------------------------------------------
 * Converts the owner-provided master spreadsheet into the typed JSON array the
 * importer consumes. RUN LOCALLY against the git-ignored staging copy:
 *
 *     bun inventory/seed/xlsx-to-json.ts
 *       inventory/_seed_tmp/Company_Inventory_Master_List.xlsx
 *       inventory/_seed_tmp/seed.json
 *
 * SECURITY: input + output live ONLY in inventory/_seed_tmp/ (git-ignored).
 * The sheet holds sensitive data (serials/values/locations/notes/sources) and is
 * NEVER committed. This SCRIPT (logic, no data) is committed.
 *
 * No third-party deps: an .xlsx is a zip of XML; this sheet stores strings inline
 * (no sharedStrings.xml), so we extract xl/worksheets/sheet1.xml via `unzip -p`
 * and parse it with the standard library only.
 *
 * ===========================================================================
 * SEED-IMPORT MAPPING DECISIONS (owner-approved 2026-05-31) — audit anchor.
 * Also recorded in inventory/PROGRESS.md "Seed-import mapping decisions".
 *
 *   Column map (sheet -> items):
 *     A Inventory ID -> id          B Section     -> category
 *     C Brand        -> brand       D Product Name -> name
 *     E Model / PN   -> model_pn    F Qty         -> qty (integer)
 *     G Device Type  -> device_type H Status      -> status (mapped, see below)
 *     I Notes        -> notes (base)  J Source(s) -> notes (appended, see below)
 *     not in sheet  -> location, assignment_purpose, value, serial = null
 *     DB defaults   -> is_archived=false, custom_fields={} (custom_fields is Phase 5)
 *
 *   Decision A — STATUS. Source Status is a binary health flag: OK / Needs Attention.
 *     'Needs Attention' -> 'Needs Attention' (verbatim)
 *     'OK'              -> 'Active/In Use'   (OK = "no-problem flag", NOT a location
 *                                             claim; 'In Storage' would invent location
 *                                             data we do not have. Lossless re the one
 *                                             bit that exists: fine vs attention.)
 *     Any other/blank status is an ERROR (the converter aborts) — we do not guess.
 *
 *   Decision B — SOURCE(S) -> notes, no schema change. Sources are appended after a
 *     machine-parseable marker so a future phase can split them back out:
 *        notes + sources : "{notes}\n\nSOURCES:\n{url}\n{url}"
 *        sources only    : "SOURCES:\n{url}\n{url}"      (19 rows, empty notes)
 *        notes only      : "{notes}"
 *        neither         : null
 *     Sheet sources are " ; "-separated; each becomes its own line. A future
 *     migration splits notes on "\n\nSOURCES:\n" (or a leading "SOURCES:\n").
 * ===========================================================================
 */
import { execFileSync } from "node:child_process";
// ---- the 7 DB-allowed status strings (items.status CHECK in phase1.sql) -------
const ALLOWED_STATUS = new Set([
    "Active/In Use", "In Storage", "Needs Attention", "In Repair",
    "Retired (Archived)", "Disposed", "Missing",
]);
// ---- Decision A: source health-flag -> DB status vocabulary --------------------
const STATUS_MAP = {
    "OK": "Active/In Use",
    "Needs Attention": "Needs Attention",
};
// ----- minimal XML helpers (no deps) -------------------------------------------
function decodeXml(s) {
    return s
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&amp;/g, "&"); // ampersand LAST so we don't double-decode
}
const colLetters = (ref) => ref.replace(/[0-9]+$/, "");
/**
 * Parse the inner XML of one <c> cell into its string value.
 * Inline strings carry <t>…</t> runs (inside <is>); numerics carry <v>…</v>.
 * Detect by content rather than the t="inlineStr" attribute (the attribute is on
 * the <c> open tag, which the caller may not include in `inner`).
 */
function cellValueFromInner(inner) {
    const hasInline = /<t[ >\/]/.test(inner) || /<is\b/.test(inner);
    if (hasInline) {
        const runs = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1] ?? ""));
        const joined = runs.join("");
        return joined.length ? joined : null;
    }
    const v = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
    return v ? decodeXml(v[1] ?? "") : null;
}
function parseSheet(xml) {
    const rows = new Map();
    for (const rowM of xml.matchAll(/<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
        const rowNum = Number(rowM[1]);
        const cells = {};
        for (const cM of (rowM[2] ?? "").matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const ref = cM[1] ?? "";
            const inner = cM[2] ?? ""; // self-closing <c .../> => empty
            if (!ref)
                continue; // a <c> with no r="..." reference -> skip
            cells[colLetters(ref)] = inner ? cellValueFromInner(inner) : null;
        }
        rows.set(rowNum, cells);
    }
    return rows;
}
function buildNotes(notesRaw, sourcesRaw) {
    const notes = (notesRaw ?? "").trim();
    const sources = (sourcesRaw ?? "").trim();
    const urls = sources
        ? sources.split(/\s*;\s*/).map((u) => u.trim()).filter(Boolean)
        : [];
    const sourcesBlock = urls.length ? "SOURCES:\n" + urls.join("\n") : "";
    if (notes && sourcesBlock)
        return `${notes}\n\n${sourcesBlock}`;
    if (notes)
        return notes;
    if (sourcesBlock)
        return sourcesBlock; // empty-notes edge: begins with "SOURCES:\n"
    return null;
}
function main() {
    const [inPath, outPath] = process.argv.slice(2);
    if (!inPath || !outPath) {
        console.error("usage: bun xlsx-to-json.ts <input.xlsx> <output.json>");
        process.exit(2);
    }
    if (!inPath.includes("_seed_tmp/")) {
        console.error("REFUSING: input must live under _seed_tmp/ (git-ignored). Got: " + inPath);
        process.exit(2);
    }
    const sheetXml = execFileSync("unzip", ["-p", inPath, "xl/worksheets/sheet1.xml"], {
        encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    });
    const rows = parseSheet(sheetXml);
    // Header row = 1; data rows = 2..N. Verify header is the shape we mapped against.
    const header = rows.get(1) ?? {};
    const EXPECT_HEADER = {
        A: "Inventory ID", B: "Section", C: "Brand", D: "Product Name", E: "Model / PN",
        F: "Qty", G: "Device Type", H: "Status", I: "Notes", J: "Source(s)",
    };
    for (const [col, label] of Object.entries(EXPECT_HEADER)) {
        if ((header[col] ?? "").trim() !== label) {
            console.error(`ABORT: header column ${col} = ${JSON.stringify(header[col])}, expected ${JSON.stringify(label)}.`);
            console.error("The spreadsheet layout changed — refusing to map by guess. Re-check the mapping.");
            process.exit(1);
        }
    }
    const items = [];
    const errors = [];
    const statusCounts = {};
    const dataRowNums = [...rows.keys()].filter((n) => n >= 2).sort((a, b) => a - b);
    for (const rn of dataRowNums) {
        const c = rows.get(rn);
        const idRaw = (c.A ?? "").trim();
        if (!/^\d+$/.test(idRaw)) {
            errors.push(`row ${rn}: non-integer Inventory ID ${JSON.stringify(c.A)}`);
            continue;
        }
        const id = Number(idRaw);
        const qtyRaw = (c.F ?? "").trim();
        let qty = null;
        if (qtyRaw) {
            if (!/^\d+$/.test(qtyRaw)) {
                errors.push(`id ${id}: non-integer Qty ${JSON.stringify(c.F)}`);
                continue;
            }
            qty = Number(qtyRaw);
        }
        const statusRaw = (c.H ?? "").trim();
        const status = STATUS_MAP[statusRaw] ?? null;
        if (statusRaw && status === null) {
            errors.push(`id ${id}: unmapped Status ${JSON.stringify(statusRaw)} (only OK / Needs Attention are known)`);
            continue;
        }
        if (status !== null && !ALLOWED_STATUS.has(status)) {
            errors.push(`id ${id}: mapped status ${JSON.stringify(status)} not in DB CHECK set`);
            continue;
        }
        statusCounts[status ?? "(null)"] = (statusCounts[status ?? "(null)"] ?? 0) + 1;
        const clean = (x) => {
            const t = (x ?? "").trim();
            return t.length ? t : null;
        };
        items.push({
            id,
            name: clean(c.D),
            brand: clean(c.C),
            model_pn: clean(c.E),
            qty,
            device_type: clean(c.G),
            category: clean(c.B),
            status,
            notes: buildNotes(c.I ?? null, c.J ?? null),
        });
    }
    if (errors.length) {
        console.error(`ABORT: ${errors.length} row error(s) — no JSON written:`);
        for (const e of errors.slice(0, 25))
            console.error("  - " + e);
        process.exit(1);
    }
    // Sort by id for deterministic output.
    items.sort((a, b) => a.id - b.id);
    Bun.write(outPath, JSON.stringify(items, null, 2) + "\n");
    // ---- summary (no row content beyond counts/ids — safe to print) ----
    const ids = items.map((i) => i.id);
    const idSet = new Set(ids);
    const min = Math.min(...ids), max = Math.max(...ids);
    const missing = [];
    for (let i = min; i <= max; i++)
        if (!idSet.has(i))
            missing.push(i);
    console.log("wrote:", outPath);
    console.log("rows:", items.length);
    console.log("id range:", `${min}..${max}`, "| missing in range:", JSON.stringify(missing));
    console.log("status counts:", JSON.stringify(statusCounts));
    console.log("notes non-null:", items.filter((i) => i.notes !== null).length);
    console.log("notes containing SOURCES block:", items.filter((i) => i.notes?.includes("SOURCES:\n")).length);
}
main();
