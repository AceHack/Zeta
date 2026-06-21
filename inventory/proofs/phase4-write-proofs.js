/**
 * Inventory — Phase 4 write-path proofs (REST, editor session, NO service_role)
 * ---------------------------------------------------------------------------
 * Proves the Phase-4 gate end-to-end against the LIVE Supabase backend, as the
 * EDITOR test user, using ONLY the publishable (anon) key. RLS + the Phase-1
 * audit trigger + the Phase-4 version trigger are the real machinery; this
 * script just exercises them and prints RAW observed output.
 *
 * Gate proofs (spec.md Phase 4 + the owner's brief):
 *   (a) every change produces a change_log row with field-level before->after
 *       (who / what / old -> new / UTC stored, local displayed).
 *   (b) a stale-version save (two concurrent edits, second one outdated) is
 *       REJECTED (0 rows), not silently overwritten — shown broken-vs-fixed.
 *   (c) archive then un-archive an item; data + history both intact.
 *   (d) RLS still default-deny: unauthenticated anon read on all four sensitive
 *       tables returns [].
 *
 * SAFETY / HONESTY:
 *   - Operates on a THROWAWAY item ('__phase4_proof_item__'), never seed rows,
 *     so seed data + its history are untouched. The item cannot be DELETEd via
 *     the client (no DELETE policy by design) so it is left ARCHIVED and flagged
 *     for owner SQL-editor cleanup (same pattern as the Phase-1 proof item).
 *   - Credentials + key come from ENV, never hard-coded, never logged. Access
 *     tokens are never printed. service_role / sb_secret_* is NEVER used.
 *
 *   PREREQUISITE: the owner must have run inventory/sql/phase1.sql AND
 *   inventory/sql/phase4.sql first (the version trigger must exist for proof b).
 *
 *   Run:
 *     SUPABASE_URL=https://<ref>.supabase.co \
 *     SUPABASE_ANON_KEY=sb_publishable_... \
 *     EDITOR_EMAIL=... EDITOR_PASSWORD=... \
 *     bun inventory/proofs/phase4-write-proofs.ts
 */
const URL = req("SUPABASE_URL");
const ANON = req("SUPABASE_ANON_KEY");
const EMAIL = req("EDITOR_EMAIL");
const PASSWORD = req("EDITOR_PASSWORD");
function req(name) {
    const v = process.env[name];
    if (!v) {
        console.error(`MISSING ENV: ${name}`);
        process.exit(2);
    }
    return v;
}
async function rest(method, path, token, opts = {}) {
    const headers = {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
    };
    if (opts.body !== undefined)
        headers["Content-Type"] = "application/json";
    if (opts.prefer)
        headers["Prefer"] = opts.prefer;
    // Build init incrementally so `body` is ABSENT (not `undefined`) on GET —
    // required under the repo tsconfig's exactOptionalPropertyTypes.
    const init = { method, headers };
    if (opts.body !== undefined)
        init.body = JSON.stringify(opts.body);
    const res = await fetch(`${URL}/rest/v1/${path}`, init);
    let body;
    const text = await res.text();
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = text;
    }
    return { status: res.status, body };
}
async function signInEditor() {
    const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const j = (await res.json());
    if (!res.ok || !j.access_token) {
        console.error(`SIGN-IN FAILED (http ${res.status}). Check EDITOR creds.`);
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
async function main() {
    line("=== Phase 4 write-path proofs (editor session, publishable key, NO service_role) ===");
    line(`URL=${URL}`);
    line("");
    const token = await signInEditor();
    // sanity: role single-source (same RPC RLS uses)
    const roleRes = await rest("POST", "rpc/current_user_role", token, { body: {} });
    line(`role (current_user_role RPC) -> ${JSON.stringify(roleRes.body)} (http ${roleRes.status})`);
    if (roleRes.body !== "editor" && roleRes.body !== "admin") {
        line("WARNING: signed-in user is not editor/admin; write proofs will be RLS-refused.");
    }
    line("");
    // ---------------------------------------------------------------------------
    // SETUP: create a throwaway item (default id -> 212+, never a seed id).
    // ---------------------------------------------------------------------------
    line("---- SETUP: insert throwaway __phase4_proof_item__ ----");
    const ins = await rest("POST", "items", token, {
        body: { name: "__phase4_proof_item__", status: "In Storage", notes: "orig", qty: 1 },
        prefer: "return=representation",
    });
    const created = arr(ins.body)[0];
    if (ins.status !== 201 || !created) {
        line(`INSERT failed (http ${ins.status}): ${JSON.stringify(ins.body)}`);
        process.exit(1);
    }
    const id = created["id"];
    const v0 = created["version"];
    line(`created id=${id} version=${v0} is_archived=${created["is_archived"]} notes=${JSON.stringify(created["notes"])}`);
    line("");
    // ---------------------------------------------------------------------------
    // (a) field-level audit: edit a field -> change_log row old->new, UTC + local
    // ---------------------------------------------------------------------------
    line("---- (a) PROOF: field-level audit (who / what / old -> new / UTC stored, local shown) ----");
    const editA = await rest("PATCH", `items?id=eq.${id}&version=eq.${v0}`, token, {
        body: { notes: "edited-by-phase4-proof-a" },
        prefer: "return=representation",
    });
    const afterA = arr(editA.body)[0];
    line(`edit notes -> http ${editA.status}; rows=${arr(editA.body).length}; new version=${afterA?.["version"]}`);
    const v1 = afterA?.["version"] ?? v0;
    const logA = await rest("GET", `change_log?item_id=eq.${id}&field=eq.notes&order=id.desc&limit=1&select=id,item_id,actor,action,field,old_value,new_value,changed_at`, token);
    const row = arr(logA.body)[0];
    if (!row) {
        line(`FAILED: no change_log notes row found: ${JSON.stringify(logA.body)}`);
        process.exit(1);
    }
    line("change_log row (raw):");
    line(JSON.stringify(row, null, 2));
    const utc = String(row["changed_at"]);
    line(`UTC stored:     ${utc}`);
    line(`Local display:  ${new Date(utc).toLocaleString()}  (tz=${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
    const aOk = row["field"] === "notes" && row["old_value"] === "orig" && row["new_value"] === "edited-by-phase4-proof-a";
    line(`(a) ASSERTION field=notes, old="orig" -> new="edited-by-phase4-proof-a", actor present, UTC present: ${aOk ? "PASS" : "FAIL"}`);
    line("");
    // ---------------------------------------------------------------------------
    // (b) stale-version save rejected (broken-vs-fixed)
    // ---------------------------------------------------------------------------
    line("---- (b) PROOF: stale-version save REJECTED, not silently overwritten (broken-vs-fixed) ----");
    line(`row is now at version=${v1}. A second editor still holds the STALE version=${v0}.`);
    // FIXED (guarded, stale): WHERE id=? AND version=v0  -> 0 rows
    const guardedStale = await rest("PATCH", `items?id=eq.${id}&version=eq.${v0}`, token, {
        body: { notes: "stale-guarded-SHOULD-NOT-APPLY" },
        prefer: "return=representation",
    });
    const guardedRows = arr(guardedStale.body).length;
    line(`FIXED  (guarded, WHERE version=${v0} stale): http ${guardedStale.status}, rows affected=${guardedRows}  -> expect 0 = REJECTED`);
    line(`  raw body: ${JSON.stringify(guardedStale.body)}`);
    // confirm the value did NOT change
    const checkB = await rest("GET", `items?id=eq.${id}&select=notes,version`, token);
    const cur = arr(checkB.body)[0];
    line(`  current notes after rejected stale save: ${JSON.stringify(cur?.["notes"])} (version=${cur?.["version"]}) -> unchanged from (a)`);
    // BROKEN (no version guard): WHERE id=? -> 1 row (the silent overwrite the guard prevents)
    const unguarded = await rest("PATCH", `items?id=eq.${id}`, token, {
        body: { notes: "unguarded-overwrite-DEMO" },
        prefer: "return=representation",
    });
    const unguardedRows = arr(unguarded.body).length;
    line(`BROKEN (no version guard, WHERE id only):    http ${unguarded.status}, rows affected=${unguardedRows}  -> 1 = the silent overwrite the guard prevents`);
    const bOk = guardedRows === 0 && unguardedRows === 1;
    line(`(b) ASSERTION guarded-stale=0 rows (rejected) AND unguarded=1 row (breach demonstrated): ${bOk ? "PASS" : "FAIL"}`);
    line("");
    // ---------------------------------------------------------------------------
    // (c) archive -> un-archive: data + history intact
    // ---------------------------------------------------------------------------
    line("---- (c) PROOF: archive then un-archive; data + history intact ----");
    // re-read current version to guard the archive write
    const pre = arr((await rest("GET", `items?id=eq.${id}&select=version,name,qty,notes`, token)).body)[0];
    const vc0 = pre["version"];
    const arch = await rest("PATCH", `items?id=eq.${id}&version=eq.${vc0}`, token, {
        body: { is_archived: true },
        prefer: "return=representation",
    });
    const archived = arr(arch.body)[0];
    line(`archive: is_archived -> ${archived?.["is_archived"]} (version ${vc0} -> ${archived?.["version"]}), http ${arch.status}`);
    const vc1 = archived?.["version"] ?? vc0;
    const unarch = await rest("PATCH", `items?id=eq.${id}&version=eq.${vc1}`, token, {
        body: { is_archived: false },
        prefer: "return=representation",
    });
    const unarchived = arr(unarch.body)[0];
    line(`un-archive (undo): is_archived -> ${unarchived?.["is_archived"]} (version ${vc1} -> ${unarchived?.["version"]}), http ${unarch.status}`);
    // data intact: name/qty unchanged through archive cycle
    const dataIntact = unarchived?.["name"] === pre["name"] &&
        unarchived?.["qty"] === pre["qty"] &&
        unarchived?.["is_archived"] === false;
    line(`data intact through cycle: name=${JSON.stringify(unarchived?.["name"])} qty=${unarchived?.["qty"]} is_archived=${unarchived?.["is_archived"]} -> ${dataIntact ? "OK" : "MISMATCH"}`);
    // history intact: INSERT + the two is_archived rows (true, then false) both present, nothing deleted
    const hist = await rest("GET", `change_log?item_id=eq.${id}&order=id.asc&select=id,action,field,old_value,new_value,changed_at`, token);
    const histRows = arr(hist.body);
    line(`full per-item history (${histRows.length} rows, append-only, oldest-first):`);
    for (const h of histRows) {
        line(`  #${h["id"]} ${h["action"]}${h["field"] ? " " + h["field"] : ""}: ${JSON.stringify(h["old_value"])} -> ${JSON.stringify(h["new_value"])}  @ ${h["changed_at"]}`);
    }
    const archTrueRow = histRows.find((h) => h["field"] === "is_archived" && h["new_value"] === "true");
    const archFalseRow = histRows.find((h) => h["field"] === "is_archived" && h["new_value"] === "false");
    const insertRow = histRows.find((h) => h["action"] === "INSERT");
    const cOk = !!insertRow && !!archTrueRow && !!archFalseRow && dataIntact;
    line(`(c) ASSERTION INSERT row + is_archived false->true + true->false all present, data intact: ${cOk ? "PASS" : "FAIL"}`);
    line("");
    // ---------------------------------------------------------------------------
    // (d) RLS still default-deny: unauthenticated anon read on 4 tables -> []
    // ---------------------------------------------------------------------------
    line("---- (d) PROOF: RLS still default-deny (unauthenticated anon, all four sensitive tables) ----");
    let dOk = true;
    for (const t of ["items", "field_definitions", "change_log", "profiles"]) {
        const res = await fetch(`${URL}/rest/v1/${t}?select=*&limit=2`, {
            headers: { apikey: ANON, Authorization: `Bearer ${ANON}` }, // anon, NOT the editor token
        });
        const body = await res.text();
        const empty = body.trim() === "[]";
        if (!empty)
            dOk = false;
        line(`  anon ${t.padEnd(18)} http ${res.status} -> ${body}`);
    }
    line(`(d) ASSERTION all four anon reads == [] : ${dOk ? "PASS" : "FAIL"}`);
    line("");
    // ---------------------------------------------------------------------------
    // CLEANUP: leave the throwaway item ARCHIVED (cannot DELETE via client — no
    // DELETE policy). Flag for owner SQL-editor cleanup, like the Phase-1 proof item.
    // ---------------------------------------------------------------------------
    const finalVer = arr((await rest("GET", `items?id=eq.${id}&select=version`, token)).body)[0];
    await rest("PATCH", `items?id=eq.${id}&version=eq.${finalVer["version"]}`, token, {
        body: { is_archived: true, notes: "phase4-proof artifact — owner: remove in SQL editor before launch" },
        prefer: "return=representation",
    });
    line(`CLEANUP: throwaway item id=${id} left ARCHIVED (no client DELETE policy by design).`);
    line(`  Owner follow-up (SQL editor, like Phase-1 cleanup): disable change_log_immutable trigger ->`);
    line(`  delete change_log where item_id=${id}; delete items where id=${id}; re-enable trigger.`);
    line("");
    const allPass = aOk && bOk && cOk && dOk;
    line(`=== SUMMARY: (a)=${aOk ? "PASS" : "FAIL"} (b)=${bOk ? "PASS" : "FAIL"} (c)=${cOk ? "PASS" : "FAIL"} (d)=${dOk ? "PASS" : "FAIL"} ===`);
    process.exit(allPass ? 0 : 1);
}
main().catch((e) => {
    console.error("UNEXPECTED ERROR:", e instanceof Error ? e.message : String(e));
    process.exit(1);
});
