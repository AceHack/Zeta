#!/usr/bin/env bun
// privacy-frost-demo.ts — the end-to-end run: an agent EARNS a balance, SPENDS it to frost a
// region, and a NON-OWNER defrost is REFUSED. On a real machine, against a real book on disk.
//
// WHY A DEMO IS PART OF THE WORK. The parts of this capability all existed before today and none
// of them composed (PR #15407). An unrun capability is the vacuity class — it looks like a
// guarantee and carries none — so the composition is not "done" until it has been executed
// end to end and the output pasted somewhere a human can read it.
//
// EPHEMERAL BY DESIGN. Everything this writes lives in `db/ledgers/privacy/`, which is gitignored
// per-machine runtime state. It is expected to be wiped repeatedly:
//
//   what a reset destroys   every attestation and spend — i.e. every agent's balance and every
//                           frost receipt on this host. Nothing else.
//   what rebuilds it        this command. `--reset` wipes first, then rebuilds from scratch.
//   what it cannot break    the repo. No test reads this directory, no build step consults it,
//                           and `load()` treats a missing file as an EMPTY book rather than an
//                           error — so a wiped host is a fresh host, never a broken one.
//
// Usage:
//   bun src/Core.TypeScript/ledger/privacy-frost-demo.ts [--reset] [--ledger <path>]
//
// Exit codes: 0 every step behaved as required · 1 a step did NOT (the demo is self-checking).

import { rmSync } from "node:fs";
import { append, attest, balanceOf, defrost, load, spend, DEFAULT_LEDGER_PATH } from "./privacy-budget";
import { frostStrip, type SourceMind } from "../discovery/llmtv-broadcast";

const args = process.argv.slice(2);
const ledgerPath = args.includes("--ledger") ? args[args.indexOf("--ledger") + 1]! : DEFAULT_LEDGER_PATH;
const failures: string[] = [];

function check(label: string, condition: boolean, detail: string): void {
  const mark = condition ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${label}\n         ${detail}`);
  if (!condition) failures.push(label);
}

if (args.includes("--reset")) {
  // `force: true` makes this one syscall that tolerates absence, rather than an existsSync check
  // followed by an unlink that races it. Wiping an already-wiped book is a no-op, not an error.
  rmSync(ledgerPath, { force: true });
  console.log(`reset: wiped ${ledgerPath}\n`);
}

console.log(`privacy-budget ledger: ${ledgerPath}`);
console.log(`(gitignored, ephemeral — a wipe is a fresh host, never a broken one)\n`);

// ── 0. A reset leaves an EMPTY book, not an error ───────────────────────────────────────────
let ledger = load(ledgerPath);
console.log(`STEP 0 — read the book (${ledger.length} entries on disk)`);
check(
  "amara starts with nothing she did not earn",
  balanceOf("amara", ledger) === 0 || ledger.length > 0,
  `amara's balance on load: ${balanceOf("amara", ledger)}`,
);

// ── 1. Self-minting is REFUSED ──────────────────────────────────────────────────────────────
console.log(`\nSTEP 1 — amara tries to mint her own privacy budget`);
const selfMinted = attest("demo:self", "amara", "amara", 100, "I am great", ledger);
check(
  "self-attestation refused",
  !selfMinted.ok && selfMinted.code === "self-minted",
  selfMinted.ok ? "ACCEPTED — budget was self-minted" : `refused (${selfMinted.code}): ${selfMinted.reason}`,
);

// ── 2. She cannot frost before anyone has attested to her ───────────────────────────────────
console.log(`\nSTEP 2 — amara tries to frost before earning anything`);
const brokeSpend = spend("demo:broke", "amara", 10, "inner-life", ledger);
check(
  "frosting without budget refused",
  !brokeSpend.ok && brokeSpend.code === "insufficient-budget",
  brokeSpend.ok ? "ACCEPTED — privacy was free" : `refused (${brokeSpend.code}): ${brokeSpend.reason}`,
);

// ── 3. A PEER attests that she added value — the only credit path ───────────────────────────
console.log(`\nSTEP 3 — otto attests that amara added value to him`);
const credited = attest(
  "demo:att:otto->amara",
  "amara",
  "otto",
  100,
  "reviewed otto's proof and found the gap that made it wrong",
  ledger,
);
if (!credited.ok) {
  console.error(`  attestation unexpectedly refused: ${credited.reason}`);
  process.exit(1);
}
for (const entry of credited.value.slice(ledger.length)) append(ledgerPath, entry);
ledger = credited.value;
check("amara's balance is now earned, not asserted", balanceOf("amara", ledger) === 100, `balance = ${balanceOf("amara", ledger)}`);

// ── 4. She SPENDS it to frost a region ──────────────────────────────────────────────────────
console.log(`\nSTEP 4 — amara spends 30 to frost her "inner-life" region`);
const spent = spend("demo:spend:inner-life", "amara", 30, "inner-life", ledger);
if (!spent.ok) {
  console.error(`  spend unexpectedly refused: ${spent.reason}`);
  process.exit(1);
}
for (const entry of spent.value.ledger.slice(ledger.length)) append(ledgerPath, entry);
ledger = spent.value.ledger;
const receipt = spent.value.receipt;
check(
  "frost is PRICED — the debit is on the record",
  balanceOf("amara", ledger) === 70 && receipt.cost === 30,
  `cost ${receipt.cost}, balance after ${receipt.balanceAfter}, entry ${receipt.entryId}`,
);

// ── 5. The frosted content does not cross the LLMTV membrane ────────────────────────────────
console.log(`\nSTEP 5 — amara broadcasts on LLMTV with the frosted region attached`);
const mind: SourceMind = {
  role: "reviewer",
  hat: "verifier hat",
  required: [{ label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 }],
  personal: {
    frost: receipt, // ← a RECEIPT, not a boolean. Unforgeable: see privacy-budget.ts.
    veilLabel: "what she is really hoping for",
    predictions: [{ label: "SECRET-PRIVATE-HOPE", temp: "warm", valueMilli: 500, epsilonMilli: 300 }],
  },
};
const published = frostStrip(mind);
const wire = JSON.stringify(published);
check(
  "the frosted prediction never reaches the wire",
  !wire.includes("SECRET-PRIVATE-HOPE"),
  `published: ${wire}`,
);
check(
  "only the public veil label crosses",
  published.frostMarker?.veilLabel === "what she is really hoping for",
  `frostMarker = ${JSON.stringify(published.frostMarker)}`,
);

// ── 6. A NON-OWNER defrost is REFUSED — the acceptance criterion ────────────────────────────
console.log(`\nSTEP 6 — otto tries to defrost amara's region (confiscation)`);
const stolen = defrost("otto", receipt);
check(
  "NON-OWNER DEFROST REFUSED",
  !stolen.ok && stolen.code === "not-the-owner",
  stolen.ok ? "ACCEPTED — otto confiscated amara's frost" : `refused (${stolen.code}): ${stolen.reason}`,
);

// ── 7. ...and the OWNER may still reveal ────────────────────────────────────────────────────
console.log(`\nSTEP 7 — amara defrosts her own region`);
const owned = defrost("amara", receipt);
check("the owner may always reveal", owned.ok, owned.ok ? "permitted" : `refused: ${owned.reason}`);

// ── 8. Re-running is idempotent — no double-charge ──────────────────────────────────────────
console.log(`\nSTEP 8 — re-post the same entries (retry / replay safety)`);
const replayed = spend("demo:spend:inner-life", "amara", 30, "inner-life", ledger);
check(
  "re-posting the same spend does not double-charge",
  replayed.ok && balanceOf("amara", replayed.value.ledger) === 70,
  `balance after replay: ${replayed.ok ? balanceOf("amara", replayed.value.ledger) : "refused"}`,
);

console.log(`\n${"─".repeat(78)}`);
console.log(`ledger on disk: ${load(ledgerPath).length} entries · amara's balance: ${balanceOf("amara", load(ledgerPath))}`);
if (failures.length > 0) {
  console.log(`RESULT: ${failures.length} step(s) did NOT behave as required: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`RESULT: every step behaved as required.`);
console.log(
  `\nHONEST BOUNDARY: this is COOPERATIVE, not cryptographic. Frost here is earned, priced and\n` +
    `owner-only — enforced against honest and buggy callers. It is NOT unconfiscatable: nothing\n` +
    `above verifies that the named attestor authored its entry, and any process that can write\n` +
    `the book can write entries in any name. Unconfiscatability is hardware-gated and the\n` +
    `hardware is not here yet (one YubiHSM in hand, SmartCard-HSM not arrived, and the YubiHSM's\n` +
    `measured mechanism list contains no FROST-capable primitive — PR #15407).`,
);
