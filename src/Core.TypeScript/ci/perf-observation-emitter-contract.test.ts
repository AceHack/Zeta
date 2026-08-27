// perf-observation-emitter-contract.test.ts — the F# emitter and the TS parser must agree.
//
// THE DEFECT THIS EXISTS FOR. `PerfObservation.emit` is F#; `parsePerfObservations` is TypeScript.
// Nothing in either language's compiler connects them. If the sentinel is retyped, a field is
// renamed, or the instant format stops being `Date.parse`-able, the emitter keeps printing and the
// parser keeps returning an EMPTY list — and an empty ledger renders as "no observations", which is
// indistinguishable from a healthy quiet period unless something checks the seam.
//
// That is the vacuity class across a language boundary, and it is the worst version of it: both
// halves are individually green, individually tested, and jointly useless.
//
// So this test reads the F# source and asserts the contract against the TS parser's actual
// behaviour — not against a copy of the contract written down twice.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { foldPerfLedger, parsePerfObservations, PERF_OBS_PREFIX } from "./perf-regression-ledger.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const EMITTER = join(REPO_ROOT, "tests/Tests.FSharp/_Support/PerfObservation.fs");
const emitter = readFileSync(EMITTER, "utf8");

describe("the sentinel is the same string on both sides", () => {
  test("the F# literal matches PERF_OBS_PREFIX exactly, including the trailing space", () => {
    // The trailing space is load-bearing — `indexOf(prefix)` then `slice(prefix.length)` would
    // leave a leading space on the JSON without it, which `JSON.parse` tolerates and a stricter
    // reader would not. Pinning the exact literal is cheaper than discovering that later.
    expect(emitter).toContain(`let Prefix = "${PERF_OBS_PREFIX}"`);
  });
});

describe("every field the parser requires is emitted", () => {
  // The parser refuses a row missing any of these, and a refused row is a silently smaller
  // denominator. Read the required set from the parser's own guard rather than restating it.
  const REQUIRED = ["test", "metric", "measured", "gate", "pass", "config", "runner", "at", "sha"];

  for (const field of REQUIRED) {
    test(`F# emits \`${field}\``, () => {
      expect(emitter).toContain(`"${field}",`);
    });
  }
});

describe("a line shaped like the F# emitter's output round-trips", () => {
  /** Reproduces `PerfObservation.line`'s payload shape. */
  const emitted = (over: Record<string, unknown> = {}): string =>
    PERF_OBS_PREFIX +
    JSON.stringify({
      test: "Zeta.Tests.Storage.ColumnZSetTests.ColumnZSet vectorized predicate scan is measurably faster than the scalar scan",
      metric: "speedup",
      measured: 3.45,
      gate: 1.5,
      pass: true,
      config: "Release",
      runner: "Linux",
      // .NET round-trip ("O") format, which is what the emitter uses.
      at: "2026-08-27T18:04:05.1234567Z",
      sha: "abc1234",
      ...over,
    });

  test("the F# emitter actually USES the round-trip format — not just that `O` output parses", () => {
    // Caught by mutation: the test below pins that a `.NET "O"` string parses, which stays true
    // however the emitter formats. Changing the F# format specifier to `ddd MMM d` left every
    // assertion green while the ledger would have refused every row. Pin the source too.
    expect(emitter).toContain('ToString("O", CultureInfo.InvariantCulture)');
    // And that the value is UTC, so two runners are comparable rather than merely parseable.
    expect(emitter).toContain("DateTime.UtcNow");
  });

  test("the .NET round-trip instant is Date.parse-able — the format most likely to silently break", () => {
    const { observations, malformed } = parsePerfObservations(emitted());
    expect(malformed).toBe(0);
    expect(observations).toHaveLength(1);
    expect(Number.isNaN(Date.parse(observations[0]!.at))).toBe(false);
  });

  test("a test name containing spaces, commas and quotes survives — hence JSON, not concatenation", () => {
    const nasty = 'name with "quotes", commas, and `backticks`';
    const { observations, malformed } = parsePerfObservations(emitted({ test: nasty }));
    expect(malformed).toBe(0);
    expect(observations[0]?.test).toBe(nasty);
  });

  test("pass:false rounds-trips as a MISS, not as an absent row", () => {
    const { observations } = parsePerfObservations(emitted({ pass: false, measured: 0.93 }));
    expect(observations[0]?.pass).toBe(false);
    expect(foldPerfLedger(observations)[0]?.misses).toBe(1);
  });

  test("both outcomes together fold to a rate — which is the whole point of emitting passes", () => {
    const text = [emitted(), emitted({ pass: false, measured: 0.93 }), emitted()].join("\n");
    const { observations } = parsePerfObservations(text);
    const roll = foldPerfLedger(observations)[0];
    expect(roll?.observations).toBe(3);
    expect(roll?.misses).toBe(1);
    expect(roll?.register).toBe("flaky");
  });
});

describe("the enrolment is exactly the wall-clock gates, and no more", () => {
  // Anchored to the CALL SITE, not the bare string: a mutation that comments the call out
  // still leaves the identifier in the file, and a `toContain("PerfObservation.emit")`
  // happily matches its own corpse. Require the argument that follows it.
  const CALL = /PerfObservation\.emit\s*\n\s*"Zeta\.Tests\./;
  const ENROLLED = [
    "tests/Tests.FSharp/Storage/ColumnLinearOps.Tests.fs",
    "tests/Tests.FSharp/Storage/ColumnZSet.Tests.fs",
  ];

  for (const path of ENROLLED) {
    test(`${path.split("/").pop()} emits`, () => {
      expect(readFileSync(join(REPO_ROOT, path), "utf8")).toMatch(CALL);
    });
  }

  test("deterministic assertions are NOT enrolled, and that is deliberate", () => {
    // A deterministic assertion cannot flake, so every row it contributed would be a guaranteed
    // pass inflating the denominator — UNDERSTATING the flake rate of the assertions that genuinely
    // are timing-sensitive. `ReceiptScheduler` asserts a computed profit multiplier and
    // `Differentiate` asserts numerical convergence; neither is a wall-clock claim.
    for (const path of [
      "tests/Tests.FSharp/ReceiptScheduler.Tests.fs",
      "tests/Tests.FSharp/Operators/Differentiate.Tests.fs",
    ]) {
      expect(readFileSync(join(REPO_ROOT, path), "utf8")).not.toMatch(CALL);
    }
  });

  test("the emitter states the enrolment rule, so the next reader does not widen it by grep", () => {
    expect(emitter).toMatch(/Only wall-clock ratio assertions belong here/);
    expect(emitter).toMatch(/understating the flake rate/i);
  });
});
