import { describe, expect, it } from "bun:test";
import { EXPERIMENT, scan, strippedLines, usesForceEvaluate } from "./lint-nuget-force-evaluate-is-confined.ts";

describe("strippedLines — prose about the flag is not use of the flag", () => {
  // The repo's own workflow header EXPLAINS `--force-evaluate` in a comment. A checker
  // matching the identifier rather than the invocation reports its own documentation as a
  // violation — the failure this repo has already been bitten by.
  it("drops a commented mention", () => {
    expect(usesForceEvaluate("#   `--force-evaluate`   A plain restore is a no-op\n")).toBe(0);
  });

  it("keeps a real invocation", () => {
    expect(usesForceEvaluate("        run: dotnet restore Zeta.sln --force-evaluate\n")).toBe(1);
  });

  it("keeps code on a line that also carries a trailing comment", () => {
    expect(usesForceEvaluate("  run: dotnet restore x --force-evaluate # deliberate\n")).toBe(1);
  });

  it("drops blank and comment-only lines", () => {
    expect(strippedLines("\n  # hi\n  run: x\n")).toEqual(["  run: x"]);
  });
});

describe("scan — the exception's scope", () => {
  const use = "  run: dotnet restore x --force-evaluate\n";

  it("passes when the flag lives only in the experiment", () => {
    const r = scan([{ name: EXPERIMENT, text: use }, { name: "other.yml", text: "run: dotnet restore x\n" }]);
    expect(r.experimentSites).toBe(1);
    expect(r.strays).toEqual([]);
  });

  // The regression the dismissal actually rides on: a production path adopting the flag.
  it("FAILS when any other workflow adopts --force-evaluate", () => {
    const r = scan([{ name: EXPERIMENT, text: use }, { name: "low-memory.yml", text: use }]);
    expect(r.strays.length).toBe(1);
    expect(r.strays[0]).toContain("low-memory.yml");
  });

  // If the experiment stops using it, the alerts are STALE rather than dismissed-with-premise.
  // Reporting "ok" there would be a check passing by finding nothing.
  it("FAILS when the experiment no longer uses the flag", () => {
    expect(scan([{ name: EXPERIMENT, text: "run: dotnet restore x\n" }]).experimentSites).toBe(0);
  });

  it("counts every site, not just the first", () => {
    expect(scan([{ name: EXPERIMENT, text: use + use }]).experimentSites).toBe(2);
  });
});

describe("a step NAME is documentation, not an invocation", () => {
  // The regression that actually happened: wiring this checker into gate.yml added a step
  // named "--force-evaluate stays confined to the lock experiment", and the checker flagged
  // its own step. A guard that greps source must match the CALL, not the identifier.
  it("ignores the flag appearing in a step name", () => {
    expect(usesForceEvaluate('      - name: --force-evaluate stays confined to the lock experiment\n')).toBe(0);
    expect(usesForceEvaluate('        name: --force-evaluate confinement\n')).toBe(0);
  });

  it("still counts the invocation on the very next line", () => {
    const y = "      - name: --force-evaluate confinement\n        run: dotnet restore x --force-evaluate\n";
    expect(usesForceEvaluate(y)).toBe(1);
  });
});
