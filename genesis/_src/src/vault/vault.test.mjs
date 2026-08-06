// Offline tests for the vault entry point: zk (default) + custodial modes.
// Real WebCrypto; GitHub Contents API is faked. Run: node src/vault/vault.test.mjs
import { GitHubVaultStorage } from "./storage.js";
import { openVault, readVaultMeta, brokerKeyFetcher, VaultLockedError, VAULT_META_PATH, MODE_ZK, MODE_CUSTODIAL } from "./index.js";

let pass = 0, fail = 0;
const ok = (n, c) => (c ? (pass++, console.log("  ok  -", n)) : (fail++, console.log(" FAIL -", n)));
async function throws(fn, Type) {
  try { await fn(); return false; } catch (e) { return Type ? e instanceof Type : true; }
}

// --- fake GitHub Contents API -------------------------------------------
function makeStorage(files = new Map()) {
  const fakeFetch = async (url, opts = {}) => {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.match(/contents\/(.*)$/)[1]);
    const method = opts.method || "GET";
    if (method === "GET") {
      if (files.has(path)) return { ok: true, status: 200, json: async () => files.get(path) };
      const kids = [...files.keys()].filter((k) => k.startsWith(path.replace(/\/?$/, "/")));
      if (kids.length) return { ok: true, status: 200, json: async () => kids.map((k) => ({ type: "file", path: k, sha: files.get(k).sha })) };
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (method === "PUT") {
      const b = JSON.parse(opts.body);
      files.set(path, { content: b.content, sha: "sha" + files.size });
      return { ok: true, status: 200, json: async () => ({ content: { sha: "sha" + files.size } }) };
    }
    if (method === "DELETE") { files.delete(path); return { ok: true, status: 200, json: async () => ({}) }; }
    return { ok: false, status: 400, json: async () => ({}) };
  };
  return { files, storage: new GitHubVaultStorage({ owner: "alice", repo: "genesis-vault", getToken: async () => "t", fetchImpl: fakeFetch }) };
}
const raw = (files, p) => Buffer.from(files.get("vault/" + p).content, "base64").toString("utf8");

// 1) zero-knowledge is the DEFAULT mode
{
  const { files, storage } = makeStorage();
  const v = await openVault({ storage, passphrase: "correct horse battery staple" });
  ok("default mode is zero-knowledge", v.mode === MODE_ZK);
  await v.put("notes/a.json", { body: "secret text" });
  ok("round-trips data", (await v.get("notes/a.json")).body === "secret text");
  ok("datastore holds ciphertext only", !raw(files, "notes/a.json").includes("secret text"));

  const meta = JSON.parse(raw(files, VAULT_META_PATH));
  ok("meta is PLAINTEXT (salt readable before key exists)", meta.mode === MODE_ZK && Boolean(meta.kdf.saltB64));
  ok("meta carries no key material", !JSON.stringify(meta).includes("correct horse"));
  ok("list() hides meta.json", (await v.list("notes")).every((i) => i.path !== VAULT_META_PATH));
}

// 2) reopening an existing zk vault: right passphrase works, wrong one fails loudly
{
  const { storage } = makeStorage();
  const v1 = await openVault({ storage, passphrase: "pass-one" });
  await v1.put("x.json", { n: 42 });

  const v2 = await openVault({ storage, passphrase: "pass-one" });
  ok("reopen with correct passphrase", (await v2.get("x.json")).n === 42);
  ok("wrong passphrase -> VaultLockedError", await throws(() => openVault({ storage, passphrase: "nope" }), VaultLockedError));
  ok("missing passphrase -> throws", await throws(() => openVault({ storage })));
}

// 3) custodial mode is OPT-IN and must be asked for explicitly
{
  const { storage } = makeStorage();
  const key = crypto.getRandomValues(new Uint8Array(32));
  let fetches = 0;
  const fetchCustodialKey = async () => { fetches++; return key.slice(); };

  const v = await openVault({ storage, mode: MODE_CUSTODIAL, fetchCustodialKey });
  ok("custodial mode when explicitly requested", v.mode === MODE_CUSTODIAL);
  await v.put("c.json", { hi: "there" });
  ok("custodial round-trip", (await v.get("c.json")).hi === "there");

  const v2 = await openVault({ storage, fetchCustodialKey });
  ok("recorded mode wins on reopen (no passphrase needed)", v2.mode === MODE_CUSTODIAL && (await v2.get("c.json")).hi === "there");
  ok("custodial vault without a key source -> throws", await throws(() => openVault({ storage, passphrase: "irrelevant" })));
  ok("key fetched, then cached per provider", fetches === 2);

  // A zk vault must never call the custody backend.
  const zk = makeStorage();
  let zkFetches = 0;
  const zkVault = await openVault({ storage: zk.storage, passphrase: "p", fetchCustodialKey: async () => { zkFetches++; return key.slice(); } });
  await zkVault.put("z.json", { a: 1 });
  ok("zk mode never touches custody", zkFetches === 0);
}

// 4) an existing vault's mode cannot be silently downgraded/switched
{
  const { storage } = makeStorage();
  await openVault({ storage, passphrase: "pw" });
  const v = await openVault({ storage, mode: MODE_CUSTODIAL, passphrase: "pw", fetchCustodialKey: async () => new Uint8Array(32) });
  ok("mode param ignored for an existing vault", v.mode === MODE_ZK);
}

// 5) readVaultMeta on a fresh repo
{
  const { storage } = makeStorage();
  ok("uninitialized vault -> meta null", (await readVaultMeta(storage)) === null);
}

// 6) brokerKeyFetcher wiring
{
  const key32 = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));
  let seenAuth = null;
  const fetcher = brokerKeyFetcher({
    authBase: "https://broker.example/",
    getIdentityToken: () => "jwt-123",
    fetchImpl: async (url, opts) => { seenAuth = opts.headers.Authorization; return { ok: true, status: 200, json: async () => ({ keyB64: key32 }) }; },
  });
  const k = await fetcher();
  ok("brokerKeyFetcher returns 32 bytes", k instanceof Uint8Array && k.length === 32);
  ok("sends identity JWT as Bearer", seenAuth === "Bearer jwt-123");
  ok("403 -> not-authorized error", await throws(() => brokerKeyFetcher({ authBase: "https://b", getIdentityToken: () => "j", fetchImpl: async () => ({ ok: false, status: 403 }) })()));
  ok("no identity -> throws", await throws(() => brokerKeyFetcher({ authBase: "https://b", getIdentityToken: () => null, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) })()));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
