/**
 * Inventory — Phase 3 seed importer (REST, editor session, NO service_role)
 * ---------------------------------------------------------------------------
 * Imports the 210-item seed JSON into Supabase `items` via the PostgREST API,
 * authenticated as the EDITOR test user with the PUBLISHABLE (anon) key. RLS
 * (items_insert: editor/admin) is the gate. The Phase-1 audit trigger writes one
 * change_log INSERT row per item as seed provenance.
 *
 * Runs the spec-mandated STAGING CHECK with abort+report on mismatch:
 *   1. PRE  — validate the JSON file in-process: count===210, id set==={1..211}\{8},
 *             status in the DB-allowed set, qty integer|null. Abort before any write.
 *   2. INSERT — one atomic POST of the whole array (PostgREST treats a single array
 *             POST as one transaction: any row failing CHECK/PK rolls the batch back
 *             to 0 rows -> safely re-runnable).
 *   3. POST — read back from the DB: count===210 AND a >=5-record field-by-field
 *             spot-check against the source JSON. Report observed; non-zero exit on
 *             any mismatch.
 *
 * SECURITY: the publishable/anon key + the editor creds are passed via ENV, never
 * hard-coded, never logged. service_role / sb_secret_* is NEVER used.
 *
 *   Run (locally, against the git-ignored seed.json):
 *     SUPABASE_URL=https://<ref>.supabase.co \
 *     SUPABASE_ANON_KEY=sb_publishable_... \
 *     EDITOR_EMAIL=... EDITOR_PASSWORD=... \
 *     bun inventory/seed/seed-import.ts inventory/_seed_tmp/seed.json [--dry-run]
 *
 *   --dry-run does steps 1 only (validate; no auth, no write) — safe offline check.
 */
const ALLOWED_STATUS = new Set([
    "Active/In Use", "In Storage", "Needs Attention", "In Repair",
    "Retired (Archived)", "Disposed", "Missing",
]);
const EXPECTED_IDS = (() => {
    const s = new Set();
    for (let i = 1; i <= 211; i++)
        if (i !== 8)
            s.add(i); // 1..211 skip 8 == 210 ids
    return s;
})();
const EXPECTED_COUNT = 210;
function die(msg) { console.error("ABORT: " + msg); process.exit(1); }
function validate(items) {
    if (!Array.isArray(items))
        die("seed JSON is not an array");
    if (items.length !== EXPECTED_COUNT)
        die(`expected ${EXPECTED_COUNT} items, got ${items.length}`);
    const ids = new Set();
    for (const it of items) {
        if (typeof it.id !== "number" || !Number.isInteger(it.id))
            die(`item has non-integer id: ${JSON.stringify(it.id)}`);
        if (ids.has(it.id))
            die(`duplicate id ${it.id}`);
        ids.add(it.id);
        if (it.status !== null && !ALLOWED_STATUS.has(it.status))
            die(`id ${it.id}: status not allowed: ${JSON.stringify(it.status)}`);
        if (it.qty !== null && (!Number.isInteger(it.qty)))
            die(`id ${it.id}: qty not integer|null: ${JSON.stringify(it.qty)}`);
    }
    const missing = [...EXPECTED_IDS].filter((i) => !ids.has(i)).sort((a, b) => a - b);
    const extra = [...ids].filter((i) => !EXPECTED_IDS.has(i)).sort((a, b) => a - b);
    if (missing.length)
        die(`missing ids vs {1..211}\\{8}: ${JSON.stringify(missing)}`);
    if (extra.length)
        die(`unexpected ids not in {1..211}\\{8}: ${JSON.stringify(extra)}`);
    console.log(`PRE-CHECK ok: ${items.length} items; ids === {1..211}\\{8}; statuses valid; qty ints.`);
}
async function getAccessToken(url, anon, email, password) {
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    if (!r.ok)
        die(`auth failed: HTTP ${r.status} (check EDITOR_EMAIL/PASSWORD; token NOT logged)`);
    const j = await r.json();
    if (!j.access_token)
        die("auth response had no access_token");
    return j.access_token; // never logged
}
async function rpcRole(url, anon, access) {
    const r = await fetch(`${url}/rest/v1/rpc/current_user_role`, {
        method: "POST",
        headers: { apikey: anon, Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    });
    if (!r.ok)
        return null;
    return await r.json();
}
async function countItems(url, anon, access) {
    // PostgREST exact count via Prefer + Content-Range header.
    const r = await fetch(`${url}/rest/v1/items?select=id`, {
        headers: { apikey: anon, Authorization: `Bearer ${access}`, Prefer: "count=exact", Range: "0-0" },
    });
    const cr = r.headers.get("content-range") || ""; // e.g. "0-0/210"
    const total = cr.includes("/") ? Number(cr.split("/")[1]) : NaN;
    if (!Number.isFinite(total))
        die(`could not read exact count (content-range=${JSON.stringify(cr)})`);
    return total;
}
async function fetchByIds(url, anon, access, ids) {
    const inList = ids.join(",");
    const cols = "id,name,brand,model_pn,qty,device_type,category,status,notes";
    const r = await fetch(`${url}/rest/v1/items?select=${cols}&id=in.(${inList})`, {
        headers: { apikey: anon, Authorization: `Bearer ${access}` },
    });
    if (!r.ok)
        die(`spot-check read failed: HTTP ${r.status}`);
    const rows = await r.json();
    const m = {};
    for (const row of rows)
        m[row.id] = row;
    return m;
}
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const file = args.find((a) => !a.startsWith("--"));
    if (!file)
        die("usage: bun seed-import.ts <seed.json> [--dry-run]");
    if (!file.includes("_seed_tmp/"))
        die(`seed file must be under _seed_tmp/ (git-ignored). Got: ${file}`);
    const items = JSON.parse(await Bun.file(file).text());
    // ---- STEP 1: PRE validate (offline) ----
    validate(items);
    if (dryRun) {
        console.log("--dry-run: validation only; no auth, no write. Done.");
        return;
    }
    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const anon = process.env.SUPABASE_ANON_KEY;
    const email = process.env.EDITOR_EMAIL;
    const password = process.env.EDITOR_PASSWORD;
    if (!url || !anon || !email || !password) {
        die("need env: SUPABASE_URL, SUPABASE_ANON_KEY (publishable/anon), EDITOR_EMAIL, EDITOR_PASSWORD");
    }
    if (anon.startsWith("sb_secret_") || anon.includes("service_role")) {
        die("SUPABASE_ANON_KEY looks like a SECRET/service_role key — forbidden. Use the publishable/anon key.");
    }
    const access = await getAccessToken(url, anon, email, password);
    const role = await rpcRole(url, anon, access);
    console.log(`auth ok; current_user_role() = ${JSON.stringify(role)} (expect "editor" or "admin").`);
    if (role !== "editor" && role !== "admin")
        die(`role ${JSON.stringify(role)} cannot insert items (need editor/admin).`);
    const pre = await countItems(url, anon, access);
    console.log(`items count BEFORE import: ${pre} (expect 0 after cleanup).`);
    if (pre !== 0)
        die(`items table not empty (count=${pre}). Run inventory/sql/phase3_cleanup.sql first, or it is already seeded.`);
    // ---- STEP 2: atomic bulk INSERT (single array POST == one transaction) ----
    const r = await fetch(`${url}/rest/v1/items`, {
        method: "POST",
        headers: {
            apikey: anon, Authorization: `Bearer ${access}`,
            "Content-Type": "application/json", Prefer: "return=minimal",
        },
        body: JSON.stringify(items),
    });
    if (!(r.status === 201 || r.status === 200)) {
        const body = await r.text();
        die(`bulk insert failed: HTTP ${r.status} — ${body.slice(0, 500)} (atomic: 0 rows persisted, safe to retry)`);
    }
    console.log(`bulk INSERT: HTTP ${r.status} (atomic array POST).`);
    // ---- STEP 3: POST verify — count + >=5 field-by-field spot-check ----
    const post = await countItems(url, anon, access);
    console.log(`items count AFTER import: ${post} (expect ${EXPECTED_COUNT}).`);
    if (post !== EXPECTED_COUNT)
        die(`post-import count ${post} != ${EXPECTED_COUNT}.`);
    const spotIds = [1, 2, 10, 14, 18, 211].filter((id) => items.some((it) => it.id === id));
    const dbRows = await fetchByIds(url, anon, access, spotIds);
    const fields = ["name", "brand", "model_pn", "qty", "device_type", "category", "status", "notes"];
    let mismatches = 0;
    for (const id of spotIds) {
        const src = items.find((it) => it.id === id);
        const got = dbRows[id];
        if (!got) {
            console.error(`  [MISS] id ${id} not found in DB`);
            mismatches++;
            continue;
        }
        for (const f of fields) {
            const a = src[f] ?? null, b = got[f] ?? null;
            if (a !== b) {
                mismatches++;
                console.error(`  [DIFF] id ${id}.${f}: src=${JSON.stringify(a)?.slice(0, 80)} db=${JSON.stringify(b)?.slice(0, 80)}`);
            }
        }
        console.log(`  spot id ${id}: ${mismatches === 0 ? "match" : "see diffs above"}`);
    }
    if (mismatches)
        die(`${mismatches} field mismatch(es) in spot-check.`);
    console.log(`POST-CHECK ok: count=${post}, ${spotIds.length}-record spot-check 0 mismatches. SEED COMPLETE.`);
}
main();
