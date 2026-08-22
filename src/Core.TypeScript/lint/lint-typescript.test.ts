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
import { missingInstalledDeps, packageBaseName } from "./lint-typescript.ts";

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

  it("deduplicates and sorts across many diagnostics", () => {
    const out = [tsc2307("playwright"), tsc2307("playwright"), tsc2307("@scope/pkg")].join("\n");
    expect(missingInstalledDeps(out, declared, nothingInstalled)).toEqual([
      "@scope/pkg",
      "playwright",
    ]);
  });
});
