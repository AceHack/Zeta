/**
 * Inventory — Phase 5 custom-field proofs (REST; admin + editor sessions; NO service_role)
 * ---------------------------------------------------------------------------
 * Proves the Phase-5 gate end-to-end against the LIVE Supabase backend using
 * ONLY the publishable (anon) key. The DB trigger (sql/phase5.sql) + RLS are the
 * real machinery; this script exercises them and prints RAW observed output.
 *
 * Gate proofs (spec.md Phase 5 + the owner's brief):
 *   (1) ADD one field of EACH of the five types (text/number/date/dropdown/boolean)
 *       — admin only (field_definitions RLS).
 *   (2) APPEARS ON EVERY ITEM — the definitions are global; custom_fields default
 *       '{}' on every row, so a field is available on all items at once.
 *   (3) PER-TYPE VALIDATION, DB-REJECTED via REST bypassing the client — sent as
 *       the EDITOR (the zero-trust case: an editor with the anon key hitting
 *       PostgREST directly). A malformed value of each type is rejected by the DB.
 *   (4) XSS value STORED verbatim as data (render-inert is the Playwright proof).
 *   (5) DEACTIVATE a field -> stored values + change_log history PRESERVED.
 *   (6) RLS still default-deny: unauthenticated anon read on all four sensitive
 *       tables returns [].
 *   (Numeric-sort correctness is proven by the SQL proof phase5_proofs.sql +
 *    the unit suite + the Playwright in-app sort; PostgREST JSON-arrow ordering
 *    is lexicographic by design, so it is NOT the sort mechanism — shown here
 *    only to demonstrate the "10 < 9" trap the client/SQL layers avoid.)
 *
 * SAFETY / HONESTY:
 *   - Operates on THROWAWAY items + throwaway field defs (unique run suffix),
 *     never seed rows. Throwaway items cannot be client-DELETEd (no DELETE
 *     policy by design) so they are left ARCHIVED and flagged for owner SQL
 *     cleanup. Throwaway field defs are left is_active=false (NOT hard-deleted —
 *     same "never delete a definition with data" rule) and flagged for cleanup.
 *   - Creds + key come from ENV, never hard-coded, never logged. Access tokens
 *     are never printed. service_role / sb_secret_* is NEVER used.
 *
 *   PREREQUISITE: the owner must have run sql/phase1.sql, sql/phase4.sql AND
 *   sql/phase5.sql first (the validation trigger must exist for proof 3).
 *
 *   Run:
 *     SUPABASE_URL=https://<ref>.supabase.co \
 *     SUPABASE_ANON_KEY=sb_publishable_... \
 *     ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *     EDITOR_EMAIL=... EDITOR_PASSWORD=... \
 *     bun inventory/proofs/phase5-custom-fields-proofs.ts
 */
const URL = req("SUPABASE_URL");
const ANON = req("SUPABASE_ANON_KEY");
const ADMIN_EMAIL = req("ADMIN_EMAIL");
const ADMIN_PASSWORD = req("ADMIN_PASSWORD");
const EDITOR_EMAIL = req("EDITOR_EMAIL");
const EDITOR_PASSWORD = req("EDITOR_PASSWORD");
function req(name) {
    const v = process.env[name];
    if (!v) {
        console.error(`MISSING ENV: ${name}`);
        process.exit(2);
    }
    return v;
}
async function rest(method, path, token, opts = {}) {
    const headers = { apikey: ANON, Authorization: `Bearer ${token}` };
    if (opts.body !== undefined)
        headers["Content-Type"] = "application/json";
    if (opts.prefer)
        headers["Prefer"] = opts.prefer;
    const init = { method, headers };
    if (opts.body !== undefined)
        init.body = JSON.stringify(opts.body);
    const res = await fetch(`${URL}/rest/v1/${path}`, init);
    const text = await res.text();
    let body;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = text;
    }
    return { status: res.status, body };
}
async function signIn(email, password, label) {
    const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    let j = {};
    try {
        j = JSON.parse(text);
    }
    catch { /* non-JSON */ }
    if (!res.ok || !j.access_token) {
        // The auth error body states the REASON (invalid_grant vs email_not_confirmed)
        // and never echoes the submitted password — safe to print.
        console.error(`SIGN-IN FAILED for ${label} (http ${res.status}): ${text}`);
        process.exit(2);
    }
    return j.access_token; // never printed
}
function line(s = "") {
    console.log(s);
}
function arr(b) {
    return Array.isArray(b) ? b : [];
}
function ok2xx(s) {
    return s >= 200 && s < 300;
}
// jsonb is UNORDERED — Postgres normalizes key order on storage, so compare the
// custom_fields object key-by-key (NOT JSON.stringify, which is order-sensitive).
function sameCf(stored, sent) {
    if (!stored || typeof stored !== "object")
        return false;
    const so = stored;
    const sk = Object.keys(so), tk = Object.keys(sent);
    if (sk.length !== tk.length)
        return false;
    return tk.every((k) => JSON.stringify(so[k]) === JSON.stringify(sent[k]));
}
async function main() {
    line("=== Phase 5 custom-field proofs (admin+editor sessions, publishable key, NO service_role) ===");
    line(`URL=${URL}`);
    line("");
    const adminToken = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD, "admin");
    const editorToken = await signIn(EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    const adminRole = (await rest("POST", "rpc/current_user_role", adminToken, { body: {} })).body;
    const editorRole = (await rest("POST", "rpc/current_user_role", editorToken, { body: {} })).body;
    line(`admin  role -> ${JSON.stringify(adminRole)}`);
    line(`editor role -> ${JSON.stringify(editorRole)}`);
    if (adminRole !== "admin")
        line("WARNING: ADMIN_* user is not 'admin'; field-def proofs will be RLS-refused.");
    if (editorRole !== "editor" && editorRole !== "admin")
        line("WARNING: EDITOR_* user cannot write items.");
    line("");
    // unique suffix so re-runs never collide (key must match ^[a-z][a-z0-9_]*$)
    const sfx = "p5_" + Date.now().toString(36);
    const F = {
        text: `${sfx}_text`,
        number: `${sfx}_number`,
        date: `${sfx}_date`,
        dropdown: `${sfx}_dropdown`,
        boolean: `${sfx}_boolean`,
    };
    // NOTE: PostgREST bulk insert (array) requires EVERY object to have the SAME key
    // set (PGRST102 "All object keys must match") — so all five carry `options`
    // (null for non-dropdowns). The DB CHECK allows NULL options for non-dropdowns.
    const defs = [
        { key: F.text, label: "P5 Text", type: "text", options: null, required: false },
        { key: F.number, label: "P5 Number", type: "number", options: null, required: false },
        { key: F.date, label: "P5 Date", type: "date", options: null, required: false },
        { key: F.dropdown, label: "P5 Dropdown", type: "dropdown", options: ["red", "green", "blue"], required: false },
        { key: F.boolean, label: "P5 Boolean", type: "boolean", options: null, required: false },
    ];
    // ---------------------------------------------------------------------------
    // (1) ADD one field of each of the five types (admin).
    // ---------------------------------------------------------------------------
    line("---- (1) PROOF: admin adds one field of EACH of the five types ----");
    const ins = await rest("POST", "field_definitions", adminToken, { body: defs, prefer: "return=representation" });
    const created = arr(ins.body);
    line(`insert field_definitions -> http ${ins.status}; rows=${created.length}`);
    for (const d of created)
        line(`  + ${d["key"]} (${d["type"]}) is_active=${d["is_active"]}`);
    const p1 = ins.status === 201 && created.length === 5;
    line(`(1) ASSERTION 5 typed field defs created (http 201): ${p1 ? "PASS" : "FAIL"}`);
    if (!p1) {
        line(`  raw: ${JSON.stringify(ins.body)}`);
    }
    line("");
    // ---------------------------------------------------------------------------
    // (2) APPEARS ON EVERY ITEM — definitions are global; custom_fields default '{}'.
    // ---------------------------------------------------------------------------
    line("---- (2) PROOF: the new fields are available on EVERY item ----");
    const visDefs = arr((await rest("GET", `field_definitions?select=key,type,is_active&key=like.${sfx}_*`, editorToken)).body);
    line(`field_definitions visible to the EDITOR (non-admin) role: ${visDefs.length} of 5`);
    const sampleItems = arr((await rest("GET", "items?select=id,custom_fields&order=id.asc&limit=5", editorToken)).body);
    const allObjects = sampleItems.length > 0 && sampleItems.every((r) => r["custom_fields"] !== null && typeof r["custom_fields"] === "object");
    line(`sample of existing items (custom_fields is an object on each — the field slot exists on all):`);
    for (const r of sampleItems)
        line(`  #${r["id"]} custom_fields=${JSON.stringify(r["custom_fields"])}`);
    const p2 = visDefs.length === 5 && allObjects;
    line(`(2) ASSERTION all 5 defs visible to a viewer/editor AND every sampled item has a custom_fields object: ${p2 ? "PASS" : "FAIL"}`);
    line("");
    // SETUP: a throwaway item the EDITOR owns the writes on.
    line("---- SETUP: editor inserts throwaway __phase5_proof_item__ ----");
    const itemIns = await rest("POST", "items", editorToken, {
        body: { name: "__phase5_proof_item__", status: "In Storage", qty: 1 },
        prefer: "return=representation",
    });
    const item = arr(itemIns.body)[0];
    if (itemIns.status !== 201 || !item) {
        line(`INSERT failed (http ${itemIns.status}): ${JSON.stringify(itemIns.body)}`);
        process.exit(1);
    }
    const id = item["id"];
    line(`created item id=${id} custom_fields=${JSON.stringify(item["custom_fields"])}`);
    line("");
    // valid values of all five types in one write (editor):
    line("---- (2b) editor sets one VALID value of each type on the item ----");
    const validCf = { [F.text]: "hello", [F.number]: 42, [F.date]: "2024-02-29", [F.dropdown]: "green", [F.boolean]: true };
    const setValid = await rest("PATCH", `items?id=eq.${id}`, editorToken, { body: { custom_fields: validCf }, prefer: "return=representation" });
    const afterValid = arr(setValid.body)[0];
    line(`set valid custom_fields -> http ${setValid.status}; stored=${JSON.stringify(afterValid?.["custom_fields"])}`);
    const p2b = ok2xx(setValid.status) && sameCf(afterValid?.["custom_fields"], validCf);
    line(`(2b) ASSERTION all five valid typed values accepted + stored: ${p2b ? "PASS" : "FAIL"}`);
    line("");
    // ---------------------------------------------------------------------------
    // (3) PER-TYPE VALIDATION, DB-REJECTED via REST as the EDITOR (bypassing client)
    // ---------------------------------------------------------------------------
    line("---- (3) PROOF: per-type validation REJECTED at the DB (editor, direct REST) ----");
    const bad = [
        [`number <- string "not-a-number"`, { [F.number]: "not-a-number" }],
        [`boolean <- string "yes"`, { [F.boolean]: "yes" }],
        [`date <- "2024-13-40"`, { [F.date]: "2024-13-40" }],
        [`dropdown <- "purple" (not an option)`, { [F.dropdown]: "purple" }],
        [`text <- number 123`, { [F.text]: 123 }],
        [`unknown key`, { [`${sfx}_unknown`]: "x" }],
    ];
    let p3 = true;
    for (const [desc, cf] of bad) {
        const r = await rest("PATCH", `items?id=eq.${id}`, editorToken, { body: { custom_fields: { ...validCf, ...cf } } });
        const rejected = !ok2xx(r.status);
        if (!rejected)
            p3 = false;
        const msg = typeof r.body === "object" && r.body && "message" in r.body ? r.body["message"] : r.body;
        line(`  ${desc.padEnd(40)} -> http ${r.status} ${rejected ? "REJECTED" : "ACCEPTED (BUG!)"}  ${rejected ? "(" + JSON.stringify(msg) + ")" : ""}`);
    }
    // confirm the valid value is unchanged after the rejected writes
    const stillValid = arr((await rest("GET", `items?id=eq.${id}&select=custom_fields`, editorToken)).body)[0];
    const intact = sameCf(stillValid?.["custom_fields"], validCf);
    line(`  value intact after all rejects: ${JSON.stringify(stillValid?.["custom_fields"])} -> ${intact ? "OK" : "MISMATCH"}`);
    line(`(3) ASSERTION every malformed value + unknown key DB-rejected, valid value intact: ${p3 && intact ? "PASS" : "FAIL"}`);
    line("");
    // ---------------------------------------------------------------------------
    // (4) XSS value STORED verbatim as data (render-inert proven in Playwright).
    // ---------------------------------------------------------------------------
    line("---- (4) PROOF: a <script>/onerror payload is stored as DATA (text), accepted by the DB ----");
    const XSS = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>`;
    const setXss = await rest("PATCH", `items?id=eq.${id}`, editorToken, { body: { custom_fields: { ...validCf, [F.text]: XSS } }, prefer: "return=representation" });
    const xssStored = arr(setXss.body)[0]?.["custom_fields"];
    line(`stored text field -> http ${setXss.status}; value=${JSON.stringify(xssStored?.[F.text])}`);
    const p4 = ok2xx(setXss.status) && xssStored?.[F.text] === XSS;
    line(`(4) ASSERTION payload stored verbatim as a JSON string (render-inert proof = Playwright): ${p4 ? "PASS" : "FAIL"}`);
    line("");
    // ---------------------------------------------------------------------------
    // (5) DEACTIVATE a field -> stored values + history PRESERVED.
    // ---------------------------------------------------------------------------
    line("---- (5) PROOF: deactivate a field; stored values + change_log history preserved ----");
    const deact = await rest("PATCH", `field_definitions?key=eq.${F.number}`, adminToken, { body: { is_active: false }, prefer: "return=representation" });
    const deactRow = arr(deact.body)[0];
    line(`admin deactivate ${F.number} -> http ${deact.status}; is_active=${deactRow?.["is_active"]}`);
    const afterDeact = arr((await rest("GET", `items?id=eq.${id}&select=custom_fields`, editorToken)).body)[0];
    const numPreserved = afterDeact?.["custom_fields"]?.[F.number] === 42;
    line(`item custom_fields after deactivation: ${JSON.stringify(afterDeact?.["custom_fields"])}`);
    line(`  number value (42) still present despite the field being inactive: ${numPreserved ? "PRESERVED" : "LOST"}`);
    const hist = arr((await rest("GET", `change_log?item_id=eq.${id}&field=eq.custom_fields&order=id.asc&select=id,field,old_value,new_value,changed_at`, editorToken)).body);
    line(`change_log custom_fields history rows (append-only, ${hist.length} total):`);
    for (const h of hist)
        line(`  #${h["id"]} custom_fields changed @ ${h["changed_at"]}`);
    const p5 = deactRow?.["is_active"] === false && numPreserved && hist.length >= 1;
    line(`(5) ASSERTION field deactivated AND value preserved AND history intact: ${p5 ? "PASS" : "FAIL"}`);
    line("");
    // numeric-sort trap demonstration (NOT the sort mechanism; client/SQL/unit own that)
    line("---- (note) PostgREST JSON-arrow ordering is lexicographic (the \"10 < 9\" trap) ----");
    line("  numeric correctness is enforced client-side (lib/custom-fields.js compareValues),");
    line("  proven in phase5_proofs.sql (cast ::numeric) + custom-fields.unit.test.ts + Playwright.");
    line("");
    // ---------------------------------------------------------------------------
    // (6) RLS still default-deny: unauthenticated anon read on 4 tables -> []
    // ---------------------------------------------------------------------------
    line("---- (6) PROOF: RLS still default-deny (unauthenticated anon, all four sensitive tables) ----");
    let p6 = true;
    for (const t of ["items", "field_definitions", "change_log", "profiles"]) {
        const res = await fetch(`${URL}/rest/v1/${t}?select=*&limit=2`, {
            headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, // anon, NOT a user token
        });
        const body = await res.text();
        const empty = body.trim() === "[]";
        if (!empty)
            p6 = false;
        line(`  anon ${t.padEnd(18)} http ${res.status} -> ${body}`);
    }
    line(`(6) ASSERTION all four anon reads == [] : ${p6 ? "PASS" : "FAIL"}`);
    line("");
    // ---------------------------------------------------------------------------
    // CLEANUP: archive the throwaway item (cannot DELETE via client); deactivate
    // the throwaway field defs (NOT hard-deleted — they have data on the item).
    // ---------------------------------------------------------------------------
    await rest("PATCH", `items?id=eq.${id}`, editorToken, {
        body: { is_archived: true, name: "__phase5_proof artifact — owner: remove in SQL editor before launch" },
    });
    for (const k of Object.values(F)) {
        await rest("PATCH", `field_definitions?key=eq.${k}`, adminToken, { body: { is_active: false } });
    }
    line(`CLEANUP: throwaway item id=${id} left ARCHIVED; throwaway field defs (${Object.values(F).join(", ")}) left is_active=false.`);
    line(`  Owner follow-up (SQL editor): disable change_log_immutable trigger -> delete change_log where item_id=${id};`);
    line(`  delete items where id=${id}; delete from field_definitions where key like '${sfx}_%'; re-enable trigger.`);
    line("");
    const allPass = p1 && p2 && p2b && p3 && intact && p4 && p5 && p6;
    line(`=== SUMMARY: (1)=${b(p1)} (2)=${b(p2)} (2b)=${b(p2b)} (3)=${b(p3 && intact)} (4)=${b(p4)} (5)=${b(p5)} (6)=${b(p6)} ===`);
    process.exit(allPass ? 0 : 1);
}
function b(v) {
    return v ? "PASS" : "FAIL";
}
main().catch((e) => {
    console.error("UNEXPECTED ERROR:", e instanceof Error ? e.message : String(e));
    process.exit(1);
});
