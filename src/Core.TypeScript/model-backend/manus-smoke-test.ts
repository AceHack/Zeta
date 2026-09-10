// manus-smoke-test.ts — one live task.create to verify the Manus key authenticates (shadow*).
// Aaron 2026-07-03: "did it get a real key? … can we test it works real quick?"
//
//   bun src/Core.TypeScript/model-backend/manus-smoke-test.ts
//
// ── WHY IT MOVED OUT OF `tools/setup/` (2026-09-10) ──────────────────────────
// It lived in `tools/setup/` because running it is a setup ceremony. But what it
// EXERCISES is `manus-task.ts` and `backend.ts` — it is this backend's live
// smoke test, and nothing in the install path calls it. Those two imports were
// the whole of the bootstrap surface's dependency on the meta-harness, and
// round 4 named them as the load-bearing pair of the harness's 38 back-edges
// (`docs/research/2026-09-09-repo-split-round-4-*.md` §3.1): a surface that has
// to work BEFORE anything else does must not need the harness to be present.
// The graph's own rule settles where it goes instead — a consumer that exists
// only to exercise a component belongs inside that component (the same reading
// that puts `ci/`'s QEMU harness with `zflash`, §3.3). Nothing about the test
// changed; only the directory it is typed from.
//
// Reads zeta-manus-api-key from the macOS Keychain at the edge (NEVER logged), wraps `fetch` as the
// HttpTransport, and fires ONE minimal task.create. Prints only the outcome:
//   200 + task_id  → the key is REAL and authenticates (a tiny task lands in the Manus app).
//   401            → bad key / wrong paste.
// The key never touches stdout.

import { readGenericPassword, describeStatus } from "../secrets/keychain-macos.ts";
import { createTask } from "./manus-task.ts";
import type { HttpTransport } from "./backend.ts";

// Was: execFileSync("security", ["find-generic-password", …]).
//
// macOS evaluates a keychain item's ACL against the process that ASKS, so with a
// subprocess the asker is always /usr/bin/security and this file's own code
// identity never reaches the keychain — Norm Hardy's confused deputy (1988).
// Porting shell to TypeScript did not fix that: `spawnSync` and `$( )` launder
// identity identically, which is why this site kept the defect through its port.
//
// `readGenericPassword` tries Security.framework in-process first and reports in
// `via` which path actually served the read. On this machine the in-process read
// is currently REFUSED (errSecAuthFailed, -25293) because every existing item was
// stored with an ACL naming only `security`; the deputy fallback keeps this smoke
// test working and makes the refusal visible instead of silent. It stops being a
// deputy read once the item is re-stored with an ACL that names the reader — an
// operator ceremony, tracked in the work-item, not something an agent fires.
const read = readGenericPassword("zeta-manus-api-key");
if (!read.ok) {
  console.error(`✗ zeta-manus-api-key unavailable: ${describeStatus(read.status)} (attempted ${read.via})`);
  process.exit(1);
}
const apiKey = read.secret;
console.log(`key length: ${String(apiKey.length)} chars (value not shown; served ${read.via})`);

const transport: HttpTransport = {
  async post(url, headers, body) {
    const r = await fetch(url, { method: "POST", headers, body });
    return { status: r.status, body: await r.text() };
  },
  async get(url, headers) {
    const r = await fetch(url, { method: "GET", headers });
    return { status: r.status, body: await r.text() };
  },
};

const out = await createTask({ apiKey }, transport, {
  text: "Zeta ↔ Manus API smoke test. Reply with the single word: pong.",
  title: "Zeta smoke test",
});

if (out.ok) {
  console.log("✓ KEY AUTHENTICATES — task created");
  console.log("  task_id:  " + out.task.taskId);
  console.log("  task_url: " + out.task.taskUrl + "  (open this in your Manus app)");
} else {
  console.log("✗ " + out.error);
}
