// manus-smoke-test.ts — one live task.create to verify the Manus key authenticates (shadow*).
// Aaron 2026-07-03: "did it get a real key? … can we test it works real quick?"
//
// Reads zeta-manus-api-key from the macOS Keychain at the edge (NEVER logged), wraps `fetch` as the
// HttpTransport, and fires ONE minimal task.create. Prints only the outcome:
//   200 + task_id  → the key is REAL and authenticates (a tiny task lands in the Manus app).
//   401            → bad key / wrong paste.
// The key never touches stdout.

import { readGenericPassword, describeStatus } from "../../src/Core.TypeScript/secrets/keychain-macos.ts";
import { createTask } from "../../src/Core.TypeScript/model-backend/manus-task.ts";
import type { HttpTransport } from "../../src/Core.TypeScript/model-backend/backend.ts";

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
