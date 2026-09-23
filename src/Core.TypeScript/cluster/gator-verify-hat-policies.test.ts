/**
 * Proves `gator-verify-hat-policies.ts` can go RED -- on broken policies, on thin
 * suites, and on a gator that is not the enforcing engine's version.
 *
 * Two halves:
 *
 *   1. PURE (always runs): the policy splitter, the clock placeholders, the
 *      coverage refusal and the pin check, each with a case that must fail.
 *   2. MUTATION (needs `gator` on PATH): copy the committed policies, break ONE
 *      thing, run the real runner against the copy, and require exit 1. Plus an
 *      unmutated control that must exit 0, so a runner that failed
 *      unconditionally could not satisfy the suite.
 *
 * Without gator the mutation half SKIPS -- the hermetic TS lanes do not install
 * it -- unless `ZETA_REQUIRE_GATOR=1`, which the gator CI job sets. There, an
 * absent gator is a FAILURE: a mutation suite that silently skipped in the one
 * lane built to run it would be a check that did not run reading as one that
 * passed.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HAT_POLICY_DIR, defaultRepoRoot } from "./hat-constraint-roster.ts";
import { coverageFailures, pinFailures, renderTimePlaceholders, splitPolicy } from "./gator-verify-hat-policies.ts";

const ROOT = defaultRepoRoot();
const RUNNER = join(ROOT, "src/Core.TypeScript/cluster/gator-verify-hat-policies.ts");

describe("pure checks", () => {
  test("splitPolicy separates the template from the constraint", () => {
    const text = readFileSync(join(ROOT, HAT_POLICY_DIR, "03-conflict-of-interest.yaml"), "utf8");
    const split = splitPolicy("03-conflict-of-interest", text);
    expect(split.templateName).toBe("hatconflict");
    expect(split.template).toContain("kind: ConstraintTemplate");
    expect(split.constraint).toContain("kind: HatConflict");
    expect(split.constraint).not.toContain("ConstraintTemplate");
  });

  test("splitPolicy refuses a third document rather than dropping it", () => {
    const text = readFileSync(join(ROOT, HAT_POLICY_DIR, "02-max-bindings.yaml"), "utf8");
    expect(() => splitPolicy("x", `${text}\n---\napiVersion: v1\nkind: ConfigMap\nmetadata: {name: stray}\n`)).toThrow(/1 other document/);
  });

  test("splitPolicy refuses a file with no Constraint", () => {
    expect(() => splitPolicy("x", "apiVersion: templates.gatekeeper.sh/v1\nkind: ConstraintTemplate\nmetadata: {name: t}\n")).toThrow(/0 constraint/);
  });

  test("clock placeholders render relative to the given now", () => {
    const now = Date.UTC(2026, 8, 23, 12, 0, 0);
    expect(renderTimePlaceholders('a: "{{now-60s}}" b: "{{now+600s}}"', now)).toBe('a: "2026-09-23T11:59:00Z" b: "2026-09-23T12:10:00Z"');
  });

  const deny = { assertions: [{ violations: "yes" }] };
  const admit = { assertions: [{ violations: "no" }] };
  const suite = (cases: object[]) => [{ file: "s.suite.yaml", suite: { tests: [{ name: "t", template: "_policies/p.template.yaml", cases }] } }];

  test("coverage passes with one must-violate and one must-admit case", () => {
    expect(coverageFailures(["p"], suite([deny, admit]))).toEqual([]);
  });

  test("coverage refuses a policy with only admit cases (a deny-nothing policy would pass)", () => {
    expect(coverageFailures(["p"], suite([admit])).join("\n")).toContain("no MUST-VIOLATE case");
  });

  test("coverage refuses a policy with only deny cases (a deny-everything policy would pass)", () => {
    expect(coverageFailures(["p"], suite([{ assertions: [{ violations: 2 }] }])).join("\n")).toContain("no MUST-ADMIT case");
  });

  test("coverage refuses a policy no suite tests at all", () => {
    expect(coverageFailures(["p", "q"], suite([deny, admit])).join("\n")).toContain("q: no MUST-VIOLATE case");
  });

  test("coverage refuses an empty roster", () => {
    expect(coverageFailures([], []).join("\n")).toContain("empty roster");
  });

  test("coverage refuses a suite naming a policy that does not exist", () => {
    expect(coverageFailures(["q"], suite([deny, admit])).join("\n")).toContain("not a committed policy");
  });

  const app = "spec:\n  source:\n    chart: gatekeeper\n    targetRevision: 3.23.1\n";
  const line = "gator version v3.23.1 (Feature State: beta), opa/v1.17.1";

  test("pins agree", () => {
    expect(pinFailures(app, 'gator = "3.23.1"\n', line)).toEqual([]);
  });

  test("a mise pin that disagrees with the chart is refused", () => {
    expect(pinFailures(app, 'gator = "3.22.0"\n', "gator version v3.22.0 (x)").join("\n")).toContain("!= gatekeeper chart 3.23.1");
  });

  test("a gator on PATH that is not the pinned one is refused", () => {
    expect(pinFailures(app, 'gator = "3.23.1"\n', "gator version v3.20.0 (x)").join("\n")).toContain("reports 3.20.0");
  });

  test("the committed pins agree", () => {
    const committed = pinFailures(
      readFileSync(join(ROOT, "full-ai-cluster/k8s/applications/open-policy-agent/Application.yaml"), "utf8"),
      readFileSync(join(ROOT, ".mise.full.toml"), "utf8"),
      line,
    );
    expect(committed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MUTATION HALF
// ---------------------------------------------------------------------------

const gatorPresent = spawnSync("gator", ["--version"], { encoding: "utf8" }).status === 0;
const required = process.env["ZETA_REQUIRE_GATOR"] === "1";

/** One defect planted in one policy file. `find` must occur exactly `count` times. */
interface Mutation {
  readonly name: string;
  readonly file: string;
  readonly find: string | RegExp;
  readonly replace: string;
  readonly count?: number;
}

const REVERSE_RULE = /\n {8}# THE REVERSE DIRECTION\.[\s\S]*?\n {8}\}\n/;

const MUTATIONS: readonly Mutation[] = [
  { name: "03: delete the reverse-direction rule", file: "03-conflict-of-interest.yaml", find: REVERSE_RULE, replace: "\n" },
  { name: "03: incoming rule stops matching the conflicting hat", file: "03-conflict-of-interest.yaml", find: "          existing.spec.hat == conflict_name\n", replace: "" },
  {
    name: "03: unreconciled bindings invisible again",
    file: "03-conflict-of-interest.yaml",
    find: 'object.get(existing, ["status", "phase"], "") != "Revoked"',
    replace: 'existing.status.phase != "Revoked"',
    count: 2,
  },
  { name: "02: cap off by one (>= -> >)", file: "02-max-bindings.yaml", find: "count(existing) >= input", replace: "count(existing) > input" },
  { name: "02: unreconciled bindings uncounted again", file: "02-max-bindings.yaml", find: 'object.get(b, ["status", "phase"], "") != "Revoked"', replace: 'b.status.phase != "Revoked"' },
  { name: "02: revoked bindings counted", file: "02-max-bindings.yaml", find: 'object.get(b, ["status", "phase"], "") != "Revoked"', replace: "true" },
  { name: "01: cooldown comparison inverted", file: "01-cooldown.yaml", find: "delta_s < input.parameters.cooldownSeconds", replace: "delta_s > input.parameters.cooldownSeconds" },
  { name: "01: wearer match dropped", file: "01-cooldown.yaml", find: "          swap.spec.previousWearer.spiffeID == wearer\n", replace: "" },
  { name: "01: event filter dropped", file: "01-cooldown.yaml", find: '          swap.spec.event == "SwapOff"\n', replace: "" },
  {
    name: "04: omitted cosignedBy bypasses quorum again",
    file: "04-quorum.yaml",
    find: 'count(object.get(input.review.object.spec, "cosignedBy", []))',
    replace: "count(input.review.object.spec.cosignedBy)",
  },
  { name: "04: quorum off by one (< -> <=)", file: "04-quorum.yaml", find: "signed < required", replace: "signed <= required" },
  { name: "05: warmup window inverted", file: "05-warmup.yaml", find: "now < ends", replace: "now > ends" },
  { name: "05: transition source unchecked", file: "05-warmup.yaml", find: '          input.review.oldObject.status.phase == "Warmup"\n', replace: "" },
  { name: "06: 24h window inverted", file: "06-max-new-hats.yaml", find: "(now - created) < window", replace: "(now - created) > window" },
  { name: "06: cap off by one (>= -> >)", file: "06-max-new-hats.yaml", find: "count(recent) >= input", replace: "count(recent) > input" },
  {
    name: "07: empty Hat inventory fails open again",
    file: "07-no-supervisor-cycles.yaml",
    find: "          existing := hat_catalog\n",
    replace: '          existing := data.inventory.cluster["society.zeta.io/v1alpha1"]["Hat"]\n',
  },
  { name: "07: only direct edges checked (no transitive reachability)", file: "07-no-supervisor-cycles.yaml", find: "graph.reachable(edges(catalog), {sup})[name]", replace: "edges(catalog)[sup][name]" },
];

function runAgainst(policiesDir: string): { status: number | null; out: string } {
  const r = spawnSync("bun", [RUNNER, "--policies", policiesDir], { encoding: "utf8" });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
}

function withPolicyCopy<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "gator-mutant-"));
  try {
    cpSync(join(ROOT, HAT_POLICY_DIR), dir, { recursive: true });
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!gatorPresent && !required)("mutation: the real gator run goes red on a broken policy", () => {
  test("gator is present when the lane requires it", () => {
    expect(gatorPresent).toBe(true);
  });

  test("CONTROL: the unmutated policies pass", () => {
    const r = withPolicyCopy((dir) => runAgainst(dir));
    expect(r.status).toBe(0);
  }, 60_000);

  for (const m of MUTATIONS) {
    test(`RED: ${m.name}`, () => {
      const r = withPolicyCopy((dir) => {
        const path = join(dir, m.file);
        const text = readFileSync(path, "utf8");
        const hits = typeof m.find === "string" ? text.split(m.find).length - 1 : (text.match(new RegExp(m.find.source, "g")) ?? []).length;
        // A mutation that matches nothing mutates nothing, and "the suite went red"
        // would then be about something else -- so the plant itself is asserted.
        expect(hits).toBe(m.count ?? 1);
        const mutated = typeof m.find === "string" ? text.split(m.find).join(m.replace) : text.replace(m.find, m.replace);
        expect(mutated).not.toBe(text);
        writeFileSync(path, mutated);
        return runAgainst(dir);
      });
      expect(r.status).toBe(1);
      expect(r.out).toContain("FAIL");
    }, 60_000);
  }
});
