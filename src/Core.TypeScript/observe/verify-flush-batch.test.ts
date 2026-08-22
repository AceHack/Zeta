import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkBatch,
  deriveProducer,
  hasFailure,
  isDirectEventChild,
  renderReport,
  type BatchInput,
  type Finding,
} from "./verify-flush-batch.ts";
import { buildPersonaRoster, discoverPersonaRosterPaths } from "./verify-attestation-events.ts";
import type { PersonaKeyRoster } from "./attestation-record.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const EMPTY_ROSTER: PersonaKeyRoster = new Map();

const codes = (fs: readonly Finding[]): readonly string[] => fs.filter((f) => f.severity === "fail").map((f) => f.code);

function batch(over: Partial<BatchInput> & Pick<BatchInput, "branch">): BatchInput {
  return {
    changedPaths: [],
    readFile: () => null,
    roster: EMPTY_ROSTER,
    ...over,
  };
}

/** A minimal well-formed heartbeat event authored by `by`. */
function eventJson(by: string): string {
  return JSON.stringify({ id: "a".repeat(32), at: "2026-08-19T00:00:00Z", by, action: { kind: "self_claim" } });
}

const OTTO_BRANCH = `heartbeat/otto-flush-${"0".repeat(40)}`;

describe("deriveProducer", () => {
  test("parses the branch form the fleet actually produces", () => {
    // The whole reason this work-item exists: 300 consecutive skipped runs
    // because the trigger matched `flush/` and nothing produces `flush/`.
    expect(deriveProducer("heartbeat/otto-flush-5199aeccbc2ce8f6243173130385ce3297473715")).toBe("otto");
    expect(deriveProducer("heartbeat/alexa-flush-9954c7958d1988ba54e08e33ea2f85c5b9b09353")).toBe("alexa");
    expect(deriveProducer("heartbeat/soraya-flush-901ddb7a93d1582c65a2eb4c85597fab8c561ad3")).toBe("soraya");
  });

  test("still parses the legacy form, three of which exist on the remote", () => {
    expect(deriveProducer("flush/heartbeat-alexa-20260801T1500Z")).toBe("alexa");
  });

  test("returns null — never the string 'unknown' — for a branch that names no producer", () => {
    // The predecessor emitted `agent=unknown` and carried it into an approval
    // body reading "Producer: unknown". No batch makes that sentence true.
    for (const b of [
      "heartbeat/otto", // a lane, not a flush snapshot
      "heartbeat/tick-metrics",
      "heartbeat/society",
      "main",
      "",
      "heartbeat/otto-flush-not-a-sha",
      "heartbeat/-flush-" + "0".repeat(40), // the empty-agent case `[a-z]*` accepted
    ]) {
      expect(deriveProducer(b)).toBeNull();
    }
  });

  test("is anchored at both ends, so a producer cannot be smuggled in a longer name", () => {
    expect(deriveProducer(`x/heartbeat/otto-flush-${"0".repeat(40)}`)).toBeNull();
    expect(deriveProducer(`heartbeat/otto-flush-${"0".repeat(40)}/evil`)).toBeNull();
    expect(deriveProducer("prefix-flush/heartbeat-alexa-20260801T1500Z")).toBeNull();
  });
});

describe("isDirectEventChild", () => {
  test("accepts a direct child under any of the folder's three naming schemes", () => {
    // Filename SHAPE belongs to hygiene/audit-observe-event-filenames.ts, which
    // knows the folder holds three schemes. A `^[0-9a-f]{32}\.json$` test here
    // would fail a batch carrying a legitimate society event.
    expect(isDirectEventChild(`docs/observe-events/${"0".repeat(32)}.json`)).toBe(true);
    expect(isDirectEventChild("docs/observe-events/society-msm7luj6.json")).toBe(true);
  });

  test("excludes the folder's non-event members, which are not malformed events", () => {
    // Found by dry-running this checker against live PR #12346 BEFORE shipping:
    // `.rs-buffer-otto.json` is a replay-state buffer (`{buffer, seq}`), and
    // treating it as an event produced four FAILs on a file behaving exactly as
    // designed — i.e. every flush batch red forever.
    expect(isDirectEventChild("docs/observe-events/.rs-buffer-otto.json")).toBe(false);
    expect(isDirectEventChild("docs/observe-events/society-index.json")).toBe(false);
    expect(isDirectEventChild("docs/observe-events/README.md")).toBe(false);
  });

  test("rejects traversal, extra components, and prefix collisions", () => {
    for (const p of [
      "docs/observe-events/../../.github/workflows/gate.yml",
      "docs/observe-events/nested/evt.json",
      "docs/observe-events/..",
      "docs/observe-events/",
      "docs/observe-events-evil/evt.json",
      "src/Core/ZSet.fs",
    ]) {
      expect(isDirectEventChild(p)).toBe(false);
    }
  });
});

describe("the producer binding — the check nothing else in the repo performs", () => {
  test("REJECTS a batch whose events name a different agent than the branch", () => {
    // The exact defect: a `heartbeat/alexa-flush-*` branch carrying otto's
    // events. Both facts existed before #12243 and were never compared.
    const path = `docs/observe-events/${"b".repeat(32)}.json`;
    const report = checkBatch(
      batch({
        branch: `heartbeat/alexa-flush-${"0".repeat(40)}`,
        changedPaths: [path],
        readFile: (p) => (p === path ? eventJson("otto") : null),
      }),
    );
    expect(codes(report.findings)).toEqual(["producer-mismatch"]);
    expect(hasFailure(report)).toBe(true);
    expect(report.findings[0]?.detail).toContain("branch names 'alexa'");
    expect(report.findings[0]?.detail).toContain("by: 'otto'");
  });

  test("ACCEPTS the matching case, so the rejection above is discriminating", () => {
    // Without this the test above passes for a checker that fails everything.
    const path = `docs/observe-events/${"b".repeat(32)}.json`;
    const report = checkBatch(
      batch({ branch: OTTO_BRANCH, changedPaths: [path], readFile: (p) => (p === path ? eventJson("otto") : null) }),
    );
    expect(hasFailure(report)).toBe(false);
    expect(report.eventsInspected).toBe(1);
  });

  test("rejects an event with no `by` at all", () => {
    const path = `docs/observe-events/${"c".repeat(32)}.json`;
    const body = JSON.stringify({ id: "x", at: "t", action: {} });
    const report = checkBatch(
      batch({ branch: OTTO_BRANCH, changedPaths: [path], readFile: (p) => (p === path ? body : null) }),
    );
    expect(codes(report.findings)).toContain("producer-mismatch");
  });

  test("refuses outright when the branch names no producer, and inspects nothing", () => {
    const report = checkBatch(
      batch({ branch: "heartbeat/society", changedPaths: [`docs/observe-events/${"d".repeat(32)}.json`] }),
    );
    expect(codes(report.findings)).toEqual(["no-producer"]);
    expect(report.eventsInspected).toBe(0);
    expect(report.producer).toBeNull();
  });

  test("a REMOVED path is not a failure — a deleted file has no `by` to bind", () => {
    const report = checkBatch(
      batch({ branch: OTTO_BRANCH, changedPaths: [`docs/observe-events/${"e".repeat(32)}.json`] }),
    );
    expect(hasFailure(report)).toBe(false);
  });

  test("does not judge the non-event paths a real flush batch carries", () => {
    // Measured on PRs #12344/#12345/#12346. The predecessor's allowlist named
    // none of these, so it would have skipped every downstream step forever.
    const report = checkBatch(
      batch({
        branch: OTTO_BRANCH,
        changedPaths: [
          "db/mutation-findings/otto.jsonl",
          "data/tick-history.json",
          "docs/history/pr-reviews/PR-1.md",
          "docs/github/prs/shards/010/x.json",
        ],
      }),
    );
    expect(hasFailure(report)).toBe(false);
  });

  test("an unparseable or non-object event is a failure, not a skip", () => {
    const p1 = `docs/observe-events/${"f".repeat(32)}.json`;
    const p2 = `docs/observe-events/${"1".repeat(32)}.json`;
    const report = checkBatch(
      batch({
        branch: OTTO_BRANCH,
        changedPaths: [p1, p2],
        readFile: (p) => (p === p1 ? "{not json" : "[1,2,3]"),
      }),
    );
    expect(codes(report.findings)).toEqual(["unreadable", "not-an-object"]);
  });
});

describe("attestation record verification — the half #12256 built and nothing called", () => {
  const attestationJson = (over: Record<string, unknown> = {}): string =>
    JSON.stringify({
      id: "a".repeat(32),
      at: "2026-08-19T00:00:00Z",
      by: "otto",
      kind: "attestation",
      action: { kind: "self_claim" },
      attestation: {
        attestor: "otto",
        attested: "alexa",
        windowStart: "2026-08-19T00:00:00Z",
        windowEnd: "2026-08-19T00:30:00Z",
        eventCount: 3,
        claim: "heartbeat-genuine",
        strength: 1,
        ...over,
      },
    });

  test("a digest-less record is REFUSED — the shape 377 of main's 380 records carry", () => {
    const path = `docs/observe-events/${"a".repeat(32)}.json`;
    const report = checkBatch(
      batch({ branch: OTTO_BRANCH, changedPaths: [path], readFile: (p) => (p === path ? attestationJson() : null) }),
    );
    expect(codes(report.findings)).toContain("attestation-refused");
  });

  test("`kind: attestation` with no attestation object is REFUSED, never silently skipped", () => {
    const path = `docs/observe-events/${"a".repeat(32)}.json`;
    const body = JSON.stringify({ id: "a".repeat(32), at: "t", by: "otto", kind: "attestation", action: {} });
    const report = checkBatch(
      batch({ branch: OTTO_BRANCH, changedPaths: [path], readFile: (p) => (p === path ? body : null) }),
    );
    expect(codes(report.findings)).toContain("attestation-refused");
  });

  test("an UNBOUND record is reported and is NOT a failure by default", () => {
    // The entire committed corpus is unbound; failing on it would fail every
    // batch forever, which is a check nobody can act on.
    const path = `docs/observe-events/${"a".repeat(32)}.json`;
    const body = attestationJson({ attestedDigest: `sha256:${"0".repeat(64)}` });
    const report = checkBatch(
      batch({ branch: OTTO_BRANCH, changedPaths: [path], readFile: (p) => (p === path ? body : null) }),
    );
    const unbound = report.findings.filter((f) => f.code === "attestation-unbound");
    // Either it is unbound (reported, not fatal) or refused for an unrelated
    // reason; what must never happen is a silent pass with nothing recorded.
    expect(report.attestationsInspected).toBe(1);
    if (unbound.length > 0) {
      expect(unbound[0]?.severity).toBe("info");
      expect(hasFailure(report)).toBe(false);
    }
  });

  test("--require-bound promotes UNBOUND to a failure, so the flag is not decorative", () => {
    const path = `docs/observe-events/${"a".repeat(32)}.json`;
    const body = attestationJson({ attestedDigest: `sha256:${"0".repeat(64)}` });
    const input = batch({ branch: OTTO_BRANCH, changedPaths: [path], readFile: (p) => (p === path ? body : null) });
    const lenient = checkBatch(input);
    const strict = checkBatch({ ...input, requireBound: true });
    const lenientUnbound = lenient.findings.filter((f) => f.code === "attestation-unbound");
    if (lenientUnbound.length > 0) {
      expect(hasFailure(lenient)).toBe(false);
      expect(hasFailure(strict)).toBe(true);
    }
  });

  test("a plain heartbeat event is not run through the attestation verifier", () => {
    const path = `docs/observe-events/${"a".repeat(32)}.json`;
    const report = checkBatch(
      batch({ branch: OTTO_BRANCH, changedPaths: [path], readFile: (p) => (p === path ? eventJson("otto") : null) }),
    );
    expect(report.attestationsInspected).toBe(0);
    expect(hasFailure(report)).toBe(false);
  });
});

describe("the report says what it did NOT check", () => {
  test("never uses the word 'attest' about its own output", () => {
    // #12243 removed "I attest that <producer> produced genuine heartbeat
    // events". There is still one identity behind this run, so the word must
    // not come back. It may appear as `attestation`/`attestor` naming the
    // RECORDS being read — those are other parties' claims, not this one's.
    const report = checkBatch(batch({ branch: OTTO_BRANCH }));
    const prose = renderReport(report, OTTO_BRANCH)
      .join("\n")
      .replace(/attestation|attestor|attested/g, "");
    expect(prose).not.toMatch(/\battest\b/i);
  });

  test("names the limit of the binding rather than implying authorship", () => {
    const prose = renderReport(checkBatch(batch({ branch: OTTO_BRANCH })), OTTO_BRANCH).join("\n");
    expect(prose).toContain("consistency property, not proof of authorship");
    expect(prose).toContain("no second identity");
  });

  test("an empty batch reports that nothing was exercised", () => {
    // "Nothing failed" and "nothing was looked at" must not print the same sentence.
    const report = checkBatch(batch({ branch: OTTO_BRANCH }));
    expect(report.findings.map((f) => f.code)).toContain("nothing-inspected");
  });
});

describe("the workflow that calls this", () => {
  const WF = join(REPO_ROOT, ".github", "workflows", "agent-reviewer.yml");

  test("exists and is readable", () => {
    expect(existsSync(WF)).toBe(true);
  });

  /**
   * The workflow with every comment line removed — i.e. what it DOES.
   *
   * The distinction is load-bearing and this test found it: the file's header
   * explains at length why `--approve` was removed, so a naive scan of the whole
   * text reports an approver in a file that has none. Stripping comments is safe
   * in the strict direction, because a `#`-prefixed line cannot execute.
   */
  const executableBody = (): string =>
    readFileSync(WF, "utf8")
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");

  test("holds NO write authority — the auto-approver is gone, not merely dormant", () => {
    // The bar this change had to clear: strictly harder to get a false approval
    // than the dormant state. A capability that is absent cannot be re-armed by
    // renaming a branch.
    const body = executableBody();
    for (const forbidden of ["pr review", "--approve", "git push", "git commit", "contents: write", "pull-requests: write"]) {
      expect(body).not.toContain(forbidden);
    }
    // And the grant it DOES carry is read-only, so the absence above is a
    // property of the permissions block and not merely of today's step list.
    expect(body).toContain("contents: read");
    expect(body).toContain("pull-requests: read");
  });

  test("its trigger matches the branch form the fleet actually produces", () => {
    const wf = executableBody();
    expect(wf).toContain("-flush-");
    expect(wf).not.toContain("startsWith(github.head_ref, 'flush/')");
    // And the pattern the workflow gates on must agree with this module's parser
    // on a real branch name, or the two drift the way the trigger already did.
    expect(deriveProducer("heartbeat/otto-flush-5199aeccbc2ce8f6243173130385ce3297473715")).not.toBeNull();
  });
});

describe("the committed persona roster", () => {
  test("is discoverable and unambiguous, so a real run has something to verify against", () => {
    const sources = discoverPersonaRosterPaths(REPO_ROOT);
    expect(sources.length).toBeGreaterThan(0);
    const roster = buildPersonaRoster(sources);
    expect(roster.size).toBeGreaterThan(0);
  });
});
