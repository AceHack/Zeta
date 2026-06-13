import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CONFIG,
  parseArgs,
  parsePositiveMinutes,
  pollOnce,
  type Adapters,
} from "./standing-by-detector";
import type { AgentId, MessageEnvelope, SenderAgentId } from "../bus/types";

type FakeNudgeCall = {
  from: SenderAgentId;
  to: AgentId;
  idleMinutes: number;
  rationale: string;
};

function fakeAdapters(
  nowIso: string,
  lastCommitIso: string | null,
  lastPrActivityIso: string | null = null,
  capturedCalls: FakeNudgeCall[] = [],
  publishImpl?: (from: SenderAgentId, to: AgentId, idleMinutes: number, rationale: string) => MessageEnvelope,
): Adapters {
  return {
    now: () => new Date(nowIso),
    lastCommitIso: () => lastCommitIso,
    lastPrActivityIso: () => lastPrActivityIso,
    publishNudge: publishImpl ?? ((from, to, idleMinutes, rationale): MessageEnvelope => {
      capturedCalls.push({ from, to, idleMinutes, rationale });
      return {
        id: "test-envelope-id",
        from,
        to,
        timestamp: nowIso,
        expiresAt: nowIso,
        topic: "infinite-backlog-nudge",
        payload: { idleMinutes, rationale },
      };
    }),
  };
}

describe("standing-by-detector slice 3 (P0 fix: PR-activity poll)", () => {
  test("default config has sensible thresholds + bus defaults", () => {
    expect(DEFAULT_CONFIG.pollIntervalMin).toBe(5);
    expect(DEFAULT_CONFIG.idleThresholdMin).toBe(15);
    expect(DEFAULT_CONFIG.fromAgent).toBe("otto");
    expect(DEFAULT_CONFIG.toAgent).toBe("*");
  });

  describe("P0 fix — idle uses MAX(commit, pr) so PR-only agents are NOT flagged", () => {
    test("recent COMMIT only (no PR activity) → NOT idle", () => {
      const result = pollOnce(
        { ...DEFAULT_CONFIG, idleThresholdMin: 15, noPublish: true },
        fakeAdapters("2026-05-13T18:00:00Z", "2026-05-13T17:58:00Z", null),
      );
      expect(result.idleDetected).toBe(false);
      expect(result.idleMinutes).toBe(2);
      expect(result.lastCommitAt).toBe("2026-05-13T17:58:00.000Z");
      expect(result.lastPrActivityAt).toBeNull();
    });

    test("recent PR activity only (no commit) → NOT idle (was Riven's P0 false-negative)", () => {
      const result = pollOnce(
        { ...DEFAULT_CONFIG, idleThresholdMin: 15, noPublish: true },
        fakeAdapters("2026-05-13T18:00:00Z", null, "2026-05-13T17:58:00Z"),
      );
      expect(result.idleDetected).toBe(false);
      expect(result.idleMinutes).toBe(2);
      expect(result.lastCommitAt).toBeNull();
      expect(result.lastPrActivityAt).toBe("2026-05-13T17:58:00.000Z");
    });

    test("OLD commit + recent PR activity → NOT idle (PR work counts)", () => {
      const result = pollOnce(
        { ...DEFAULT_CONFIG, idleThresholdMin: 15, noPublish: true },
        fakeAdapters("2026-05-13T18:00:00Z", "2026-05-13T17:00:00Z", "2026-05-13T17:55:00Z"),
      );
      expect(result.idleDetected).toBe(false);
      expect(result.idleMinutes).toBe(5);
    });

    test("recent commit + OLD PR activity → NOT idle (commit work counts)", () => {
      const result = pollOnce(
        { ...DEFAULT_CONFIG, idleThresholdMin: 15, noPublish: true },
        fakeAdapters("2026-05-13T18:00:00Z", "2026-05-13T17:55:00Z", "2026-05-13T17:00:00Z"),
      );
      expect(result.idleDetected).toBe(false);
      expect(result.idleMinutes).toBe(5);
    });

    test("BOTH old → idle flagged", () => {
      const result = pollOnce(
        { ...DEFAULT_CONFIG, idleThresholdMin: 15, noPublish: true },
        fakeAdapters("2026-05-13T18:00:00Z", "2026-05-13T17:30:00Z", "2026-05-13T17:35:00Z"),
      );
      expect(result.idleDetected).toBe(true);
      expect(result.idleMinutes).toBe(25);
    });

    test("BOTH null → no detection (no false positive)", () => {
      const result = pollOnce(
        DEFAULT_CONFIG,
        fakeAdapters("2026-05-13T18:00:00Z", null, null),
      );
      expect(result.idleDetected).toBe(false);
      expect(result.lastCommitAt).toBeNull();
      expect(result.lastPrActivityAt).toBeNull();
      expect(result.note).toContain("no commit AND no PR activity");
    });
  });

  describe("bus publish — slice 4 behavior preserved", () => {
    test("publishes nudge when idle detected", () => {
      const captured: FakeNudgeCall[] = [];
      const result = pollOnce(
        { ...DEFAULT_CONFIG, idleThresholdMin: 15 },
        fakeAdapters("2026-05-13T18:00:00Z", "2026-05-13T17:30:00Z", "2026-05-13T17:35:00Z", captured),
      );
      expect(result.publishedEnvelopeId).toBe("test-envelope-id");
      expect(result.lastPublishError).toBeNull();
      expect(result.note).toContain("nudge published");
      expect(captured).toHaveLength(1);
      expect(captured[0]!.rationale).toContain("Standing-by detected");
      expect(captured[0]!.rationale).toContain("commit or PR");
    });

    test("does NOT publish when noPublish=true", () => {
      const captured: FakeNudgeCall[] = [];
      const result = pollOnce(
        { ...DEFAULT_CONFIG, idleThresholdMin: 15, noPublish: true },
        fakeAdapters("2026-05-13T18:00:00Z", "2026-05-13T17:30:00Z", null, captured),
      );
      expect(result.idleDetected).toBe(true);
      expect(result.publishedEnvelopeId).toBeNull();
      expect(captured).toHaveLength(0);
      expect(result.note).toContain("publish skipped");
    });

    test("P1 fix — publish failure surfaces in structured lastPublishError field", () => {
      const captured: FakeNudgeCall[] = [];
      const result = pollOnce(
        { ...DEFAULT_CONFIG, idleThresholdMin: 15 },
        fakeAdapters(
          "2026-05-13T18:00:00Z",
          "2026-05-13T17:30:00Z",
          null,
          captured,
          () => { throw new Error("bus IO failure: disk full"); },
        ),
      );
      expect(result.idleDetected).toBe(true);
      expect(result.publishedEnvelopeId).toBeNull();
      expect(result.lastPublishError).toBe("bus IO failure: disk full");
      expect(result.note).toContain("publish failed");
    });
  });

  describe("parsePositiveMinutes", () => {
    test("accepts positive finite numbers", () => {
      expect(parsePositiveMinutes("5", "--poll-min")).toBe(5);
    });

    test("rejects invalid inputs", () => {
      expect(() => parsePositiveMinutes(undefined, "--poll-min")).toThrow(/requires a value/);
      expect(() => parsePositiveMinutes("0", "--poll-min")).toThrow(/positive finite/);
      expect(() => parsePositiveMinutes("Infinity", "--poll-min")).toThrow(/positive finite/);
    });
  });

  describe("parseArgs", () => {
    test("default config when no args", () => {
      expect(parseArgs([])).toEqual(DEFAULT_CONFIG);
    });

    test("--once / --no-publish / --agent / --to flags", () => {
      const config = parseArgs(["--once", "--no-publish", "--agent", "vera", "--to", "lior"]);
      expect(config.once).toBe(true);
      expect(config.noPublish).toBe(true);
      expect(config.fromAgent).toBe("vera");
      expect(config.toAgent).toBe("lior");
    });

    test("rejects invalid --agent (no broadcast as sender)", () => {
      expect(() => parseArgs(["--agent", "*"])).toThrow(/must be one of/);
    });

    test("rejects unknown flags", () => {
      expect(() => parseArgs(["--unknown"])).toThrow(/unknown flag/);
    });
  });
});
