import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractPaceInstructions, type PaceInstruction } from "./pace-extractor.ts";

function instructionAt(
  instructions: PaceInstruction[],
  index: number,
): PaceInstruction {
  const instruction = instructions[index];
  expect(instruction).toBeDefined();
  return instruction!;
}

function makeTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "pace-ext-"));
  mkdirSync(join(root, "memory"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
  return root;
}

describe("extractPaceInstructions", () => {
  test("single pace instruction from memory file → extracted with source attribution", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_go_hard_aaron_2026_05_02.md"),
      [
        "---",
        "name: Go hard authorization",
        "description: Aaron authorized go-hard overnight",
        "type: feedback",
        "---",
        "",
        "Aaron 2026-05-02 ~00:42Z:",
        "",
        '> *"you can go hard, you don\'t have to do minimum action"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.source).toBe("aaron");
    expect(instruction.file).toContain("feedback_go_hard_aaron_2026_05_02.md");
    expect(instruction.raw).toContain("go hard");
    expect(instruction.timestamp).toBe("2026-05-02");
  });

  test("two instructions from maintainer → both returned in chronological order", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_go_hard_aaron_2026_05_01.md"),
      [
        "---",
        "name: Go hard first",
        "description: First go-hard",
        "type: feedback",
        "---",
        "",
        "Aaron 2026-05-01:",
        "",
        '> *"go hard on the backlog"*',
      ].join("\n"),
    );
    writeFileSync(
      join(root, "memory", "feedback_rest_now_aaron_2026_05_02.md"),
      [
        "---",
        "name: Rest now",
        "description: Rest instruction",
        "type: feedback",
        "---",
        "",
        "Aaron 2026-05-02:",
        "",
        '> *"rest now, hold the line"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(2);
    const first = instructionAt(result, 0);
    const second = instructionAt(result, 1);
    expect((first.timestamp ?? "").localeCompare(second.timestamp ?? "")).toBeLessThanOrEqual(0);
  });

  test("peer-AI framing → extracted with peer-AI source tag", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_cooling_period_claudeai_2026_05_02.md"),
      [
        "---",
        "name: Cooling period advisory",
        "description: Claude.ai suggested cooling period",
        "type: feedback",
        "---",
        "",
        "Claude.ai 2026-05-02:",
        "",
        '> *"cooling period applies after the intense session"*',
      ].join("\n"),
    );
    writeFileSync(
      join(root, "memory", "feedback_codex_pace_note_codex_2026_05_03.md"),
      [
        "---",
        "name: Codex pace framing",
        "description: Codex suggested holding",
        "type: feedback",
        "---",
        "",
        "Codex 2026-05-03:",
        "",
        '> *"recommend holding until maintainer returns"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    const sources = result.map((r) => r.source);
    expect(sources).toContain("claude.ai");
    expect(sources).toContain("codex");
  });

  test("peer-authored file mentioning Aaron uses issuer line for source", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_cooling_claudeai_2026_05_04.md"),
      [
        "---",
        "name: Peer summary of maintainer pace",
        "description: Claude.ai discusses Aaron pace language",
        "type: feedback",
        "---",
        "",
        "Claude.ai 2026-05-04:",
        "",
        'Aaron used the phrase "go hard", but recommend holding until maintainer returns.',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.source).toBe("claude.ai");
    expect(instruction.raw).toContain("recommend holding");
    expect(instruction.timestamp).toBe("2026-05-04");
  });

  test("peer-authored file without issuer line falls back to filename source", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_cooling_claudeai_2026_05_04.md"),
      [
        "---",
        "name: Peer summary of maintainer pace",
        "description: Claude.ai discusses Aaron pace language",
        "type: feedback",
        "---",
        "",
        'Aaron used the phrase "go hard", but recommend holding until maintainer returns.',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.source).toBe("claude.ai");
  });

  test("role-ref 'the human maintainer' recognized as aaron source", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "CLAUDE.md"),
      [
        "# CLAUDE.md",
        "",
        "the human maintainer 2026-05-02:",
        "",
        '> *"go hard, you don\'t have to do minimum action"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.source).toBe("aaron");
    expect(instruction.timestamp).toBe("2026-05-02");
  });

  test("multi-line pace quote inherits attribution header", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "CLAUDE.md"),
      [
        "# CLAUDE.md",
        "",
        "Aaron 2026-05-02:",
        "",
        '> *"go hard on B-0160"*',
        '> *"you can go hard, you don\'t have to do minimum action"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(2);
    for (const instruction of result) {
      expect(instruction.source).toBe("aaron");
      expect(instruction.timestamp).toBe("2026-05-02");
    }
  });

  test("multiple pace lines in one file emit separate candidates with correct timestamps", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "CURRENT-aaron.md"),
      [
        "# CURRENT-aaron.md",
        "",
        'Aaron 2026-05-01: *"go hard on B-0160"*',
        'Aaron 2026-05-02: *"rest now, hold the line"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(2);
    expect(instructionAt(result, 0).raw).toContain("go hard");
    expect(instructionAt(result, 0).timestamp).toBe("2026-05-01");
    expect(instructionAt(result, 1).raw).toContain("rest now");
    expect(instructionAt(result, 1).timestamp).toBe("2026-05-02");
  });

  test("no pace instruction in substrate → empty array", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_some_unrelated_topic_2026_05_01.md"),
      [
        "---",
        "name: Unrelated topic",
        "description: Nothing about pace",
        "type: feedback",
        "---",
        "",
        "This file discusses the build gate configuration.",
        "No pace instructions here.",
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(0);
  });

  test("instruction with rescind language → extracted with raw text preserved", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_stop_grinding_aaron_2026_05_03.md"),
      [
        "---",
        "name: Stop grinding",
        "description: Aaron rescinded go-hard",
        "type: feedback",
        "---",
        "",
        "Aaron 2026-05-03:",
        "",
        '> *"stop grinding, take it easy for now"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.raw).toContain("stop grinding");
    expect(instruction.source).toBe("aaron");
  });

  test("CLAUDE.md pace bullet → extracted", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "CLAUDE.md"),
      [
        "# CLAUDE.md",
        "",
        "Some preamble text.",
        "",
        '- **No-op cadence is the failure mode** — Aaron 2026-05-02: *"you can go hard"*',
        "",
        "Other content.",
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const fromClaude = result.find((r) => r.file.endsWith("CLAUDE.md"));
    expect(fromClaude).toBeDefined();
    expect(fromClaude!.source).toBe("aaron");
    expect(fromClaude!.raw).toContain("go hard");
    expect(fromClaude!.timestamp).toBe("2026-05-02");
  });

  test("CURRENT-aaron.md → extracted", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "CURRENT-aaron.md"),
      [
        "# CURRENT-aaron.md",
        "",
        "## Pace",
        "",
        'Aaron 2026-05-07: *"keep grinding through backlog"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.source).toBe("aaron");
    expect(instruction.raw).toContain("keep grinding");
    expect(instruction.file).toContain("CURRENT-aaron.md");
  });

  test("docs/active-trajectory.md → extracted", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "docs", "active-trajectory.md"),
      [
        "# Active trajectory",
        "",
        'Aaron 2026-05-06: *"go hard on B-0160 decomposition"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.file).toContain("active-trajectory.md");
  });

  test("mixed sources across surfaces → all extracted", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_go_hard_aaron_2026_05_02.md"),
      [
        "---",
        "name: Go hard",
        "description: Maintainer go-hard",
        "type: feedback",
        "---",
        "",
        'Aaron 2026-05-02: *"go hard overnight"*',
      ].join("\n"),
    );
    writeFileSync(
      join(root, "memory", "feedback_cooling_claudeai_2026_05_02.md"),
      [
        "---",
        "name: Cooling",
        "description: Claude.ai cooling period",
        "type: feedback",
        "---",
        "",
        'Claude.ai 2026-05-02: *"cooling period applies"*',
      ].join("\n"),
    );
    writeFileSync(
      join(root, "memory", "CURRENT-aaron.md"),
      [
        "# CURRENT-aaron.md",
        "",
        'Aaron 2026-05-04: *"keep working on the backlog"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(3);
    const sources = result.map((r) => r.source);
    expect(sources).toContain("aaron");
    expect(sources).toContain("claude.ai");
  });

  test("Amara framing → extracted with source amara", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "memory", "feedback_amara_hold_amara_2026_05_01.md"),
      [
        "---",
        "name: Amara hold",
        "description: Amara suggested holding",
        "type: feedback",
        "---",
        "",
        'Amara 2026-05-01: *"hold until maintainer confirms"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.source).toBe("amara");
  });

  test("CLAUDE.md entry quoting Aaron → attributed to aaron, not claude.ai", async () => {
    const root = makeTempRoot();
    writeFileSync(
      join(root, "CLAUDE.md"),
      [
        "# CLAUDE.md",
        "",
        "Aaron 2026-05-02:",
        "",
        '> *"go hard, you don\'t have to do minimum action"*',
      ].join("\n"),
    );

    const result = await extractPaceInstructions(root);
    expect(result.length).toBe(1);
    const instruction = instructionAt(result, 0);
    expect(instruction.source).toBe("aaron");
    expect(instruction.file).toBe("CLAUDE.md");
  });

  test("missing surfaces gracefully handled", async () => {
    const root = makeTempRoot();
    const result = await extractPaceInstructions(root);
    expect(result).toEqual([]);
  });
});
