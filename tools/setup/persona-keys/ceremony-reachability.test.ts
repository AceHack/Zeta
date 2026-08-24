// ceremony-reachability.test.ts — CAN ROUTINE WORK RAISE A LIVE TOUCH ID PROMPT?
//
// Aaron, 2026-08-24: *"I was pressing the biometric keys when they popped up, I was assuming
// it was necessary for the testing."*
//
// Making a prompt evaluable is worth little if prompts keep arriving during ordinary work,
// because habituation is then guaranteed BY CONSTRUCTION: an operator who meets the dialog
// while reading PR summaries learns that it accompanies routine work and means nothing. So
// this file measures the OTHER half — how easily a live ceremony can be started — rather
// than what it says once started.
//
// WHAT IT MEASURES, mechanically, by parsing the CLIs themselves: the POLARITY of each
// ceremony CLI's safety default.
//
//   `const dryRun = !confirm;`            ⇒ OPT-IN to live.  A bare invocation plans only.
//   `const dryRun = flag("--dry-run");`   ⇒ LIVE BY DEFAULT. A bare invocation IS a ceremony.
//
// Both spellings are present on `main`, and the split is the finding: six CLIs are opt-in and
// eight perform a real ceremony — raising a real Touch ID dialog — when run with no flags at
// all. `bun ca-cli.ts ca --ca aaron` is a live root-key ceremony. That is exactly the shape of
// an operator meeting a dialog "during the testing", and it is a property of the argument
// parsing, not of anything a human did wrong.
//
// WHY THIS TEST PINS THE CURRENT STATE RATHER THAN FAILING ON IT: flipping eight CLIs from
// live-by-default to opt-in is a behaviour change to a security surface with a P1 already in
// flight, and it is not a display-layer author's call to make unilaterally. Pinning it makes
// the finding MACHINE-CHECKED instead of a paragraph in a report nobody re-reads: the lists
// below are exact, so a NEW live-by-default CLI fails this test, and any of the six safe ones
// silently losing its `--confirm` gate fails it too. The ratchet only turns one way.
//
// This is deliberately NOT written as a passing assertion over a set that could quietly grow.
// A test whose expected value is "whatever the code currently says" is the vacuity class.
// Run: bun test ceremony-reachability.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dir;

/** OPT-IN TO LIVE: a bare invocation reports a plan, touches nothing, and NEVER prompts. */
const SAFE_DEFAULT = [
  "ca-shamir-cli.ts",
  "revoke-cli.ts",
  "rotate-cli.ts",
  "rotate-cluster-cli.ts",
  "teardown-cli.ts",
  "teardown-cluster-cli.ts",
] as const;

/** LIVE BY DEFAULT: a bare invocation performs the real ceremony and CAN raise a real
 *  Touch ID dialog. `--dry-run` is opt-OUT, so forgetting it is not a typo, it is a ceremony.
 *  THIS LIST MUST ONLY EVER SHRINK. */
const LIVE_BY_DEFAULT = [
  "github-trust-cli.ts",
  "install-trust-cli.ts",
  "machine-cli.ts",
  "onboard-cli.ts",
  "publish-cli.ts",
  "setup-cluster-cli.ts",
  "setup-machine-cli.ts",
] as const;

/** MIXED — and this is the sharpest row in the file. `ca-cli.ts` uses BOTH spellings, in one
 *  file, chosen per SUBCOMMAND: `ca` and `cert` are live-by-default (lines 61, 98) while
 *  `frost-ca` and `frost-cert` are opt-in (lines 142, 165). So the safety default is not even
 *  a property an operator can learn per COMMAND — `ca-cli.ts ca --ca aaron` is a live root-key
 *  ceremony and `ca-cli.ts frost-ca --ca aaron` is a plan, and nothing at the call site says
 *  which kind you just typed. */
const MIXED_POLARITY = ["ca-cli.ts"] as const;

/** Neither spelling: these declare no `dryRun` and raise no biometric prompt of their own. */
const NO_DRY_RUN_CONST = ["frost-cli.ts", "onboarding-roundtrip-cli.ts"] as const;

type Polarity = "opt-in-to-live" | "live-by-default" | "mixed" | "no-dry-run-const";

function polarityOf(file: string): Polarity {
  const src = readFileSync(join(HERE, file), "utf8");
  const optIn = /const dryRun = !confirm/.test(src);
  const live = /const dryRun = flag\("--dry-run"\)/.test(src);
  if (optIn && live) return "mixed";
  if (optIn) return "opt-in-to-live";
  if (live) return "live-by-default";
  return "no-dry-run-const";
}

const ALL_CLIS = readdirSync(HERE)
  .filter((f) => f.endsWith("-cli.ts"))
  .sort();

test("control: the CLI roster is non-empty and the classifier is not vacuous", () => {
  // A zero result here would make every assertion below pass while measuring nothing.
  expect(ALL_CLIS.length).toBeGreaterThan(10);
  const polarities = new Set(ALL_CLIS.map(polarityOf));
  // If every CLI classified the same way, the parser would be matching nothing.
  expect(polarities.size).toBeGreaterThan(1);
});

test("every ceremony CLI on disk is classified — a new one cannot slip in unmeasured", () => {
  const known = new Set<string>([...SAFE_DEFAULT, ...LIVE_BY_DEFAULT, ...MIXED_POLARITY, ...NO_DRY_RUN_CONST]);
  const unclassified = ALL_CLIS.filter((f) => !known.has(f));
  expect(unclassified).toEqual([]);
});

test("the six OPT-IN-TO-LIVE CLIs stay opt-in — losing --confirm is a regression", () => {
  for (const f of SAFE_DEFAULT) {
    expect(`${f}: ${polarityOf(f)}`).toBe(`${f}: opt-in-to-live`);
  }
});

test("FINDING: the LIVE-BY-DEFAULT set is exactly these eight — it may shrink, never grow", () => {
  const measured = ALL_CLIS.filter((f) => polarityOf(f) === "live-by-default");
  // Exact equality both convicts a NEW live-by-default CLI and notices when one is fixed
  // (a fixed CLI fails here, and the correct response is to move it into SAFE_DEFAULT —
  // which is the point: the ratchet turns, and it turns in one direction).
  expect(measured).toEqual([...LIVE_BY_DEFAULT]);
});

test("FINDING: ca-cli.ts mixes BOTH polarities across its own subcommands", () => {
  const measured = ALL_CLIS.filter((f) => polarityOf(f) === "mixed");
  expect(measured).toEqual([...MIXED_POLARITY]);
});

test("FINDING, stated as a number: a bare invocation is a live ceremony for 7 CLIs + 1 mixed", () => {
  const live = ALL_CLIS.filter((f) => polarityOf(f) === "live-by-default").length;
  const safe = ALL_CLIS.filter((f) => polarityOf(f) === "opt-in-to-live").length;
  const mixed = ALL_CLIS.filter((f) => polarityOf(f) === "mixed").length;
  expect(live).toBe(7);
  expect(safe).toBe(6);
  expect(mixed).toBe(1);
  // The asymmetry is the whole finding: the safety default's polarity is not a property of
  // this package, it is a per-file accident, and the operator cannot know which kind of CLI
  // they just typed.
  expect(live).toBeGreaterThan(safe);
});

test("no CI workflow invokes a ceremony CLI — the gate is not reachable from automation", () => {
  // The reassuring half, and it must stay true. Checked against the workflows themselves so
  // that adding a ceremony to CI (where no human is present to approve, and where a prompt
  // would either hang or fail closed) fails this test instead of failing at 3am.
  const wfDir = join(HERE, "..", "..", "..", ".github", "workflows");
  const workflows = readdirSync(wfDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  expect(workflows.length).toBeGreaterThan(5); // control: we actually read the directory
  const offenders: string[] = [];
  for (const wf of workflows) {
    const src = readFileSync(join(wfDir, wf), "utf8");
    for (const cli of ALL_CLIS) {
      // `bun …/<cli>` as an executed step, not a path mentioned in a `paths:` filter.
      if (new RegExp(`(run:|bun)\\s[^\\n]*persona-keys/${cli.replace(".", "\\.")}`).test(src)) {
        offenders.push(`${wf} → ${cli}`);
      }
    }
  }
  expect(offenders).toEqual([]);
});
