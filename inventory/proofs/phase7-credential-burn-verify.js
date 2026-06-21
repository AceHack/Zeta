/**
 * Inventory — Phase 7 burned-credential verification (negative auth check)
 * ---------------------------------------------------------------------------
 * Residual Risk Register: the build-time test users (editor@gmail.com,
 * viewer@gmail.com) and the admin password were shared in chat -> treat as
 * compromised. The OWNER rotates/deletes them in the Supabase dashboard; THIS
 * script confirms a given OLD credential NO LONGER authenticates.
 *
 * It attempts a password sign-in against Supabase Auth and PASSES only if the
 * attempt is REFUSED (no access_token; HTTP 400 / invalid credentials). It is a
 * "this key is dead" proof, run AFTER rotation.
 *
 * SECRET HYGIENE (repo is PUBLIC, CLAUDE.md):
 *   - The password is read from the BURN_PASSWORD env var, never an arg, and is
 *     NEVER printed. Only the email's length/shape and the auth verdict are shown.
 *   - If a token were ever returned (i.e. the credential is STILL LIVE), the token
 *     is NOT printed — only the FAIL verdict — and the script exits non-zero.
 *   - Uses the PUBLIC anon key only. The service_role key is never used.
 *
 * Run (owner, after rotating the credential in the dashboard):
 *   BURN_EMAIL='editor@gmail.com' BURN_PASSWORD='<the OLD password>' \
 *     bun inventory/proofs/phase7-credential-burn-verify.ts
 * Optional overrides: SUPABASE_URL, SUPABASE_ANON_KEY.
 * Exit: 0 = credential is DEAD (good); 1 = still live OR misconfigured.
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://mdtbgreryqddloluhdmm.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "sb_publishable_UjTK7ZQ0uGX_mEm9HJOT6Q_MJjPvKE3";
const email = process.env.BURN_EMAIL ?? "";
const password = process.env.BURN_PASSWORD ?? "";
function fail(msg) { console.log("FAIL: " + msg); process.exit(1); }
if (!email || !password) {
    fail("set BURN_EMAIL and BURN_PASSWORD env vars (password is never logged).");
}
const atOk = email.includes("@");
console.log(`checking credential: email length=${email.length} has_at=${atOk} (value not shown); password length=${password.length} (value not shown)`);
const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
});
let body = {};
try {
    body = await res.json();
}
catch { /* non-JSON body — treat as no token */ }
const hasToken = typeof body?.access_token === "string" && body.access_token.length > 0;
if (hasToken) {
    // Do NOT print the token. The credential is STILL LIVE — rotation incomplete.
    fail(`credential STILL AUTHENTICATES (HTTP ${res.status}). Rotation/deletion NOT complete — re-rotate in the Supabase dashboard.`);
}
if (res.status === 400 || res.status === 401 || res.status === 403) {
    console.log(`PASS: credential is DEAD — auth refused (HTTP ${res.status}, error_code=${body?.error_code ?? body?.error ?? "n/a"}, no access_token).`);
    process.exit(0);
}
// Any other status with no token: ambiguous — report, do not falsely pass.
fail(`unexpected HTTP ${res.status} with no access_token (msg=${body?.msg ?? body?.error_description ?? "n/a"}). Inspect manually; not certifying as dead.`);
