// Offline tests for the Genesis broker data-token flow (GitHub-as-a-database).
// Real WebCrypto; global fetch + Workers-KV are faked. Run: node test/data-flow.test.mjs
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (name, cond) => (cond ? (pass++, console.log("  ok  -", name)) : (fail++, console.log(" FAIL -", name)));

// --- Fakes ---------------------------------------------------------------
function makeKv() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
  };
}
const baseEnv = (kv) => ({
  SELF_BASE_URL: "https://genesis-auth.example.workers.dev",
  ALLOWED_FRONTEND_ORIGINS: "https://alice.github.io/Zeta/genesis/",
  GITHUB_DATA_CLIENT_ID: "Iv1.dataclient",
  GITHUB_DATA_CLIENT_SECRET: "datasecret",
  GITHUB_DATA_REPO: "genesis-vault",
  SESSIONS: kv,
});
const req = (url, opts = {}) => new Request(url, opts);
const cookieFrom = (res, name) => {
  for (const [k, v] of res.headers) {
    if (k.toLowerCase() === "set-cookie" && v.startsWith(name + "=")) return v.split(";")[0].slice(name.length + 1);
  }
  return null;
};

// Install a fetch stub for the GitHub token + user endpoints.
let refreshCounter = 0;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u === "https://github.com/login/oauth/access_token") {
    const params = new URLSearchParams(opts.body);
    const grant = params.get("grant_type");
    if (grant === "authorization_code") {
      return jr({ access_token: "gho_access_1", refresh_token: "ghr_refresh_1", expires_in: 28800 });
    }
    if (grant === "refresh_token") {
      refreshCounter++;
      return jr({ access_token: "gho_access_" + (refreshCounter + 1), refresh_token: "ghr_refresh_" + (refreshCounter + 1), expires_in: 28800 });
    }
  }
  if (u === "https://api.github.com/user") {
    return jr({ login: "alice", id: 123 });
  }
  return { ok: false, status: 404, json: async () => ({}) };
};
function jr(obj, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => obj };
}

// --- Tests ---------------------------------------------------------------
{
  const kv = makeKv();
  const env = baseEnv(kv);

  // 1) healthz advertises data availability
  const h = await worker.fetch(req("https://b/healthz"), env);
  const hb = await h.json();
  ok("healthz data:true when configured", hb.data === true);

  // 2) data login -> 302 to GitHub authorize + state cookie
  const loginUrl = "https://b/auth/github/data/login?redirect=" + encodeURIComponent("https://alice.github.io/Zeta/genesis/");
  const loginRes = await worker.fetch(req(loginUrl), env);
  const loc = loginRes.headers.get("Location") || "";
  const state = cookieFrom(loginRes, "gx_dstate_github");
  ok("data login 302", loginRes.status === 302);
  ok("authorize URL is GitHub + has client_id", loc.startsWith("https://github.com/login/oauth/authorize") && loc.includes("Iv1.dataclient"));
  ok("state cookie set", Boolean(state));

  // 3) data callback -> stores KV, redirects with #data_session
  const cbUrl = "https://genesis-auth.example.workers.dev/auth/github/data/callback?code=abc&state=" + encodeURIComponent(state);
  const cookieHeader = `gx_dstate_github=${state}; gx_dredir_github=${encodeURIComponent("https://alice.github.io/Zeta/genesis/")}`;
  const cbRes = await worker.fetch(req(cbUrl, { headers: { Cookie: cookieHeader } }), env);
  const cbLoc = cbRes.headers.get("Location") || "";
  const m = cbLoc.match(/[#&]data_session=([^&]+)/);
  const handle = m ? decodeURIComponent(m[1]) : null;
  ok("callback 302 to frontend", cbRes.status === 302 && cbLoc.startsWith("https://alice.github.io/Zeta/genesis/"));
  ok("callback returns opaque data_session handle", Boolean(handle) && handle !== "ghr_refresh_1");
  ok("refresh token stored in KV (not in redirect)", kv._m.size === 1 && !cbLoc.includes("ghr_refresh_1") && !cbLoc.includes("gho_access_1"));
  const storedRaw = [...kv._m.values()][0];
  ok("KV holds refresh token server-side", storedRaw.includes("ghr_refresh_1"));

  // 4) refresh with valid handle -> returns stored (still-fresh) access token, no GitHub call
  const before = refreshCounter;
  const r1 = await worker.fetch(req("https://b/auth/data/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: handle }) }), env);
  const r1b = await r1.json();
  ok("refresh returns token + owner + repo", r1.status === 200 && r1b.token === "gho_access_1" && r1b.owner === "alice" && r1b.repo === "genesis-vault");
  ok("fresh stored token reused (no GitHub refresh call)", refreshCounter === before);
  ok("CORS header present on refresh", r1.headers.get("Access-Control-Allow-Origin") === "*");

  // 5) refresh when access token expired -> GitHub refresh exchange + rotate in KV
  const rec = JSON.parse([...kv._m.values()][0]);
  rec.access_expires_at = Math.floor(Date.now() / 1000) - 10; // force-expire
  kv._m.set([...kv._m.keys()][0], JSON.stringify(rec));
  const r2 = await worker.fetch(req("https://b/auth/data/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: handle }) }), env);
  const r2b = await r2.json();
  ok("expired -> GitHub refresh called", refreshCounter === before + 1);
  ok("refresh returns rotated access token", r2.status === 200 && r2b.token === "gho_access_2");
  ok("refresh token rotated in KV", [...kv._m.values()][0].includes("ghr_refresh_2"));

  // 6) unknown session -> 401
  const r3 = await worker.fetch(req("https://b/auth/data/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: "nope" }) }), env);
  ok("unknown session -> 401", r3.status === 401);

  // 7) missing session -> 400
  const r4 = await worker.fetch(req("https://b/auth/data/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }), env);
  ok("missing session -> 400", r4.status === 400);

  // 8) OPTIONS preflight -> 204 + CORS
  const r5 = await worker.fetch(req("https://b/auth/data/refresh", { method: "OPTIONS" }), env);
  ok("OPTIONS preflight -> 204 + CORS", r5.status === 204 && r5.headers.get("Access-Control-Allow-Methods").includes("POST"));

  // 9) bad state on callback -> 400 (CSRF guard)
  const badCb = await worker.fetch(req(cbUrl, { headers: { Cookie: `gx_dstate_github=different; gx_dredir_github=${encodeURIComponent("https://alice.github.io/Zeta/genesis/")}` } }), env);
  ok("callback bad state -> 400", badCb.status === 400);

  // 10) data endpoints 404 when not configured
  const bare = { SELF_BASE_URL: env.SELF_BASE_URL, ALLOWED_FRONTEND_ORIGINS: env.ALLOWED_FRONTEND_ORIGINS };
  const noData = await worker.fetch(req(loginUrl), bare);
  ok("data login 404 when unconfigured", noData.status === 404);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
