// Tests for the CS9057 guard's pure logic (version compare + pin parse + offender detection).
// The dotnet-invoking `main` is not unit-tested here; its behaviour is exercised end-to-end in CI
// (gate.yml runs the script against the real SDK).

import { test, expect } from "bun:test";
import { parseVersion, cmp, parseCodeAnalysisPins, offenders, show } from "./audit-codeanalysis-sdk-match.ts";

test("parseVersion tolerates Roslyn pre-release suffixes", () => {
  expect(parseVersion("5.3.0-2.26219.105")).toEqual({ major: 5, minor: 3, patch: 0 });
  expect(parseVersion("5.6.0")).toEqual({ major: 5, minor: 6, patch: 0 });
  expect(parseVersion("not-a-version")).toBeNull();
});

test("cmp orders by major, then minor, then patch", () => {
  expect(cmp(parseVersion("5.6.0")!, parseVersion("5.3.0")!)).toBeGreaterThan(0);
  expect(cmp(parseVersion("5.3.0")!, parseVersion("5.3.0")!)).toBe(0);
  expect(cmp(parseVersion("5.3.1")!, parseVersion("5.3.0")!)).toBeGreaterThan(0);
  expect(cmp(parseVersion("4.14.0")!, parseVersion("5.3.0")!)).toBeLessThan(0);
});

const PROPS = `
  <ItemGroup>
    <PackageVersion Include="Microsoft.CodeAnalysis.CSharp" Version="5.3.0" />
    <PackageVersion Include="Microsoft.CodeAnalysis.Analyzers" Version="5.3.0" />
    <PackageVersion Include="FSharp.Core" Version="10.1.302" />
  </ItemGroup>`;

test("parseCodeAnalysisPins finds only the CodeAnalysis pins", () => {
  const pins = parseCodeAnalysisPins(PROPS);
  expect(pins.map((p) => p.name)).toEqual(["Microsoft.CodeAnalysis.CSharp", "Microsoft.CodeAnalysis.Analyzers"]);
  expect(pins.every((p) => show(p.version) === "5.3.0")).toBe(true);
});

test("offenders: 5.3.0 pins are fine under a 5.3.0 SDK Roslyn", () => {
  const roslyn = parseVersion("5.3.0")!;
  expect(offenders(roslyn, parseCodeAnalysisPins(PROPS))).toHaveLength(0);
});

test("offenders: the #9774 regression (5.6.0 pin under 5.3.0 Roslyn) is caught", () => {
  const roslyn = parseVersion("5.3.0")!;
  const bumped = PROPS.replace('CodeAnalysis.CSharp" Version="5.3.0"', 'CodeAnalysis.CSharp" Version="5.6.0"');
  const bad = offenders(roslyn, parseCodeAnalysisPins(bumped));
  expect(bad.length).toBe(1);
  expect(bad[0].raw).toBe("5.6.0");
});
