import { describe, expect, test } from "bun:test";
import {
  classifyCascadeUrgency,
  DEFAULT_CONFIG,
  MAX_REPORTED_MISSING_COMMITS,
  parseArgs,
  parsePositiveMinutes,
  pollOnce,
  realCascadeDetector,
  type Adapters,
  type BranchCompareResult,
  type CascadeDetectorAdapters,
  type CascadeFinding,
  type FetchResult,
  type MergedPR,
  type PRRefsResult,
} from "./missed-substrate-detector";
import type { RecoveryResult } from "./missed-substrate-recovery";
import type { AgentId, MessageEnvelope, SenderAgentId } from "../bus/types";

type FakeCascadeCall = {
  from: SenderAgentId;
  to: AgentId;
  finding: CascadeFinding;
};

function adapters(opts: {
  nowIso: string;
  fetch: FetchResult;
  detectCascade?: (pr: MergedPR) => CascadeFinding | null;
  capturedPublishes?: FakeCascadeCall[];
  publishImpl?: (from: SenderAgentId, to: AgentId, finding: CascadeFinding) => MessageEnvelope;
}): Adapters {
  const captured = opts.capturedPublishes ?? [];
  return {
    now: () => new Date(opts.nowIso),
    fetchRecentMergedPRs: () => opts.fetch,
    detectCascade: opts.detectCascade ?? (() => null),
    publishCascade: opts.publishImpl ?? ((from, to, finding): MessageEnvelope => {
      captured.push({ from, to, finding });
      return {
        id: `env-${captured.length}`,
        from,
        to,
        timestamp: opts.nowIso,
        expiresAt: opts.nowIso,
        topic: "missed-substrate-cascade",
        payload: {
          prNumber: finding.prNumber,
          branchName: finding.branchName,
          missingCommits: finding.missingCommits,
          recommendedAction: "open-recovery-PR",
          urgency: finding.urgency,
        },
      };
    }),
  };
}

function cascadeAdapters(opts: {
  prRefs?: Partial<Record<number, PRRefsResult>>;
  branchCompares?: Partial<Record<string, BranchCompareResult>>;
  nowIso?: string;
}): CascadeDetectorAdapters {
  return {
    now: () => new Date(opts.nowIso ?? "2026-05-13T18:00:00Z"),
    fetchPRRefs: (prNumber: number) =>
      opts.prRefs?.[prNumber] ?? { status: "error", reason: "no fake configured" },
    compareBranchToMerged: (branchName: string) =>
      opts.branchCompares?.[branchName] ?? { status: "error", reason: "no fake configured" },
  };
}

describe("missed-substrate-detector slice 4 (bus publish wiring; slice-3 detect is stub)", () => {
  test("default config", () => {
    expect(DEFAULT_CONFIG.pollIntervalMin).toBe(5);
    expect(DEFAULT_CONFIG.lookbackMin).toBe(30);
    expect(DEFAULT_CONFIG.fetchLimit).toBe(100);
    expect(DEFAULT_CONFIG.noPublish).toBe(false);
    expect(DEFAULT_CONFIG.fromAgent).toBe("otto");
    expect(DEFAULT_CONFIG.toAgent).toBe("*");
  });

  describe("pollOnce — fetch path", () => {
    test("0 candidates when no merged PRs", () => {
      const result = pollOnce(DEFAULT_CONFIG, adapters({
        nowIso: "2026-05-13T18:00:00Z",
        fetch: { status: "ok", prs: [], truncated: false },
      }));
      expect(result.candidatesScanned).toBe(0);
      expect(result.cascadesDetected).toBe(0);
      expect(result.publishedEnvelopeIds).toHaveLength(0);
      expect(result.note).toContain("no merged PRs");
    });

    test("scans merged PRs but stub detector finds no cascades", () => {
      const merged: MergedPR[] = [
        { number: 2997, headRefName: "feat/x", mergedAt: "2026-05-13T17:50:00Z" },
        { number: 2998, headRefName: "feat/y", mergedAt: "2026-05-13T17:55:00Z" },
      ];
      const result = pollOnce(DEFAULT_CONFIG, adapters({
        nowIso: "2026-05-13T18:00:00Z",
        fetch: { status: "ok", prs: merged, truncated: false },
      }));
      expect(result.candidatesScanned).toBe(2);
      expect(result.cascadesDetected).toBe(0);
      expect(result.note).toContain("no cascades detected");
    });

    test("gh-error surfaces explicitly (does NOT silently treat as zero)", () => {
      const result = pollOnce(DEFAULT_CONFIG, adapters({
        nowIso: "2026-05-13T18:00:00Z",
        fetch: { status: "gh-error", reason: "HTTP 503" },
      }));
      expect(result.fetchStatus).toBe("gh-error");
      expect(result.note).toContain("gh fetch failed");
    });

    test("flags truncation warning when results hit fetchLimit", () => {
      const merged: MergedPR[] = Array.from({ length: 100 }, (_, i) => ({
        number: 1000 + i,
        headRefName: `feat/${i}`,
        mergedAt: "2026-05-13T17:50:00Z",
      }));
      const result = pollOnce(DEFAULT_CONFIG, adapters({
        nowIso: "2026-05-13T18:00:00Z",
        fetch: { status: "ok", prs: merged, truncated: true },
      }));
      expect(result.fetchTruncated).toBe(true);
      expect(result.note).toContain("WARNING: results truncated");
    });
  });

  describe("pollOnce — cascade detection + bus publish (slice 4)", () => {
    test("publishes envelope when injected detector finds a cascade", () => {
      const captured: FakeCascadeCall[] = [];
      const cascade: CascadeFinding = {
        prNumber: 2980,
        branchName: "feat/launch-thread",
        missingCommits: ["abc123", "def456"],
        urgency: "medium",
      };
      const result = pollOnce(DEFAULT_CONFIG, adapters({
        nowIso: "2026-05-13T18:00:00Z",
        fetch: { status: "ok", prs: [{ number: 2980, headRefName: "feat/launch-thread", mergedAt: "2026-05-13T17:55:00Z" }], truncated: false },
        detectCascade: () => cascade,
        capturedPublishes: captured,
      }));
      expect(result.cascadesDetected).toBe(1);
      expect(result.publishedEnvelopeIds).toHaveLength(1);
      expect(captured).toHaveLength(1);
      expect(captured[0]!.finding.prNumber).toBe(2980);
      expect(captured[0]!.finding.missingCommits).toEqual(["abc123", "def456"]);
      expect(captured[0]!.finding.urgency).toBe("medium");
      expect(result.note).toContain("cascade(s) detected");
    });

    test("does NOT publish when noPublish=true", () => {
      const captured: FakeCascadeCall[] = [];
      const cascade: CascadeFinding = {
        prNumber: 2980,
        branchName: "feat/x",
        missingCommits: ["sha1"],
        urgency: "high",
      };
      const result = pollOnce(
        { ...DEFAULT_CONFIG, noPublish: true },
        adapters({
          nowIso: "2026-05-13T18:00:00Z",
          fetch: { status: "ok", prs: [{ number: 2980, headRefName: "feat/x", mergedAt: "2026-05-13T17:55:00Z" }], truncated: false },
          detectCascade: () => cascade,
          capturedPublishes: captured,
        }),
      );
      expect(result.cascadesDetected).toBe(1);
      expect(result.publishedEnvelopeIds).toHaveLength(0);
      expect(captured).toHaveLength(0);
      expect(result.note).toContain("publish skipped");
    });

    test("publish failure surfaces in note + does NOT crash poll loop", () => {
      const cascade: CascadeFinding = {
        prNumber: 2980,
        branchName: "feat/x",
        missingCommits: ["sha1"],
        urgency: "low",
      };
      const result = pollOnce(DEFAULT_CONFIG, adapters({
        nowIso: "2026-05-13T18:00:00Z",
        fetch: { status: "ok", prs: [{ number: 2980, headRefName: "feat/x", mergedAt: "2026-05-13T17:55:00Z" }], truncated: false },
        detectCascade: () => cascade,
        publishImpl: () => { throw new Error("bus IO failure"); },
      }));
      expect(result.cascadesDetected).toBe(1);
      expect(result.publishedEnvelopeIds).toHaveLength(0);
      expect(result.note).toContain("publish failed");
    });
  });

  describe("realCascadeDetector (slice 3 — branch-vs-squash comparator)", () => {
    const pr2980: MergedPR = {
      number: 2980,
      headRefName: "feat/launch-thread",
      mergedAt: "2026-05-13T17:55:00Z",
    };

    test("detects cascade — branch has post-squash drift commits", () => {
      const finding = realCascadeDetector(pr2980, cascadeAdapters({
        prRefs: { 2980: { status: "ok", headRefOid: "aaaaaaa" } },
        branchCompares: {
          "feat/launch-thread": { status: "ok", missingCommits: ["bbb111", "ccc222"] },
        },
        nowIso: "2026-05-13T18:00:00Z",
      }));
      expect(finding).not.toBeNull();
      expect(finding!.prNumber).toBe(2980);
      expect(finding!.branchName).toBe("feat/launch-thread");
      expect(finding!.missingCommits).toEqual(["bbb111", "ccc222"]);
      expect(finding!.urgency).toBe("high"); // fresh (<1hr) → high
    });

    test("no cascade when missingCommits is empty (branch matches squash exactly)", () => {
      const finding = realCascadeDetector(pr2980, cascadeAdapters({
        prRefs: { 2980: { status: "ok", headRefOid: "aaaaaaa" } },
        branchCompares: {
          "feat/launch-thread": { status: "ok", missingCommits: [] },
        },
      }));
      expect(finding).toBeNull();
    });

    test("returns null when branch was deleted post-merge (unrecoverable)", () => {
      const finding = realCascadeDetector(pr2980, cascadeAdapters({
        prRefs: { 2980: { status: "ok", headRefOid: "aaaaaaa" } },
        branchCompares: {
          "feat/launch-thread": { status: "branch-deleted", reason: "deleted" },
        },
      }));
      expect(finding).toBeNull();
    });

    test("returns null when branch was rebased (too complex to auto-diagnose)", () => {
      const finding = realCascadeDetector(pr2980, cascadeAdapters({
        prRefs: { 2980: { status: "ok", headRefOid: "aaaaaaa" } },
        branchCompares: {
          "feat/launch-thread": { status: "branch-rebased", reason: "not ancestor" },
        },
      }));
      expect(finding).toBeNull();
    });

    test("returns null when gh has no merge commit (closed-not-merged)", () => {
      const finding = realCascadeDetector(pr2980, cascadeAdapters({
        prRefs: { 2980: { status: "no-merge", reason: "no mergeCommit" } },
        branchCompares: {
          "feat/launch-thread": { status: "ok", missingCommits: ["should-not-reach"] },
        },
      }));
      expect(finding).toBeNull();
    });

    test("returns null when gh errors (cannot diagnose without refs)", () => {
      const finding = realCascadeDetector(pr2980, cascadeAdapters({
        prRefs: { 2980: { status: "error", reason: "HTTP 503" } },
      }));
      expect(finding).toBeNull();
    });

    test("returns null when git compare errors", () => {
      const finding = realCascadeDetector(pr2980, cascadeAdapters({
        prRefs: { 2980: { status: "ok", headRefOid: "aaaaaaa" } },
        branchCompares: {
          "feat/launch-thread": { status: "error", reason: "git fatal" },
        },
      }));
      expect(finding).toBeNull();
    });
  });

  describe("classifyCascadeUrgency", () => {
    const nowMs = new Date("2026-05-13T18:00:00Z").getTime();

    test("high — fresh drift (<1hr) with any commits", () => {
      expect(classifyCascadeUrgency(1, "2026-05-13T17:58:00Z", nowMs)).toBe("high");
      expect(classifyCascadeUrgency(1, "2026-05-13T17:05:00Z", nowMs)).toBe("high");
    });

    test("high — 4+ missing commits regardless of age", () => {
      expect(classifyCascadeUrgency(4, "2026-05-10T10:00:00Z", nowMs)).toBe("high");
      expect(classifyCascadeUrgency(10, "2026-05-01T00:00:00Z", nowMs)).toBe("high");
    });

    test("medium — 2-3 missing commits, age 1hr-24hr", () => {
      expect(classifyCascadeUrgency(2, "2026-05-13T10:00:00Z", nowMs)).toBe("medium");
      expect(classifyCascadeUrgency(3, "2026-05-13T05:00:00Z", nowMs)).toBe("medium");
    });

    test("medium — single commit, age <24hr", () => {
      expect(classifyCascadeUrgency(1, "2026-05-13T05:00:00Z", nowMs)).toBe("medium");
    });

    test("low — single commit, age >24hr (might be intentional WIP)", () => {
      expect(classifyCascadeUrgency(1, "2026-05-11T05:00:00Z", nowMs)).toBe("low");
    });
  });

  describe("slice 3 reporting bounds", () => {
    test("MAX_REPORTED_MISSING_COMMITS is a sane cap", () => {
      expect(MAX_REPORTED_MISSING_COMMITS).toBeGreaterThan(10);
      expect(MAX_REPORTED_MISSING_COMMITS).toBeLessThan(500);
    });
  });

  describe("parsePositiveMinutes", () => {
    test("accepts + rejects", () => {
      expect(parsePositiveMinutes("30", "--lookback-min")).toBe(30);
      expect(() => parsePositiveMinutes("0", "--lookback-min")).toThrow(/positive finite/);
    });
  });

  describe("parseArgs", () => {
    test("defaults + flags", () => {
      expect(parseArgs([])).toEqual(DEFAULT_CONFIG);
      const c = parseArgs(["--once", "--no-publish", "--agent", "vera", "--to", "lior", "--fetch-limit", "50"]);
      expect(c.once).toBe(true);
      expect(c.noPublish).toBe(true);
      expect(c.fromAgent).toBe("vera");
      expect(c.toAgent).toBe("lior");
      expect(c.fetchLimit).toBe(50);
    });

    test("rejects unknown flags + invalid agent", () => {
      expect(() => parseArgs(["--unknown"])).toThrow(/unknown flag/);
      expect(() => parseArgs(["--agent", "*"])).toThrow(/must be one of/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Slice 5b (B-0504): auto-recover wiring
// ─────────────────────────────────────────────────────────────────────

describe("missed-substrate-detector slice 5b (auto-recover wiring)", () => {
  // Helper: build a CascadeFinding for tests
  function makeFinding(prNumber = 1234): CascadeFinding {
    return {
      prNumber,
      branchName: `feat/test-${prNumber}`,
      missingCommits: ["aaa111", "bbb222"],
      urgency: "medium",
    };
  }

  // Helper: extend the existing `adapters()` helper with an openRecoveryPR
  // override. Returns the captured RecoveryResult adapter calls.
  function adaptersWithRecovery(opts: {
    nowIso: string;
    fetch: FetchResult;
    detectCascade?: (pr: MergedPR) => CascadeFinding | null;
    openRecoveryPR?: (finding: CascadeFinding, dryRun: boolean) => RecoveryResult;
    recoveryCalls?: Array<{ finding: CascadeFinding; dryRun: boolean }>;
  }): Adapters {
    const base = adapters(opts);
    if (opts.openRecoveryPR !== undefined) {
      const captured = opts.recoveryCalls ?? [];
      base.openRecoveryPR = (finding, dryRun) => {
        captured.push({ finding, dryRun });
        return opts.openRecoveryPR!(finding, dryRun);
      };
    }
    return base;
  }

  test("autoRecover=false (default): recoveryAttempts=0; adapter never called", () => {
    let adapterCalled = false;
    const config = { ...DEFAULT_CONFIG, once: true };
    const finding = makeFinding();
    const result = pollOnce(config, adaptersWithRecovery({
      nowIso: "2026-05-15T12:00:00Z",
      fetch: { status: "ok", prs: [{ number: 1234, headRefName: "feat/x", mergedAt: "2026-05-15T11:59:00Z" }], truncated: false },
      detectCascade: () => finding,
      openRecoveryPR: () => {
        adapterCalled = true;
        return { status: "opened", prUrl: "https://example/pr/1", cherryPickedCount: 2 };
      },
    }));
    expect(result.recoveryAttempts).toBe(0);
    expect(result.recoveryOpened).toBe(0);
    expect(adapterCalled).toBe(false);
  });

  test("autoRecover=true, adapter returns opened: recoveryOpened=1; note contains PR URL", () => {
    const config = { ...DEFAULT_CONFIG, once: true, autoRecover: true, noPublish: true };
    const finding = makeFinding();
    const result = pollOnce(config, adaptersWithRecovery({
      nowIso: "2026-05-15T12:00:00Z",
      fetch: { status: "ok", prs: [{ number: 1234, headRefName: "feat/x", mergedAt: "2026-05-15T11:59:00Z" }], truncated: false },
      detectCascade: () => finding,
      openRecoveryPR: () => ({ status: "opened", prUrl: "https://example.com/pr/9999", cherryPickedCount: 2 }),
    }));
    expect(result.recoveryAttempts).toBe(1);
    expect(result.recoveryOpened).toBe(1);
    expect(result.note).toContain("https://example.com/pr/9999");
  });

  test("autoRecover=true, recoveryDryRun=true: adapter receives dryRun=true; note reflects dry-run", () => {
    const config = { ...DEFAULT_CONFIG, once: true, autoRecover: true, recoveryDryRun: true, noPublish: true };
    const finding = makeFinding();
    const calls: Array<{ finding: CascadeFinding; dryRun: boolean }> = [];
    const result = pollOnce(config, adaptersWithRecovery({
      nowIso: "2026-05-15T12:00:00Z",
      fetch: { status: "ok", prs: [{ number: 1234, headRefName: "feat/x", mergedAt: "2026-05-15T11:59:00Z" }], truncated: false },
      detectCascade: () => finding,
      openRecoveryPR: () => ({ status: "opened", prUrl: "dry-run", cherryPickedCount: 0 }),
      recoveryCalls: calls,
    }));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.dryRun).toBe(true);
    expect(result.recoveryAttempts).toBe(1);
    expect(result.recoveryOpened).toBe(1);
    expect(result.note).toContain("dry-run");
  });

  test("autoRecover=true, adapter returns already-exists: recoveryOpened=0; note contains already-exists", () => {
    const config = { ...DEFAULT_CONFIG, once: true, autoRecover: true, noPublish: true };
    const result = pollOnce(config, adaptersWithRecovery({
      nowIso: "2026-05-15T12:00:00Z",
      fetch: { status: "ok", prs: [{ number: 1234, headRefName: "feat/x", mergedAt: "2026-05-15T11:59:00Z" }], truncated: false },
      detectCascade: () => makeFinding(),
      openRecoveryPR: () => ({ status: "already-exists", reason: "PR for recovery/1234 already open" }),
    }));
    expect(result.recoveryAttempts).toBe(1);
    expect(result.recoveryOpened).toBe(0);
    expect(result.note).toContain("already-exists");
  });

  test("autoRecover=true, adapter throws: recoveryOpened=0; note contains 'recovery error'; poll completes", () => {
    const config = { ...DEFAULT_CONFIG, once: true, autoRecover: true, noPublish: true };
    const result = pollOnce(config, adaptersWithRecovery({
      nowIso: "2026-05-15T12:00:00Z",
      fetch: { status: "ok", prs: [{ number: 1234, headRefName: "feat/x", mergedAt: "2026-05-15T11:59:00Z" }], truncated: false },
      detectCascade: () => makeFinding(),
      openRecoveryPR: () => { throw new Error("simulated adapter blowup"); },
    }));
    expect(result.recoveryAttempts).toBe(1);
    expect(result.recoveryOpened).toBe(0);
    expect(result.note).toContain("recovery error");
    expect(result.note).toContain("simulated adapter blowup");
    // The poll itself completed successfully — fetchStatus=ok, no exception.
    expect(result.fetchStatus).toBe("ok");
  });

  test("parseArgs sets autoRecover/recoveryDryRun flags + DEFAULT_CONFIG defaults", () => {
    expect(parseArgs([]).autoRecover).toBe(false);
    expect(parseArgs([]).recoveryDryRun).toBe(false);
    expect(parseArgs(["--auto-recover"]).autoRecover).toBe(true);
    expect(parseArgs(["--recovery-dry-run"]).recoveryDryRun).toBe(true);
    // --recovery-dry-run without --auto-recover is silently accepted.
    const c = parseArgs(["--recovery-dry-run"]);
    expect(c.recoveryDryRun).toBe(true);
    expect(c.autoRecover).toBe(false);
    // Combined.
    const both = parseArgs(["--auto-recover", "--recovery-dry-run"]);
    expect(both.autoRecover).toBe(true);
    expect(both.recoveryDryRun).toBe(true);
  });

  test("autoRecover=true but adapter undefined: recoveryAttempts=0 (treats missing adapter as autoRecover=false)", () => {
    const config = { ...DEFAULT_CONFIG, once: true, autoRecover: true, noPublish: true };
    // Don't pass openRecoveryPR to adapters() — it's optional.
    const result = pollOnce(config, adapters({
      nowIso: "2026-05-15T12:00:00Z",
      fetch: { status: "ok", prs: [{ number: 1234, headRefName: "feat/x", mergedAt: "2026-05-15T11:59:00Z" }], truncated: false },
      detectCascade: () => makeFinding(),
    }));
    // Cascade was detected but adapter is missing → recovery skipped silently.
    expect(result.cascadesDetected).toBe(1);
    expect(result.recoveryAttempts).toBe(0);
    expect(result.recoveryOpened).toBe(0);
  });
});
