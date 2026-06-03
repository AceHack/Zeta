// Ace verifyIndex 3-gate trust-core cross-verification oracle (TS).
// Runs the real verifyIndex for each case; asserts the VERDICT (ok) + a stable GATE-CLASS;
// writes ts-output.json; exit non-zero on any mismatch (assert-don't-skip).
//
// The cross-language contract is the verdict + which gate fired, NOT the English reason string
// (a non-TS Ace words its messages differently). The fixture stores expected_gate as a stable
// class; this oracle maps verifyIndex's free-text reason to that class via documented substrings:
//   pinned-key                 <- "pinned key"
//   signature:unsupported-algo <- "signature" + "unsupported-algo"
//   signature:untrusted-key    <- "signature" + "untrusted-key"
//   signature:bad-signature    <- "signature" + "bad-signature"
//   rollback                   <- "rollback"
//   future-skew                <- "future"
//   stale                      <- "stale"
//   ok                         <- verdict ok:true
//
// Each case's expected_ok + expected_gate were authored by an INDEPENDENT Python five-check
// re-implementation of verifyIndex (key_id compare; ed25519 verify via `cryptography`; sequence
// compare; future-skew & staleness arithmetic with the real constants 300000 ms / 30 days; same
// check order). Python's policy impl is wholly separate from Ace's verifyIndex, so a match here is
// genuine cross-language agreement, not a TS-vs-TS tautology. Run from this directory:
// `bun cross-verify.ts`.
import { verifyIndex, type IndexDoc, type CacheMeta, type VerifyOpts } from "../../../tools/ace/registry-remote.ts";
import type { RemoteRegistryConfig } from "../../../tools/ace/store.ts";
import type { TrustEntry } from "../../../tools/ace/signing.ts";

interface Case {
  id: string;
  doc: IndexDoc;
  remote: RemoteRegistryConfig;
  trust: Record<string, TrustEntry>;
  cache_sequence_high_water: number;
  now: number;
  offline: boolean;
  expected_ok: boolean;
  expected_gate: string;
}

const vec = JSON.parse(await Bun.file("vectors.json").text()) as { cases: Case[] };

function gateOf(r: { ok: true } | { ok: false; reason: string }): string {
  if (r.ok) return "ok";
  const m = r.reason;
  if (m.includes("pinned key")) return "pinned-key";
  if (m.includes("signature")) {
    if (m.includes("unsupported-algo")) return "signature:unsupported-algo";
    if (m.includes("untrusted-key")) return "signature:untrusted-key";
    if (m.includes("bad-signature")) return "signature:bad-signature";
    return `signature:?(${m})`;
  }
  if (m.includes("rollback")) return "rollback";
  if (m.includes("future")) return "future-skew";
  if (m.includes("stale")) return "stale";
  return `?(${m})`;
}

const out: Record<string, { ok: boolean; gate: string }> = {};
let mismatches = 0;
const fail = (msg: string): void => { mismatches++; console.error(msg); };

for (const c of vec.cases) {
  const cacheMeta: CacheMeta = {
    url: c.remote.url, sequence_high_water: c.cache_sequence_high_water,
    index_content_hash: "", fetched_at: "",
  };
  const trustStore = new Map<string, TrustEntry>(Object.entries(c.trust));
  const opts: VerifyOpts = { offline: c.offline };
  const r = verifyIndex(c.doc, c.remote, trustStore, cacheMeta, c.now, opts);
  const gate = gateOf(r);
  out[c.id] = { ok: r.ok, gate };
  if (r.ok !== c.expected_ok) fail(`${c.id}: ok MISMATCH got=${r.ok} exp=${c.expected_ok}`);
  if (gate !== c.expected_gate) fail(`${c.id}: gate MISMATCH got=${gate} exp=${c.expected_gate}`);
}

await Bun.write("ts-output.json", JSON.stringify(out, null, 2) + "\n");
console.log(`verify-index-gate cross-verify: cases=${vec.cases.length}, ${mismatches} mismatches.`);
if (mismatches > 0) process.exit(1);
