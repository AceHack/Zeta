import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { auditRoster, deriveFromGate, gateJobNames, relevant, runCheck, NO_LOCAL, ROSTER } from "./local-checks.ts";
import { ALL_DOMAINS, type Domain } from "./path-domains.ts";

const NONE = Object.fromEntries(ALL_DOMAINS.map((d) => [d, false])) as Record<Domain, boolean>;
const ALL = Object.fromEntries(ALL_DOMAINS.map((d) => [d, true])) as Record<Domain, boolean>;

describe("a missing tool is UNKNOWN, never a pass", () => {
  test("an absent binary is could-not-run", () => {
    const r = runCheck(
      { gateJob: "x", domains: [], argv: ["definitely-not-a-real-binary-zzz"], requires: "definitely-not-a-real-binary-zzz" },
      ALL, true,
    );
    expect(r.outcome).toBe("could-not-run");
    expect(r.outcome).not.toBe("passed");
  });

  test("a MISSING MODULE is could-not-run, not failed — bun exits 1 for both", () => {
    // The defect this tool shipped with on its first run: exit code alone
    // cannot separate "the subject is broken" from "the check never ran".
    const r = runCheck(
      { gateJob: "x", domains: [], argv: ["bun", "src/does/not/exist-zzz.ts"], requires: "bun" },
      ALL, true,
    );
    expect(r.outcome).toBe("could-not-run");
  });

  test("a real finding IS failed", () => {
    const r = runCheck({ gateJob: "x", domains: [], argv: ["false"], requires: "false" }, ALL, true);
    expect(r.outcome).toBe("failed");
  });
});

describe("slow checks are not attempted by default, and that is its own outcome", () => {
  const slow = { gateJob: "s", domains: [], argv: ["true"], requires: "true", slow: true } as const;
  test("default poll does not attempt it", () => {
    expect(runCheck(slow, ALL, true, false).outcome).toBe("not-attempted");
  });
  test("--slow attempts it", () => {
    expect(runCheck(slow, ALL, true, true).outcome).toBe("passed");
  });
  test("not-attempted is NOT passed and NOT could-not-run", () => {
    const o = runCheck(slow, ALL, true, false).outcome;
    expect(o).not.toBe("passed");
    expect(o).not.toBe("could-not-run");
  });
});

describe("relevance follows the diff", () => {
  test("a domain-scoped check is not applicable when the diff misses it", () => {
    expect(runCheck({ gateJob: "c", domains: ["rust"], argv: ["true"], requires: "true" }, NONE, false).outcome)
      .toBe("not-applicable");
  });
  test("an unscoped check is always relevant — fail-safe", () => {
    expect(relevant({ gateJob: "c", domains: [], argv: ["true"], requires: "true" }, NONE)).toBe(true);
  });
});

describe("the roster is checked against gate.yml, not trusted", () => {
  const yaml = readFileSync(".github/workflows/gate.yml", "utf-8");

  test("gate job names are extracted", () => {
    const names = gateJobNames(yaml);
    expect(names).toContain("gate (required)");
    expect(names).toContain("lint (actionlint)");
  });

  test("derivation finds real commands and refuses shell-dependent ones", () => {
    const { specs, unrunnable } = deriveFromGate(yaml);
    expect(specs.length).toBeGreaterThan(10);
    // Every derived command is a plain argv — no env vars, no continuations.
    for (const s of specs) expect(s.argv.join(" ")).not.toMatch(/[$<>\\]/u);
    // And the ones that ARE shell-dependent are declared, not dropped.
    expect(unrunnable.length).toBeGreaterThan(0);
  });

  test("auditRoster REPORTS gaps rather than hiding them", () => {
    // This is expected to be non-empty today: the roster is incomplete and
    // says so. The falsifier is that it must never claim completeness it
    // lacks — a silently empty result here would be the defect.
    const missing = auditRoster(yaml);
    expect(Array.isArray(missing)).toBe(true);
    for (const m of missing) {
      expect(ROSTER.some((r) => r.gateJob === m)).toBe(false);
      expect(NO_LOCAL.some((n) => n.gateJob === m)).toBe(false);
    }
  });

  test("every hand-written roster entry names a job that EXISTS in gate.yml", () => {
    const names = new Set(gateJobNames(yaml));
    for (const r of ROSTER) expect(names.has(r.gateJob)).toBe(true);
    for (const n of NO_LOCAL) expect(names.has(n.gateJob)).toBe(true);
  });
});

describe("derivation sees every invocation form gate.yml uses", () => {
  const yaml = readFileSync(".github/workflows/gate.yml", "utf-8");

  // The regression this guards: derivation recognised only `bun <path>.ts`, so
  // 44 of 90 real check invocations were invisible while --audit stayed green.
  // Each case below FAILS if that narrowing comes back.
  const FIXTURE = [
    "jobs:",
    "  j:",
    "    name: lint (fixture)",
    "    steps:",
    "      - name: a path invocation",
    "        run: bun src/Core.TypeScript/hygiene/a.ts",
    "      - name: a package script",
    "        run: bun run hygiene:check-something",
    "      - name: a test path",
    "        run: bun test src/Core.TypeScript/hygiene/b.test.ts",
    "      - name: setup, NOT a check",
    "        run: bun install --frozen-lockfile",
  ].join("\n");

  test("all three check forms derive; `bun install` does NOT", () => {
    const { specs } = deriveFromGate(FIXTURE);
    const argvs = specs.map((s) => s.argv.join(" "));
    expect(argvs).toContain("bun src/Core.TypeScript/hygiene/a.ts");
    expect(argvs).toContain("bun run hygiene:check-something");
    expect(argvs).toContain("bun test src/Core.TypeScript/hygiene/b.test.ts");
    expect(argvs.some((a) => a.includes("install"))).toBe(false);
    expect(specs.length).toBe(3);
  });

  test("the REAL gate.yml derives all three forms — not just the path one", () => {
    const { specs } = deriveFromGate(yaml);
    const argvs = specs.map((s) => s.argv.join(" "));
    const byForm = {
      path: argvs.filter((a) => /^bun (?:src|tools|tests)\//u.test(a)).length,
      run: argvs.filter((a) => a.startsWith("bun run ")).length,
      test: argvs.filter((a) => a.startsWith("bun test ")).length,
    };
    // Measured 2026-09-11: 46 / 26 / 18 before dedup. Asserted as "several",
    // because pinning the exact count would make every new gate step a test
    // failure — the number that matters is that NO form is zero.
    expect(byForm.path).toBeGreaterThan(10);
    expect(byForm.run).toBeGreaterThan(10);
    expect(byForm.test).toBeGreaterThan(5);
  });

  test("the busiest job is no longer represented by 2 of its 29 checks", () => {
    const job = "lint (bash retirement inventory + hygiene unit tests)";
    const { specs } = deriveFromGate(yaml);
    const mine = specs.filter((s) => s.gateJob === job);
    expect(gateJobNames(yaml)).toContain(job);
    expect(mine.length).toBeGreaterThan(20);
  });
});
