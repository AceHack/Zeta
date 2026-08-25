import { describe, expect, test } from "bun:test";

import {
  auditArchiveRefs,
  gate,
  gatedFindings,
  partitionByAge,
  STRANDED_BASELINE,
} from "./audit-orphaned-archive-refs";

const ref = (pr: number, run = 1, attempt = 1): string =>
  `automation/pr-archive-${String(pr)}-run-${String(run)}-attempt-${String(attempt)}`;

describe("auditArchiveRefs — the record-on-main invariant", () => {
  test("a ref whose record is on main is LANDED, not stranded", () => {
    const r = auditArchiveRefs([ref(100)], new Set([100]));
    expect(r.landed.map((f) => f.sourcePr)).toEqual([100]);
    expect(r.stranded).toEqual([]);
  });

  test("a ref whose record is ABSENT from main is STRANDED", () => {
    const r = auditArchiveRefs([ref(100)], new Set([999]));
    expect(r.stranded.map((f) => f.sourcePr)).toEqual([100]);
    expect(r.landed).toEqual([]);
  });

  // The whole point of the audit: it must see refs that no PR was ever opened
  // for. The sibling audit takes `gh pr list` as input and therefore cannot.
  test("classifies a ref with no PR at all — the case the PR-based audit cannot see", () => {
    const r = auditArchiveRefs([ref(4242)], new Set([1, 2, 3]));
    expect(r.stranded).toHaveLength(1);
    expect(r.stranded[0]!.ref).toBe(ref(4242));
  });

  test("unparseable refs are OUT OF SCOPE, never silently counted clean", () => {
    const r = auditArchiveRefs(["heartbeat/otto", "automation/other-thing", "main"], new Set([1]));
    expect(r.findings).toEqual([]);
  });

  test("no clock is consulted — the same input replays to the same verdict", () => {
    const input = [ref(1), ref(2)];
    const archived = new Set([1]);
    expect(auditArchiveRefs(input, archived)).toEqual(auditArchiveRefs(input, archived));
  });
});

describe("gate — the ratchet", () => {
  test("passes when the stranded count is at the high-water mark", () => {
    const refs = Array.from({ length: 5 }, (_, i) => ref(i + 1));
    expect(gate(auditArchiveRefs(refs, new Set([999])), 5)).toEqual({ ok: true });
  });

  test("FAILS the moment one more record is stranded", () => {
    const refs = Array.from({ length: 6 }, (_, i) => ref(i + 1));
    const verdict = gate(auditArchiveRefs(refs, new Set([999])), 5);
    expect(verdict).toHaveProperty("error");
    expect((verdict as { error: string }).error).toContain("has been stranded");
  });

  // The cheap wrong fix must not make the check pass. Re-runs push `-attempt-2`
  // for the same source PR; counting refs would inflate the backlog with
  // duplicates of a single missing record and mask the true number.
  test("counts DISTINCT source PRs, so a re-run attempt is not a second strand", () => {
    const refs = [ref(7, 1, 1), ref(7, 2, 2), ref(7, 3, 3)];
    expect(gate(auditArchiveRefs(refs, new Set([999])), 1)).toEqual({ ok: true });
  });

  // Liveness: an empty index means the lookup broke, which would classify every
  // ref as stranded. Reporting that as a lane failure would be measuring the
  // audit's own defect; reporting it as success would be worse.
  test("REFUSES a verdict when the record index is empty", () => {
    const verdict = gate(auditArchiveRefs([ref(1)], new Set()), 1000);
    expect(verdict).toHaveProperty("error");
    expect((verdict as { error: string }).error).toContain("EMPTY");
  });

  test("a lane with zero archive refs is healthy and passes", () => {
    expect(gate(auditArchiveRefs([], new Set([1])), 0)).toEqual({ ok: true });
  });

  test("gates on the SETTLED set, so a record still in flight does not fail the floor", () => {
    const refs = [ref(1), ref(2)];
    const result = auditArchiveRefs(refs, new Set([999]));
    const now = new Date("2026-08-25T12:00:00Z");
    const fresh = new Map([
      [ref(1), "2026-08-25T11:55:00Z"],
      [ref(2), "2026-08-25T11:58:00Z"],
    ]);
    const part = partitionByAge(result.stranded, fresh, now, 120);
    expect(part.inFlight).toHaveLength(2);
    expect(gate(result, 0, gatedFindings(part))).toEqual({ ok: true });
  });

  test("the shipped baseline is a small number, not the ref population", () => {
    // Guards the correction this audit made: the pile is ref litter (1,279 refs
    // whose records landed), not 1,284 lost records. A baseline near the ref
    // count would mean the two verdicts had been collapsed again.
    expect(STRANDED_BASELINE).toBeLessThan(100);
  });
});

describe("partitionByAge — the grace window", () => {
  const NOW = new Date("2026-08-25T12:00:00Z");
  const stranded = (n: number) => auditArchiveRefs([ref(n)], new Set([999])).stranded;

  test("a record older than the grace window is SETTLED — the real defect", () => {
    const part = partitionByAge(stranded(1), new Map([[ref(1), "2026-08-25T06:00:00Z"]]), NOW, 120);
    expect(part.settled).toHaveLength(1);
    expect(part.inFlight).toHaveLength(0);
  });

  test("a record inside the grace window is IN FLIGHT — normal operation, not a finding", () => {
    const part = partitionByAge(stranded(1), new Map([[ref(1), "2026-08-25T11:30:00Z"]]), NOW, 120);
    expect(part.inFlight).toHaveLength(1);
    expect(part.settled).toHaveLength(0);
  });

  // Fail-closed. "I could not measure it" and "it is fine" are different answers,
  // and collapsing them is the exact tolerance this whole change removes.
  test("an unreadable age counts AGAINST the ratchet, never as clean", () => {
    for (const bad of [null, "not-a-date"]) {
      const part = partitionByAge(stranded(1), new Map([[ref(1), bad]]), NOW, 120);
      expect(part.unknownAge).toHaveLength(1);
      expect(gatedFindings(part)).toHaveLength(1);
    }
  });

  test("a ref missing from the age map is unknown, not silently in-flight", () => {
    const part = partitionByAge(stranded(1), new Map(), NOW, 120);
    expect(gatedFindings(part)).toHaveLength(1);
  });

  test("the clock is injected, so the partition replays deterministically", () => {
    const ages = new Map([[ref(1), "2026-08-25T06:00:00Z"]]);
    expect(partitionByAge(stranded(1), ages, NOW, 120)).toEqual(partitionByAge(stranded(1), ages, NOW, 120));
  });
});
