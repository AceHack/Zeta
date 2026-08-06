// Offline tests for the OPT-IN custodial vault-key endpoint (/vault/key).
// Real WebCrypto; no network. Run: node test/vault-key.test.mjs
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (n, c) => (c ? (pass++, console.log("  ok  -", n)) : (fail++, console.log(" FAIL -", n)));

const JWT_SECRET = "test-secret-at-least-32-bytes-long-xxxxx";
const KEY_B64 = btoa(String.fromCharCode(...new Uint8Array(32).fill(7))); // 32 bytes

// Mint an identity JWT the same way the Worker does.
const b64url = (bytes) => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
};
const b64urlStr = (s) => b64url(new TextEncoder().encode(s));
async function mintJwt(claims, secret = JWT_SECRET, alg = "HS256") {
  const header = b64urlStr(JSON.stringify({ alg, typ: "JWT" }));
  const payload = b64urlStr(JSON.stringify(claims));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}
const future = () => Math.floor(Date.now() / 1000) + 600;
const get = (env, headers = {}) => worker.fetch(new Request("https://b/vault/key", { headers }), env);

const envWith = (extra = {}) => ({
  JWT_SECRET,
  SELF_BASE_URL: "https://b",
  ALLOWED_FRONTEND_ORIGINS: "https://alice.github.io/Zeta/genesis/",
  ...extra,
});
const custodialEnv = envWith({ VAULT_TEAM_KEY_B64: KEY_B64, VAULT_KEY_ALLOWED_LOGINS: "alice, bob" });

{
  const goodJwt = await mintJwt({ login: "alice", exp: future() });

  // Happy path
  const r = await get(custodialEnv, { Authorization: `Bearer ${goodJwt}` });
  const body = await r.json();
  ok("allowlisted user gets the key", r.status === 200 && body.keyB64 === KEY_B64);
  ok("response is no-store (never cached)", r.headers.get("Cache-Control") === "no-store");
  ok("keyId returned", Boolean(body.keyId));

  // AuthN / AuthZ
  ok("no token -> 401", (await get(custodialEnv)).status === 401);
  const badSig = await mintJwt({ login: "alice", exp: future() }, "wrong-secret-wrong-secret-wrong!!");
  ok("bad signature -> 401", (await get(custodialEnv, { Authorization: `Bearer ${badSig}` })).status === 401);
  const expired = await mintJwt({ login: "alice", exp: Math.floor(Date.now() / 1000) - 5 });
  ok("expired token -> 401", (await get(custodialEnv, { Authorization: `Bearer ${expired}` })).status === 401);
  const noneAlg = await mintJwt({ login: "alice", exp: future() }, JWT_SECRET, "none");
  ok("alg=none -> 401", (await get(custodialEnv, { Authorization: `Bearer ${noneAlg}` })).status === 401);

  const mallory = await mintJwt({ login: "mallory", exp: future() });
  ok("non-allowlisted signed-in user -> 403", (await get(custodialEnv, { Authorization: `Bearer ${mallory}` })).status === 403);
  const upper = await mintJwt({ login: "ALICE", exp: future() });
  ok("allowlist is case-insensitive", (await get(custodialEnv, { Authorization: `Bearer ${upper}` })).status === 200);

  // Opt-in: disabled unless BOTH a key source and an allowlist exist
  ok("no allowlist -> 404 (endpoint disabled)", (await get(envWith({ VAULT_TEAM_KEY_B64: KEY_B64 }), { Authorization: `Bearer ${goodJwt}` })).status === 404);
  ok("no key source -> 404", (await get(envWith({ VAULT_KEY_ALLOWED_LOGINS: "alice" }), { Authorization: `Bearer ${goodJwt}` })).status === 404);

  // Malformed key must not be served
  const badKey = envWith({ VAULT_TEAM_KEY_B64: btoa("too-short"), VAULT_KEY_ALLOWED_LOGINS: "alice" });
  ok("wrong-length key -> 502, never served", (await get(badKey, { Authorization: `Bearer ${goodJwt}` })).status === 502);

  // Method + preflight
  const post = await worker.fetch(new Request("https://b/vault/key", { method: "POST", headers: { Authorization: `Bearer ${goodJwt}` } }), custodialEnv);
  ok("POST -> 405", post.status === 405);
  const pre = await worker.fetch(new Request("https://b/vault/key", { method: "OPTIONS" }), custodialEnv);
  ok("OPTIONS -> 204 + CORS", pre.status === 204 && pre.headers.get("Access-Control-Allow-Origin") === "*");

  // healthz advertises custodial availability
  const h1 = await (await worker.fetch(new Request("https://b/healthz"), custodialEnv)).json();
  const h2 = await (await worker.fetch(new Request("https://b/healthz"), envWith({}))).json();
  ok("healthz custodialKey true/false", h1.custodialKey === true && h2.custodialKey === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
