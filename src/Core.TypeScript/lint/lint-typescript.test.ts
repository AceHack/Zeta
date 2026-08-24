// 081KZKWB1FZ — the unprovisioned-environment guard.
//
// The guard exists because `tsc` cannot distinguish "not declared" (a real error)
// from "declared but never installed here" (an unprovisioned checkout): both are
// TS2307. The second reads exactly like a finding, which is how a phantom
// `Cannot find module 'playwright'` convinced two independent reviewers that lint
// was red on main while CI was green on the same commit.
//
// The load-bearing test is the NEGATIVE one: the guard must never be able to
// swallow a genuine missing-module error.
import { describe, expect, it } from "bun:test";
import {
  missingInstalledDeps,
  packageBaseName,
  STEPS,
  type Step,
  successMessage,
  toolsRun,
  TYPESCRIPT_COMPILER_COMMAND,
} from "./lint-typescript.ts";

const tsc2307 = (specifier: string) =>
  `src/foo.ts(6,51): error TS2307: Cannot find module '${specifier}' or its corresponding type declarations.`;

describe("packageBaseName", () => {
  it("keeps the scope for scoped packages", () => {
    expect(packageBaseName("@scope/pkg")).toBe("@scope/pkg");
    expect(packageBaseName("@scope/pkg/sub/path")).toBe("@scope/pkg");
  });

  it("strips subpaths from unscoped packages", () => {
    expect(packageBaseName("playwright")).toBe("playwright");
    expect(packageBaseName("playwright/test")).toBe("playwright");
  });
});

describe("TypeScript compiler runtime", () => {
  it("executes the checked-in compiler under Node to avoid Bun teardown crashes", () => {
    expect(TYPESCRIPT_COMPILER_COMMAND).toEqual([
      "node",
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "--pretty",
      "false",
      "-p",
      "tsconfig.json",
    ]);
  });
});

describe("missingInstalledDeps (081KZKWB1FZ)", () => {
  const declared = new Set(["playwright", "@scope/pkg"]);
  const nothingInstalled = () => false;
  const everythingInstalled = () => true;

  it("flags a DECLARED but NOT-INSTALLED module (the phantom-error case)", () => {
    expect(missingInstalledDeps(tsc2307("playwright"), declared, nothingInstalled)).toEqual([
      "playwright",
    ]);
  });

  it("NEVER flags an UNDECLARED module — that is a real error and must survive", () => {
    // The whole guard is unacceptable if it can hide this. `totally-made-up` is
    // absent from package.json, so it is a genuine TS2307 and must not be
    // reclassified as an environment problem.
    expect(missingInstalledDeps(tsc2307("totally-made-up"), declared, nothingInstalled)).toEqual(
      [],
    );
  });

  it("does not flag a declared module that IS installed", () => {
    expect(missingInstalledDeps(tsc2307("playwright"), declared, everythingInstalled)).toEqual([]);
  });

  it("ignores relative and absolute specifiers", () => {
    const out = `${tsc2307("./local-thing")}\n${tsc2307("/abs/path")}`;
    expect(missingInstalledDeps(out, declared, nothingInstalled)).toEqual([]);
  });

  it("maps a subpath import back to its declared package", () => {
    expect(missingInstalledDeps(tsc2307("@scope/pkg/sub"), declared, nothingInstalled)).toEqual([
      "@scope/pkg",
    ]);
  });

  it("reports nothing for output containing no TS2307 at all", () => {
    const other = "src/foo.ts(1,1): error TS2532: Object is possibly 'undefined'.";
    expect(missingInstalledDeps(other, declared, nothingInstalled)).toEqual([]);
  });

  it("misses a TS2307 whose 'error TS' token was split by ANSI pretty (081M031RT7S)", () => {
    // Default tsc --pretty paints the code: `error` + reset + ` TS2307`.
    // Measured on #10811: grep -c "error TS" == 0 while tsc exited 2.
    // --pretty false is the fix; do not teach the regex to parse color.
    const pretty = "src/foo.ts(6,51): error\u001b[0m\u001b[90m TS2307: Cannot find module 'playwright'.";
    expect(missingInstalledDeps(pretty, declared, nothingInstalled)).toEqual([]);
    expect(pretty.includes("error TS")).toBe(false);
  });

  it("deduplicates and sorts across many diagnostics", () => {
    const out = [tsc2307("playwright"), tsc2307("playwright"), tsc2307("@scope/pkg")].join("\n");
    expect(missingInstalledDeps(out, declared, nothingInstalled)).toEqual([
      "@scope/pkg",
      "playwright",
    ]);
  });
});

// ── 081M0RBXF6J087G0R0023EX9X2 — the success line may not name a tool that did
// not run. `main()` printed "✓ TypeScript, Prettier, and style checks passed
// successfully!" on every green run while STEPS held tsc alone: two tools
// announced as passed that never executed. A corrected string is one edit away
// from drifting back, so the message is now derived from STEPS and these are the
// falsifiers for that derivation.
//
// The load-bearing test is `never names a tool it did not run` — it is written
// against the REAL, exported STEPS, so it goes red the moment the message and the
// step list disagree, in either direction.

/**
 * Tools this repo has configured, pinned, or named in CI. eslint / prettier /
 * stylelint are the three that were being announced without running; the rest are
 * plausible future additions. A tool absent from STEPS must not appear in the
 * message, and this roster is what makes that assertion able to fail.
 */
const CLAIMABLE_TOOLS = [
  "tsc",
  "eslint",
  "prettier",
  "stylelint",
  "markdownlint",
  "oxlint",
  "biome",
  "dprint",
] as const;

const fakeStep = (tool: string): Step => ({
  label: `fake: ${tool}`,
  tool,
  cmd: [tool, "--version"],
});

describe("successMessage (081M0RBXF6J087G0R0023EX9X2)", () => {
  it("never names a tool it did not run — against the real STEPS", () => {
    const message = successMessage(STEPS).toLowerCase();
    const ran = new Set(toolsRun(STEPS).map((tool) => tool.toLowerCase()));
    const announcedButNotRun = CLAIMABLE_TOOLS.filter(
      (tool) => !ran.has(tool) && message.includes(tool),
    );
    // Empty array, not `false` — a failure then prints WHICH tool was claimed.
    expect(announcedButNotRun).toEqual([]);
  });

  it("names EVERY tool it did run — a step cannot be silently dropped", () => {
    const message = successMessage(STEPS);
    expect(toolsRun(STEPS).length).toBeGreaterThan(0);
    for (const tool of toolsRun(STEPS)) expect(message).toContain(tool);
  });

  it("is a function of the step list, so a new step updates it for free", () => {
    expect(successMessage([fakeStep("tsc")])).toBe("✓ 1 check passed: tsc");
    expect(successMessage([fakeStep("tsc"), fakeStep("eslint")])).toBe(
      "✓ 2 checks passed: tsc, eslint",
    );
    expect(successMessage([fakeStep("tsc"), fakeStep("tsc")])).toBe("✓ 1 check passed: tsc");
  });

  it("refuses to call an empty step list a pass", () => {
    // Zero checks executed is the vacuity class: it must not read as green.
    expect(successMessage([])).not.toContain("✓");
    expect(successMessage([])).toContain("NOTHING RAN");
  });

  it("declares a tool the command actually invokes", () => {
    // Guards the other end: a step could otherwise declare `tool: "eslint"` and
    // shell out to something else, putting a true-looking name in the message.
    for (const step of STEPS) expect(step.cmd.join(" ")).toContain(step.tool);
  });
});
