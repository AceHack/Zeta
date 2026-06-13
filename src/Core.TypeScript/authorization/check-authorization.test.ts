import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkAuthorization,
  formatInterpretation,
  formatShardField,
} from "./check-authorization.ts";

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "auth-check-"));
  mkdirSync(join(root, "memory"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  return root;
}

describe("checkAuthorization", () => {
  test("end-to-end: maintainer go-hard → operative surfaced", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_go_hard_aaron_2026_05_02.md"),
      [
        "---",
        "name: Go hard",
        "description: Aaron go-hard",
        "type: feedback",
        "---",
        "",
        "Aaron 2026-05-02:",
        "",
        '> *"go hard on the backlog"*',
      ].join("\n"),
    );

    const output = await checkAuthorization(root);

    expect(output.queriedAt).toBeTruthy();
    expect(output.result.operative).not.toBeNull();
    expect(output.result.operative!.source).toBe("aaron");
    expect(output.result.operative!.raw).toContain("go hard");
  });

  test("end-to-end: peer-AI only → operative null, never-idle default", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_cooling_claudeai_2026_05_02.md"),
      [
        "---",
        "name: Cooling",
        "description: Claude.ai cooling",
        "type: feedback",
        "---",
        "",
        "Claude.ai 2026-05-02:",
        "",
        '> *"cooling period applies"*',
      ].join("\n"),
    );

    const output = await checkAuthorization(root);

    expect(output.result.operative).toBeNull();
    expect(output.result.reason).toContain("never-idle");
  });

  test("end-to-end: empty substrate → operative null", async () => {
    const root = makeTempRoot();

    const output = await checkAuthorization(root);

    expect(output.result.operative).toBeNull();
    expect(output.result.allCandidates.length).toBe(0);
  });

  test("end-to-end: maintainer + peer-AI → only maintainer operative", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_go_hard_aaron_2026_05_02.md"),
      [
        "---",
        "name: Go hard",
        "description: Aaron go-hard",
        "type: feedback",
        "---",
        "",
        "Aaron 2026-05-02:",
        "",
        '> *"go hard on the backlog"*',
      ].join("\n"),
    );
    writeFileSync(
      join(root, "memory", "feedback_cooling_claudeai_2026_05_02.md"),
      [
        "---",
        "name: Cooling",
        "description: Claude.ai cooling",
        "type: feedback",
        "---",
        "",
        "Claude.ai 2026-05-02:",
        "",
        '> *"cooling period applies"*',
      ].join("\n"),
    );

    const output = await checkAuthorization(root);

    expect(output.result.operative).not.toBeNull();
    expect(output.result.operative!.source).toBe("aaron");
    expect(output.result.filteredOut.length).toBe(1);
  });

  test("queriedAt is a valid ISO timestamp", async () => {
    const root = makeTempRoot();
    const output = await checkAuthorization(root);
    const parsed = Date.parse(output.queriedAt);
    expect(Number.isNaN(parsed)).toBe(false);
  });
});

describe("formatInterpretation", () => {
  test("operative present → shows source + timestamp + raw", () => {
    const text = formatInterpretation({
      queriedAt: "2026-05-08T12:00:00Z",
      result: {
        operative: {
          source: "aaron",
          timestamp: "2026-05-02",
          raw: "go hard on the backlog",
          file: "memory/feedback_test.md",
        },
        reason: "most recent authorized pace instruction from aaron (2026-05-02)",
        allCandidates: [],
        filteredOut: [],
      },
    });

    expect(text).toContain("[authorization]");
    expect(text).toContain("operative:");
    expect(text).toContain("go hard");
    expect(text).toContain("aaron");
    expect(text).toContain("2026-05-02");
  });

  test("operative null → shows reason with never-idle default", () => {
    const text = formatInterpretation({
      queriedAt: "2026-05-08T12:00:00Z",
      result: {
        operative: null,
        reason:
          "no operative pace authorization found; default to never-idle floor per CLAUDE.md",
        allCandidates: [],
        filteredOut: [],
      },
    });

    expect(text).toContain("[authorization]");
    expect(text).toContain("never-idle");
  });

  test("operative with null timestamp → shows undated", () => {
    const text = formatInterpretation({
      queriedAt: "2026-05-08T12:00:00Z",
      result: {
        operative: {
          source: "aaron",
          timestamp: null,
          raw: "keep working on the backlog",
          file: "memory/feedback_test.md",
        },
        reason: "most recent authorized pace instruction from aaron (undated)",
        allCandidates: [],
        filteredOut: [],
      },
    });

    expect(text).toContain("undated");
  });
});

describe("formatShardField", () => {
  test("operative present → compact source + timestamp + quote", () => {
    const text = formatShardField({
      queriedAt: "2026-05-08T12:00:00Z",
      result: {
        operative: {
          source: "aaron",
          timestamp: "2026-05-02",
          raw: "go hard on the backlog",
          file: "memory/feedback_test.md",
        },
        reason: "",
        allCandidates: [],
        filteredOut: [],
      },
    });

    expect(text).toBe('aaron 2026-05-02: "go hard on the backlog"');
  });

  test("operative null → never-idle default", () => {
    const text = formatShardField({
      queriedAt: "2026-05-08T12:00:00Z",
      result: {
        operative: null,
        reason: "",
        allCandidates: [],
        filteredOut: [],
      },
    });

    expect(text).toContain("never-idle");
  });
});
