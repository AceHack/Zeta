// manus-smoke-test.ts — one live task.create to verify the Manus key authenticates (shadow*).
// Aaron 2026-07-03: "did it get a real key? … can we test it works real quick?"
//
// Reads zeta-manus-api-key from the macOS Keychain at the edge (NEVER logged), wraps `fetch` as the
// HttpTransport, and fires ONE minimal task.create. Prints only the outcome:
//   200 + task_id  → the key is REAL and authenticates (a tiny task lands in the Manus app).
//   401            → bad key / wrong paste.
// The key never touches stdout.

import { execFileSync } from "node:child_process";
import { createTask } from "../../src/Core.TypeScript/model-backend/manus-task.ts";
import type { HttpTransport } from "../../src/Core.TypeScript/model-backend/backend.ts";

let apiKey: string;
try {
  apiKey = execFileSync("security", ["find-generic-password", "-s", "zeta-manus-api-key", "-w"], { encoding: "utf8" }).trim();
} catch {
  console.error("✗ zeta-manus-api-key not found in Keychain");
  process.exit(1);
}
console.log(`key length: ${String(apiKey.length)} chars (value not shown)`); // shape sanity, not the value

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
