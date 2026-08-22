/**
 * signal-death.test.ts
 *
 * These tests kill real child processes with real signals. That is deliberate:
 * the defect is that a SIGSEGV and a clean pass look identical to a check that
 * greps output, and the only way to show a guard discriminates is to produce
 * both and watch the guard separate them.
 *
 * `bash -c 'kill -SEGV $$'` makes the shell deliver SIGSEGV to itself, which is
 * a genuine WIFSIGNALED death — not a program choosing to `exit 139`. Node then
 * reports `status === null, signal === "SIGSEGV"`, which is the structured form
 * of the shell's 128+11.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertCompleted,
  classifyExit,
  classifyShellCode,
  describeDisposition,
  describeExitCode,
  isSignalExitCode,
  producedInterpretableOutput,
  signalName,
  signalNumberOf,
  SIGNAL_EXIT_BASE,
  SignalDeathError,
} from "./signal-death.ts";
import { stripAnsi } from "./run-checked.ts";

const HERE = resolve(import.meta.dir);
const RUN_CHECKED = resolve(HERE, "run-checked.ts");

// ── the arithmetic Aaron named: 139 = 128 + 11, 134 = 128 + 6 ────────────────

describe("shell exit-code decoding", () => {
  test("139 is SIGSEGV", () => {
    expect(signalNumberOf(139)).toBe(11);
    expect(signalName(11)).toBe("SIGSEGV");
    expect(describeExitCode(139)).toContain("SIGSEGV");
    expect(describeExitCode(139)).toContain("128+11");
  });

  test("134 is SIGABRT", () => {
    expect(signalNumberOf(134)).toBe(6);
    expect(signalName(6)).toBe("SIGABRT");
    expect(describeExitCode(134)).toContain("SIGABRT");
  });

  test("SIGNAL_EXIT_BASE is the POSIX 128", () => {
    expect(SIGNAL_EXIT_BASE).toBe(128);
  });

  test("an ordinary nonzero exit is NOT a signal death", () => {
    expect(isSignalExitCode(1)).toBe(false);
    expect(isSignalExitCode(2)).toBe(false);
    expect(isSignalExitCode(127)).toBe(false);
    expect(signalNumberOf(1)).toBeNull();
    expect(describeExitCode(1)).toBe("1 (exited)");
  });

  test("128 itself is not a signal death (there is no signal 0)", () => {
    expect(isSignalExitCode(128)).toBe(false);
  });

  test("the window closes above 128+31, so an arbitrary large code is not read as a signal", () => {
    expect(isSignalExitCode(159)).toBe(true);
    expect(isSignalExitCode(160)).toBe(false);
    expect(isSignalExitCode(255)).toBe(false);
  });

  test("classifyShellCode separates the three outcomes", () => {
    expect(classifyShellCode(0).kind).toBe("completed");
    expect(classifyShellCode(1).kind).toBe("exited");
    expect(classifyShellCode(139).kind).toBe("signal");
    expect(classifyShellCode(134).kind).toBe("signal");
  });
});

// ── real signal deaths, real child processes ────────────────────────────────

describe("a process actually killed by a signal", () => {
  test("SIGSEGV: node reports status=null/signal=SIGSEGV and classifyExit says so", () => {
    const r = spawnSync("bash", ["-c", "kill -SEGV $$"], { encoding: "utf8" });
    expect(r.signal).toBe("SIGSEGV");
    expect(r.status).toBeNull();

    const d = classifyExit(r);
    expect(d.kind).toBe("signal");
    if (d.kind === "signal") {
      expect(d.signal).toBe("SIGSEGV");
      expect(d.signalNumber).toBe(11);
      expect(d.shellCode).toBe(139);
    }
    expect(producedInterpretableOutput(d)).toBe(false);
    expect(describeDisposition(d)).toContain("no verdict was produced");
  });

  test("SIGABRT: the 134 half of the pair", () => {
    const r = spawnSync("bash", ["-c", "kill -ABRT $$"], { encoding: "utf8" });
    const d = classifyExit(r);
    expect(d.kind).toBe("signal");
    if (d.kind === "signal") expect(d.shellCode).toBe(134);
  });

  test("THE DEFECT, demonstrated: a signal death emits NOTHING, so a grep sees a clean run", () => {
    // The crashed process and a clean process produce byte-identical output.
    const crashed = spawnSync("bash", ["-c", "kill -SEGV $$"], { encoding: "utf8" });
    const clean = spawnSync("bash", ["-c", "exit 0"], { encoding: "utf8" });

    const crashedOut = `${crashed.stdout ?? ""}${crashed.stderr ?? ""}`;
    const cleanOut = `${clean.stdout ?? ""}${clean.stderr ?? ""}`;
    expect(crashedOut).toBe("");
    expect(cleanOut).toBe("");

    // So the naive check — "PASS iff the bad string is absent" — passes both.
    const naivePasses = (out: string): boolean => !/sorryAx/.test(out);
    expect(naivePasses(crashedOut)).toBe(true);
    expect(naivePasses(cleanOut)).toBe(true);

    // And the guard separates them. This is the discrimination proof.
    expect(() => assertCompleted("crashed", crashed)).toThrow(SignalDeathError);
    expect(() => assertCompleted("clean", clean)).not.toThrow();
  });

  test("a spawn that never started is refused, not treated as empty-and-fine", () => {
    const r = spawnSync("definitely-not-a-real-binary-9f3a", [], { encoding: "utf8" });
    const d = classifyExit(r);
    expect(d.kind).toBe("never-started");
    expect(producedInterpretableOutput(d)).toBe(false);
  });

  test("a normal nonzero exit is classified as exited, not as a crash", () => {
    const r = spawnSync("bash", ["-c", "exit 3"], { encoding: "utf8" });
    const d = classifyExit(r);
    expect(d.kind).toBe("exited");
    if (d.kind === "exited") expect(d.code).toBe(3);
  });

  test("a program that CHOOSES to exit 139 is exited, not signalled — node knows the difference", () => {
    // At shell resolution these are indistinguishable; through spawnSync they
    // are not, which is why the structured form is preferred.
    const r = spawnSync("bash", ["-c", "exit 139"], { encoding: "utf8" });
    expect(r.signal).toBeNull();
    expect(classifyExit(r).kind).toBe("exited");
  });
});

// ── the CLI, end to end: crash -> 2, finding -> 1, clean -> 0 ───────────────

function runChecked(args: readonly string[]): { code: number; out: string } {
  const r = spawnSync("bun", [RUN_CHECKED, ...args], { encoding: "utf8" });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

describe("run-checked.ts discriminates crash from pass from finding", () => {
  test("SIGSEGV under the check exits 2 and says the check DID NOT RUN", () => {
    const r = runChecked(["--label", "audit", "--deny", "sorryAx", "--", "bash", "-c", "kill -SEGV $$"]);
    expect(r.code).toBe(2);
    expect(r.out).toContain("DID NOT RUN");
    expect(r.out).toContain("SIGSEGV");
    expect(r.out).toContain("it emitted nothing at all");
  });

  test("SIGABRT under the check exits 2", () => {
    const r = runChecked(["--label", "audit", "--deny", "sorryAx", "--", "bash", "-c", "kill -ABRT $$"]);
    expect(r.code).toBe(2);
    expect(r.out).toContain("SIGABRT");
  });

  test("RESTORE AND PASS: the same check over a healthy silent command exits 0", () => {
    const r = runChecked(["--label", "audit", "--deny", "sorryAx", "--", "bash", "-c", "exit 0"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("✓ audit");
  });

  test("a genuine finding exits 1 — distinct from the crash code, because they mean different things", () => {
    const r = runChecked([
      "--label",
      "audit",
      "--deny",
      "sorryAx",
      "--message",
      "ToyModel regressed",
      "--",
      "bash",
      "-c",
      "echo 'theorem foo depends on axioms: [sorryAx]'",
    ]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("ToyModel regressed");
    expect(r.out).toContain("forbidden pattern");
  });

  test("--require catches the vacuous case: the tool ran but printed no verdict line", () => {
    const r = runChecked([
      "--label",
      "audit",
      "--require",
      "depends on axioms",
      "--",
      "bash",
      "-c",
      "echo nothing-useful",
    ]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("MISSING the required pattern");
  });

  test("a nonzero exit is code 2 as well — it also produced no verdict", () => {
    const r = runChecked(["--label", "audit", "--deny", "sorryAx", "--", "bash", "-c", "exit 1"]);
    expect(r.code).toBe(2);
    expect(r.out).toContain("exited 1");
  });

  test("a missing binary is refused rather than read as an empty clean run", () => {
    const r = runChecked(["--label", "audit", "--deny", "sorryAx", "--", "definitely-not-a-real-binary-9f3a"]);
    expect(r.code).toBe(2);
    expect(r.out).toContain("never started");
  });

  test("bad invocation is exit 3, never confused with a result", () => {
    expect(runChecked(["--deny", "x", "--", "true"]).code).toBe(3);
    expect(runChecked(["--label", "l", "--", "true"]).code).toBe(3);
    expect(runChecked(["--label", "l", "--deny", "x"]).code).toBe(3);
  });
});

// ── the second measured trap: colour codes defeat a literal grep ────────────

describe("--strip-ansi (the colourised-tsc trap)", () => {
  // The exact bytes `bunx tsc` wrote to a FILE (not a tty) on 2026-08-15.
  const COLOURED = "\u001b[91merror\u001b[0m\u001b[90m TS2688: \u001b[0mCannot find type definition file for 'bun'.";
  // The same line as bash `printf %b` will re-emit it.
  const EMIT = String.raw`printf '%b\n' '\033[91merror\033[0m\033[90m TS2688: \033[0mCannot find type definition file'`;

  test("without stripping, /error TS/ does not match colourised tsc output", () => {
    expect(COLOURED).toContain("TS2688");
    expect(/error TS/.test(COLOURED)).toBe(false);
    expect(stripAnsi(COLOURED)).toContain("error TS2688");
  });

  test("a literal --deny over the colourised bytes finds nothing — the false clean", () => {
    const r = runChecked(["--label", "typecheck", "--deny", "error TS", "--", "bash", "-c", EMIT]);
    expect(r.code).toBe(0);
  });

  test("with --strip-ansi the same check catches it", () => {
    const r = runChecked(["--label", "typecheck", "--strip-ansi", "--deny", "error TS", "--", "bash", "-c", EMIT]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("forbidden pattern");
  });
});

// ── the diagnostic must not break the tool that reads it ────────────────────

describe("no output line may begin with `---` (the git-trailer trap)", () => {
  // `git interpret-trailers` treats a line beginning `---` as a patch boundary
  // and stops parsing there. A PR body quoting this tool's output would lose its
  // AgencySignature block. The first version of run-checked.ts printed
  // `--- it emitted nothing at all ---` and did exactly that to the PR that
  // introduced it, which is how this test exists.
  const startsWithTripleDash = (out: string): readonly string[] => out.split("\n").filter((l) => l.startsWith("---"));

  test("the signal-death path", () => {
    const r = runChecked(["--label", "audit", "--deny", "sorryAx", "--", "bash", "-c", "kill -SEGV $$"]);
    expect(startsWithTripleDash(r.out)).toEqual([]);
  });

  test("the died-with-output path", () => {
    const r = runChecked(["--label", "audit", "--deny", "x", "--", "bash", "-c", "echo noise; kill -SEGV $$"]);
    expect(r.code).toBe(2);
    expect(startsWithTripleDash(r.out)).toEqual([]);
  });

  test("the finding path", () => {
    const r = runChecked(["--label", "audit", "--deny", "bad", "--", "bash", "-c", "echo bad"]);
    expect(r.code).toBe(1);
    expect(startsWithTripleDash(r.out)).toEqual([]);
  });

  test("and a body carrying that output still parses its trailers", () => {
    const r = runChecked(["--label", "audit", "--deny", "sorryAx", "--", "bash", "-c", "kill -SEGV $$"]);
    const body = `Report\n\n\`\`\`\n${r.out}\n\`\`\`\n\nTask: X\nCo-authored-by: A <a@b.c>\n`;
    const parsed = spawnSync("git", ["interpret-trailers", "--parse"], { input: body, encoding: "utf8" });
    expect(parsed.stdout).toContain("Task: X");
  });
  test("and the `::error::` annotation is NOT ANSI-prefixed, so Actions renders it", () => {
    // GitHub Actions only recognises a workflow command when the line BEGINS
    // with `::error::`. Bun colourises console output even to a pipe, which
    // would prefix every line with an SGR sequence and silently drop the
    // annotation. run-checked.ts writes to process.stderr directly for this.
    const r = runChecked(["--label", "audit", "--deny", "sorryAx", "--", "bash", "-c", "kill -SEGV $$"]);
    const annotations = r.out.split("\n").filter((l) => l.startsWith("::error::"));
    expect(annotations.length).toBeGreaterThan(0);
  });
});
