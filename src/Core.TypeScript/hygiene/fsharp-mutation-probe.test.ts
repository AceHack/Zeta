import { describe, expect, test } from "bun:test";
import { xunitFilterArgs } from "./fsharp-mutation-probe.ts";

// The probe's verdicts are only as good as the selection they run against. Under
// Microsoft.Testing.Platform a VSTest filter string is not understood, so the translation is
// pinned here: a widened selection hides survivors, an empty one fails the baseline.
describe("xunitFilterArgs — the probe's filter under Microsoft.Testing.Platform", () => {
  test("an xUnit method pattern passes through as --filter-method", () => {
    expect(xunitFilterArgs("*TlcRunner*")).toEqual(["--filter-method", "*TlcRunner*"]);
  });

  test("the legacy VSTest contains-form FullyQualifiedName~X becomes *X*", () => {
    expect(xunitFilterArgs("FullyQualifiedName~FormalVerificationTests")).toEqual([
      "--filter-method",
      "*FormalVerificationTests*",
    ]);
  });

  test("any other VSTest expression is REFUSED, never guessed at", () => {
    expect(() => xunitFilterArgs("FullyQualifiedName=Zeta.Tests.X")).toThrow(/unsupported filter/);
    expect(() => xunitFilterArgs("Category=Slow|Category=Fast")).toThrow(/unsupported filter/);
    expect(() => xunitFilterArgs("FullyQualifiedName~A|FullyQualifiedName~B")).toThrow(/unsupported filter/);
  });
});
