// audit-heartbeat-lane-attestations.test.ts
//
// These tests exist to prove the auditor CAN FAIL. An audit that only ever returns clean is
// the vacuity class, and a bypass guarded by a vacuous audit is an unguarded bypass. So every
// violation status below has a test that produces it, and each such test is a falsifier: delete
// the corresponding branch in the auditor and the test goes red.
//
// Design: docs/research/2026-08-25-pr-free-heartbeat-lane-attestation-instead-of-gate.md

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

import {
  ATTESTATION_KEYS,
  allowEntryFor,
  classifyCommit,
  globToRegExp,
  isViolation,
  matchesAny,
  parseArgs,
  parseAttestation,
  parseRegistry,
  REGISTRY_FILENAME,
  type Change,
  type CommitRecord,
  type Registry,
  type Status,
} from "./audit-heartbeat-lane-attestations.ts";

const REPO_ROOT = joinPath(import.meta.dir, "..", "..", "..");

function shippedRegistryRaw(): unknown {
  return JSON.parse(readFileSync(joinPath(REPO_ROOT, REGISTRY_FILENAME), "utf8")) as unknown;
}

const REGISTRY: Registry = parseRegistry(shippedRegistryRaw());
const CUTOVER = Date.parse("2026-08-01T00:00:00Z");
const TREE = "1111111111111111111111111111111111111111";
const OTHER_TREE = "2222222222222222222222222222222222222222";
const LANE_EMAIL = [...REGISTRY.laneEmails][0] ?? "";

function attestation(over: Partial<Record<string, string>> = {}): string {
  const fields: Record<string, string> = {
    "Verification-Version": "1",
    "Verification-Lane": "agent-heartbeat",
    "Verification-Subject": TREE,
    "Verification-Checks": REGISTRY.requiredChecks.join(","),
    "Verification-Verdict": "pass",
    "Verification-Runner": "github-actions/32818569388",
    ...over,
  };
  return ATTESTATION_KEYS.map((k) => `${k}: ${fields[k] ?? ""}`).join("\n");
}

function commit(over: Partial<CommitRecord> = {}): CommitRecord {
  return {
    sha: "abcdef0123456789abcdef0123456789abcdef01",
    treeSha: TREE,
    subject: "[heartbeat-batch-merge] periodic sync to main",
    message: `[heartbeat-batch-merge] periodic sync to main\n\n${attestation()}\n`,
    authorEmail: LANE_EMAIL,
    committerEmail: LANE_EMAIL,
    timestamp: Date.parse("2026-08-20T00:00:00Z"),
    isoDate: "2026-08-20T00:00:00Z",
    changes: [{ kind: "A", path: "docs/observe-events/080d01bb43a51810a0130008f43fa6f9.json", addedBytes: 300 }],
    ...over,
  };
}

function verdict(over: Partial<CommitRecord> = {}): Status {
  return classifyCommit(commit(over), REGISTRY, CUTOVER).status;
}

// ---------------------------------------------------------------------------
// THE SHIPPED REGISTRY IS ITSELF A CLAIM — check it
// ---------------------------------------------------------------------------

describe("shipped registry", () => {
  it("parses, so a malformed registry cannot ship green", () => {
    expect(REGISTRY.allow.length).toBeGreaterThan(0);
    expect(REGISTRY.requiredChecks.length).toBeGreaterThan(0);
    expect(REGISTRY.laneEmails.size).toBeGreaterThan(0);
  });

  it("covers the paths the CURRENT heartbeat flush actually writes", () => {
    // Measured from the last 40 `[heartbeat-batch-merge]` commits on origin/main, 2026-08-25.
    // If the lane starts writing somewhere new, this list is where the widening is reviewed.
    const measured = [
      "data/ci-runs.jsonl",
      "db/mutation-findings/alexa.jsonl",
      "docs/github/prs/manifest.jsonl",
      "docs/github/prs/shards/013/080000000000000078030000000032ce.json",
      "docs/observe-events/080d01bb43a51810a0130008f43fa6f9.json",
      "docs/history/pr-reviews/PR-13011-archive-pr-reviews-pr-13007-on-merge.md",
      "docs/agent-heartbeats/otto/2026/05/27/080cf34dbc457007a013000803955b96.md",
      "data/vault-state.json",
    ];
    for (const path of measured) {
      expect(allowEntryFor(path, REGISTRY)).not.toBeNull();
    }
  });

  it("refuses an empty lane-identity list — that would match nothing and pass vacuously", () => {
    const raw = shippedRegistryRaw() as Record<string, unknown>;
    const ident = { ...(raw["laneIdentities"] as Record<string, unknown>), emails: [] };
    expect(() => parseRegistry({ ...raw, laneIdentities: ident })).toThrow(/empty/);
  });

  it("refuses an empty requiredChecks — an attestation could then name no checks and pass", () => {
    const raw = shippedRegistryRaw() as Record<string, unknown>;
    expect(() => parseRegistry({ ...raw, requiredChecks: { names: [] } })).toThrow(/empty/);
  });

  it("refuses a requiredCheck absent from knownChecks", () => {
    const raw = shippedRegistryRaw() as Record<string, unknown>;
    expect(() =>
      parseRegistry({ ...raw, requiredChecks: { names: ["not-a-real-check"] } }),
    ).toThrow(/not in knownChecks/);
  });

  it("refuses an unknown path mode", () => {
    const raw = shippedRegistryRaw() as Record<string, unknown>;
    const paths = { ...(raw["paths"] as Record<string, unknown>), allow: [{ pattern: "x", mode: "whatever" }] };
    expect(() => parseRegistry({ ...raw, paths })).toThrow(/mode must be/);
  });
});

// ---------------------------------------------------------------------------
// GLOB — the language of the path predicate is small on purpose
// ---------------------------------------------------------------------------

describe("glob", () => {
  it("`*` does not cross a slash and `**` does", () => {
    expect(globToRegExp("db/*.jsonl").test("db/otto.jsonl")).toBe(true);
    expect(globToRegExp("db/*.jsonl").test("db/nested/otto.jsonl")).toBe(false);
    expect(globToRegExp("db/**").test("db/nested/deep/otto.jsonl")).toBe(true);
  });

  it("treats regex metacharacters in a pattern as literals", () => {
    expect(globToRegExp("data/ci-runs.jsonl").test("data/ci-runsXjsonl")).toBe(false);
    expect(globToRegExp("a+b.json").test("a+b.json")).toBe(true);
  });

  it("anchors — a prefix match is not a match", () => {
    expect(matchesAny("docs/observe-events-evil/x.json", [".github/**", "src/**"])).toBe(false);
    expect(globToRegExp("src/**").test("notsrc/x.ts")).toBe(false);
    expect(globToRegExp("src/**").test("src/x.ts")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ATTESTATION PARSING
// ---------------------------------------------------------------------------

describe("attestation parsing", () => {
  it("accepts the canonical block", () => {
    const parsed = parseAttestation(`subject\n\n${attestation()}\n`);
    expect(parsed).not.toBeNull();
    expect(parsed !== null && "ok" in parsed && parsed.ok.lane).toBe("agent-heartbeat");
  });

  it("returns null when a key is missing — an incomplete block is NOT a block", () => {
    const lines = attestation().split("\n").filter((l) => !l.startsWith("Verification-Runner"));
    expect(parseAttestation(lines.join("\n"))).toBeNull();
  });

  it("returns null when a blank line splits the block — contiguity is the rule", () => {
    const lines = attestation().split("\n");
    lines.splice(3, 0, "");
    expect(parseAttestation(lines.join("\n"))).toBeNull();
  });

  it("takes the LAST complete block when a squash preimage carries several", () => {
    const first = attestation({ "Verification-Lane": "old-lane" });
    const second = attestation({ "Verification-Lane": "new-lane" });
    const parsed = parseAttestation(`${first}\n\nprose\n\n${second}`);
    expect(parsed !== null && "ok" in parsed && parsed.ok.lane).toBe("new-lane");
  });

  it("reports MALFORMED distinctly from MISSING for a bad subject", () => {
    const parsed = parseAttestation(attestation({ "Verification-Subject": "not-a-sha" }));
    expect(parsed !== null && "malformed" in parsed).toBe(true);
  });

  it("rejects a version other than 1 rather than guessing", () => {
    const parsed = parseAttestation(attestation({ "Verification-Version": "2" }));
    expect(parsed !== null && "malformed" in parsed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CLASSIFICATION — one test per violation status. These are the falsifiers.
// ---------------------------------------------------------------------------

describe("classification", () => {
  it("OK for a well-formed lane commit inside the allowlist", () => {
    expect(verdict()).toBe("OK");
  });

  it("NOT-LANE for anyone else, so the audit never blocks ordinary work", () => {
    expect(verdict({ authorEmail: "human@example.com", committerEmail: "noreply@github.com" })).toBe("NOT-LANE");
  });

  it("PRE-CUTOVER-LEGACY before the cutover, so arming adds no retroactive red", () => {
    expect(verdict({ timestamp: Date.parse("2026-07-01T00:00:00Z"), message: "no attestation here" })).toBe(
      "PRE-CUTOVER-LEGACY",
    );
  });

  it("MISSING-ATTESTATION — the base case the bypass would otherwise permit", () => {
    expect(verdict({ message: "[heartbeat-batch-merge] periodic sync to main\n" })).toBe("MISSING-ATTESTATION");
  });

  it("SUBJECT-MISMATCH — a COPIED attestation is caught by the tree binding", () => {
    // The exact scenario agencysignature-block.ts records as unparseable for v1: an attestation
    // lifted verbatim from a commit that really was verified. Byte-identical, and still caught,
    // because it names a tree these bytes do not hash to.
    expect(verdict({ treeSha: OTHER_TREE })).toBe("SUBJECT-MISMATCH");
  });

  it("VERDICT-NOT-PASS — a lane that failed its own checks may not push", () => {
    expect(
      verdict({ message: `s\n\n${attestation({ "Verification-Verdict": "fail" })}\n` }),
    ).toBe("VERDICT-NOT-PASS");
  });

  it("MISSING-REQUIRED-CHECK — a lane cannot pass by naming FEWER checks", () => {
    const fewer = REGISTRY.requiredChecks.slice(0, 1).join(",");
    expect(verdict({ message: `s\n\n${attestation({ "Verification-Checks": fewer })}\n` })).toBe(
      "MISSING-REQUIRED-CHECK",
    );
  });

  it("UNKNOWN-CHECK — a lane cannot pass by INVENTING a weaker check name", () => {
    const invented = `${REGISTRY.requiredChecks.join(",")},looks-fine-to-me`;
    expect(verdict({ message: `s\n\n${attestation({ "Verification-Checks": invented })}\n` })).toBe("UNKNOWN-CHECK");
  });

  it("PATH-ESCAPE for a path outside every allow pattern", () => {
    expect(verdict({ changes: [{ kind: "A", path: "docs/VISION.md", addedBytes: 10 }] })).toBe("PATH-ESCAPE");
  });

  it("PATH-ESCAPE for the workflow directory — the supply-chain surface", () => {
    expect(verdict({ changes: [{ kind: "A", path: ".github/workflows/evil.yml", addedBytes: 10 }] })).toBe("PATH-ESCAPE");
  });

  it("PATH-ESCAPE for source, even alongside legitimate telemetry in the same commit", () => {
    const changes: readonly Change[] = [
      { kind: "A", path: "docs/observe-events/aaaa.json", addedBytes: 10 },
      { kind: "M", path: "src/Core/Runtime.fs", addedBytes: 10 },
    ];
    expect(verdict({ changes })).toBe("PATH-ESCAPE");
  });

  it("MODE-VIOLATION when an add-only path is modified", () => {
    expect(verdict({ changes: [{ kind: "M", path: "docs/observe-events/aaaa.json", addedBytes: 10 }] })).toBe(
      "MODE-VIOLATION",
    );
  });

  it("MODE-VIOLATION when an append-only path is rewritten rather than extended", () => {
    const changes: readonly Change[] = [
      { kind: "M", path: "data/ci-runs.jsonl", addedBytes: 10, prefixPreserved: false },
    ];
    expect(verdict({ changes })).toBe("MODE-VIOLATION");
  });

  it("accepts a genuine append on an append-only path", () => {
    const changes: readonly Change[] = [
      { kind: "M", path: "data/ci-runs.jsonl", addedBytes: 10, prefixPreserved: true },
    ];
    expect(verdict({ changes })).toBe("OK");
  });

  it("MODE-VIOLATION for a DELETE anywhere — the lane is never allowed to erase", () => {
    for (const kind of ["D", "R", "C", "T"] as const) {
      expect(verdict({ changes: [{ kind, path: "docs/observe-events/aaaa.json", addedBytes: 10 }] })).toBe(
        "MODE-VIOLATION",
      );
    }
  });

  it("BUDGET-EXCEEDED on a runaway file count", () => {
    const changes = Array.from({ length: REGISTRY.maxFilesPerCommit + 1 }, (_, i) => ({
      kind: "A" as const,
      path: `docs/observe-events/${String(i).padStart(32, "0")}.json`,
      addedBytes: 10,
    }));
    expect(verdict({ changes })).toBe("BUDGET-EXCEEDED");
  });

  it("BUDGET-EXCEEDED on an oversized single file", () => {
    const changes: readonly Change[] = [
      { kind: "A", path: "docs/observe-events/aaaa.json", addedBytes: REGISTRY.maxAddedBytesPerFile + 1 },
    ];
    expect(verdict({ changes })).toBe("BUDGET-EXCEEDED");
  });

  it("every violation status is reachable and marked as a violation", () => {
    const reached: readonly Status[] = [
      "MISSING-ATTESTATION",
      "MALFORMED-ATTESTATION",
      "SUBJECT-MISMATCH",
      "VERDICT-NOT-PASS",
      "UNKNOWN-CHECK",
      "MISSING-REQUIRED-CHECK",
      "PATH-ESCAPE",
      "MODE-VIOLATION",
      "BUDGET-EXCEEDED",
    ];
    for (const status of reached) expect(isViolation(status)).toBe(true);
    for (const status of ["OK", "NOT-LANE", "PRE-CUTOVER-LEGACY"] as const) {
      expect(isViolation(status)).toBe(false);
    }
  });

  it("MALFORMED-ATTESTATION is distinct from MISSING — different findings, different fixes", () => {
    expect(verdict({ message: `s\n\n${attestation({ "Verification-Lane": "" })}\n` })).toBe("MALFORMED-ATTESTATION");
  });
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

describe("parseArgs", () => {
  it("rejects an unknown flag rather than ignoring it", () => {
    const r = parseArgs(["--not-a-flag"]);
    expect("err" in r).toBe(true);
  });

  it("rejects a flag with no value", () => {
    expect("err" in parseArgs(["--since"])).toBe(true);
  });

  it("rejects a non-positive --max", () => {
    expect("err" in parseArgs(["--max", "0"])).toBe(true);
  });

  it("accepts the documented flags", () => {
    const r = parseArgs(["--branch", "main", "--max", "5", "--online"]);
    expect("ok" in r && r.ok.branch).toBe("main");
    expect("ok" in r && r.ok.max).toBe(5);
    expect("ok" in r && r.ok.online).toBe(true);
  });
});
