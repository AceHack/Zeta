// Falsifiers for AH003. Each case is written so that removing the behaviour it pins turns
// it red — a test that passes against a stubbed-out audit is not a falsifier.
//
// Structured around the three findings the audit can emit plus the two ways it could be
// vacuous: reporting OK over files it never read, and reporting OK because its scan found
// nothing at all. Both of those happened for real while this file was being written, which
// is why they have cases rather than comments.

import { describe, expect, test } from "bun:test";
import {
  auditWorkflow,
  resolveWriter,
  successPathsWithoutWrite,
  writesOutput,
} from "./audit-workflow-step-output-has-writer";

const noScripts = (): string | null => null;

describe("writesOutput", () => {
  test("recognises the canonical append", () => {
    expect(writesOutput('echo "skip=true" >> "$GITHUB_OUTPUT"', "skip")).toBe(true);
  });

  test("recognises an unquoted redirect target", () => {
    expect(writesOutput("echo skip=true >> $GITHUB_OUTPUT", "skip")).toBe(true);
  });

  test("recognises a write built across lines (heredoc / staged variable)", () => {
    const run = ['V=$(compute)', 'printf "pr_number=%s\\n" "$V" >> "$GITHUB_OUTPUT"'].join("\n");
    expect(writesOutput(run, "pr_number")).toBe(true);
  });

  test("a block that never touches GITHUB_OUTPUT writes nothing", () => {
    expect(writesOutput('echo "skip=true"', "skip")).toBe(false);
  });

  test("does not confuse a different output name that shares a prefix", () => {
    expect(writesOutput('echo "skipped=1" >> "$GITHUB_OUTPUT"', "skip")).toBe(false);
  });

  test("does not match the name merely being READ", () => {
    expect(writesOutput('echo "$skip" >> "$GITHUB_OUTPUT"', "skip")).toBe(false);
  });
});

describe("resolveWriter — delegated scripts", () => {
  const runner = 'bun src/Core.TypeScript/planning/runner.ts --flag';

  test("follows an invoked script that writes the name", () => {
    const script = 'const p = process.env.GITHUB_OUTPUT;\nwriteOutput("branch", plan.branch);';
    expect(resolveWriter(runner, "branch", () => script)).toBe("writes");
  });

  test("reports opaque — not absent — when the script writes outputs it cannot name", () => {
    const script = 'const p = process.env.GITHUB_OUTPUT;\nwriteOutput(computedName, v);';
    expect(resolveWriter(runner, "branch", () => script)).toBe("opaque");
  });

  test("a script that never touches GITHUB_OUTPUT leaves the name absent", () => {
    expect(resolveWriter(runner, "branch", () => "console.log('hi')")).toBe("absent");
  });

  test("an unreadable script does not silently satisfy the reference", () => {
    expect(resolveWriter(runner, "branch", noScripts)).toBe("absent");
  });

  test("REGRESSION: the passkey false positive — a real runner shape resolves to writes", () => {
    // The first draft flagged passkey-proposal-gated-commit.yml because the writes live in
    // TypeScript behind a helper. Blocking CI on a working workflow is the expensive
    // direction, so this shape is pinned.
    const script = [
      "function writeOutput(name: string, value: string): void {",
      "  const outputPath = process.env.GITHUB_OUTPUT;",
      "  if (!outputPath) return;",
      "  writeFileSync(outputPath, `${name}=${value}\\n`, { flag: 'a' });",
      "}",
      'writeOutput("proposal_id", plan.proposalId);',
    ].join("\n");
    expect(
      resolveWriter("bun src/Core.TypeScript/planning/proposal-gated-commit-runner.ts", "proposal_id", () => script),
    ).toBe("writes");
  });
});

describe("successPathsWithoutWrite", () => {
  test("flags a guard clause that returns success writing nothing", () => {
    const run = [
      'if [ -n "$BLOCKER" ]; then',
      '  echo "backpressured"',
      "  exit 0",
      "fi",
      'echo "skip=false" >> "$GITHUB_OUTPUT"',
      "do_work",
    ].join("\n");
    expect(successPathsWithoutWrite(run, ["skip"])).toEqual([3]);
  });

  test("a guard that writes before returning is satisfied", () => {
    const run = [
      'if [ -n "$BLOCKER" ]; then',
      '  echo "skip=true" >> "$GITHUB_OUTPUT"',
      "  exit 0",
      "fi",
      'echo "skip=false" >> "$GITHUB_OUTPUT"',
      "do_work",
    ].join("\n");
    expect(successPathsWithoutWrite(run, ["skip"])).toEqual([]);
  });

  test("an unconditional write above satisfies later guards", () => {
    const run = [
      'echo "skip=false" >> "$GITHUB_OUTPUT"',
      'if [ -n "$X" ]; then',
      "  exit 0",
      "fi",
      "do_work",
    ].join("\n");
    expect(successPathsWithoutWrite(run, ["skip"])).toEqual([]);
  });

  test("REGRESSION: a write inside an EXITING guard does not exempt a later guard", () => {
    // The first implementation used a single latch, so the write at line 2 marked
    // "something was written" and silently exempted the second guard. That hid the real
    // second instance in agent-heartbeat.yml (the `RC == 4` path).
    const run = [
      'if [ -n "$A" ]; then',
      '  echo "skip=true" >> "$GITHUB_OUTPUT"',
      "  exit 0",
      "fi",
      'if [ "$RC" -eq 4 ]; then',
      '  echo "already there"',
      "  exit 0",
      "fi",
      "do_work",
    ].join("\n");
    expect(successPathsWithoutWrite(run, ["skip"])).toEqual([7]);
  });

  test("a trailing exit 0 is ordinary completion, not an early guard", () => {
    expect(successPathsWithoutWrite(["do_work", "exit 0"].join("\n"), ["skip"])).toEqual([]);
  });

  test("exit 0 inside a comment returns from nothing", () => {
    const run = ["# exit 0 would be wrong here", "do_work", 'echo "skip=x" >> "$GITHUB_OUTPUT"', "done_thing"].join("\n");
    expect(successPathsWithoutWrite(run, ["skip"])).toEqual([]);
  });

  test("a nonzero exit is loud already and is not flagged", () => {
    const run = ['if [ -z "$PR" ]; then', "  exit 1", "fi", "do_work"].join("\n");
    expect(successPathsWithoutWrite(run, ["skip"])).toEqual([]);
  });

  test("VACUITY GUARD: no read names means nothing to check, and no findings invented", () => {
    const run = ['if [ -n "$X" ]; then', "  exit 0", "fi", "do_work"].join("\n");
    expect(successPathsWithoutWrite(run, [])).toEqual([]);
  });
});

describe("auditWorkflow", () => {
  const wf = (steps: string): string => `name: t\non: push\njobs:\n  j:\n    steps:\n${steps}`;

  test("flags a reference to a step id that does not exist", () => {
    const src = wf(
      [
        "      - name: reader",
        "        if: steps.ghost.outputs.ready == 'true'",
        "        run: echo hi",
      ].join("\n"),
    );
    const { findings } = auditWorkflow("t.yml", src, noScripts);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.reason).toBe("no-such-step");
    expect(findings[0]?.producerStep).toBe("ghost");
  });

  test("flags a run step that never writes the referenced output", () => {
    const src = wf(
      [
        "      - id: prod",
        "        run: echo doing-work",
        "      - name: reader",
        "        env:",
        "          PR: ${{ steps.prod.outputs.pr_number }}",
        "        run: echo $PR",
      ].join("\n"),
    );
    const { findings } = auditWorkflow("t.yml", src, noScripts);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.reason).toBe("step-writes-no-such-output");
    expect(findings[0]?.output).toBe("pr_number");
  });

  test("does NOT flag an output of a `uses:` step — opaque by construction", () => {
    const src = wf(
      [
        "      - id: prod",
        "        uses: some/action@v1",
        "      - name: reader",
        "        env:",
        "          V: ${{ steps.prod.outputs.anything }}",
        "        run: echo $V",
      ].join("\n"),
    );
    const res = auditWorkflow("t.yml", src, noScripts);
    expect(res.findings).toHaveLength(0);
    expect(res.opaque).toBe(1);
  });

  test("accepts a step that does write the output", () => {
    const src = wf(
      [
        "      - id: prod",
        '        run: echo "pr_number=7" >> "$GITHUB_OUTPUT"',
        "      - name: reader",
        "        env:",
        "          PR: ${{ steps.prod.outputs.pr_number }}",
        "        run: echo $PR",
      ].join("\n"),
    );
    expect(auditWorkflow("t.yml", src, noScripts).findings).toHaveLength(0);
  });

  test("LIVE SHAPE: writes the output but returns success before reaching it", () => {
    const src = wf(
      [
        "      - id: prod",
        "        run: |",
        '          if [ -n "$BLOCKER" ]; then',
        '            echo "backpressured"',
        "            exit 0",
        "          fi",
        '          echo "skip=false" >> "$GITHUB_OUTPUT"',
        "          do_work",
        "      - name: reader",
        "        if: steps.prod.outputs.skip != 'true'",
        "        run: echo go",
      ].join("\n"),
    );
    const { findings } = auditWorkflow("t.yml", src, noScripts);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.reason).toBe("success-path-without-write");
    expect(findings[0]?.runLine).toBe(3);
  });

  test("counts references so a silent zero-scan is detectable", () => {
    const src = wf(
      [
        "      - id: prod",
        '        run: echo "a=1" >> "$GITHUB_OUTPUT"',
        "      - name: reader",
        "        env:",
        "          A: ${{ steps.prod.outputs.a }}",
        "        run: echo $A",
      ].join("\n"),
    );
    expect(auditWorkflow("t.yml", src, noScripts).refs).toBe(1);
  });

  test("VACUITY GUARD: a workflow with no jobs yields no findings AND no references", () => {
    const res = auditWorkflow("t.yml", "name: t\non: push\n", noScripts);
    expect(res.findings).toHaveLength(0);
    expect(res.refs).toBe(0);
  });

  test("a reference in one job cannot be satisfied by a step in another", () => {
    const src = [
      "name: t",
      "on: push",
      "jobs:",
      "  a:",
      "    steps:",
      "      - id: prod",
      '        run: echo "v=1" >> "$GITHUB_OUTPUT"',
      "  b:",
      "    steps:",
      "      - name: reader",
      "        env:",
      "          V: ${{ steps.prod.outputs.v }}",
      "        run: echo $V",
    ].join("\n");
    const { findings } = auditWorkflow("t.yml", src, noScripts);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.job).toBe("b");
    expect(findings[0]?.reason).toBe("no-such-step");
  });
});
