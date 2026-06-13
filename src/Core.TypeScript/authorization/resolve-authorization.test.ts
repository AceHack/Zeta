import { describe, expect, test } from "bun:test";
import type { PaceInstruction } from "./pace-extractor.ts";
import { resolveAuthorization } from "./resolve-authorization.ts";

function pi(
  source: string,
  timestamp: string | null,
  raw: string,
  file = "memory/feedback_test.md",
): PaceInstruction {
  return { source, timestamp, raw, file };
}

describe("resolveAuthorization", () => {
  test("cross-instance absorption: Claude.ai cooling-period alongside maintainer go-hard → only maintainer surfaces", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-02", 'go hard on the backlog'),
      pi("claude.ai", "2026-05-02", 'cooling period applies after the intense session'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.source).toBe("aaron");
    expect(result.operative!.raw).toContain("go hard");
    expect(result.filteredOut.length).toBe(1);
    expect(result.filteredOut[0]!.source).toBe("claude.ai");
  });

  test("later pace instruction replaces earlier ones → latest with pace content wins", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'go hard on the backlog'),
      pi("aaron", "2026-05-02", 'keep grinding through backlog'),
      pi("aaron", "2026-05-03", 'stop grinding, take it easy for now'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.raw).toContain("stop grinding");
    expect(result.operative!.timestamp).toBe("2026-05-03");
  });

  test("go-hard rescinds a prior rest instruction", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'rest now, hold the line'),
      pi("aaron", "2026-05-03", 'go hard on B-0160'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.raw).toContain("go hard");
    expect(result.operative!.timestamp).toBe("2026-05-03");
  });

  test("implicit displacement (later instruction on different topic) does NOT rescind", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'go hard on the backlog'),
      pi("aaron", "2026-05-03", 'really look at the backlog priorities'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.timestamp).toBe("2026-05-03");
  });

  test("no maintainer instruction → operative: null with default reason", () => {
    const instructions: PaceInstruction[] = [
      pi("claude.ai", "2026-05-02", 'cooling period applies'),
      pi("codex", "2026-05-03", 'recommend holding until maintainer returns'),
      pi("amara", "2026-05-01", 'hold until maintainer confirms'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).toBeNull();
    expect(result.reason).toContain("no operative pace authorization found");
    expect(result.filteredOut.length).toBe(3);
  });

  test("empty input → operative: null", () => {
    const result = resolveAuthorization([]);

    expect(result.operative).toBeNull();
    expect(result.reason).toContain("no operative pace authorization found");
    expect(result.allCandidates.length).toBe(0);
    expect(result.filteredOut.length).toBe(0);
  });

  test("multiple maintainer instructions, none rescinded → most recent wins", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'go hard on the backlog'),
      pi("aaron", "2026-05-02", 'keep working on the backlog'),
      pi("aaron", "2026-05-04", 'keep grinding through backlog'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.timestamp).toBe("2026-05-04");
    expect(result.operative!.raw).toContain("keep grinding");
  });

  test("mixed sources: only aaron instructions pass source filter", () => {
    const instructions: PaceInstruction[] = [
      pi("grok", "2026-05-01", 'recommend holding'),
      pi("aaron", "2026-05-02", 'go hard on the backlog'),
      pi("gemini", "2026-05-03", 'cooling period applies'),
      pi("amara", "2026-05-03", 'hold until maintainer confirms'),
      pi("ani", "2026-05-03", 'take it easy'),
      pi("riven", "2026-05-03", 'stop grinding'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.source).toBe("aaron");
    expect(result.filteredOut.length).toBe(5);
    for (const filtered of result.filteredOut) {
      expect(filtered.source).not.toBe("aaron");
    }
  });

  test("unknown source is filtered out", () => {
    const instructions: PaceInstruction[] = [
      pi("unknown", "2026-05-02", 'go hard on the backlog'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).toBeNull();
    expect(result.filteredOut.length).toBe(1);
  });

  test("allCandidates preserves full input", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'go hard'),
      pi("claude.ai", "2026-05-02", 'cooling period'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.allCandidates.length).toBe(2);
    expect(result.allCandidates).toEqual(instructions);
  });

  test("null timestamps sort after dated instructions", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", null, 'keep working on the backlog'),
      pi("aaron", "2026-05-02", 'go hard on the backlog'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.timestamp).toBe("2026-05-02");
  });

  test("single maintainer instruction → operative directly", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-07", 'keep grinding through backlog'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.raw).toContain("keep grinding");
    expect(result.reason).toContain("most recent");
    expect(result.filteredOut.length).toBe(0);
  });

  test("rest then go-hard then rest → final rest is operative", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'rest now'),
      pi("aaron", "2026-05-02", 'go hard on the backlog'),
      pi("aaron", "2026-05-03", 'hold the line, rest now'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.timestamp).toBe("2026-05-03");
    expect(result.operative!.raw).toContain("rest now");
  });

  test("pure rescind without replacement → operative: null", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'go hard on the backlog'),
      pi("aaron", "2026-05-03", 'I rescind the go-hard instruction'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).toBeNull();
    expect(result.reason).toContain("rescinded");
  });

  test("rescind then new pace → new pace is operative", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'go hard on the backlog'),
      pi("aaron", "2026-05-02", 'I rescind that pace instruction'),
      pi("aaron", "2026-05-03", 'keep grinding through backlog'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.timestamp).toBe("2026-05-03");
    expect(result.operative!.raw).toContain("keep grinding");
  });

  test("rescind-only as only authorized instruction → operative: null", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-03", 'forget what I said about pace'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).toBeNull();
    expect(result.reason).toContain("rescinded");
  });

  test("rescind with pace replacement in same instruction → treated as pace", () => {
    const instructions: PaceInstruction[] = [
      pi("aaron", "2026-05-01", 'go hard on the backlog'),
      pi("aaron", "2026-05-03", 'I rescind the go-hard, take it easy for now'),
    ];

    const result = resolveAuthorization(instructions);

    expect(result.operative).not.toBeNull();
    expect(result.operative!.raw).toContain("rescind");
    expect(result.operative!.raw).toContain("take it easy");
  });
});
